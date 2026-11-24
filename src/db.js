// SQLite del sitio. Un solo archivo, WAL.
// Las tablas de contenido las edita Fernando desde /admin; la de ciudades la
// llena scripts/importar-ciudades.mjs y no se toca a mano.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

let db = null;

export function getDb() {
  if (!db) throw new Error("La base no está inicializada: llamá initDb() primero.");
  return db;
}

export function initDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  crearEsquema(db);
  migrar(db);
  return db;
}

/** Columnas que se agregaron después de crear la tabla: ALTER solo si faltan. */
function sumarColumnas(d, tabla, columnas) {
  const hay = new Set(d.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name));
  for (const [nombre, tipo] of columnas) {
    if (!hay.has(nombre)) d.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
  }
}

// Migraciones idempotentes: corren en cada arranque y no hacen nada si ya están.
function migrar(d) {
  // Columnas de la suscripción con consentimiento (ya sin uso: la web no guarda
  // datos de los visitantes). Se dejan para no tocar bases existentes.
  sumarColumnas(d, "suscriptores", [
    ["consentimiento_at", "INTEGER"],
    ["consentimiento_version", "TEXT"],
    ["pagina", "TEXT"],
  ]);
}

function crearEsquema(d) {
  d.exec(`
    -- Ciudades para el geocodificador. Viene de GeoNames y trae la zona horaria
    -- IANA de cada lugar, que es lo que después resuelve el huso HISTÓRICO.
    CREATE TABLE IF NOT EXISTS ciudades (
      id           INTEGER PRIMARY KEY,
      nombre       TEXT NOT NULL,
      nombre_norm  TEXT NOT NULL,
      pais         TEXT NOT NULL,
      admin1       TEXT,
      lat          REAL NOT NULL,
      lon          REAL NOT NULL,
      tz           TEXT NOT NULL,
      poblacion    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ix_ciudades_norm ON ciudades(nombre_norm, poblacion DESC);

    -- Nombres alternativos. Existen porque el sitio está en castellano y nadie
    -- escribe "London": escribe "Londres". Sin esto, buscar Londres devolvía
    -- Londres de Catamarca y la capital del Reino Unido no aparecía nunca.
    CREATE TABLE IF NOT EXISTS ciudad_alias (
      ciudad_id   INTEGER NOT NULL REFERENCES ciudades(id) ON DELETE CASCADE,
      alias_norm  TEXT NOT NULL,
      PRIMARY KEY (alias_norm, ciudad_id)
    ) WITHOUT ROWID;

    -- Índice de PALABRAS del nombre. Sin esto, buscar por una parte del nombre
    -- ("del plata") obligaba a recorrer las 184.000 ciudades en cada tecla:
    -- 69 ms por búsqueda. Con el índice, el candidato sale por prefijo de
    -- palabra —que sí usa índice— y la subcadena se filtra sobre ese puñado.
    CREATE TABLE IF NOT EXISTS ciudad_palabra (
      palabra    TEXT NOT NULL,
      ciudad_id  INTEGER NOT NULL REFERENCES ciudades(id) ON DELETE CASCADE,
      PRIMARY KEY (palabra, ciudad_id)
    ) WITHOUT ROWID;

    -- Notas de la revista. Tres carriles fijos: trabajo, grupos, ciclos.
    CREATE TABLE IF NOT EXISTS notas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      handle        TEXT NOT NULL UNIQUE,
      titulo        TEXT NOT NULL,
      bajada        TEXT NOT NULL DEFAULT '',
      carril        TEXT NOT NULL DEFAULT 'trabajo',
      cuerpo        TEXT NOT NULL DEFAULT '',
      portada_url   TEXT,
      minutos       INTEGER NOT NULL DEFAULT 0,
      publicada     INTEGER NOT NULL DEFAULT 0,
      destacada     INTEGER NOT NULL DEFAULT 0,
      publicada_at  INTEGER,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_notas_pub ON notas(publicada, publicada_at DESC);

    -- Páginas de contenido: las cuatro puertas, el recorrido, ayuda, legales.
    CREATE TABLE IF NOT EXISTS paginas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      handle      TEXT NOT NULL UNIQUE,
      titulo      TEXT NOT NULL,
      bajada      TEXT NOT NULL DEFAULT '',
      cuerpo      TEXT NOT NULL DEFAULT '',
      publicada   INTEGER NOT NULL DEFAULT 1,
      orden       INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    -- Consultas resueltas: el bloque 07 de la portada. Tres pasos por caso.
    CREATE TABLE IF NOT EXISTS casos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      etiqueta    TEXT NOT NULL DEFAULT '',
      quien       TEXT NOT NULL DEFAULT '',
      traia       TEXT NOT NULL DEFAULT '',
      mostro      TEXT NOT NULL DEFAULT '',
      mostro_tit  TEXT NOT NULL DEFAULT 'Qué mostró la carta',
      decidio     TEXT NOT NULL DEFAULT '',
      orden       INTEGER NOT NULL DEFAULT 0,
      publicado   INTEGER NOT NULL DEFAULT 1
    );

    -- Próximas fechas: los encuentros de Fernando, distintos del calendario del cielo.
    CREATE TABLE IF NOT EXISTS fechas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      cuando      INTEGER NOT NULL,
      titulo      TEXT NOT NULL,
      detalle     TEXT NOT NULL DEFAULT '',
      tipo        TEXT NOT NULL DEFAULT 'abierto',
      url         TEXT,
      sin_cupo    INTEGER NOT NULL DEFAULT 0,
      publicada   INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS ix_fechas ON fechas(publicada, cuando);

    CREATE TABLE IF NOT EXISTS preguntas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      pregunta    TEXT NOT NULL,
      respuesta   TEXT NOT NULL,
      orden       INTEGER NOT NULL DEFAULT 0,
      en_portada  INTEGER NOT NULL DEFAULT 1,
      publicada   INTEGER NOT NULL DEFAULT 1
    );

    -- Newsletter. La ETIQUETA DE ORIGEN es lo que después permite segmentar:
    -- quién llegó por la calculadora, quién por la revista (brief, sección 08).
    CREATE TABLE IF NOT EXISTS suscriptores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT NOT NULL UNIQUE,
      email_norm   TEXT NOT NULL,
      nombre       TEXT NOT NULL DEFAULT '',
      origen       TEXT NOT NULL DEFAULT 'sitio',
      confirmado   INTEGER NOT NULL DEFAULT 0,
      token        TEXT,
      baja_at      INTEGER,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_susc_norm ON suscriptores(email_norm);

    CREATE TABLE IF NOT EXISTS ajustes (
      clave   TEXT PRIMARY KEY,
      valor   TEXT NOT NULL
    );

    -- Sesiones del panel de Fernando. Cookie propia, nada de terceros.
    CREATE TABLE IF NOT EXISTS sesiones (
      token       TEXT PRIMARY KEY,
      creada_at   INTEGER NOT NULL,
      expira_at   INTEGER NOT NULL,
      ip          TEXT
    );
  `);
}

// --- Ajustes ---------------------------------------------------------------
export function getAjuste(clave, def = null) {
  const r = getDb().prepare("SELECT valor FROM ajustes WHERE clave = ?").get(clave);
  if (!r) return def;
  try { return JSON.parse(r.valor); } catch { return r.valor; }
}

export function setAjuste(clave, valor) {
  getDb().prepare(`INSERT INTO ajustes (clave, valor) VALUES (?, ?)
                   ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`)
    .run(clave, JSON.stringify(valor));
}

// --- Suscripción -----------------------------------------------------------
// La web no junta datos de los visitantes (Fernando, 24/11/2026): no hay alta
// de suscripción. La tabla `suscriptores` y sus columnas quedan como están (el
// panel la sigue mostrando, vacía); no se borra nada.

// --- Revista ---------------------------------------------------------------
export function listarNotas({ carril = null, limite = 20, incluirBorradores = false } = {}) {
  const cond = [], args = [];
  if (!incluirBorradores) cond.push("publicada = 1");
  if (carril) { cond.push("carril = ?"); args.push(carril); }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  return getDb().prepare(
    `SELECT * FROM notas ${where} ORDER BY destacada DESC, COALESCE(publicada_at, created_at) DESC LIMIT ?`,
  ).all(...args, limite);
}

export const notaPorHandle = (handle) =>
  getDb().prepare("SELECT * FROM notas WHERE handle = ?").get(handle) || null;

export const paginaPorHandle = (handle) =>
  getDb().prepare("SELECT * FROM paginas WHERE handle = ? AND publicada = 1").get(handle) || null;

export const listarCasos = () =>
  getDb().prepare("SELECT * FROM casos WHERE publicado = 1 ORDER BY orden, id").all();

export const listarPreguntas = ({ soloPortada = false } = {}) =>
  getDb().prepare(`SELECT * FROM preguntas WHERE publicada = 1 ${soloPortada ? "AND en_portada = 1" : ""}
                   ORDER BY orden, id`).all();

/** Las fechas que todavía no pasaron. Una sin cupo se muestra apagada, no se esconde. */
export const listarFechas = (limite = 6) =>
  getDb().prepare("SELECT * FROM fechas WHERE publicada = 1 AND cuando >= ? ORDER BY cuando LIMIT ?")
    .all(Date.now() - 12 * 3600 * 1000, limite);

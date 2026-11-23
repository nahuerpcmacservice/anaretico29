// Carga el geocodificador desde GeoNames. Se corre una vez (y de nuevo cuando
// se quiera actualizar el padrón). Sin --apply no escribe nada.
//
//   node scripts/importar-ciudades.mjs --apply
//
// Trae dos padrones y los une:
//   · cities1000  — todo el mundo con más de 1000 habitantes (~171.000)
//   · AR          — TODOS los lugares poblados de la Argentina, incluidos los
//                   pueblos chicos, porque es donde nació la mayoría de los que
//                   van a usar la calculadora.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { initDb, getDb } from "../src/db.js";
import { normalizar } from "../src/lib/geo.js";
import { config, RAIZ } from "../src/config.js";

const APLICAR = process.argv.includes("--apply");
const DIR = path.join(RAIZ, "data", "geonames");
const BASE = "https://download.geonames.org/export/dump";

const FUENTES = [
  { zip: "cities1000.zip", txt: "cities1000.txt", filtro: () => true },
  // De la Argentina entra sólo la clase P (lugares poblados): el archivo del
  // país trae también cerros, arroyos y estancias, que no son un lugar de
  // nacimiento y ensuciarían el autocompletado.
  { zip: "AR.zip", txt: "AR.txt", filtro: (f) => f[6] === "P" },
];

function bajar(zip) {
  const destino = path.join(DIR, zip);
  if (fs.existsSync(destino)) { console.log(`  ${zip} ya está bajado`); return destino; }
  console.log(`  bajando ${zip}…`);
  execFileSync("curl", ["-sSL", "--fail", "-o", destino, `${BASE}/${zip}`], { stdio: "inherit" });
  return destino;
}

function admin1Nombres() {
  const archivo = path.join(DIR, "admin1CodesASCII.txt");
  if (!fs.existsSync(archivo)) {
    execFileSync("curl", ["-sSL", "--fail", "-o", archivo, `${BASE}/admin1CodesASCII.txt`], { stdio: "inherit" });
  }
  const mapa = new Map();
  for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
    const [codigo, nombre] = linea.split("\t");
    if (codigo && nombre) mapa.set(codigo, nombre);
  }
  return mapa;
}

fs.mkdirSync(DIR, { recursive: true });
console.log(`Base: ${config.dbPath}`);
initDb();
const db = getDb();

const admin1 = admin1Nombres();
const filas = new Map(); // por geonameid: el archivo del país pisa al mundial

for (const fuente of FUENTES) {
  const zip = bajar(fuente.zip);
  const txt = path.join(DIR, fuente.txt);
  if (!fs.existsSync(txt)) execFileSync("unzip", ["-o", "-q", zip, fuente.txt, "-d", DIR], { stdio: "inherit" });
  let n = 0;
  for (const linea of fs.readFileSync(txt, "utf8").split("\n")) {
    if (!linea) continue;
    const f = linea.split("\t");
    if (f.length < 19 || !fuente.filtro(f)) continue;
    const pais = f[8];
    const clave = `${pais}.${f[10]}`;
    filas.set(Number(f[0]), {
      id: Number(f[0]), nombre: f[1], nombre_norm: normalizar(f[1]),
      pais, admin1: admin1.get(clave) || null,
      lat: Number(f[4]), lon: Number(f[5]), tz: f[17],
      poblacion: Number(f[14]) || 0,
    });
    n++;
  }
  console.log(`  ${fuente.txt}: ${n.toLocaleString("es-AR")} filas`);
}

const utiles = [...filas.values()].filter((c) => c.tz && c.nombre_norm && Number.isFinite(c.lat));
console.log(`\nTotal a cargar: ${utiles.length.toLocaleString("es-AR")} ciudades ` +
  `(${utiles.filter((c) => c.pais === "AR").length.toLocaleString("es-AR")} argentinas)`);

if (!APLICAR) {
  console.log("\nEnsayo: no se escribió nada. Corré con --apply para cargarlas.");
  process.exit(0);
}

const insertar = db.prepare(
  `INSERT INTO ciudades (id, nombre, nombre_norm, pais, admin1, lat, lon, tz, poblacion)
   VALUES (@id, @nombre, @nombre_norm, @pais, @admin1, @lat, @lon, @tz, @poblacion)
   ON CONFLICT(id) DO UPDATE SET
     nombre=excluded.nombre, nombre_norm=excluded.nombre_norm, pais=excluded.pais,
     admin1=excluded.admin1, lat=excluded.lat, lon=excluded.lon, tz=excluded.tz,
     poblacion=excluded.poblacion`,
);
db.transaction((lista) => { for (const c of lista) insertar.run(c); })(utiles);

// Alias EN CASTELLANO. Existen porque el sitio está en castellano y nadie
// escribe "London": escribe "Londres".
//
// Salen del padrón de nombres alternativos de GeoNames filtrado por idioma. La
// primera versión usaba la columna de alternos del propio cities1000, que trae
// los nombres en TODOS los idiomas más abreviaturas y códigos: con eso, buscar
// "Concordia" devolvía El Paso (Texas) —que se llamó así— antes que Concordia,
// Entre Ríos, y "tan" devolvía Anchorage por un código de tres letras. Filtrar
// por idioma no es una optimización: es la diferencia entre un alias útil y
// uno que tapa a la ciudad que la persona está buscando.
await cargarAliasCastellanos(db, new Set(utiles.map((c) => c.id)));

async function cargarAliasCastellanos(db, idsConocidos) {
  const zip = path.join(DIR, "alternateNamesV2.zip");
  const txt = path.join(DIR, "alternateNamesV2.txt");
  if (!fs.existsSync(txt)) {
    if (!fs.existsSync(zip)) {
      console.log("  bajando alternateNamesV2.zip (195 MB, una sola vez)…");
      execFileSync("curl", ["-sSL", "--fail", "-o", zip, `${BASE}/alternateNamesV2.zip`], { stdio: "inherit" });
    }
    execFileSync("unzip", ["-o", "-q", zip, "alternateNamesV2.txt", "-d", DIR], { stdio: "inherit" });
  }

  // Se lee en streaming: son ~19 millones de filas y no entran en memoria de
  // una. Sólo sobreviven las que son de una ciudad que tenemos, en castellano
  // y que no sean nombres HISTÓRICOS (los que ya no se usan son justamente los
  // que confunden: el nombre viejo de una ciudad tapa a otra que hoy se llama así).
  const { createInterface } = await import("node:readline");
  const lector = createInterface({ input: fs.createReadStream(txt), crlfDelay: Infinity });
  const alias = new Map();
  let leidas = 0;
  for await (const linea of lector) {
    leidas++;
    const f = linea.split("\t");
    if (f[2] !== "es" || f[7] === "1") continue;
    const id = Number(f[1]);
    if (!idsConocidos.has(id)) continue;
    const a = normalizar(f[3]);
    if (a.length < 3 || a.length > 40) continue;
    alias.set(`${a}\u0000${id}`, { alias_norm: a, ciudad_id: id });
  }
  console.log(`  leídas ${leidas.toLocaleString("es-AR")} filas de nombres alternativos`);

  db.prepare("DELETE FROM ciudad_alias").run();
  const ins = db.prepare("INSERT OR IGNORE INTO ciudad_alias (ciudad_id, alias_norm) VALUES (@ciudad_id, @alias_norm)");
  db.transaction((lista) => { for (const a of lista) ins.run(a); })([...alias.values()]);
  console.log(`Alias en castellano: ${alias.size.toLocaleString("es-AR")}.`);
}
console.log(`Cargadas. En la base hay ${db.prepare("SELECT COUNT(*) n FROM ciudades").get().n.toLocaleString("es-AR")}.`);

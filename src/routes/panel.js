// Panel de contenido. Fernando carga y edita todo desde acá: no hace falta
// tocar código para publicar una nota, cambiar el texto de una puerta o sumar
// una fecha.
import express from "express";
import { getDb, listarNotas } from "../db.js";
import { sanearHtml } from "../lib/sanear-html.js";
import {
  claveValida, crearSesion, cerrarSesion, ponerCookie, borrarCookie, exigirSesion, tokenDe,
} from "../lib/sesion.js";
import { enDesarrollo, setEnDesarrollo } from "../lib/portero.js";
import { config } from "../config.js";
import { escapeHtml, fmtFecha } from "../views/layout.js";
import { panel, entrarHtml, campo, area, eleccion, casilla } from "../views/panel.js";
import { CARRILES } from "../views/contenido.js";

const router = express.Router();
const db = () => getDb();

const flashDe = (req) => {
  const m = {
    guardado: { texto: "Guardado.", tipo: "ok" },
    creado: { texto: "Creado.", tipo: "ok" },
    borrado: { texto: "Borrado.", tipo: "ok" },
    handle: { texto: "Ese enlace ya está usado por otra entrada. Poné otro.", tipo: "mal" },
    faltan: { texto: "Faltan datos obligatorios.", tipo: "mal" },
    abierto: { texto: "El sitio quedó ABIERTO al público.", tipo: "ok" },
    cerrado: { texto: "El sitio quedó CERRADO: el público ve «En desarrollo».", tipo: "ok" },
  }[req.query.m];
  return m || null;
};

const bool = (v) => (v ? 1 : 0);
const txt = (v, max = 400) => String(v ?? "").trim().slice(0, max);

const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

// Freno de fuerza bruta. Es la única puerta del sitio y no hay nada delante:
// sin esto, la clave se prueba de a miles por minuto. Vive en memoria a
// propósito — se pierde al reiniciar, que es exactamente lo que hace falta si
// alguien se deja afuera a sí mismo.
const FALLOS_MAX = 8;
const ESPERA_MS = 10 * 60 * 1000;
const fallos = new Map(); // ip -> { n, hasta }

function frenado(ip) {
  const f = fallos.get(ip);
  if (!f) return 0;
  if (f.hasta && f.hasta > Date.now()) return Math.ceil((f.hasta - Date.now()) / 60000);
  if (f.hasta) fallos.delete(ip); // la espera se cumplió: se arranca de cero
  return 0;
}

function anotarFallo(ip) {
  const f = fallos.get(ip) || { n: 0, hasta: 0 };
  f.n += 1;
  if (f.n >= FALLOS_MAX) { f.hasta = Date.now() + ESPERA_MS; f.n = 0; }
  fallos.set(ip, f);
  // La tabla se limpia sola: si no, un barrido de IPs distintas la hace crecer
  // sin techo hasta comerse la memoria del proceso.
  if (fallos.size > 5000) {
    for (const [k, v] of fallos) if (!v.hasta || v.hasta < Date.now()) fallos.delete(k);
  }
}

// --- Entrar y salir --------------------------------------------------------
router.get("/panel/entrar", (req, res) => {
  if (!config.adminPassword) {
    return res.status(503).send(entrarHtml(
      "No hay clave configurada. Poné ADMIN_PASSWORD en el .env del servidor y reiniciá."));
  }
  res.send(entrarHtml(req.query.e ? "Clave incorrecta." : null, txt(req.query.volver, 200) || "/panel"));
});

router.post("/panel/entrar", (req, res) => {
  const volver = txt(req.body.volver, 200);
  const espera = frenado(req.ip);
  if (espera) {
    return res.status(429).send(entrarHtml(
      `Demasiados intentos. Probá de nuevo en ${espera} ${espera === 1 ? "minuto" : "minutos"}.`, volver));
  }
  if (!claveValida(req.body.clave)) {
    anotarFallo(req.ip);
    return res.redirect(303, `/panel/entrar?e=1&volver=${encodeURIComponent(volver || "/panel")}`);
  }
  fallos.delete(req.ip); // entró: los intentos fallidos de antes ya no cuentan
  ponerCookie(res, crearSesion(req.ip));
  // Sólo rutas internas: con la URL entera, alguien podría mandar a alguien a
  // entrar y terminar en otro sitio con la sesión recién abierta.
  res.redirect(303, volver.startsWith("/panel") ? volver : "/panel");
});

router.post("/panel/salir", (req, res) => {
  cerrarSesion(tokenDe(req));
  borrarCookie(res);
  res.redirect(303, "/panel/entrar");
});

router.use("/panel", exigirSesion);

// --- Resumen ---------------------------------------------------------------
router.get("/panel", (req, res) => {
  const n = (sql, ...a) => db().prepare(sql).get(...a).n;
  const tarjetas = [
    ["/panel/notas", "Notas publicadas", n("SELECT COUNT(*) n FROM notas WHERE publicada = 1")],
    ["/panel/notas", "Borradores", n("SELECT COUNT(*) n FROM notas WHERE publicada = 0")],
    ["/panel/casos", "Casos", n("SELECT COUNT(*) n FROM casos")],
    ["/panel/fechas", "Fechas por venir", n("SELECT COUNT(*) n FROM fechas WHERE cuando >= ?", Date.now())],
    ["/panel/suscriptores", "Suscriptores", n("SELECT COUNT(*) n FROM suscriptores WHERE baja_at IS NULL")],
  ];
  res.send(panel({
    titulo: "Resumen", activo: "/panel", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Resumen</h1></div>
      ${estadoDelSitio()}
      <div class="tarjetas">${tarjetas.map(([h, q, v]) =>
        `<a class="tarjeta" href="${h}"><span class="n">${v}</span><span class="q">${escapeHtml(q)}</span></a>`).join("")}</div>
      <h2 style="margin-bottom:12px">Últimas notas</h2>
      ${tablaNotas(listarNotas({ limite: 6, incluirBorradores: true }))}`,
  }));
});

/**
 * El estado del sitio, arriba de todo en el Resumen. Es lo primero que hay que
 * ver al entrar: mientras está cerrado, el visitante no ve NADA del sitio, y
 * eso no se puede deducir de ninguna otra pantalla.
 */
function estadoDelSitio() {
  const cerrado = enDesarrollo();
  return `<div class="estado ${cerrado ? "cerrado" : "abierto"}">
    <div>
      <span class="lab">${cerrado ? "El sitio está cerrado" : "El sitio está abierto"}</span>
      <p>${cerrado
        ? "Cualquiera que entre a la dirección ve el cartel de «En desarrollo». Vos lo ves entero porque tenés la sesión abierta."
        : "Cualquiera que entre ve el sitio completo. Los buscadores lo pueden indexar."}</p>
    </div>
    <form method="POST" action="/panel/estado">
      <input type="hidden" name="abrir" value="${cerrado ? "1" : "0"}">
      <button class="btn ${cerrado ? "btn-p" : "btn-g"}" type="submit"
        onclick="return confirm('${cerrado
          ? "El sitio queda visible para cualquiera. ¿Lo abrís?"
          : "El público va a ver el cartel de «En desarrollo». ¿Lo cerrás?"}')">${
        cerrado ? "Abrir el sitio al público" : "Volver a ponerlo en desarrollo"}</button>
    </form>
  </div>`;
}

router.post("/panel/estado", (req, res) => {
  const abrir = req.body.abrir === "1";
  setEnDesarrollo(!abrir);
  res.redirect(303, `/panel?m=${abrir ? "abierto" : "cerrado"}`);
});

// --- Revista ---------------------------------------------------------------
const tablaNotas = (notas) => !notas.length ? `<p>Todavía no hay notas.</p>` : `
  <table><thead><tr><th>Título</th><th>Carril</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
  ${notas.map((n) => `<tr>
    <td><a href="/panel/notas/${n.id}">${escapeHtml(n.titulo)}</a></td>
    <td>${escapeHtml(CARRILES[n.carril]?.corto || n.carril)}</td>
    <td><span class="pill${n.publicada ? " si" : ""}">${n.publicada ? "Publicada" : "Borrador"}</span></td>
    <td>${escapeHtml(fmtFecha(n.publicada_at || n.created_at))}</td></tr>`).join("")}
  </tbody></table>`;

router.get("/panel/notas", (req, res) => {
  res.send(panel({
    titulo: "Revista", activo: "/panel/notas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Revista</h1>
      <a class="btn btn-p" href="/panel/notas/nueva">Escribir una nota</a></div>
      ${tablaNotas(listarNotas({ limite: 200, incluirBorradores: true }))}`,
  }));
});

router.get("/panel/notas/:id", (req, res, next) => {
  const nueva = req.params.id === "nueva";
  const n = nueva ? { carril: "trabajo", publicada: 0, minutos: 0 }
                  : db().prepare("SELECT * FROM notas WHERE id = ?").get(req.params.id);
  if (!n) return next();
  res.send(panel({
    titulo: nueva ? "Nota nueva" : n.titulo, activo: "/panel/notas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>${nueva ? "Nota nueva" : "Editar nota"}</h1>
      ${!nueva && n.publicada ? `<a class="btn btn-g" href="/revista/${escapeHtml(n.handle)}" target="_blank" rel="noopener">Verla en el sitio ↗</a>` : ""}</div>
    <form class="ficha" method="POST" action="/panel/notas/${nueva ? "nueva" : n.id}">
      ${campo("titulo", "Título", n.titulo, { req: true })}
      ${campo("handle", "Enlace", n.handle, {
        ayuda: "La dirección de la nota: /revista/<b>lo-que-pongas-acá</b>. Si lo dejás vacío se arma solo del título. Cambiarlo rompe los links viejos." })}
      ${area("bajada", "Bajada", n.bajada, { chico: true, ayuda: "Una o dos líneas. Es lo que se lee en la portada y lo que sale en Google." })}
      <div class="fila">
        ${eleccion("carril", "Carril", n.carril, Object.entries(CARRILES).map(([k, v]) => [k, v.nombre]))}
        ${campo("minutos", "Minutos de lectura", n.minutos, { tipo: "number" })}
      </div>
      ${campo("portada_url", "Foto de portada (dirección)", n.portada_url || "")}
      ${area("cuerpo", "Texto", n.cuerpo, {
        ayuda: "Se escribe en HTML: &lt;p&gt; para cada párrafo, &lt;h2&gt; para los títulos, &lt;strong&gt; para negrita. Lo que no esté permitido se saca solo al guardar." })}
      <div class="fila">${casilla("publicada", "Publicada", n.publicada)}${casilla("destacada", "Destacada en la portada", n.destacada)}</div>
      <div class="acciones">
        <button class="btn btn-p" type="submit">Guardar</button>
        <a class="btn btn-g" href="/panel/notas">Volver</a>
        ${nueva ? "" : `<button class="btn btn-r" formaction="/panel/notas/${n.id}/borrar"
          onclick="return confirm('¿Borrar la nota «${escapeHtml(n.titulo).replace(/'/g, "\\'")}»? No se puede deshacer.')">Borrar</button>`}
      </div>
    </form>`,
  }));
});

router.post("/panel/notas/:id", (req, res) => {
  const nueva = req.params.id === "nueva";
  const titulo = txt(req.body.titulo, 200);
  if (!titulo) return res.redirect(303, `/panel/notas/${req.params.id}?m=faltan`);
  const handle = slug(req.body.handle) || slug(titulo);
  const publicada = bool(req.body.publicada);
  const fila = {
    titulo, handle, bajada: txt(req.body.bajada, 500),
    carril: CARRILES[req.body.carril] ? req.body.carril : "trabajo",
    cuerpo: sanearHtml(req.body.cuerpo),
    portada_url: txt(req.body.portada_url, 500) || null,
    minutos: Math.max(0, Math.min(999, Number(req.body.minutos) || 0)),
    publicada, destacada: bool(req.body.destacada), updated_at: Date.now(),
  };
  try {
    if (nueva) {
      db().prepare(`INSERT INTO notas (titulo, handle, bajada, carril, cuerpo, portada_url, minutos,
        publicada, destacada, publicada_at, created_at, updated_at)
        VALUES (@titulo,@handle,@bajada,@carril,@cuerpo,@portada_url,@minutos,@publicada,@destacada,
        @publicada_at,@created_at,@updated_at)`)
        .run({ ...fila, publicada_at: publicada ? Date.now() : null, created_at: Date.now() });
    } else {
      // La fecha de publicación se pone la PRIMERA vez que se publica y no se
      // vuelve a tocar: si no, cada corrección de una coma la manda arriba de
      // todo como si fuera nueva.
      const antes = db().prepare("SELECT publicada, publicada_at FROM notas WHERE id = ?").get(req.params.id);
      const publicada_at = publicada ? (antes?.publicada_at || Date.now()) : antes?.publicada_at || null;
      db().prepare(`UPDATE notas SET titulo=@titulo, handle=@handle, bajada=@bajada, carril=@carril,
        cuerpo=@cuerpo, portada_url=@portada_url, minutos=@minutos, publicada=@publicada,
        destacada=@destacada, publicada_at=@publicada_at, updated_at=@updated_at WHERE id=@id`)
        .run({ ...fila, publicada_at, id: Number(req.params.id) });
    }
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.redirect(303, `/panel/notas/${req.params.id}?m=handle`);
    throw e;
  }
  res.redirect(303, "/panel/notas?m=guardado");
});

router.post("/panel/notas/:id/borrar", (req, res) => {
  db().prepare("DELETE FROM notas WHERE id = ?").run(req.params.id);
  res.redirect(303, "/panel/notas?m=borrado");
});

// --- Páginas ---------------------------------------------------------------
router.get("/panel/paginas", (req, res) => {
  const paginas = db().prepare("SELECT * FROM paginas ORDER BY orden, handle").all();
  res.send(panel({
    titulo: "Páginas", activo: "/panel/paginas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Páginas</h1></div>
      <p style="margin-bottom:18px;color:var(--tx2)">Las cuatro puertas de la portada y el recorrido.
        Se editan acá y el sitio las toma al instante.</p>
      <table><thead><tr><th>Página</th><th>Enlace</th><th>Estado</th></tr></thead><tbody>
      ${paginas.map((p) => `<tr>
        <td><a href="/panel/paginas/${p.id}">${escapeHtml(p.titulo)}</a></td>
        <td><code>/${escapeHtml(p.handle)}</code></td>
        <td><span class="pill${p.publicada ? " si" : ""}">${p.publicada ? "Publicada" : "Oculta"}</span></td>
      </tr>`).join("")}</tbody></table>`,
  }));
});

router.get("/panel/paginas/:id", (req, res, next) => {
  const p = db().prepare("SELECT * FROM paginas WHERE id = ?").get(req.params.id);
  if (!p) return next();
  res.send(panel({
    titulo: p.titulo, activo: "/panel/paginas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>${escapeHtml(p.titulo)}</h1>
      <a class="btn btn-g" href="/${escapeHtml(p.handle)}" target="_blank" rel="noopener">Verla ↗</a></div>
    <form class="ficha" method="POST" action="/panel/paginas/${p.id}">
      ${campo("titulo", "Título", p.titulo, { req: true })}
      ${area("bajada", "Bajada", p.bajada, { chico: true })}
      ${area("cuerpo", "Texto", p.cuerpo, { ayuda: "HTML: &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt;, &lt;ul&gt;." })}
      ${casilla("publicada", "Publicada", p.publicada)}
      <div class="acciones"><button class="btn btn-p" type="submit">Guardar</button>
        <a class="btn btn-g" href="/panel/paginas">Volver</a></div>
    </form>`,
  }));
});

router.post("/panel/paginas/:id", (req, res) => {
  db().prepare(`UPDATE paginas SET titulo=?, bajada=?, cuerpo=?, publicada=?, updated_at=? WHERE id=?`)
    .run(txt(req.body.titulo, 200), txt(req.body.bajada, 500), sanearHtml(req.body.cuerpo),
         bool(req.body.publicada), Date.now(), req.params.id);
  res.redirect(303, "/panel/paginas?m=guardado");
});

// --- Casos, fechas y preguntas --------------------------------------------
router.get("/panel/casos", (req, res) => {
  const casos = db().prepare("SELECT * FROM casos ORDER BY orden, id").all();
  res.send(panel({
    titulo: "Casos", activo: "/panel/casos", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Consultas resueltas</h1>
      <a class="btn btn-p" href="/panel/casos/nuevo">Sumar un caso</a></div>
      <table><thead><tr><th>Caso</th><th>Quién</th><th>Estado</th></tr></thead><tbody>
      ${casos.map((c) => `<tr><td><a href="/panel/casos/${c.id}">${escapeHtml(c.etiqueta)}</a></td>
        <td>${escapeHtml(c.quien).replace(/\n/g, " · ")}</td>
        <td><span class="pill${c.publicado ? " si" : ""}">${c.publicado ? "Visible" : "Oculto"}</span></td></tr>`).join("")}
      </tbody></table>`,
  }));
});

router.get("/panel/casos/:id", (req, res, next) => {
  const nuevo = req.params.id === "nuevo";
  const c = nuevo ? { mostro_tit: "Qué mostró la carta", publicado: 1, orden: 0 }
                  : db().prepare("SELECT * FROM casos WHERE id = ?").get(req.params.id);
  if (!c) return next();
  res.send(panel({
    titulo: "Caso", activo: "/panel/casos", flash: flashDe(req),
    contenido: `<div class="tit"><h1>${nuevo ? "Caso nuevo" : "Editar caso"}</h1></div>
    <form class="ficha" method="POST" action="/panel/casos/${nuevo ? "nuevo" : c.id}">
      ${campo("etiqueta", "Etiqueta", c.etiqueta, { req: true, ayuda: "Por ejemplo: «Caso 01 · Vocacional»." })}
      ${area("quien", "Quién", c.quien, { chico: true, ayuda: "Sin nombre real. Una línea por renglón: «Abogada, 41 años» y abajo el rubro." })}
      ${area("traia", "Qué traía", c.traia, { chico: true })}
      ${campo("mostro_tit", "Título del segundo paso", c.mostro_tit)}
      ${area("mostro", "Qué mostró", c.mostro, { chico: true })}
      ${area("decidio", "Qué decidió", c.decidio, { chico: true })}
      <div class="fila">${campo("orden", "Orden", c.orden, { tipo: "number" })}
        <div style="align-self:end">${casilla("publicado", "Visible", c.publicado)}</div></div>
      <div class="acciones"><button class="btn btn-p" type="submit">Guardar</button>
        <a class="btn btn-g" href="/panel/casos">Volver</a>
        ${nuevo ? "" : `<button class="btn btn-r" formaction="/panel/casos/${c.id}/borrar"
          onclick="return confirm('¿Borrar este caso?')">Borrar</button>`}</div>
    </form>`,
  }));
});

router.post("/panel/casos/:id", (req, res) => {
  const f = {
    etiqueta: txt(req.body.etiqueta, 120), quien: txt(req.body.quien, 300),
    traia: txt(req.body.traia, 1000), mostro_tit: txt(req.body.mostro_tit, 120) || "Qué mostró la carta",
    mostro: txt(req.body.mostro, 1000), decidio: txt(req.body.decidio, 1000),
    orden: Number(req.body.orden) || 0, publicado: bool(req.body.publicado),
  };
  if (!f.etiqueta) return res.redirect(303, `/panel/casos/${req.params.id}?m=faltan`);
  if (req.params.id === "nuevo") {
    db().prepare(`INSERT INTO casos (etiqueta,quien,traia,mostro_tit,mostro,decidio,orden,publicado)
      VALUES (@etiqueta,@quien,@traia,@mostro_tit,@mostro,@decidio,@orden,@publicado)`).run(f);
  } else {
    db().prepare(`UPDATE casos SET etiqueta=@etiqueta,quien=@quien,traia=@traia,mostro_tit=@mostro_tit,
      mostro=@mostro,decidio=@decidio,orden=@orden,publicado=@publicado WHERE id=@id`)
      .run({ ...f, id: Number(req.params.id) });
  }
  res.redirect(303, "/panel/casos?m=guardado");
});

router.post("/panel/casos/:id/borrar", (req, res) => {
  db().prepare("DELETE FROM casos WHERE id = ?").run(req.params.id);
  res.redirect(303, "/panel/casos?m=borrado");
});

router.get("/panel/fechas", (req, res) => {
  const fechas = db().prepare("SELECT * FROM fechas ORDER BY cuando DESC").all();
  res.send(panel({
    titulo: "Fechas", activo: "/panel/fechas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Próximas fechas</h1>
      <a class="btn btn-p" href="/panel/fechas/nueva">Sumar una fecha</a></div>
      <table><thead><tr><th>Cuándo</th><th>Qué</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>
      ${fechas.map((f) => `<tr><td>${escapeHtml(fmtFecha(f.cuando))}</td>
        <td><a href="/panel/fechas/${f.id}">${escapeHtml(f.titulo)}</a></td>
        <td>${f.tipo === "miembros" ? "Miembros" : "Abierto"}</td>
        <td><span class="pill${f.sin_cupo ? "" : " si"}">${f.sin_cupo ? "Sin cupo" : "Con lugar"}</span></td></tr>`).join("")}
      </tbody></table>`,
  }));
});

const paraInput = (ms) => {
  if (!ms) return "";
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

router.get("/panel/fechas/:id", (req, res, next) => {
  const nueva = req.params.id === "nueva";
  const f = nueva ? { tipo: "abierto", publicada: 1, cuando: Date.now() + 7 * 86400000 }
                  : db().prepare("SELECT * FROM fechas WHERE id = ?").get(req.params.id);
  if (!f) return next();
  res.send(panel({
    titulo: "Fecha", activo: "/panel/fechas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>${nueva ? "Fecha nueva" : "Editar fecha"}</h1></div>
    <form class="ficha" method="POST" action="/panel/fechas/${nueva ? "nueva" : f.id}">
      ${campo("titulo", "Qué es", f.titulo, { req: true })}
      ${area("detalle", "Detalle", f.detalle, { chico: true })}
      <div class="fila">
        ${campo("cuando", "Cuándo", paraInput(f.cuando), { tipo: "datetime-local", req: true,
          ayuda: "En hora de Buenos Aires." })}
        ${eleccion("tipo", "Para quién", f.tipo, [["abierto", "Abierto"], ["miembros", "Miembros"]])}
      </div>
      ${campo("url", "Dirección para anotarse", f.url || "", { ayuda: "Si la dejás vacía, el botón lleva a /agenda." })}
      <div class="fila">${casilla("sin_cupo", "Sin cupo", f.sin_cupo)}${casilla("publicada", "Visible", f.publicada)}</div>
      <div class="acciones"><button class="btn btn-p" type="submit">Guardar</button>
        <a class="btn btn-g" href="/panel/fechas">Volver</a>
        ${nueva ? "" : `<button class="btn btn-r" formaction="/panel/fechas/${f.id}/borrar"
          onclick="return confirm('¿Borrar esta fecha?')">Borrar</button>`}</div>
    </form>`,
  }));
});

router.post("/panel/fechas/:id", (req, res) => {
  const cuando = new Date(String(req.body.cuando || "")).getTime();
  const f = {
    titulo: txt(req.body.titulo, 200), detalle: txt(req.body.detalle, 600),
    cuando: Number.isFinite(cuando) ? cuando : Date.now(),
    tipo: req.body.tipo === "miembros" ? "miembros" : "abierto",
    url: txt(req.body.url, 400) || null,
    sin_cupo: bool(req.body.sin_cupo), publicada: bool(req.body.publicada),
  };
  if (!f.titulo || !Number.isFinite(cuando)) return res.redirect(303, `/panel/fechas/${req.params.id}?m=faltan`);
  if (req.params.id === "nueva") {
    db().prepare(`INSERT INTO fechas (titulo,detalle,cuando,tipo,url,sin_cupo,publicada)
      VALUES (@titulo,@detalle,@cuando,@tipo,@url,@sin_cupo,@publicada)`).run(f);
  } else {
    db().prepare(`UPDATE fechas SET titulo=@titulo,detalle=@detalle,cuando=@cuando,tipo=@tipo,
      url=@url,sin_cupo=@sin_cupo,publicada=@publicada WHERE id=@id`).run({ ...f, id: Number(req.params.id) });
  }
  res.redirect(303, "/panel/fechas?m=guardado");
});

router.post("/panel/fechas/:id/borrar", (req, res) => {
  db().prepare("DELETE FROM fechas WHERE id = ?").run(req.params.id);
  res.redirect(303, "/panel/fechas?m=borrado");
});

router.get("/panel/preguntas", (req, res) => {
  const ps = db().prepare("SELECT * FROM preguntas ORDER BY orden, id").all();
  res.send(panel({
    titulo: "Preguntas", activo: "/panel/preguntas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>Preguntas frecuentes</h1>
      <a class="btn btn-p" href="/panel/preguntas/nueva">Sumar una</a></div>
      <table><thead><tr><th>Pregunta</th><th>En la portada</th><th>Estado</th></tr></thead><tbody>
      ${ps.map((p) => `<tr><td><a href="/panel/preguntas/${p.id}">${escapeHtml(p.pregunta)}</a></td>
        <td>${p.en_portada ? "Sí" : "No"}</td>
        <td><span class="pill${p.publicada ? " si" : ""}">${p.publicada ? "Visible" : "Oculta"}</span></td></tr>`).join("")}
      </tbody></table>`,
  }));
});

router.get("/panel/preguntas/:id", (req, res, next) => {
  const nueva = req.params.id === "nueva";
  const p = nueva ? { en_portada: 1, publicada: 1, orden: 0 }
                  : db().prepare("SELECT * FROM preguntas WHERE id = ?").get(req.params.id);
  if (!p) return next();
  res.send(panel({
    titulo: "Pregunta", activo: "/panel/preguntas", flash: flashDe(req),
    contenido: `<div class="tit"><h1>${nueva ? "Pregunta nueva" : "Editar pregunta"}</h1></div>
    <form class="ficha" method="POST" action="/panel/preguntas/${nueva ? "nueva" : p.id}">
      ${campo("pregunta", "Pregunta", p.pregunta, { req: true })}
      ${area("respuesta", "Respuesta", p.respuesta, { chico: true })}
      <div class="fila">${campo("orden", "Orden", p.orden, { tipo: "number" })}
        <div style="align-self:end">${casilla("en_portada", "Mostrar en la portada", p.en_portada)}
          ${casilla("publicada", "Visible", p.publicada)}</div></div>
      <div class="acciones"><button class="btn btn-p" type="submit">Guardar</button>
        <a class="btn btn-g" href="/panel/preguntas">Volver</a>
        ${nueva ? "" : `<button class="btn btn-r" formaction="/panel/preguntas/${p.id}/borrar"
          onclick="return confirm('¿Borrar esta pregunta?')">Borrar</button>`}</div>
    </form>`,
  }));
});

router.post("/panel/preguntas/:id", (req, res) => {
  const f = {
    pregunta: txt(req.body.pregunta, 300), respuesta: txt(req.body.respuesta, 2000),
    orden: Number(req.body.orden) || 0, en_portada: bool(req.body.en_portada),
    publicada: bool(req.body.publicada),
  };
  if (!f.pregunta) return res.redirect(303, `/panel/preguntas/${req.params.id}?m=faltan`);
  if (req.params.id === "nueva") {
    db().prepare(`INSERT INTO preguntas (pregunta,respuesta,orden,en_portada,publicada)
      VALUES (@pregunta,@respuesta,@orden,@en_portada,@publicada)`).run(f);
  } else {
    db().prepare(`UPDATE preguntas SET pregunta=@pregunta,respuesta=@respuesta,orden=@orden,
      en_portada=@en_portada,publicada=@publicada WHERE id=@id`).run({ ...f, id: Number(req.params.id) });
  }
  res.redirect(303, "/panel/preguntas?m=guardado");
});

router.post("/panel/preguntas/:id/borrar", (req, res) => {
  db().prepare("DELETE FROM preguntas WHERE id = ?").run(req.params.id);
  res.redirect(303, "/panel/preguntas?m=borrado");
});

// --- Newsletter ------------------------------------------------------------
router.get("/panel/suscriptores", (req, res) => {
  const lista = db().prepare("SELECT * FROM suscriptores ORDER BY created_at DESC LIMIT 500").all();
  const porOrigen = db().prepare(
    `SELECT origen, COUNT(*) n FROM suscriptores WHERE baja_at IS NULL GROUP BY origen ORDER BY n DESC`).all();
  res.send(panel({
    titulo: "Newsletter", activo: "/panel/suscriptores",
    contenido: `<div class="tit"><h1>Newsletter</h1>
      <a class="btn btn-g" href="/panel/suscriptores.csv">Bajar el CSV</a></div>
      <p style="margin-bottom:18px;color:var(--tx2)">El <b>origen</b> dice por dónde entró cada uno.
        Es lo que después permite escribirle distinto al que llegó por la calculadora
        y al que llegó por una nota. Las altas de la franja de canales (origen <b>canales</b>)
        llevan la fecha del consentimiento y la versión del texto que aceptaron. Todavía no
        se manda ningún mail: falta la doble confirmación.</p>
      <div class="tarjetas">${porOrigen.map((o) =>
        `<div class="tarjeta"><span class="n">${o.n}</span><span class="q">${escapeHtml(o.origen)}</span></div>`).join("")}</div>
      <table><thead><tr><th>Mail</th><th>Origen</th><th>Página</th><th>Alta</th><th>Consentimiento</th><th>Estado</th></tr></thead><tbody>
      ${lista.map((s) => `<tr><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.origen)}</td>
        <td>${escapeHtml(s.pagina || "")}</td>
        <td>${escapeHtml(fmtFecha(s.created_at))}</td>
        <td>${s.consentimiento_at ? `${escapeHtml(fmtFecha(s.consentimiento_at))} · texto ${escapeHtml(s.consentimiento_version || "")}` : "—"}</td>
        <td><span class="pill${s.baja_at ? "" : " si"}">${s.baja_at ? "De baja" : "Activo"}</span></td></tr>`).join("")}
      </tbody></table>`,
  }));
});

router.get("/panel/suscriptores.csv", (req, res) => {
  const lista = db().prepare(`SELECT email, origen, created_at, baja_at, consentimiento_at, consentimiento_version, pagina
                              FROM suscriptores ORDER BY created_at, id`).all();
  const iso = (t) => (t ? new Date(t).toISOString() : "");
  const csv = ["email,origen,alta,baja,consentimiento,version_consentimiento,pagina"].concat(lista.map((s) =>
    [s.email, s.origen, iso(s.created_at), iso(s.baja_at), iso(s.consentimiento_at), s.consentimiento_version || "", s.pagina || ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))).join("\n");
  res.set("content-type", "text/csv; charset=utf-8");
  res.set("content-disposition", 'attachment; filename="suscriptores.csv"');
  res.send("﻿" + csv); // BOM: sin él, Excel abre los acentos rotos
});

export default router;

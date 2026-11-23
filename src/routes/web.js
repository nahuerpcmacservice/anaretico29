// La web nueva: las tres páginas publicadas, sus archivos y las redirecciones de
// los nombres de archivo del prototipo. Va DESPUÉS del portero (app.js): con el
// sitio cerrado, el anónimo ve el cartel también acá.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  WEB_DIR, MANIFIESTO, PAGINAS, leerVisibilidad, destinoONull, pagVisible,
} from "../lib/web-nueva.js";
import { paginaInicio, datosJs } from "../lib/portada.js";
import { AVISOS } from "../lib/suscripcion.js";
import { paginaPrivacidad } from "../lib/privacidad.js";

const router = express.Router();

// Solo se sirve lo que lista el manifiesto de la importación: un archivo que
// quedó en src/web/ de antes (o un respaldo copiado a mano) no sale nunca.
const manifiesto = JSON.parse(fs.readFileSync(MANIFIESTO, "utf8"));
const archivos = new Map(); // URL pública → ruta absoluta
for (const rel of manifiesto.archivos) {
  if (rel.endsWith(".html")) continue; // las páginas van por sus rutas limpias
  archivos.set("/" + rel.replace(/^variantes\//, ""), path.join(WEB_DIR, rel));
}
const D = leerVisibilidad();

// CSS y JS llevan ?v= en cada referencia: pueden cachearse una semana. Los
// datos (JSON, el mapa) se revalidan siempre, que los scripts los piden así.
const cacheDe = (u) =>
  /\.(?:css|js|jpe?g|png|webp|avif|svg)$/.test(u) && !u.startsWith("/datos/") ? "7d" : 0;

// data.js lleva el cielo del motor (A29_DATA, la línea de tiempo y los
// diálogos): cambia con cada tramo de caché del cielo, así que se revalida
// siempre aunque lleve ?v=.
router.get("/data.js", async (req, res, next) => {
  try {
    const js = await datosJs();
    res.set("cache-control", "no-cache").type("application/javascript; charset=utf-8").send(js);
  } catch (err) { next(err); }
});

router.get(/.*/, (req, res, next) => {
  const archivo = archivos.get(req.path);
  if (!archivo) return next();
  res.sendFile(archivo, { maxAge: cacheDe(req.path), dotfiles: "deny" }, (err) => { if (err) next(err); });
});

// El aviso de la suscripción sin JS (routes/suscripcion.js vuelve con
// ?suscripcion=<código>#canales): va en la zona de aviso del prototipo. Solo se
// muestra un texto conocido; lo que venga en la URL nunca se refleja.
const ZONA_AVISO = '<span class="bo-err" id="bo-err" role="alert"></span>';
function conAviso(html, codigo) {
  const texto = typeof codigo === "string" && Object.hasOwn(AVISOS, codigo) ? AVISOS[codigo] : "";
  if (!texto || !html.includes(ZONA_AVISO)) return html;
  return html.replace(ZONA_AVISO, () => `<span class="bo-err" id="bo-err" role="alert">${texto}</span>`);
}

// /privacidad: lugar provisorio de la política (src/lib/privacidad.js). noindex
// también por cabecera, para que siga así el día que se abra el sitio.
router.get("/privacidad", (req, res) => {
  if (req.path.endsWith("/")) return res.redirect(301, "/privacidad");
  res.set("cache-control", "no-cache").set("x-robots-tag", "noindex, nofollow");
  res.type("html").send(paginaPrivacidad());
});

const query = (req) => {
  const i = req.originalUrl.indexOf("?");
  return i === -1 ? "" : req.originalUrl.slice(i);
};

for (const [ruta, archivo] of Object.entries(PAGINAS)) {
  const abs = path.join(WEB_DIR, "variantes", archivo);
  router.get(ruta, (req, res, next) => {
    // Con barra final la página resolvería "datos/..." contra otra carpeta
    if (ruta !== "/" && req.path.endsWith("/")) return res.redirect(301, ruta + query(req));
    res.set("cache-control", "no-cache");
    // La portada lleva el cielo del motor: se rellena la plantilla (src/lib/portada.js)
    if (ruta === "/") {
      return paginaInicio().then((html) => res.type("html").send(conAviso(html, req.query.suscripcion)), next);
    }
    res.sendFile(abs, (err) => { if (err) next(err); });
  });
}

// Los nombres de archivo del prototipo (por si alguien comparte uno): las
// páginas publicadas van a su URL limpia para siempre (301); lo apagado va a
// Próximamente, que es temporal (302: doc 05 §6.3, nunca 301).
router.get(/^\/[\w.-]+\.html$/, (req, res, next) => {
  const archivo = req.path.slice(1);
  const dest = destinoONull(archivo + query(req), D);
  if (!dest) return next();
  const apagada = dest.startsWith("/proximamente?") && archivo !== "proximamente.html";
  res.redirect(apagada ? 302 : 301, dest);
});

// Nombres limpios de las páginas apagadas (/servicios, /research, /shop,
// /academia, /revista, /membresia, /carta): Próximamente mientras estén apagadas.
// Son el destino de los 301 viejos (routes/viejas.js), que no pueden apuntar a
// Próximamente directamente.
for (const p of D.paginas) {
  if (p.tipo === "cuadro" || pagVisible(p)) continue;
  const nombres = new Set([p.id, p.archivo.replace(/\.html$/, "")]);
  for (const n of nombres) router.get(`/${n}`, (req, res) => res.redirect(302, `/proximamente?p=${encodeURIComponent(p.id)}`));
}

export default router;

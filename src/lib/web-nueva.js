// La web nueva: el prototipo de Fernando (entrega del 21/11/2026), publicado tal
// cual en src/web/ por scripts/importar-web.mjs.
//
// Acá vive lo que comparten la importación y el servidor:
//   - qué URL limpia tiene cada página publicada,
//   - el estado de visibilidad (src/web/variantes/datos/visibilidad.json),
//   - y la FUNCIÓN ÚNICA que dice a dónde apunta un enlace según ese estado
//     (regla 5 del documento 05): la usan los HTML al importarse, los scripts
//     que arman enlaces y las redirecciones de las rutas *.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WEB_DIR = path.resolve(HERE, "..", "web");
export const VISIBILIDAD = path.join(WEB_DIR, "variantes", "datos", "visibilidad.json");
export const MANIFIESTO = path.join(WEB_DIR, "publicado.json");

/** Las tres páginas que se publican: URL limpia → archivo del prototipo. */
export const PAGINAS = {
  "/": "combinado.html",
  "/sobre-mi": "sobre-mi.html",
  "/proximamente": "proximamente.html",
};

/**
 * Archivos publicados que no están en visibilidad.json. "Sobre mí" todavía no
 * figura ahí (pregunta 7 del documento 05) y la pantalla Próximamente no es una
 * página que se apague.
 */
const SIN_ENTRADA = { "sobre-mi.html": "/sobre-mi", "proximamente.html": "/proximamente" };

// Misma lógica que proximamente.js: una página bloqueada siempre se ve; una
// página apagada apaga todas sus partes.
export const pagVisible = (p) => p.bloqueada === true || p.visible !== false;
export const parteVisible = (p, x) => pagVisible(p) && x.visible !== false;

export const leerVisibilidad = (archivo = VISIBILIDAD) => JSON.parse(fs.readFileSync(archivo, "utf8"));

const aPantalla = (id) => `/proximamente?p=${encodeURIComponent(id)}`;

/** La página de visibilidad.json dueña de un archivo (el suyo o una subpágina). */
export const paginaDe = (D, archivo) =>
  (D.paginas || []).find((p) => p.tipo !== "cuadro" && (p.archivo === archivo || (p.subpaginas || []).includes(archivo)));

/**
 * A dónde apunta un enlace del prototipo según el estado de visibilidad.
 *
 * - Externos, anclas y URLs que ya son limpias quedan como están.
 * - Una página apagada (o una de sus subpáginas) va a /proximamente?p=<id>.
 * - Un ancla a una parte apagada de una página visible va a /proximamente?p=<parte>.
 * - Una página visible va a su URL limpia (campo "ruta").
 * - Un .html que no se publica y no está apagado es un error: preferible que
 *   la importación se corte a publicar un enlace roto.
 */
export function destino(href, D) {
  const m = /^(?:\.\/)?([\w.-]+\.html)(\?[^#]*)?(#.*)?$/.exec(href);
  if (!m) return href;
  const [, archivo, query = "", ancla = ""] = m;
  if (archivo === "proximamente.html") return "/proximamente" + query + ancla;
  const p = paginaDe(D, archivo);
  if (p) {
    if (!pagVisible(p)) return aPantalla(p.id);
    const h = ancla.slice(1);
    const x = h ? (p.partes || []).find((y) => y.id === h) : null;
    if (x && !parteVisible(p, x)) return aPantalla(x.id);
    if (p.ruta && p.archivo === archivo) return p.ruta + ancla;
    throw new Error(`«${p.nombre}» está visible pero ${archivo} no se publica (${href})`);
  }
  if (SIN_ENTRADA[archivo]) return SIN_ENTRADA[archivo] + ancla;
  throw new Error(`enlace a una página que no se publica: ${href}`);
}

/** Igual que destino(), pero null en vez de error: para las redirecciones del servidor. */
export const destinoONull = (href, D) => {
  try { return destino(href, D); } catch { return null; }
};

// Las páginas de error (404 y 500) con el diseño de la web nueva (S20).
//
// No son páginas del prototipo: se arman sobre "Sobre mí" (src/web, generado
// por la importación) cambiándole el título, las descripciones, la canónica y
// el <main>. Así llevan el mismo encabezado y menú, la misma franja de canales,
// el mismo pie (texto legal, «Imágenes: Anaretico 29» y «Código fuente (AGPL)»)
// y las mismas hojas y scripts en el mismo orden. Todos los enlaces y archivos
// de "Sobre mí" son absolutos, así que sirven en cualquier dirección.
//
// Siempre con noindex (meta y X-Robots-Tag) y no-store. El 500 nunca muestra
// el error y el registro no lleva nada del pedido (S9: ni la dirección, ni la
// query, ni las cabeceras, ni el mensaje del error, que puede citar datos).
import fs from "node:fs";
import path from "node:path";
import { WEB_DIR } from "./web-nueva.js";

const NOINDEX = '<meta name="robots" content="noindex,nofollow">';

export const PAGINAS_ERROR = {
  404: { titulo: "Anaretico 29 · Página no encontrada", frase: "No encontramos esta página." },
  500: { titulo: "Anaretico 29 · Algo salió mal", frase: "Algo salió mal. Probá de nuevo en un rato." },
};

const cuerpo = (codigo, frase) => `<main id="inicio" class="sm">
<div class="sm-w sm-hero"><div><p class="k">Error ${codigo}</p><h1>${frase}</h1><p><a class="btn-sm" href="/">Volver al inicio</a></p></div></div>
</main>`;

/** Reemplazo que tiene que encontrar exactamente una vez lo que espera. */
function una(html, re, poner, nombre) {
  const n = (html.match(new RegExp(re.source, "g")) || []).length;
  if (n !== 1) throw new Error(`errores: esperaba 1 × ${nombre} en sobre-mi.html, encontré ${n}`);
  return html.replace(re, () => poner);
}

/** La página de error, a partir del HTML de "Sobre mí" ya importado. */
export function errorHtml(sobreMi, codigo) {
  const { titulo, frase } = PAGINAS_ERROR[codigo];
  let t = sobreMi;
  // Sobre mí se indexa (S19) y lleva su canónica; un error no
  t = una(t, /<link rel="canonical" href="[^"]*">/, NOINDEX, "canónica");
  t = una(t, /<title>[^<]*<\/title>/, `<title>${titulo}</title>`, "<title>");
  t = una(t, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${titulo}">`, "og:title");
  t = una(t, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${frase}">`, "og:description");
  t = una(t, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${frase}">`, "description");
  t = una(t, /<main id="inicio" class="sm">[\s\S]*?<\/main>/, cuerpo(codigo, frase), "<main>");
  return t;
}

// Si "Sobre mí" no se pudiera leer, igual se contesta algo, sin detalles
const minima = (codigo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">${NOINDEX}<title>${PAGINAS_ERROR[codigo].titulo}</title></head>` +
  `<body><h1>${PAGINAS_ERROR[codigo].frase}</h1><p><a href="/">Volver al inicio</a></p></body></html>`;

const cache = {};
/** Se arma una vez por proceso: "Sobre mí" solo cambia con una importación (y un deploy). */
export function paginaError(codigo) {
  if (cache[codigo]) return cache[codigo];
  try {
    return (cache[codigo] = errorHtml(fs.readFileSync(path.join(WEB_DIR, "variantes", "sobre-mi.html"), "utf8"), codigo));
  } catch {
    return minima(codigo);
  }
}

function enviar(res, codigo) {
  res.status(codigo).set({ "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" }).type("html").send(paginaError(codigo));
}

/** Middleware final: ninguna ruta contestó. */
export function noEncontrada(req, res) {
  enviar(res, 404);
}

/** Manejador de errores final. Registra solo el tipo de error y las líneas de código. */
// eslint-disable-next-line no-unused-vars
export function manejarError(err, req, res, next) {
  const pila = String(err?.stack || "").split("\n").filter((l) => /^\s+at /.test(l)).slice(0, 8).join("\n");
  console.error(`[anaretico] error 500 (${err?.name || typeof err}${err?.code ? " " + err.code : ""})\n${pila}`);
  if (res.headersSent) return res.end();
  enviar(res, 500);
}

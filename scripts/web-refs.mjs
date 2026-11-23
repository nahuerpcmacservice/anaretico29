// Lectura de las referencias de la web nueva (prototipo de Fernando).
//
// Lo usan dos lados: scripts/importar-web.mjs, para saber QUÉ archivos del
// prototipo se publican (se publica lo que las páginas cargan, no lo que hay en
// la carpeta), y scripts/test-web-nueva.mjs, para pedir cada uno de esos
// archivos al sitio servido. Es todo lectura de texto: nunca se ejecuta un
// script del prototipo.

/** ¿Apunta afuera del sitio, a un ancla o a un dato embebido? */
export const esExterna = (u) =>
  !u || u.startsWith("#") || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u);

const decodificar = (v) => v.replace(/&amp;/g, "&");

/** Atributos de una etiqueta de apertura, en orden. */
export function atributos(etiqueta) {
  const out = {};
  for (const m of etiqueta.matchAll(/\s([a-zA-Z_:][\w:.-]*)(?:="([^"]*)")?/g)) {
    out[m[1].toLowerCase()] = m[2] === undefined ? "" : decodificar(m[2]);
  }
  return out;
}

/** Cada etiqueta que puede traer una referencia, con sus atributos. */
export function* etiquetas(html) {
  for (const m of html.matchAll(/<(a|link|script|img|source|meta|video|iframe|form)\b[^>]*>/gi)) {
    yield { tag: m[1].toLowerCase(), texto: m[0], indice: m.index, attrs: atributos(m[0]) };
  }
}

const primeros = (srcset) => srcset.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);

/**
 * Lo que una página CARGA (hojas, scripts, imágenes, íconos, og:image) y lo
 * que ENLAZA (<a href>, <form action>). Los valores van tal cual están en el
 * HTML (relativos o absolutos); quien llama decide contra qué resolverlos.
 */
export function refsHtml(html) {
  const recursos = [], enlaces = [], hojas = [], scripts = [];
  for (const { tag, attrs } of etiquetas(html)) {
    if (tag === "a" && "href" in attrs) enlaces.push(attrs.href);
    else if (tag === "form" && attrs.action) enlaces.push(attrs.action);
    else if (tag === "link" && attrs.href) {
      const rel = (attrs.rel || "").toLowerCase();
      if (rel === "preconnect" || rel === "dns-prefetch") continue;
      if (rel === "stylesheet") hojas.push(attrs.href);
      recursos.push(attrs.href);
    } else if (tag === "script" && attrs.src) { scripts.push(attrs.src); recursos.push(attrs.src); }
    else if (tag === "img" || tag === "source" || tag === "video" || tag === "iframe") {
      if (attrs.src) recursos.push(attrs.src);
      if (attrs.poster) recursos.push(attrs.poster);
      if (attrs.srcset) recursos.push(...primeros(attrs.srcset));
    } else if (tag === "meta" && /^(og:image|twitter:image)$/.test(attrs.property || attrs.name || "") && attrs.content) {
      recursos.push(attrs.content);
    }
  }
  // url() en estilos en línea
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) recursos.push(decodificar(m[1]));
  return { recursos, enlaces, hojas, scripts };
}

/** url() y @import de una hoja de estilos. */
export function refsCss(css) {
  const out = [];
  for (const m of css.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) out.push(m[1]);
  return [...new Set(out)];
}

/** Lo que un script pide con fetch('...'): se resuelve contra la PÁGINA, no contra el script. */
export const fetchsJs = (js) => [...js.matchAll(/fetch\(\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);

const EXT_RECURSO = /\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|vtt|json)$/i;

/** Rutas a recursos dentro de un JSON (por ejemplo "imagen": "../assets/x.webp"). */
export function rutasJson(valor, out = []) {
  if (typeof valor === "string") {
    if (!esExterna(valor) && /^(?:\.\.\/|\.\/)?[\w./-]+$/.test(valor) && EXT_RECURSO.test(valor)) out.push(valor);
  } else if (Array.isArray(valor)) valor.forEach((v) => rutasJson(v, out));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => rutasJson(v, out));
  return out;
}

/** href de un SVG (por si el mapa trae imágenes o usos externos). */
export const refsSvg = (svg) =>
  [...svg.matchAll(/\s(?:xlink:)?href="([^"]+)"/g)].map((m) => m[1]).filter((u) => !esExterna(u));

/**
 * Las fotos del carrusel de la portada: portada-plaza.js las arma con
 * `${base}portada/${s.id}-${w}.${ext}` (base = assets/) desde window.A29_SLIDES
 * de data.js; sin "widths" usa `assets/${s.image}.jpg`. Devuelve rutas desde
 * la raíz de web/ ("assets/portada/mundial-800.webp").
 */
export function fotosCarrusel(dataJs) {
  const m = /window\.A29_SLIDES\s*=\s*(\[[\s\S]*?\]);\s*$/m.exec(dataJs);
  if (!m) throw new Error("data.js: no encuentro window.A29_SLIDES");
  const slides = JSON.parse(m[1]);
  const out = [];
  for (const s of slides) {
    if (Array.isArray(s.widths) && s.widths.length) {
      for (const w of s.widths) for (const ext of ["webp", "jpg"]) out.push(`assets/portada/${s.id}-${w}.${ext}`);
    } else if (s.image) out.push(`assets/${s.image}.jpg`);
  }
  return out;
}

// Saneado del HTML que se escribe en el panel. Fernando escribe las notas y
// las páginas, así que no es contenido hostil — pero un texto pegado desde
// Word o desde otra web trae de todo, y un <script> que entra por ahí queda
// corriendo en el sitio para siempre.
const PERMITIDAS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li",
  "h2", "h3", "h4", "a", "img", "figure", "figcaption", "hr", "table", "thead",
  "tbody", "tr", "th", "td", "code", "pre", "small", "sup", "sub",
]);
const ATRIBUTOS = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height", "loading"],
  td: ["colspan", "rowspan"], th: ["colspan", "rowspan"],
};
// Se saca el bloque ENTERO, no sólo la etiqueta: dejar el contenido de un
// <script> lo deja escrito como texto en medio de la nota.
const BLOQUES_FUERA = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1\s*>/gi;

function urlSegura(url) {
  const u = String(url || "").trim();
  // javascript: y data: son las dos formas de meter código en un href o un src.
  if (/^\s*(javascript|vbscript|data)\s*:/i.test(u)) return null;
  return u;
}

export function sanearHtml(entrada) {
  let html = String(entrada || "");
  html = html.replace(BLOQUES_FUERA, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (todo, etiqueta, attrs) => {
    const nombre = etiqueta.toLowerCase();
    if (!PERMITIDAS.has(nombre)) return "";
    if (todo.startsWith("</")) return `</${nombre}>`;

    const permitidos = ATRIBUTOS[nombre] || [];
    const salida = [];
    const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let m;
    while ((m = re.exec(attrs))) {
      const clave = m[1].toLowerCase();
      if (!permitidos.includes(clave)) continue;      // esto tira todos los on* de una
      let valor = m[3] ?? m[4] ?? m[5] ?? "";
      if (clave === "href" || clave === "src") {
        const u = urlSegura(valor);
        if (u === null) continue;
        valor = u;
      }
      salida.push(`${clave}="${valor.replace(/"/g, "&quot;")}"`);
    }
    // Un link que abre en otra pestaña sin rel deja al sitio destino con acceso
    // a la ventana de origen.
    if (nombre === "a" && salida.some((a) => a.startsWith('target='))) {
      if (!salida.some((a) => a.startsWith("rel="))) salida.push('rel="noopener noreferrer"');
    }
    const cierra = nombre === "br" || nombre === "img" || nombre === "hr" ? " /" : "";
    return `<${nombre}${salida.length ? " " + salida.join(" ") : ""}${cierra}>`;
  });
}

// Importa la web nueva desde la entrega de Fernando a src/web/.
//
//   node scripts/importar-web.mjs <carpeta web/ de la entrega>
//
// Se publica SOLO lo que cargan las tres páginas (combinado.html, sobre-mi.html
// y proximamente.html): sus <link>, <script>, imágenes, srcset, url() y
// @import de las hojas, lo que los scripts piden con fetch, las rutas de
// imágenes de esos JSON y las fotos del carrusel que arma portada-plaza.js
// desde data.js. Los respaldos y variantes de la guía §2.2 quedan afuera porque
// nadie los carga. El prototipo se LEE como texto: nunca se ejecuta nada suyo.
//
// Al copiar se aplica el estado de visibilidad (abajo, APAGADAS) y se adapta lo
// mínimo para servirlo con URLs limpias:
//   - referencias locales de los HTML → rutas absolutas; CSS y JS con ?v=VERSION
//   - enlaces → la función única destino() de src/lib/web-nueva.js
//   - og:image absoluto en el dominio
//   - regla 4: con Membresía apagada no se generan sus botones principales
//   - Próximamente sin la franja de aprobación [SOLO MAQUETA] (doc 05 §4.7)
//   - los scripts que arman enlaces (menú, carta, puertas, Próximamente)
//   - la suscripción de la franja de canales: POST /suscripcion, casilla de
//     consentimiento sin tildar, campo señuelo (S5; textos en src/lib/suscripcion.js)
// Cada retoque exige encontrar EXACTAMENTE lo que espera: si el prototipo
// cambia, la importación se corta en vez de publicar algo a medias.
import fs from "node:fs";
import path from "node:path";
import { refsHtml, refsCss, fetchsJs, rutasJson, refsSvg, fotosCarrusel, esExterna, etiquetas } from "./web-refs.mjs";
import { WEB_DIR, PAGINAS, destino, pagVisible } from "../src/lib/web-nueva.js";
import { CONSENTIMIENTO_HTML, AVISOS } from "../src/lib/suscripcion.js";

/** Versión para vaciar la caché de CSS y JS: subirla en cada importación. */
const VERSION = "20261123.5";
const CODIGO_FUENTE = "https://github.com/nahuerpcmacservice/anaretico29";
/** Host canónico (config.js, hostCanonico): el og:image tiene que ser absoluto. */
const SITIO = "https://www.anaretico29.com";
/**
 * Lo que el visitante ve como "Próximamente" (pedido de Fernando, 23/11/2026:
 * inicio y su recorrido al público, "el resto que diga en proximamente").
 * Servicios está bloqueada en el JSON de muestra (regla 1), pero Fernando la
 * pidió en Próximamente mientras la arma: se le saca el bloqueo.
 */
const APAGADAS = ["servicios", "research", "academia", "revista", "membresia", "carta"];
/** URL limpia de las entradas de visibilidad.json que se publican. */
const RUTAS = { inicio: "/", enfoque: "/", recorrido: "/sobre-mi" };

const origen = process.argv[2];
if (!origen || !fs.existsSync(path.join(origen, "variantes", "combinado.html"))) {
  console.error("Uso: node scripts/importar-web.mjs <carpeta web/ de la entrega>  (tiene que tener variantes/combinado.html)");
  process.exit(1);
}
const ORIGEN = path.resolve(origen);
const leer = (rel) => fs.readFileSync(path.join(ORIGEN, rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(ORIGEN, rel)) && fs.statSync(path.join(ORIGEN, rel)).isFile();
const falla = (msg) => { throw new Error(msg); };

/** Resuelve una referencia relativa a un archivo de web/ y devuelve la ruta desde web/. */
function resolver(ref, desde) {
  const u = new URL(ref, `http://prototipo/${desde}`);
  if (u.host !== "prototipo") return null;
  return decodeURIComponent(u.pathname.slice(1));
}
/**
 * URL pública de un archivo de web/. Las páginas se sirven en un solo segmento
 * (/, /sobre-mi, /proximamente), así que lo de variantes/ va en la raíz y lo de
 * web/ también: "../styles.css" desde variantes/ y "styles.css" coinciden.
 */
const urlDe = (rel) => "/" + rel.replace(/^variantes\//, "");

// --- 1. Estado de visibilidad ------------------------------------------------
const D = JSON.parse(leer("variantes/datos/visibilidad.json"));
for (const p of D.paginas) {
  if (APAGADAS.includes(p.id)) { p.visible = false; delete p.bloqueada; delete p.motivo; }
  if (RUTAS[p.id]) p.ruta = RUTAS[p.id];
}
for (const id of APAGADAS) if (!D.paginas.some((p) => p.id === id)) falla(`visibilidad.json no tiene la página ${id}`);
const membresiaApagada = !pagVisible(D.paginas.find((p) => p.id === "membresia"));
const serviciosApagada = !pagVisible(D.paginas.find((p) => p.id === "servicios"));

// --- 2. El conjunto publicado, leyendo lo que cargan las páginas -------------
const publicados = new Set(); // rutas desde web/
const sumar = (rel, porQue) => {
  if (!rel) return;
  if (!existe(rel)) falla(`falta ${rel} (lo pide ${porQue})`);
  publicados.add(rel);
};

/** Recortes del HTML que no van a la web real (antes de leer sus referencias). */
function recortar(html, archivo) {
  let out = html;
  const quitar = (re, esperado, nombre, chequeo) => {
    const hallados = out.match(re) || [];
    if (hallados.length !== esperado) falla(`${archivo}: esperaba ${esperado} × ${nombre}, encontré ${hallados.length}`);
    for (const h of hallados) if (chequeo && !chequeo(h)) falla(`${archivo}: ${nombre} no es lo que esperaba`);
    out = out.replace(re, "");
  };
  // AGPL §13 (Swiss Ephemeris): el pie de cada página lleva al código fuente publicado
  const cierrePie = out.match(/<\/small><\/footer>/g) || [];
  if (cierrePie.length !== 1) falla(`${archivo}: esperaba 1 × cierre del pie, encontré ${cierrePie.length}`);
  out = out.replace("</small></footer>",
    `<br><a href="${CODIGO_FUENTE}" rel="noopener">Código fuente (AGPL)</a></small></footer>`);
  if (archivo === "combinado.html") {
    // S4: la tarjeta «Carta del momento» nombraba el corte fijo; queda solo su botón (a Próximamente)
    quitar(/<p class="t-text">Por ahora, el cielo del corte de referencia: 20\/10\/2026, 12:00 de Buenos Aires\.<\/p>/g,
      1, "frase del corte en Herramientas");
  }
  if (archivo === "proximamente.html") {
    // Doc 05 §4.7: la franja de aprobación existe solo para que Fernando aprobara el diseño
    quitar(/<section class="pr-demo"[\s\S]*?<\/section>\n?/g, 1, "franja pr-demo",
      (h) => h.includes("no va en la web real") && (h.match(/<section\b/g) || []).length === 1);
    // "Ver servicios" no tiene a dónde llevar con Servicios en Próximamente
    if (serviciosApagada) quitar(/<a [^>]*data-pr-servicios[^>]*>Ver servicios<\/a>/g, 1, "«Ver servicios»");
  }
  if (membresiaApagada) {
    // Regla 4: los botones principales de Membresía se OCULTAN, no van a Próximamente
    const n = archivo === "combinado.html" ? 1 : 0;
    quitar(/<a class="hc-btn" href="membresia\.html">Sumarme<\/a>/g, n, "«Sumarme» del carrusel");
    quitar(/<div class="m-feature">[\s\S]*?<\/a><\/div>/g, n, "franja «Membresía mensual»",
      (h) => h.includes("Conocer la membresía") && (h.match(/<a\b/g) || []).length === 1);
  }
  return out;
}

const htmls = {};
for (const archivo of Object.values(PAGINAS)) {
  const rel = `variantes/${archivo}`;
  sumar(rel, "la lista de páginas");
  const html = recortar(leer(rel), archivo);
  htmls[archivo] = html;
  const { recursos, scripts } = refsHtml(html);
  for (const r of recursos) if (!esExterna(r)) sumar(resolver(r, rel), rel);
  for (const s of scripts) {
    if (esExterna(s)) continue;
    const js = leer(resolver(s, rel));
    // fetch() se resuelve contra la PÁGINA (variantes/), no contra el script
    for (const f of fetchsJs(js)) {
      const dato = resolver(f, rel);
      sumar(dato, s);
      if (dato.endsWith(".json")) for (const r of rutasJson(JSON.parse(leer(dato)))) sumar(resolver(r, rel), dato);
      if (dato.endsWith(".svg")) for (const r of refsSvg(leer(dato))) sumar(resolver(r, dato), dato);
    }
  }
}
// Las fotos del carrusel: portada-plaza.js las arma desde data.js
if (!leer("variantes/portada-plaza.js").includes("`${base}portada/${s.id}-${w}.${ext} ${w}w`")) {
  falla("portada-plaza.js ya no arma las fotos como espera fotosCarrusel()");
}
for (const f of fotosCarrusel(leer("data.js"))) sumar(f, "data.js (A29_SLIDES)");
// Hojas: url() y @import, resueltos contra la hoja
for (const rel of [...publicados]) {
  if (!rel.endsWith(".css")) continue;
  const pendientes = [rel];
  while (pendientes.length) {
    const hoja = pendientes.pop();
    for (const r of refsCss(leer(hoja))) {
      if (esExterna(r)) continue;
      const dest = resolver(r, hoja);
      // Servida desde la raíz, la referencia tiene que caer en el mismo archivo
      const servida = new URL(r, `http://x${urlDe(hoja)}`).pathname;
      if (servida !== urlDe(dest)) falla(`${hoja}: ${r} se rompe servida en ${urlDe(hoja)}`);
      if (!publicados.has(dest)) { sumar(dest, hoja); if (dest.endsWith(".css")) pendientes.push(dest); }
    }
  }
}
// Dos archivos no pueden caer en la misma URL
const porUrl = new Map();
for (const rel of publicados) {
  const u = urlDe(rel);
  if (porUrl.has(u)) falla(`${rel} y ${porUrl.get(u)} caerían los dos en ${u}`);
  porUrl.set(u, rel);
}

// --- 3. Retoques -------------------------------------------------------------
const conVersion = (u) => `${u}${u.includes("?") ? "&" : "?"}v=${VERSION}`;
const escAttr = (v) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function reescribirHtml(html, archivo) {
  const rel = `variantes/${archivo}`;
  const conPronto = refsHtml(html).hojas.includes("proximamente.css");
  const local = (ref) => {
    const r = resolver(ref, rel);
    if (!publicados.has(r)) falla(`${archivo}: ${ref} no está publicado`);
    return urlDe(r);
  };
  const enlace = (href) => (esExterna(href) ? href : destino(href, D));

  // El menú: lo apagado conserva su lugar, va a Próximamente y, donde la página
  // carga proximamente.css, lleva la marca «Pronto» (regla 2; es el mismo
  // marcado que agrega proximamente.js, pero puesto desde el servidor).
  let out = html.replace(/(<nav aria-label="Navegación principal">)([\s\S]*?)(<\/nav>)/, (_, a, medio, c) =>
    a + medio.replace(/<a ([^>]*)href="([^"]*)"([^>]*)>([^<]*)<\/a>/g, (t, pre, href, post, texto) => {
      const nuevo = enlace(href);
      const marca = conPronto && nuevo.startsWith("/proximamente?p=") ? '<span class="pronto">Pronto</span>' : "";
      return `<a ${pre}href="${escAttr(nuevo)}"${post}>${texto}${marca}</a>`;
    }) + c);

  let reemplazos = [];
  for (const { tag, texto, indice, attrs } of etiquetas(out)) {
    let nuevo = texto;
    const poner = (attr, valor) => {
      nuevo = nuevo.replace(new RegExp(`(\\s${attr}=")[^"]*(")`), `$1${escAttr(valor)}$2`);
    };
    if (tag === "a" && attrs.href !== undefined) poner("href", enlace(attrs.href));
    else if (tag === "link" && attrs.href && !esExterna(attrs.href)) {
      const u = local(attrs.href);
      poner("href", (attrs.rel || "").toLowerCase() === "stylesheet" ? conVersion(u) : u);
    } else if (tag === "script" && attrs.src && !esExterna(attrs.src)) poner("src", conVersion(local(attrs.src)));
    else if (tag === "img" || tag === "source") {
      if (attrs.src && !esExterna(attrs.src)) poner("src", local(attrs.src));
      if (attrs.srcset) poner("srcset", attrs.srcset.split(",").map((s) => {
        const [u, ...resto] = s.trim().split(/\s+/);
        return [esExterna(u) ? u : local(u), ...resto].join(" ");
      }).join(", "));
    } else if (tag === "meta" && attrs.property === "og:image" && !esExterna(attrs.content)) {
      poner("content", SITIO + local(attrs.content));
    } else if (tag === "form" && attrs.action) poner("action", enlace(attrs.action));
    if (nuevo !== texto) reemplazos.push([indice, texto.length, nuevo]);
  }
  for (const [i, largo, nuevo] of reemplazos.reverse()) out = out.slice(0, i) + nuevo + out.slice(i + largo);

  // Chequeos de lo que no se puede perder
  if (!out.includes('<meta name="robots" content="noindex,nofollow">')) falla(`${archivo}: perdió el noindex`);
  if (!out.includes("Contenido astrológico y educativo. No constituye asesoramiento ni recomendación de inversión.")) falla(`${archivo}: perdió el texto legal`);
  const antes = refsHtml(html), despues = refsHtml(out);
  if (antes.hojas.length !== despues.hojas.length || antes.scripts.length !== despues.scripts.length) falla(`${archivo}: cambió la cantidad de hojas o scripts`);
  for (const e of despues.enlaces) if (!esExterna(e) && /\.html\b/.test(e)) falla(`${archivo}: quedó un enlace a ${e}`);
  return out;
}

/** Retoque puntual de un script: tiene que encontrar el texto exactamente una vez. */
function parche(texto, archivo, buscar, poner) {
  const n = texto.split(buscar).length - 1;
  if (n !== 1) falla(`${archivo}: esperaba 1 × ${JSON.stringify(buscar)}, encontré ${n}`);
  return texto.replace(buscar, () => poner);
}

/**
 * Retoque de un tramo: desde `desde` (que aparece exactamente una vez) hasta el
 * primer `hasta` que le sigue, inclusive. `chequeo` confirma que el tramo es el
 * que se espera antes de reemplazarlo.
 */
function parcheTramo(texto, archivo, desde, hasta, poner, chequeo) {
  const n = texto.split(desde).length - 1;
  if (n !== 1) falla(`${archivo}: esperaba 1 × ${JSON.stringify(desde)}, encontré ${n}`);
  const i = texto.indexOf(desde), j = texto.indexOf(hasta, i + desde.length);
  if (j === -1) falla(`${archivo}: después de ${JSON.stringify(desde)} no está ${JSON.stringify(hasta)}`);
  const tramo = texto.slice(i, j + hasta.length);
  if (chequeo && !chequeo(tramo)) falla(`${archivo}: el tramo de ${JSON.stringify(desde)} no es lo que esperaba`);
  return texto.slice(0, i) + poner + texto.slice(j + hasta.length);
}

/**
 * «El cielo de hoy» y «La línea de tiempo» con el cielo real (S4): los valores
 * fijos del corte del 20/10/2026 pasan a ser marcas {{clave}} que rellena
 * src/lib/portada.js en cada tramo de caché. El marcado queda igual.
 */
function plantillaPortada(html) {
  const A = "combinado.html";
  let t = html;
  const p = (buscar, poner) => { t = parche(t, A, buscar, poner); };
  // Tarjeta del reloj
  p("<h3>Martes, 20 de octubre</h3><p class=\"clock-year\">2026</p>", "<h3>{{fecha}}</h3><p class=\"clock-year\">{{anio}}</p>");
  p("<time>12:00<span>:00</span></time><small>HORA DE REFERENCIA</small>", "<time>{{hora}}<span>{{segundos}}</span></time><small>HORA DE REFERENCIA</small>");
  p("<span>DÍA PLANETARIO</span><strong>♂ Marte</strong>", "<span>DÍA PLANETARIO</span><strong>{{diaPlanetario}}</strong>");
  p("<span>HORA PLANETARIA</span><strong>♄ Saturno</strong>", "<span>HORA PLANETARIA</span><strong>{{horaPlanetaria}}</strong>");
  p("<span>Hora 6 de 24</span><strong>11:32 — 12:38</strong>", "<span>{{horaNumero}}</span><strong>{{horaRango}}</strong>");
  p("↗ Amanecer <b>06:05</b>", "↗ Amanecer <b>{{amanecer}}</b>");
  p("↘ Ocaso <b>19:12</b>", "↘ Ocaso <b>{{ocaso}}</b>");
  // La Luna
  p("<span class=\"phase-badge\">68,5% iluminada</span>", "<span class=\"phase-badge\">{{iluminada}}</span>");
  p("<h3>Gibosa creciente</h3><p>en Acuario <span>18°50′</span></p>", "<h3>{{fase}}</h3><p>en {{lunaSigno}} <span>{{lunaGrado}}</span></p>");
  p("<span>PRÓXIMO INGRESO</span><strong>Piscis</strong><time>21 oct · 09:35</time>", "<span>PRÓXIMO INGRESO</span><strong>{{ingresoSigno}}</strong><time>{{ingresoFecha}}</time>");
  p("<span>PRÓXIMA LUNA LLENA</span><strong>Tauro</strong><time>26 oct · 01:11</time>", "<span>PRÓXIMA LUNA LLENA</span><strong>{{llenaSigno}}</strong><time>{{llenaFecha}}</time>");
  p("<span><i></i> Luna no vacía de curso</span>", "<span><i></i> {{curso}}</span>");
  // El radar
  p("<div class=\"radar-time\"><time>14:42</time>", "<div class=\"radar-time\"><time>{{radarHora}}</time>");
  p("<div class=\"aspect-glyphs\" aria-hidden=\"true\">☽ <span>□</span> ☿</div><h3>Luna en cuadratura <br>con Mercurio</h3><p>El próximo aspecto mayor de la Luna antes de su cambio de signo.</p>",
    "<div class=\"aspect-glyphs\" aria-hidden=\"true\">☽ <span>{{radarGlifo}}</span> {{radarOtro}}</div><h3>Luna en {{radarAspecto}} <br>con {{radarPlaneta}}</h3>{{radarTexto}}");
  // La cinta: las dos copias (la segunda es para el bucle sin saltos)
  p("<div class=\"planet-ticker\" aria-label=\"Posiciones planetarias del corte de referencia\">", "<div class=\"planet-ticker\" aria-label=\"Posiciones planetarias del día\">");
  for (const oculta of ["", " aria-hidden=\"true\""]) {
    t = parcheTramo(t, A, `<div class="ticker-copy"${oculta}>`, "</div>", `<div class="ticker-copy"${oculta}>{{cinta}}</div>`,
      (x) => (x.match(/<span class="ticker-item">/g) || []).length === 10 && x.includes("Plutón <strong>Acuario 03°04′</strong>"));
  }
  // El barómetro (a las 12:00 del día)
  p("<strong>60<small>%</small></strong><b>Tensión</b><div class=\"mini-track\"><i style=\"width:60%\"></i></div>",
    "<strong>{{baroTension}}<small>%</small></strong><b>Tensión</b><div class=\"mini-track\"><i style=\"width:{{baroTension}}%\"></i></div>");
  p("<strong>47<small>%</small></strong><b>Aire</b><div class=\"mini-track\"><i style=\"width:47%\"></i></div>",
    "<strong>{{baroElemento}}<small>%</small></strong><b>{{baroElementoNombre}}</b><div class=\"mini-track\"><i style=\"width:{{baroElemento}}%\"></i></div>");
  p("<strong>64<small>%</small></strong><b>Fija</b><div class=\"mini-track\"><i style=\"width:64%\"></i></div>",
    "<strong>{{baroModalidad}}<small>%</small></strong><b>{{baroModalidadNombre}}</b><div class=\"mini-track\"><i style=\"width:{{baroModalidad}}%\"></i></div>");
  p("<p class=\"baro-summary\">Predominio de aire; énfasis en sostener.</p>", "<p class=\"baro-summary\">{{baroResumen}}</p>");
  // Las cuatro tarjetas de datos
  const filas = (n) => (x) => (x.match(/<div class="bar-row">/g) || []).length === n;
  t = parcheTramo(t, A, "<h3>Balance de elementos</h3><span>PONDERADO</span></div><div class=\"bar-list\">", "</article>",
    "<h3>Balance de elementos</h3><span>PONDERADO</span></div><div class=\"bar-list\">{{elementos}}</div></article>", filas(4));
  t = parcheTramo(t, A, "<h3>Modalidades</h3><span>RITMOS</span></div><div class=\"bar-list\">", "</article>",
    "<h3>Modalidades</h3><span>RITMOS</span></div><div class=\"bar-list\">{{modalidades}}</div></article>", filas(3));
  t = parcheTramo(t, A, "<h3>Retrógrados</h3><span>4 ACTIVOS</span></div><ul class=\"planet-list\">", "</ul>",
    "<h3>Retrógrados</h3><span>{{retroCuenta}}</span></div><ul class=\"planet-list\">{{retro}}</ul>", (x) => (x.match(/<li>/g) || []).length === 4);
  t = parcheTramo(t, A, "<h3>Ciclos de fondo</h3><span>LARGO PLAZO</span></div><ul class=\"planet-list\">", "</ul>",
    "<h3>Ciclos de fondo</h3><span>LARGO PLAZO</span></div><ul class=\"planet-list\">{{ciclos}}</ul>", (x) => (x.match(/<li>/g) || []).length === 3);
  p("<p class=\"reference-note\">Datos del cielo: corte de referencia del 20/10/2026, 12:00 de Buenos Aires. La cinta muestra esas posiciones en movimiento.</p>",
    "<p class=\"reference-note\">Datos del cielo: {{nota}} de Buenos Aires. La cinta muestra esas posiciones en movimiento.</p>");
  // La línea de tiempo: el período (los eventos salen de data.js)
  p("<span class=\"period\">20 OCT — 18 NOV 2026<br>BUENOS AIRES · ART</span>", "<span class=\"period\">{{periodo}}</span>");
  // Nada del corte fijo puede quedar en esos dos bloques
  const bloques = t.slice(t.indexOf('<section class="compact-sky section" id="cielo">'), t.indexOf('<section class="of doors" id="areas"'));
  for (const x of ["20/10", "corte de referencia", "corte fijo", "2026"]) if (bloques.includes(x)) falla(`${A}: el cielo o la línea de tiempo todavía dicen «${x}»`);
  return t;
}

/**
 * La suscripción de la franja de canales, conectada de verdad (S5). Se agrega
 * lo justo al formulario del prototipo: a dónde postea, la casilla de
 * consentimiento SIN TILDAR (doc 02 §7.3, regla 1) con el enlace a
 * /privacidad, la página de origen y un campo señuelo oculto para robots.
 * El resto del marcado queda igual.
 */
function formSuscripcion(html) {
  const A = "combinado.html";
  let t = html;
  t = parche(t, A, '<form class="boletin" novalidate aria-labelledby="bo-titulo">',
    '<form class="boletin" action="/suscripcion" method="post" novalidate aria-labelledby="bo-titulo">');
  t = parche(t, A, '<button type="submit" class="hc-btn primary">Suscribirme</button></div><span class="bo-err" id="bo-err" role="alert"></span></form>',
    '<button type="submit" class="hc-btn primary">Suscribirme</button></div>'
    + `<label class="bo-text bo-consentimiento"><input type="checkbox" name="consentimiento" value="si" required> ${CONSENTIMIENTO_HTML}</label>`
    + '<input type="hidden" name="pagina" value="/">'
    + '<div class="bo-oculto" aria-hidden="true"><label for="bo-web">No completar este campo</label><input id="bo-web" type="text" name="web" tabindex="-1" autocomplete="off"></div>'
    + '<span class="bo-err" id="bo-err" role="alert"></span></form>');
  return t;
}

const PARCHES = {
  "app.js": (t) => {
    // Busca su propio <script> por el final del src: con ?v= ya no termina en app.js
    t = parche(t, "app.js", `script[src$="app.js"]`, `script[src*="app.js"]`);
    // «El enfoque»: el párrafo que describía el corte fijo no va (el resto es de Fernando, sin tocar)
    t = parcheTramo(t, "app.js", "<p>Esta versión de diseño presenta un <strong>corte fijo del 20 de octubre de 2026", "</p>", "",
      (x) => x.includes("La vista conserva ese instante durante la revisión del diseño."));
    // El año del evento sale del evento, no de un "/2026" fijo
    return parche(t, "app.js", "e.displayDate+'/2026 · '", "e.displayDate+'/'+e.date.slice(0,4)+' · '");
  },
  // data.js: A29_DATA lo arma el motor en cada tramo (src/lib/portada.js); A29_SLIDES queda tal cual
  "data.js": (t) => {
    const ini = "window.A29_DATA=", fin = ";\nwindow.A29_SLIDES=";
    if (!t.startsWith(ini) || t.split(fin).length !== 2) falla("data.js: no tiene la forma window.A29_DATA={…};window.A29_SLIDES=…");
    const viejo = JSON.parse(t.slice(ini.length, t.indexOf(fin)));
    if (!Array.isArray(viejo.events) || viejo.utc !== "2026-10-20T15:00:00.000Z") falla("data.js: A29_DATA no es el corte que se esperaba");
    return ini + "{{A29_DATA}}" + t.slice(t.indexOf(fin));
  },
  // Los diálogos del cielo: lo calculado sale de A29_DATA.cielo; el texto fijo de Fernando queda
  "compact.js": (t) => {
    t = parche(t, "compact.js", "<p>En esta vista previa todos los datos corresponden al 20/10/2026, 15:00 UTC. Es una referencia de diseño calculada, sin actualización astronómica en vivo.</p>", "");
    return parcheTramo(t, "compact.js", "'Luna no vacía de curso.','<p>En el corte del 20/10/2026", "</p>');",
      "window.A29_DATA.cielo.criterio.titulo,window.A29_DATA.cielo.criterio.cuerpo);",
      (x) => x.includes("Se consideran aspectos mayores exactos") && x.includes("El reloj es la hora de referencia del panel."));
  },
  "variantes/rich.js": (t) => {
    t = parcheTramo(t, "rich.js", "'EN EL RADAR / ASPECTO LUNAR','Luna en cuadratura con Mercurio',", "</p>');",
      "'EN EL RADAR / ASPECTO LUNAR',window.A29_DATA.cielo.radar.titulo,window.A29_DATA.cielo.radar.cuerpo);",
      (x) => x.includes("17:42:00.774 UTC") && x.includes("no determina una decisión empresarial o financiera."));
    return parcheTramo(t, "rich.js", "'Amanecer y ocaso de referencia','<p>Para el 20 de octubre de 2026", "</p>');",
      "'Amanecer y ocaso de referencia',window.A29_DATA.cielo.solar.cuerpo);",
      (x) => x.includes("En el corte de las 12:00") && x.includes("pueden modificar la observación."));
  },
  // La línea de tiempo: ventana, nombres cortos y "Hoy" desde A29_DATA, no del corte escrito a mano
  "linea-tiempo/opciones-lt.js": (t) => {
    const A = "opciones-lt.js";
    t = parcheTramo(t, A, "const NAME = { 0: 'Venus · Plutón',", "};",
      "const NAME = Object.fromEntries(window.A29_DATA.events.map(e => [e.index, e.short]));", (x) => x.includes("10: 'Sol · Júpiter'"));
    t = parche(t, A, "const START = Date.parse('2026-10-20T03:00:00Z'), DAY = 864e5, DAYS = 30,",
      "const START = Date.parse(window.A29_DATA.agenda.inicio), DAY = 864e5, DAYS = window.A29_DATA.agenda.dias,");
    t = parche(t, A, `// "Hoy": el día real si cae dentro del corte; si no, el primer día del corte (vista de ejemplo)`,
      `// "Hoy": el día real si cae dentro de la ventana; si no, el instante de los datos del servidor`);
    t = parche(t, A, "const NOW = Date.now() >= START && Date.now() < END ? Date.now() : START;",
      "const NOW = Date.now() >= START && Date.now() < END ? Date.now() : Date.parse(window.A29_DATA.utc);");
    t = parche(t, A, "' tránsitos · horarios de Buenos Aires · corte de referencia del 20/10 al 18/11, no es en vivo'", "' tránsitos · horarios de Buenos Aires'");
    return parche(t, A, "No hay tránsitos de este tipo en el corte. Probá con «Todo».", "No hay tránsitos de este tipo en estos días. Probá con «Todo».");
  },
  // La suscripción: manda el formulario a POST /suscripcion en vez de mostrar la vista previa
  "variantes/portada.js": (t) => parcheTramo(t, "portada.js",
    "// Suscripción al cielo del mes: valida el mail y avisa que es una vista previa",
    " f.reset(); i.removeAttribute('aria-invalid');\n });\n})();",
    `// Suscripción al cielo del mes: valida el mail y la casilla, y la anota en el servidor (POST /suscripcion).
// Sin JS el formulario hace el mismo POST y el servidor vuelve a #canales con el aviso.
(() => {
 const f = document.querySelector('.boletin');
 if (!f) return;
 const i = f.elements.email, casilla = f.elements.consentimiento, err = f.querySelector('#bo-err');
 let enviando = false;
 f.addEventListener('submit', async e => {
  e.preventDefault();
  if (enviando) return;
  const v = i.value.trim();
  const m = !v ? ${JSON.stringify(AVISOS.vacio)} : /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v) ? '' : ${JSON.stringify(AVISOS.mail)};
  err.textContent = m; i.setAttribute('aria-invalid', String(!!m));
  if (m) { i.focus(); return; }
  if (!casilla.checked) { err.textContent = ${JSON.stringify(AVISOS.consentimiento)}; casilla.focus(); return; }
  enviando = true;
  let r = null;
  try {
   const res = await fetch(f.action, { method: 'POST', headers: { accept: 'application/json' }, body: new URLSearchParams(new FormData(f)) });
   r = await res.json();
  } catch (x) { r = null; }
  enviando = false;
  if (!r || !r.ok) {
   err.textContent = (r && r.mensaje) || ${JSON.stringify(AVISOS.error)};
   if (r && r.campo === 'email') { i.setAttribute('aria-invalid', 'true'); i.focus(); }
   else if (r && r.campo === 'consentimiento') casilla.focus();
   return;
  }
  err.textContent = '';
  const mail = v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  openDialog('SUSCRIPCIÓN / EL CIELO DEL MES', 'Gracias por sumarte', '<p>Anotamos <strong>' + mail + '</strong> para recibir el cielo del mes.</p>');
  f.reset(); i.removeAttribute('aria-invalid');
 });
})();`,
    (x) => x.includes("Por ahora es una vista previa: este mail no se guardó ni se envió.")),
  // El enlace de la casilla: .channels a (canales.css) es la tarjeta de cada red; acá vuelve a ser un enlace de texto
  "variantes/portada.css": (t) => parche(t, "portada.css",
    ".bo-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n",
    ".bo-oculto{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\n"
    + ".channels .bo-consentimiento a{display:inline;padding:0;border-radius:0;color:inherit;text-decoration:underline}\n"
    + ".channels .bo-consentimiento a:hover{background:none}\n"),
  "variantes/menu.js": (t) => {
    t = parche(t, "menu.js", `cta.href = 'membresia.html';`, `cta.href = '${destino("membresia.html", D)}';`);
    // Regla 4: con Membresía apagada el «Sumarme» del encabezado no se genera
    if (membresiaApagada) {
      t = parche(t, "menu.js", "header.appendChild(cta); header.appendChild(btn);",
        "header.appendChild(btn); // «Sumarme» no va: Membresía está apagada (regla 4)");
    }
    return t;
  },
  // Con la carta en Próximamente, el formulario y "Ver la carta de ahora" van a la pantalla: nada de cartas de ejemplo
  "variantes/herramientas.js": (t) => {
    const carta = destino("carta.html", D);
    t = parche(t, "herramientas.js", `location.assign('carta.html?modo=momento')`, `location.assign('${destino("carta.html?modo=momento", D)}')`);
    if (!carta.startsWith("/proximamente")) falla("herramientas.js: la carta está visible pero no se publica");
    // S4: el diálogo de la carta del momento hablaba del corte fijo del cielo; esa frase no va
    t = parche(t, "herramientas.js",
      `<p>Los datos del panel "El cielo de hoy" siguen siendo un corte fijo del 20/10/2026.</p>`, "");
    return parche(t, "herramientas.js", `location.assign('carta.html?'+q.toString())`, `location.assign('${carta}')`);
  },
  // Las puertas de «Cuatro áreas de trabajo»
  "variantes/oferta.js": (t) => {
    if (!serviciosApagada) falla("oferta.js: Servicios está visible pero no se publica");
    return parche(t, "oferta.js", 'href="servicios.html#${a.id}"', `href="${destino("servicios.html", D)}"`);
  },
  "variantes/proximamente.js": (t) => {
    t = parche(t, "proximamente.js", `'proximamente.html?p='`, `'/proximamente?p='`);
    t = parche(t, "proximamente.js", String.raw`/(^|\/)proximamente\.html/`, String.raw`/(^|\/)proximamente(\.html)?([?#]|$)/`);
    // Lo visible va a su URL limpia ("ruta"), no al archivo del prototipo
    t = parche(t, "proximamente.js", "location.replace(it.pagina.archivo + sel);", "location.replace((it.pagina.ruta || it.pagina.archivo) + sel);");
    // El menú viene ya marcado desde el servidor: acá solo se señala la página actual
    return parche(t, "proximamente.js", "if (fraseEl) fraseEl.textContent = frase(it);",
      "if (fraseEl) fraseEl.textContent = frase(it);\n  if (it) document.querySelectorAll('header nav a[href=\"' + aPantalla(it.parte ? it.parte.id : it.pagina.id) + '\"]').forEach(a => a.setAttribute('aria-current', 'page'));");
  },
};
for (const rel of Object.keys(PARCHES)) if (!publicados.has(rel)) falla(`${rel} tiene retoque pero no se publica`);

// --- 4. Escribir -------------------------------------------------------------
const escribir = (rel, contenido) => {
  const dest = path.join(WEB_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contenido);
};
let bytes = 0;
const lista = [...publicados].sort();
for (const rel of lista) {
  const archivo = path.basename(rel);
  if (rel.startsWith("variantes/") && Object.values(PAGINAS).includes(archivo) && rel === `variantes/${archivo}`) {
    const html = reescribirHtml(htmls[archivo], archivo);
    escribir(rel, archivo === "combinado.html" ? formSuscripcion(plantillaPortada(html)) : html);
  } else if (rel === "variantes/datos/visibilidad.json") {
    escribir(rel, JSON.stringify(D, null, 1) + "\n");
  } else if (PARCHES[rel]) {
    escribir(rel, PARCHES[rel](leer(rel)));
  } else {
    fs.mkdirSync(path.dirname(path.join(WEB_DIR, rel)), { recursive: true });
    fs.copyFileSync(path.join(ORIGEN, rel), path.join(WEB_DIR, rel));
  }
  bytes += fs.statSync(path.join(WEB_DIR, rel)).size;
}
escribir("publicado.json", JSON.stringify({
  _ayuda: "Lo genera scripts/importar-web.mjs. El servidor publica SOLO estos archivos (rutas desde src/web/); lo de variantes/ se sirve en la raíz.",
  version: VERSION,
  entrega: path.basename(path.dirname(ORIGEN)),
  paginas: PAGINAS,
  archivos: lista,
}, null, 1) + "\n");

// Lo que quedó en src/web/ de una importación anterior y ya no se publica: se avisa, no se borra.
const sobrantes = [];
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name), rel = path.relative(WEB_DIR, abs).split(path.sep).join("/");
    if (e.isDirectory()) recorrer(abs);
    else if (rel !== "publicado.json" && !publicados.has(rel)) sobrantes.push(rel);
  }
};
recorrer(WEB_DIR);

console.log(`✓ ${lista.length} archivos publicados en src/web/ (${(bytes / 1048576).toFixed(1)} MB), versión ${VERSION}`);
console.log(`  apagadas: ${APAGADAS.join(", ")}`);
if (sobrantes.length) {
  console.log(`  ⚠ ${sobrantes.length} archivos en src/web/ que ya no se publican (no se sirven; borrarlos a mano):`);
  for (const s of sobrantes) console.log(`    ${s}`);
}

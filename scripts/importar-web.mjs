// Importa la web nueva desde la entrega de Fernando a src/web/.
//
//   node scripts/importar-web.mjs <carpeta web/ de la entrega>
//
// Se publica SOLO lo que cargan las cuatro páginas (combinado.html, sobre-mi.html,
// proximamente.html y carta.html): sus <link>, <script>, imágenes, srcset, url() y
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
//   - la web no junta ningún dato de los visitantes (S5, S9): la suscripción
//     mensual queda apagada (parte «boletin»: no aparece, regla 3 del doc 05) y
//     la carta natal no pide mail; la hora de nacimiento es obligatoria (S10)
//   - las fuentes, autoalojadas (S11): las hojas de Google pasan a las de
//     src/web/assets/fuentes/ (las baja scripts/bajar-fuentes-web.mjs, una vez)
//   - el pie: «Imágenes: Anaretico 29» (S12) y el enlace al código fuente
//   - la carta (T8): carta.html, la opción 2 «Observatorio» elegida, conectada
//     a la API (POST /api/carta, GET /api/carta/momento) en vez de a las cartas
//     de ejemplo, sin los rótulos de prototipo, con «Descargar mi carta en PDF»
//     (impresión del navegador) y el límite de 2 cartas natales por semana;
//     desde T9 la carta se muestra sola, sin textos de interpretación ni
//     frases de contacto (S15, datos/significados.json ya no se publica), el
//     momento sin PDF (S16) y sin carta a medias si falta una parte (S18)
// Cada retoque exige encontrar EXACTAMENTE lo que espera: si el prototipo
// cambia, la importación se corta en vez de publicar algo a medias.
import fs from "node:fs";
import path from "node:path";
import { refsHtml, refsCss, fetchsJs, rutasJson, refsSvg, fotosCarrusel, esExterna, etiquetas } from "./web-refs.mjs";
import { WEB_DIR, PAGINAS, destino, pagVisible } from "../src/lib/web-nueva.js";

/** Versión para vaciar la caché de CSS y JS: subirla en cada importación. */
const VERSION = "20261124.5";
const CODIGO_FUENTE = "https://github.com/nahuerpcmacservice/anaretico29";
/** Host canónico (config.js, hostCanonico): el og:image tiene que ser absoluto. */
const SITIO = "https://www.anaretico29.com";
/**
 * Lo que el visitante ve como "Próximamente" (pedido de Fernando, 23/11/2026:
 * inicio y su recorrido al público, "el resto que diga en proximamente").
 * Servicios está bloqueada en el JSON de muestra (regla 1), pero Fernando la
 * pidió en Próximamente mientras la arma: se le saca el bloqueo.
 */
const APAGADAS = ["servicios", "research", "academia", "revista", "membresia"];
/**
 * Partes apagadas (regla 3 del doc 05: una parte apagada no aparece en su
 * página). Fernando, 24/11/2026: "Newsletter apagado por ahora, en
 * «Próximamente». Sacá la suscripción que guarda mails" y "la carta natal se ve
 * en pantalla sin pedir mail ni nombre".
 */
const PARTES_APAGADAS = { inicio: ["boletin"], carta: ["mail-carta"] };
/**
 * Las fuentes autoalojadas (S11): no vienen en la entrega, las baja
 * scripts/bajar-fuentes-web.mjs a src/web/assets/fuentes/. Se publican tal cual
 * están ahí (woff2, sus dos hojas y las licencias OFL).
 */
const FUENTES = "assets/fuentes";
/** URL limpia de las entradas de visibilidad.json que se publican. */
const RUTAS = { inicio: "/", enfoque: "/", recorrido: "/sobre-mi", carta: "/carta" };

const origen = process.argv[2];
if (!origen || !fs.existsSync(path.join(origen, "variantes", "combinado.html"))) {
  console.error("Uso: node scripts/importar-web.mjs <carpeta web/ de la entrega>  (tiene que tener variantes/combinado.html)");
  process.exit(1);
}
const ORIGEN = path.resolve(origen);
// Lo propio (las fuentes) se lee de src/web/; todo lo demás, de la entrega
let propios = new Set();
const base = (rel) => (propios.has(rel) ? WEB_DIR : ORIGEN);
const leer = (rel) => fs.readFileSync(path.join(base(rel), rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(base(rel), rel)) && fs.statSync(path.join(base(rel), rel)).isFile();
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
for (const [pag, ids] of Object.entries(PARTES_APAGADAS)) {
  const p = D.paginas.find((x) => x.id === pag) || falla(`visibilidad.json no tiene la página ${pag}`);
  for (const id of ids) ((p.partes || []).find((x) => x.id === id) || falla(`${pag} no tiene la parte ${id}`)).visible = false;
}
const boletinApagado = PARTES_APAGADAS.inicio.includes("boletin");
const mailCartaApagado = PARTES_APAGADAS.carta.includes("mail-carta");

// Las fuentes propias (S11): tienen que estar bajadas antes de importar
const dirFuentes = path.join(WEB_DIR, FUENTES);
if (!fs.existsSync(path.join(dirFuentes, "texto.css")) || !fs.existsSync(path.join(dirFuentes, "simbolos.css"))) {
  falla(`faltan las fuentes en src/web/${FUENTES}: correr antes node scripts/bajar-fuentes-web.mjs`);
}
propios = new Set(fs.readdirSync(dirFuentes).filter((f) => /\.(woff2|css|txt)$/.test(f)).map((f) => `${FUENTES}/${f}`));
if (![...propios].some((f) => f.endsWith(".txt"))) falla(`src/web/${FUENTES} no tiene las licencias OFL`);
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
  // El pie: S12 (el crédito de las imágenes) y AGPL §13 (Swiss Ephemeris), el
  // enlace al código fuente publicado. El texto legal queda igual.
  const pie = "<br>Fotografías con sus créditos</small></footer>";
  const cierrePie = out.match(/<\/small><\/footer>/g) || [];
  if (cierrePie.length !== 1 || out.split(pie).length !== 2) falla(`${archivo}: el pie no termina en «Fotografías con sus créditos»`);
  out = out.replace(pie, () => `<br>Imágenes: Anaretico 29<br><a href="${CODIGO_FUENTE}" rel="noopener">Código fuente (AGPL)</a></small></footer>`);
  // S11: los símbolos (Noto Sans Symbols, Symbols 2 y Noto Sans, recortadas a los
  // glifos del sitio) salen de nuestra hoja, en el mismo lugar que la de Google
  const google = out.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Noto\+Sans\+Symbols&amp;family=Noto\+Sans\+Symbols\+2&amp;family=Noto\+Sans&amp;text=[^"]*&amp;display=block">/g) || [];
  if (google.length > 1) falla(`${archivo}: más de una hoja de símbolos de Google`);
  if (google.length) {
    quitar(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"><link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/g, 1, "preconnect a Google Fonts");
    out = out.replace(google[0], () => `<link rel="stylesheet" href="../${FUENTES}/simbolos.css">`);
  }
  if (/fonts\.(googleapis|gstatic)\.com/.test(out)) falla(`${archivo}: quedó un pedido a Google Fonts`);
  if (archivo === "combinado.html") {
    // S4: la tarjeta «Carta del momento» nombraba el corte fijo; queda solo su botón (a Próximamente)
    quitar(/<p class="t-text">Por ahora, el cielo del corte de referencia: 20\/10\/2026, 12:00 de Buenos Aires\.<\/p>/g,
      1, "frase del corte en Herramientas");
    // S5: la suscripción mensual, apagada (parte «boletin»): el formulario no va
    if (boletinApagado) {
      quitar(/<form class="boletin" novalidate aria-labelledby="bo-titulo">[\s\S]*?<\/form>/g, 1, "formulario «boletin»",
        (h) => h.includes("Recibí el cielo del mes en tu mail") && (h.match(/<form\b/g) || []).length === 1);
    }
    out = cartaSinMail(out);
  }
  if (archivo === "proximamente.html") {
    // Doc 05 §4.7: la franja de aprobación existe solo para que Fernando aprobara el diseño
    quitar(/<section class="pr-demo"[\s\S]*?<\/section>\n?/g, 1, "franja pr-demo",
      (h) => h.includes("no va en la web real") && (h.match(/<section\b/g) || []).length === 1);
    // "Ver servicios" no tiene a dónde llevar con Servicios en Próximamente
    if (serviciosApagada) quitar(/<a [^>]*data-pr-servicios[^>]*>Ver servicios<\/a>/g, 1, "«Ver servicios»");
  }
  if (archivo === "carta.html") {
    // Regla 3: la franja del mail es una parte apagada (S9: la carta no se manda por mail)
    if (mailCartaApagado) {
      quitar(/<section class="ob-mail" data-solo="natal"[\s\S]*?<\/section>\n/g, 1, "franja «También te la enviamos por mail»",
        (h) => h.includes("Usamos tu mail únicamente para enviártela.") && (h.match(/<section\b/g) || []).length === 1);
    }
    out = cartaPublicada(out);
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
// Los textos de la carta (datos/significados.json) ya no se publican (S15): la carta se muestra sola.
// carta.js los pedía con new URL('datos/' + nombre, …), que fetchsJs() no lee; el retoque de carta.js saca ese pedido.
if (!leer("variantes/carta.js").includes("pedir('significados.json')")) falla("carta.js ya no pide significados.json como se espera");
// Las fotos del carrusel: portada-plaza.js las arma desde data.js
if (!leer("variantes/portada-plaza.js").includes("`${base}portada/${s.id}-${w}.${ext} ${w}w`")) {
  falla("portada-plaza.js ya no arma las fotos como espera fotosCarrusel()");
}
for (const f of fotosCarrusel(leer("data.js"))) sumar(f, "data.js (A29_SLIDES)");
// Las fuentes propias: las hojas, los woff2 y las licencias (styles.css las importa una vez parchado)
for (const f of propios) sumar(f, "las fuentes autoalojadas");
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
  // Sin aspectos que cuenten, la tensión es «—» (criterios de Fernando): el «%» va con el número
  p("<strong>60<small>%</small></strong><b>Tensión</b><div class=\"mini-track\"><i style=\"width:60%\"></i></div>",
    "<strong>{{baroTension}}</strong><b>Tensión</b><div class=\"mini-track\"><i style=\"width:{{baroTensionAncho}}%\"></i></div>");
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
 * El formulario de la carta natal (Herramientas) sin mail (S9) y con la hora
 * obligatoria (S10). Del texto de Fernando se saca solo lo que promete el mail.
 */
function cartaSinMail(html) {
  const A = "combinado.html";
  let t = html;
  t = parche(t, A, '<p class="t-text">Calculada con tu fecha, hora y lugar de nacimiento. Te la mostramos y te la enviamos a tu mail.</p>',
    '<p class="t-text">Calculada con tu fecha, hora y lugar de nacimiento. Te la mostramos en pantalla.</p>');
  t = parche(t, A, '<label><span>Hora <span class="t3-opt">(opcional)</span></span><input type="time" name="hora"></label>',
    '<label><span>Hora</span><input type="time" name="hora" required aria-describedby="err-hora"><span class="t3-err" id="err-hora" role="alert"></span></label>');
  t = parche(t, A, '<label class="t3-mail">Tu mail<input type="email" name="email" placeholder="nombre@correo.com" required autocomplete="email" inputmode="email" aria-describedby="err-email hint-email"><span class="t3-err" id="err-email" role="alert"></span></label>', "");
  // La aclaración del botón era sobre el mail; «Te la mostramos en pantalla» ya lo dice el texto de arriba
  t = parche(t, A, '<small id="hint-email">Te la mostramos en pantalla y te enviamos una copia a tu mail. Usamos tu mail únicamente para eso.</small>', "");
  return t;
}

/**
 * La pantalla de la carta (carta.html, opción 2 «Observatorio») como se publica:
 * sin los rótulos de prototipo (doc 03 §1.3, §4.1, §11.2 y §11.6) y con el botón
 * del PDF (S14) en el lugar de la franja del mail.
 */
function cartaPublicada(html) {
  const A = "carta.html";
  let t = html;
  const p = (buscar, poner) => { t = parche(t, A, buscar, poner); };
  p("<title>Anaretico 29 · Tu carta natal (ejemplo) · Opción 2</title>", "<title>Anaretico 29 · Tu carta natal</title>");
  p('<meta property="og:title" content="Anaretico 29 · Tu carta natal (ejemplo) · Opción 2">', '<meta property="og:title" content="Anaretico 29 · Tu carta natal">');
  p('<meta property="og:description" content="Carta natal y carta del momento de Anaretico 29. Prototipo con datos de ejemplo.">',
    '<meta property="og:description" content="Carta natal y carta del momento de Anaretico 29.">');
  p(" balance de elementos y aspectos con sus posibles significados. Prototipo con datos de ejemplo.\">", " balance de elementos y aspectos.\">");
  // El aviso de prototipo se quita al publicar (doc 03 §4.1): la carta ya no es de ejemplo
  p('<div class="ob-proto" role="note"><div class="ob-wrap"><strong>Carta de ejemplo</strong><span data-proto-d>Prototipo con datos de ejemplo calculados con Swiss Ephemeris.</span></div></div>\n', "");
  p('<p class="ob-kicker" data-kicker>Carta natal · ejemplo</p>', '<p class="ob-kicker" data-kicker>Carta natal</p>');
  // Sin hora no hay carta (S10) y las cartas de ejemplo no se publican (doc 03 §11.2)
  p('<a class="ob-link" data-sinhora-link href="carta.html?sinhora=1">Ver el ejemplo sin hora de nacimiento</a>', "");
  p('<span class="ob-sello" data-sello>Ejemplo</span>', '<span class="ob-sello" data-sello>Con tus datos</span>');
  // S14: «Descargar mi carta en PDF», debajo de los datos de la carta (lo muestra carta-op2.js en la carta natal)
  p('<p class="ob-ingresado" data-ingresado hidden></p></section>\n</div>',
    '<p class="ob-ingresado" data-ingresado hidden></p></section>\n<div class="ob-pdf" data-pdf hidden><button type="button" class="ob-btn" data-pdf-btn>Descargar mi carta en PDF</button>' +
    '<p class="ob-peq">Se abre la ventana de impresión del navegador: elegí «Guardar como PDF».</p></div>\n</div>');
  const resto = /.{0,40}(?:ejemplo|Opción 2|Prototipo|sinhora=|sinhora-link|ob-mail).{0,40}/.exec(t);
  if (resto) falla(`${A}: quedó un rótulo de prototipo: ${resto[0]}`);
  return cartaSola(t);
}

/**
 * S15 (Fernando, 24/11/2026): «La carta se muestra sola, sin textos de
 * interpretación y sin ninguna frase que invite a contactarme. Queda el dibujo,
 * las posiciones, el balance y los aspectos.» Salen los avisos de «posible
 * significado», el panel «Lectura de lo elegido» y su lugar debajo de la
 * matriz, la columna «Área» de las casas, «Cómo leer tu carta» y el cierre
 * «Una lectura más cercana» (consulta por WhatsApp y «Ver servicios»). Quedan
 * los títulos y los rótulos mínimos para leer los datos. El menú, los canales,
 * el pie y el aviso del límite (S14, pedido por Fernando) no se tocan.
 */
function cartaSola(html) {
  const A = "carta.html";
  let t = html;
  const p = (buscar, poner) => { t = parche(t, A, buscar, poner); };
  const fuera = (re, nombre, chequeo) => {
    const h = t.match(re) || [];
    if (h.length !== 1 || !chequeo(h[0])) falla(`${A}: esperaba 1 × ${nombre}, encontré ${h.length}`);
    t = t.replace(re, "");
  };
  p('<p class="ob-bajada" data-bajada>Tus posiciones, casas, balance de elementos y aspectos, con sus posibles significados.</p>',
    '<p class="ob-bajada" data-bajada>Tus posiciones, casas, balance de elementos y aspectos.</p>');
  fuera(/<p class="ob-nota"><span class="ob-n-lado">Elegí una fila: [^<]*<\/span><span class="ob-n-abajo">[^<]*<\/span><\/p>/g, "«Elegí una fila…»",
    (h) => h.includes("posible significado"));
  p('<p class="ob-nota"><span data-n-aspectos></span> Textos en borrador, en revisión.</p>', '<p class="ob-nota"><span data-n-aspectos></span></p>');
  fuera(/<span class="ob-n-lado ob-n-mx">Cada celda cruza dos puntos: el símbolo del aspecto y el orbe\. Elegí una para leer su posible significado en el panel\.<\/span><span class="ob-n-abajo ob-n-mx">[^<]*<\/span>/g,
    "«Cada celda cruza dos puntos…»", (h) => h.includes("debajo de la matriz"));
  p('<p class="ob-nota ob-mx-ayuda"></p>', '<p class="ob-nota ob-mx-ayuda">Cada celda cruza dos puntos: el símbolo del aspecto y el orbe.</p>');
  p('<div class="ob-mx-lectura" data-mx-inline id="ob-mx-lectura" hidden></div>\n', "");
  p('<p class="ob-nota" data-nota-casas>Casas Placidus: cada una marca un área de la vida.</p>', '<p class="ob-nota" data-nota-casas>Casas Placidus.</p>');
  p('<caption class="ob-sr">Las doce casas con su área y su cúspide</caption><thead><tr><th scope="col" class="ob-r">Casa</th><th scope="col">Área</th>',
    '<caption class="ob-sr">Las doce casas con su cúspide</caption><thead><tr><th scope="col" class="ob-r">Casa</th>');
  fuera(/<aside class="ob-panel" id="ob-panel"[\s\S]*?<\/aside>\n/g, "panel «Lectura de lo elegido»", (h) => h.includes("Lectura de lo elegido"));
  fuera(/<section class="ob-sec" id="como-leer"[\s\S]*?<\/section>\n/g, "«Cómo leer tu carta»", (h) => h.includes("Cómo leer tu carta") && (h.match(/<section\b/g) || []).length === 1);
  fuera(/<section class="ob-cierre"[\s\S]*?<\/section>\n/g, "cierre «Una lectura más cercana»",
    (h) => h.includes("Agendá una consulta") && h.includes("Ver servicios") && (h.match(/<section\b/g) || []).length === 1);
  const queda = /.{0,40}(?:signific|borrador|consulta|wa\.me|Lectura de|Cómo leer|data-panel|data-leer|data-cierre).{0,40}/i.exec(t);
  if (queda) falla(`${A}: quedó un texto de interpretación o de contacto: ${queda[0]}`);
  return t;
}

/**
 * window.A29Carta (carta.js): la carta sale del servidor, no de los JSON de
 * ejemplo. La natal se pide por POST con los datos que la portada deja después
 * del # (nunca en una dirección que llegue al servidor); el límite de 2 cartas
 * natales cada 7 días se cuenta acá, en el navegador (S14).
 */
const CARGAR_CARTA = ` // La carta la calcula el servidor (src/lib/carta.js). Si rechaza los datos (400), la promesa falla con { mensaje, campo } y no se dibuja nada.
 function api(url, opciones) {
  return fetch(url, opciones).then(function (r) {
   return r.json().catch(function () { return {}; }).then(function (j) {
    if (r.ok) return j;
    var e = new Error(j.mensaje || ('carta: ' + r.status)); e.mensaje = j.mensaje || ''; e.campo = j.campo || ''; e.estado = r.status; throw e;
   });
  });
 }
 // Los datos que dejó el formulario de la portada después del # (/carta#fecha=…&hora=…&lugar=…): el navegador no manda esa parte de la dirección.
 function entradaNatal() {
  var q = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return { fecha: q.get('fecha') || '', hora: q.get('hora') || '', lugar: (q.get('lugar') || '').slice(0, 120) };
 }
 // El límite de Fernando: 2 cartas natales cada 7 días por navegador, contadas acá (localStorage; el servidor no guarda nada ni ve IPs).
 // Se anota la huella de los datos (no los datos) y la hora de cada carta calculada con éxito. La ventana corre: cada carta deja de contar
 // a los 7 días justos de calculada. Volver a pedir los mismos datos no gasta otro lugar. Sin localStorage (bloqueado), no hay tope.
 var limite = {
  clave: 'a29-cartas-natales', max: 2, ventana: 7 * 864e5,
  huella: function (e) {
   var t = [e.fecha, e.hora, e.lugar].map(function (v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9:-]+/g, ' ').trim(); }).join('|');
   var h = 0x811c9dc5;
   for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
   return ('0000000' + h.toString(16)).slice(-8);
  },
  vigentes: function (lista, ahora) {
   return (Array.isArray(lista) ? lista : []).filter(function (x) { return x && typeof x.h === 'string' && typeof x.t === 'number' && ahora - x.t < limite.ventana; });
  },
  puede: function (lista, h, ahora) { var v = limite.vigentes(lista, ahora); return v.some(function (x) { return x.h === h; }) || v.length < limite.max; },
  anotar: function (lista, h, ahora) { var v = limite.vigentes(lista, ahora); if (!v.some(function (x) { return x.h === h; })) v.push({ h: h, t: ahora }); return v; },
  leer: function () { try { return JSON.parse(localStorage.getItem(limite.clave) || '[]'); } catch (e) { return []; } },
  guardar: function (lista) { try { localStorage.setItem(limite.clave, JSON.stringify(lista)); } catch (e) { /* sin localStorage no hay tope */ } }
 };
 // La huella de los datos que hay ahora después del # ('' si no hay datos, como en el ancla #inicio): carta-op2.js recalcula cuando cambia.
 function claveNatal() { var e = entradaNatal(); return e.fecha || e.hora || e.lugar ? limite.huella(e) : ''; }
 function pedirNatal() {
  var e = entradaNatal(), h, x;
  if (!e.fecha && !e.hora && !e.lugar) { x = new Error('sin datos'); x.sinDatos = true; return Promise.reject(x); }
  h = limite.huella(e);
  if (!limite.puede(limite.leer(), h, Date.now())) { x = new Error('límite semanal'); x.limite = true; return Promise.reject(x); }
  return api('/api/carta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e), cache: 'no-store' })
   .then(function (c) { limite.guardar(limite.anotar(limite.leer(), h, Date.now())); return c; });
 }
 // cargar('natal' | 'momento') o cargar() para leer ?modo= de la URL. Devuelve una promesa con { modo, carta, sinHora }.
 // S15: la carta se muestra sola, sin textos de interpretación: no se pide ningún archivo de textos.
 function cargar(modo) {
  modo = modoDe(modo);
  var carta = modo === 'momento' ? api('/api/carta/momento', {}) : pedirNatal();
  return carta.then(function (c) { return { modo: modo, carta: c, sinHora: sinHora(c) }; });
 }`;

/**
 * carta.js sin los textos (S15): las ayudas de datos arman las filas solo con la
 * carta del servidor (posiciones, casas, ángulos, balance y aspectos), sin
 * datos/significados.json. Reemplaza el tramo «textos» y «ayudas de datos».
 */
const DATOS_CARTA = ` // ---------------------------------------------------------------- ayudas de datos (filas listas para mostrar)
 // S15 (Fernando, 24/11/2026): la carta se muestra sola. Las filas llevan solo datos de la carta; no hay textos de interpretación.
 // Todas aceptan un último parámetro opcional modo; si falta, se toma de carta.meta.kind.
 function modoCarta(carta, modo) { return modo === 'momento' || modo === 'natal' ? modo : (carta && carta.meta && carta.meta.kind === 'momento' ? 'momento' : 'natal'); }
 function lista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }
 var ANGULO_ASP = { conjunction: '0°', sextile: '60°', square: '90°', trine: '120°', opposition: '180°' };
 // grupo: 'elements' | 'modalities'. El elemento (o la modalidad) que predomina con sus puntos, o «Equilibrio.» si empatan todos.
 function dominante(carta, grupo) {
  var b = carta.balance, dom = b['dominant_' + grupo];
  if (b['balanced_' + grupo]) return 'Equilibrio.';
  var filas = b[grupo].filter(function (x) { return dom.indexOf(x.id) >= 0; });
  return (filas.length > 1 ? 'Predominan ' : 'Predomina ') + lista(filas.map(function (f) { return f.name + ' (' + f.count + ' de ' + b.total + ')'; })) + '.';
 }
 function filasCuerpos(carta) {
  return carta.bodies.map(function (b) {
   return {
    id: b.id, glifo: glifoCuerpo(b.id), nombre: b.name, signoId: b.sign, glifoSigno: glifoSigno(b.sign), signo: b.sign_name,
    grados: grados(b), longitud: b.longitude, casa: b.house,
    retrogrado: b.retrograde, movimiento: b.retrograde ? 'Retrógrado' : 'Directo', velocidad: velTexto(b.speed)
   };
  });
 }
 function filasCasas(carta) {
  return carta.houses.map(function (h) {
   return { casa: h.house, glifoSigno: glifoSigno(h.sign), signo: h.sign_name, grados: grados(h), cuspide: h.cusp };
  });
 }
 function filasAngulos(carta) {
  return carta.angles.map(function (a) {
   return { id: a.id, etiqueta: ETIQ_ANG[a.id], nombre: a.name, glifoSigno: glifoSigno(a.sign), signo: a.sign_name, grados: grados(a), casa: a.house };
  });
 }
 // grupo: 'elements' | 'modalities'
 function filasBalance(carta, grupo) {
  var b = carta.balance, dom = b['dominant_' + grupo];
  return b[grupo].map(function (x) {
   return {
    id: x.id, nombre: x.name, cantidad: x.count, total: b.total, porcentaje: Math.round(x.percent),
    dominante: dom.indexOf(x.id) >= 0 && !b['balanced_' + grupo],
    puntos: x.points.map(function (p) { return { id: p, glifo: glifoCuerpo(p), nombre: nombre(carta, p) }; })
   };
  });
 }
 function listaAspectos(carta) {
  return carta.aspects.map(function (a, i) {
   return {
    indice: i, a: a.a, b: a.b, nombreA: nombre(carta, a.a), nombreB: nombre(carta, a.b), glifoA: glifoCuerpo(a.a), glifoB: glifoCuerpo(a.b),
    tipo: a.type, tipoNombre: a.type_name, tipoGlifo: glifoAspecto(a.type), angulo: ANGULO_ASP[a.type], orbe: a.orb_dm, orbeNumero: a.orb, fase: a.phase
   };
  });
 }
 function descripcion(carta, modo) {`;

/**
 * carta-op2.js sin textos de interpretación (S15): las filas, la matriz y la
 * lista de aspectos son datos (nada se elige para leer, no hay panel), el
 * balance dice solo qué predomina, y «Cómo leer» no va. Si a la carta le falta
 * alguna parte, no se dibuja nada (S18). Reemplaza el tramo desde la selección
 * hasta el final de pintar().
 */
const PANTALLA_SOLA = ` // ---------------------------------------------------------------- S15: la carta se muestra sola (Fernando, 24/11/2026)
 // El dibujo, las posiciones, las casas, el balance y los aspectos, sin textos de interpretación: nada se elige para leer.
 // Pasar el puntero por una celda de la matriz o por un aspecto de la lista resalta su línea en la rueda.
 function nombrePunto(glifoTxt, nombre) { // el glifo y el nombre, con la misma caja que tenían los botones del tablero
  var s = el('span', 'ob-sel ob-sel-dato');
  s.appendChild(glifoAsp(glifoTxt, 'ob-gp')); s.appendChild(el('span', '', nombre));
  return s;
 }
 function resaltarAl(n, svg, i) {
  n.addEventListener('mouseenter', function () { A.resaltar(svg, i); });
  n.addEventListener('mouseleave', function () { A.resaltar(svg, null); });
 }

 // ---------------------------------------------------------------- Posiciones: tablero de cotizaciones
 function tablero(carta) {
  var tb = $('[data-tabla] tbody'); tb.textContent = '';
  $('[data-col-casa]').hidden = false;
  A.filasCuerpos(carta).forEach(function (f) {
   var tr = el('tr', 'ob-fila'); tb.appendChild(tr);
   var c1 = el('th', 'ob-c-cuerpo'); c1.scope = 'row'; c1.appendChild(nombrePunto(f.glifo, f.nombre)); tr.appendChild(c1);
   var c2 = el('td', 'ob-c-signo'); c2.appendChild(glifo(f.glifoSigno, 'ob-gs')); c2.appendChild(el('span', '', f.signo)); tr.appendChild(c2);
   tr.appendChild(el('td', 'ob-r ob-num ob-c-grado', f.grados));
   tr.appendChild(el('td', 'ob-r ob-num ob-c-casa', f.casa));
   var c5 = el('td', 'ob-r ob-num ob-c-vel' + (f.retrogrado ? ' is-rx' : ''));
   if (f.retrogrado) { c5.appendChild(glifo(A.glifo.retrogrado, 'ob-rx')); c5.appendChild(sr('Retrógrado, ')); } else c5.appendChild(sr('Directo, '));
   c5.appendChild(el('span', '', f.velocidad)); tr.appendChild(c5);
  });
 }

 // ---------------------------------------------------------------- Casas y ángulos
 function casasYAngulos(carta) {
  var tc = $('[data-casas] tbody'), ta = $('[data-angulos] tbody'); tc.textContent = ''; ta.textContent = '';
  $('[data-con-casas]').hidden = false; $('[data-sinhora-casas]').hidden = true; $('[data-nota-casas]').hidden = false;
  A.filasCasas(carta).forEach(function (h) {
   var tr = el('tr');
   var a = el('th', 'ob-r ob-num', h.casa); a.scope = 'row'; tr.appendChild(a);
   var c = el('td', 'ob-num'); c.appendChild(glifo(h.glifoSigno, 'ob-gs')); c.appendChild(el('span', '', h.signo + ' ' + h.grados)); tr.appendChild(c);
   tc.appendChild(tr);
  });
  A.filasAngulos(carta).forEach(function (a) {
   var tr = el('tr', 'ob-fila'); ta.appendChild(tr);
   var c0 = el('th', 'ob-c-cuerpo'); c0.scope = 'row'; c0.appendChild(nombrePunto(a.etiqueta, a.nombre)); tr.appendChild(c0);
   var c1 = el('td', 'ob-num'); c1.appendChild(glifo(a.glifoSigno, 'ob-gs')); c1.appendChild(el('span', '', a.signo + ' ' + a.grados)); tr.appendChild(c1);
  });
 }

 // ---------------------------------------------------------------- Matriz de aspectos (triángulo planeta por planeta)
 function matriz(carta, lista, svg) {
  var puntos = carta.aspect_rules.points.filter(function (id) { return A.punto(carta, id); });
  var mapa = {};
  lista.forEach(function (a) { mapa[a.a + '|' + a.b] = a; mapa[a.b + '|' + a.a] = a; });
  var th = $('[data-matriz] thead'), tb = $('[data-matriz] tbody'), n = puntos.length;
  th.textContent = ''; tb.textContent = '';
  // las referencias ocupan la mitad vacía del triángulo (arriba a la derecha): ancho = la mitad de las columnas de celdas
  $('.ob-mx-w').style.setProperty('--mx-ancho', (Math.floor((n - 1) / 2) / n * 100).toFixed(2) + '%');
  var h0 = el('tr'), corner = el('td', 'ob-mx-h'); corner.appendChild(sr('Planeta o punto')); h0.appendChild(corner);
  function cab(id, fila) { var c = el('th', 'ob-mx-h'); c.scope = fila ? 'row' : 'col'; c.title = A.nombre(carta, id); c.appendChild(glifoAsp(A.glifo.cuerpo(id), 'ob-gp')); c.appendChild(sr(A.nombre(carta, id))); return c; }
  for (var c = 0; c < n - 1; c++) h0.appendChild(cab(puntos[c], false));
  th.appendChild(h0);
  for (var r = 1; r < n; r++) {
   var tr = el('tr'); tr.appendChild(cab(puntos[r], true));
   for (var k = 0; k < r; k++) {
    var td = el('td', 'ob-mx-c'), a = mapa[puntos[r] + '|' + puntos[k]];
    if (a) {
     var b = el('span', 'ob-mx-b');
     b.appendChild(sr(a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB + ', orbe ' + a.orbe + ', ' + a.fase));
     var g = glifo(a.tipoGlifo, 'ob-mx-g'); g.style.color = COLORES.aspectos[a.tipo]; b.appendChild(g);
     var o = el('span', 'ob-mx-o'); o.setAttribute('aria-hidden', 'true'); o.appendChild(el('span', 'ob-mx-f', MARCA[a.fase] || '')); o.appendChild(document.createTextNode(a.orbe)); b.appendChild(o);
     td.appendChild(b); resaltarAl(b, svg, a.indice);
    }
    tr.appendChild(td);
   }
   tb.appendChild(tr);
  }
 }

 // ---------------------------------------------------------------- Lista de aspectos (para lectores de pantalla y celulares)
 function aspectos(carta, svg, lista) {
  var cont = $('[data-aspectos]'), cab = cont.querySelector('.ob-asp-cab');
  cont.textContent = ''; if (cab) cont.appendChild(cab);
  lista.forEach(function (a) {
   var d = el('div', 'ob-asp'), s = el('div', 'ob-asp-r');
   var g = el('span', 'ob-asp-g'); g.appendChild(glifoAsp(a.glifoA, 'ob-gp')); var gt = glifo(a.tipoGlifo, 'ob-gt'); gt.style.color = COLORES.aspectos[a.tipo]; g.appendChild(gt); g.appendChild(glifoAsp(a.glifoB, 'ob-gp')); s.appendChild(g);
   s.appendChild(el('span', 'ob-asp-n', a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB));
   var o = el('span', 'ob-asp-o'); o.appendChild(el('span', 'ob-l', 'orbe ')); o.appendChild(document.createTextNode(a.orbe)); s.appendChild(o);
   var f = el('span', 'ob-asp-f ' + (a.fase === 'aplicativo' ? 'is-ap' : 'is-sp'));
   var mk = el('b', 'ob-mk', MARCA[a.fase] || ''); mk.setAttribute('aria-hidden', 'true'); f.appendChild(mk);
   f.appendChild(el('span', '', cap(a.fase))); s.appendChild(f);
   d.appendChild(s); resaltarAl(d, svg, a.indice);
   cont.appendChild(d);
  });
  var det = $('[data-lista]');
  if (window.matchMedia('(max-width:720px)').matches) det.open = true; // en el celular no hay matriz: la lista es la vista de los aspectos
 }

 // ---------------------------------------------------------------- Balance: barras horizontales, como la profundidad de un mercado
 function barras(cont, filas, dest, carta, grupo) {
  cont.textContent = '';
  filas.forEach(function (f) {
   var r = el('div', 'ob-b' + (f.dominante ? ' is-dom' : ''));
   var n = el('div', 'ob-b-n'); n.appendChild(el('strong', '', f.nombre));
   if (f.dominante) n.appendChild(el('em', 'ob-b-dom', 'Predomina'));
   r.appendChild(n);
   var t = el('div', 'ob-b-t'); t.style.setProperty('--n', f.total); t.setAttribute('role', 'img'); t.setAttribute('aria-label', f.nombre + ': ' + f.cantidad + ' de ' + f.total + ' puntos, ' + f.porcentaje + '%');
   for (var k = 0; k < f.total; k++) t.appendChild(el('i', k < f.cantidad ? 'on' : ''));
   r.appendChild(t);
   var c = el('div', 'ob-b-c'); c.appendChild(el('b', '', f.cantidad + ' / ' + f.total)); c.appendChild(el('span', '', f.porcentaje + ' %')); r.appendChild(c);
   var g = el('div', 'ob-b-p');
   if (!f.puntos.length) g.textContent = 'Ningún punto';
   f.puntos.forEach(function (p) { var s = el('span', 'ob-b-pt'); s.title = p.nombre; if (/^[A-Z]{2}$/.test(p.glifo)) s.appendChild(el('span', 'ob-ang-t', p.glifo)); else s.appendChild(glifo(p.glifo)); s.appendChild(sr(p.nombre + ' ')); g.appendChild(s); });
   r.appendChild(g);
   cont.appendChild(r);
  });
  dest.textContent = '';
  dest.appendChild(el('strong', '', A.dominante(carta, grupo)));
 }

 // S18: «si la carta no se puede calcular completa, no se muestra». Con alguna parte que falte (o que no sea un número) no se dibuja nada:
 // ni la rueda ni tablas a medias; queda el aviso de sinCarta().
 function finito(x) { return typeof x === 'number' && isFinite(x); }
 function completa(c) {
  return !!(c && c.meta && c.meta.input && c.meta.hora_conocida !== false
   && Array.isArray(c.bodies) && c.bodies.length === 12 && c.bodies.every(function (b) { return finito(b.longitude) && finito(b.speed) && finito(b.house); })
   && Array.isArray(c.angles) && c.angles.length === 4 && c.angles.every(function (a) { return finito(a.longitude); })
   && Array.isArray(c.houses) && c.houses.length === 12 && c.houses.every(function (h) { return finito(h.cusp); })
   && Array.isArray(c.aspects) && c.aspect_rules && Array.isArray(c.aspect_rules.points)
   && c.balance && finito(c.balance.total) && Array.isArray(c.balance.elements) && Array.isArray(c.balance.modalities));
 }

 function pintar(r) {
  var modo = r.modo, carta = r.carta;
  if (!completa(carta)) { var x = new Error('carta incompleta'); x.incompleta = true; throw x; }
  encabezado(modo, false, carta);
  datos(modo, false, carta); cinta(carta); leyenda($('[data-leyenda]')); leyenda($('[data-leyenda-mx]'));
  var svg = $('[data-rueda]');
  A.dibujarRueda(svg, carta, { colores: COLORES }, modo);
  var lista = A.listaAspectos(carta);
  tablero(carta); casasYAngulos(carta);
  matriz(carta, lista, svg);
  $('[data-regla]').textContent = carta.balance.rule;
  $('[data-difiere]').hidden = true; // el mismo criterio que la portada (Fernando, 24/11/2026)
  barras($('[data-elementos]'), A.filasBalance(carta, 'elements'), $('[data-dom-elementos]'), carta, 'elements');
  barras($('[data-modalidades]'), A.filasBalance(carta, 'modalities'), $('[data-dom-modalidades]'), carta, 'modalities');
  $('[data-regla-aspectos]').textContent = carta.aspect_rules.rule;
  $('[data-n-aspectos]').textContent = carta.aspects.length + ' aspectos, del más exacto al menos exacto.';
  aspectos(carta, svg, lista);
  raiz.classList.add('is-listo');
  var pdf = $('[data-pdf]'); if (pdf) pdf.hidden = modo !== 'natal';
  var cargando = $('[data-cargando]'); if (cargando) cargando.hidden = true;
 }
`;

/** carta-op2.js: ante un error o el límite no queda la carta a medias; y el botón del PDF, solo en la natal. */
const SIN_CARTA = ` // S16 (Fernando: «Carta del momento: sin botón de PDF. Se muestra la carta y nada más.»): el botón y su nota salen de la página.
 if (MODO !== 'natal') { var sinPdf = $('[data-pdf]'); if (sinPdf) sinPdf.remove(); }
 // S14: el PDF es la impresión del navegador («Guardar como PDF») con la hoja @media print de carta-op2.css: nada sale a otro servicio.
 function paraImprimir() { var d = $('[data-lista]'); if (d) d.open = true; }
 window.addEventListener('beforeprint', paraImprimir);
 var bpdf = $('[data-pdf-btn]');
 if (bpdf) bpdf.addEventListener('click', function () { paraImprimir(); window.print(); });

 // Sin carta (datos rechazados, el límite de la semana, una carta incompleta o un error): solo el aviso, nada a medias.
 var LIMITE_TXT = 'Ya calculaste tus 2 cartas de esta semana. Si querés una lectura completa, agendá una consulta';
 var WHATSAPP = 'https://wa.me/5491153144378';
 function sinCarta(err) {
  raiz.querySelector('.ob-top').classList.add('ob-top-sola'); // sin la rueda, la cabecera en una columna (carta-op2.css)
  Array.prototype.forEach.call(raiz.querySelectorAll('.ob-lado, .ob-ficha, .ob-cinta, .ob-mesa-w, #balance'), function (n) { n.style.display = 'none'; });
  var c = $('[data-cargando]'), p, a;
  if (!c) return;
  c.hidden = false; c.textContent = '';
  p = el('p', 'ob-enlaces');
  if (err && err.limite) {
   c.textContent = LIMITE_TXT;
   a = el('a', 'ob-btn', 'Agendá una consulta'); a.href = WHATSAPP; a.target = '_blank'; a.rel = 'noopener';
  } else {
   c.classList.add('is-error');
   c.textContent = (err && err.mensaje) || 'No pudimos cargar la carta. Recargá la página para intentarlo de nuevo.';
   if (err && err.campo) { a = el('a', 'ob-link', 'Volver al formulario'); a.href = '/#herramientas'; }
  }
  if (a) { p.appendChild(a); c.parentNode.insertBefore(p, c.nextSibling); }
 }

 // Si cambian los datos después del # con la página abierta, se calcula de nuevo como al abrirla (con el mismo límite): la carta anterior
 // no queda en pantalla ni se imprime. Los mismos datos (misma huella) o un ancla de la página (#inicio) no recalculan.
 var CLAVE = A.claveNatal();
 window.addEventListener('hashchange', function () { var k = A.claveNatal(); if (MODO === 'natal' && k && k !== CLAVE) location.reload(); });

 encabezado(MODO, SIN_HORA_URL, null); // antes de pedir los datos
 A.cargar().then(pintar).catch(function (err) {
  if (err && err.sinDatos) { location.replace('/#herramientas'); return; } // /carta sin datos: al formulario de la portada
  if (window.console && !(err && (err.limite || err.mensaje))) console.error('carta-op2.js:', err);
  sinCarta(err);
 });
})();`;

/** carta-op2.css: 50 casillas en el balance, el botón del PDF y la hoja de impresión (va al final). */
const CSS_CARTA = `
/* Anaretico 29 (T8). El balance de 50 puntos de Fernando son 50 casillas: separación más fina para que entren */
.ob-b-t{gap:2px}
@media (max-width:720px){.ob-b-t{gap:1px}}
/* Sin carta (el límite o un error) no hay rueda: la cabecera en una columna, como en pantallas menores */
@media (min-width:1280px){.ob-top.ob-top-sola{grid-template-columns:minmax(0,1fr);grid-template-rows:auto;row-gap:28px}.ob-top.ob-top-sola .ob-intro{grid-column:1;grid-row:1}}
/* S15: sin el panel «Lectura de lo elegido», la mesa en una columna en todos los anchos (la regla del prototipo hasta 1099 px) */
.ob-mesa{display:block}
/* S15: las filas, las celdas y los aspectos son datos: nada se elige para leer */
.ob .ob-sel-dato,.ob .ob-mx-b{cursor:default}
.ob-pos tr.ob-fila,.ob-angulos tr.ob-fila{cursor:auto}
/* S15: cada aspecto de la lista es una fila de datos, con la misma grilla que tenía su <summary> */
.ob-asp-r{display:grid;grid-template-columns:8em minmax(0,1fr) 7em 11.5em 32px;align-items:center;gap:4px 18px;padding:12px 14px;min-height:60px}
.ob-asp-r:hover{background:var(--ob-panel)}
@media (max-width:720px){.ob-asp-r{grid-template-columns:minmax(0,1fr) 32px;gap:3px 10px;padding:14px}}
/* S14: «Descargar mi carta en PDF» (solo en la carta natal; S16) */
.ob-pdf{margin-top:24px}
.ob-pdf .ob-peq{margin:10px 0 0}
.ob .ob-pdf .ob-btn{cursor:pointer}
/* El PDF: la carta impresa como se ve (rueda, posiciones, aspectos, casas, balance y el pie legal), sin menú ni botones */
@media print{
 @page{size:A4;margin:12mm}
 html,body{background:#243236!important}
 *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
 .skip,.strap,header nav,header button,#canales,dialog,.ob-enlaces,.ob-pdf,.ob-estado,.ob-ver-m{display:none!important}
 header{position:static!important;box-shadow:none!important}
 .ob-ticket,.ob-tablero,.ob-rueda,.ob-b,.ob-asp,tr{break-inside:avoid}
 .ob-svg{max-width:180mm;margin-inline:auto!important}
}`;

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
  // S11: Fraunces e Inter, de nuestra hoja (mismas familias, ejes, pesos y subconjuntos)
  "styles.css": (t) => parche(t, "styles.css",
    "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Inter:wght@400;500;600;700&display=swap');",
    `@import url('${FUENTES}/texto.css?v=${VERSION}');`),
  // S5: sin formulario de suscripción no queda nada que validar ni que mandar
  "variantes/portada.js": (t) => parcheTramo(t, "portada.js",
    "// Suscripción al cielo del mes: valida el mail y avisa que es una vista previa",
    " f.reset(); i.removeAttribute('aria-invalid');\n });\n})();",
    "// La suscripción al cielo del mes está apagada (Próximamente): la web no guarda datos de los visitantes.",
    (x) => x.includes("Por ahora es una vista previa: este mail no se guardó ni se envió.")),
  "variantes/menu.js": (t) => {
    t = parche(t, "menu.js", `cta.href = 'membresia.html';`, `cta.href = '${destino("membresia.html", D)}';`);
    // Regla 4: con Membresía apagada el «Sumarme» del encabezado no se genera
    if (membresiaApagada) {
      t = parche(t, "menu.js", "header.appendChild(cta); header.appendChild(btn);",
        "header.appendChild(btn); // «Sumarme» no va: Membresía está apagada (regla 4)");
    }
    return t;
  },
  "variantes/carta.js": (t) => {
    const A = "carta.js";
    t = parcheTramo(t, A, "// Carta natal y carta del momento: pantalla de resultado (prototipo, datos de ejemplo).", "Ningún número de la carta se escribe a mano acá.\n",
      "// Carta natal y carta del momento: window.A29Carta, la biblioteca de la pantalla carta.html (opción 2 «Observatorio»):\n" +
      "// carga de datos, ayudas de datos y rueda en SVG. NO toca el DOM de la página.\n" +
      "// La carta la calcula el servidor (POST /api/carta, GET /api/carta/momento). Sin textos de interpretación (S15).\n" +
      "// Ningún número de la carta se escribe a mano acá.\n",
      (x) => x.includes("(B) Diseño 1") && x.includes("carta-ejemplo.json"));
    t = parcheTramo(t, A, " function pedir(nombre) {", "sinHora: sinHora(r[0]) }; });\n }", CARGAR_CARTA,
      (x) => x.includes("'carta-momento-ejemplo.json'") && x.includes("'carta-sinhora-ejemplo.json'") && x.includes("pedir('significados.json')"));
    // S15: sin archivo de textos no hace falta saber de dónde se cargó el script
    t = parche(t, A, " var BASE = (document.currentScript && document.currentScript.src) || location.href;\n", "");
    // S15: fuera los textos de interpretación; las filas, solo con datos (Fernando: si empatan todos los grupos, «Equilibrio»)
    t = parcheTramo(t, A, " // ---------------------------------------------------------------- textos (posibles significados)\n", " function descripcion(carta, modo) {", DATOS_CARTA,
      (x) => x.includes("function tAspecto(") && x.includes("function listaAspectos(") && x.includes("sig.aspectos_tipos"));
    t = parche(t, A, "  textos: { rol: tRol, planetaSigno: tPlanetaSigno, planetaCasa: tPlanetaCasa, angulo: tAngulo, aspecto: tAspecto, balance: tBalance },\n",
      "  dominante: dominante,\n");
    t = parche(t, A, "' de ejemplo, zodíaco tropical'", "', zodíaco tropical'");
    t = parche(t, A, "(modo === 'momento' ? 'Rueda de la carta del momento (ejemplo)' : 'Rueda de la carta natal (ejemplo)')",
      "(modo === 'momento' ? 'Rueda de la carta del momento' : 'Rueda de la carta natal')");
    t = parche(t, A, "  nombre: nombre, punto: punto, modoDe: modoDe\n };", "  nombre: nombre, punto: punto, modoDe: modoDe,\n  limite: limite, claveNatal: claveNatal\n };");
    // La parte (B) es la opción 1 «Almanaque», descartada (guía §2.2): no se publica
    const corte = "\n// ====================================================================== (B) Diseño 1 \"Almanaque\"";
    if (t.split(corte).length !== 2 || !t.slice(t.indexOf(corte)).includes("[data-carta-almanaque]")) falla(`${A}: no encuentro la parte (B) «Almanaque»`);
    t = t.slice(0, t.indexOf(corte)) + "\n";
    if (/ejemplo/.test(t)) falla(`${A}: quedó una carta de ejemplo`);
    const queda = /.{0,40}(?:signific|\bsig\b|textos\.\w).{0,40}/i.exec(t);
    if (queda) falla(`${A}: quedaron textos de interpretación: ${queda[0]}`);
    return t;
  },
  "variantes/carta-op2.js": (t) => {
    const A = "carta-op2.js";
    t = parche(t, A, "// Ningún número de la carta se escribe a mano: todo sale de datos/carta-ejemplo.json, datos/carta-momento-ejemplo.json o datos/carta-sinhora-ejemplo.json.",
      "// Ningún número de la carta se escribe a mano: todo sale del JSON que calcula el servidor (POST /api/carta, GET /api/carta/momento).");
    // S15: la cabecera describía el panel de lectura, que ya no va
    t = parche(t, A, "// matriz planeta por planeta, y el significado de lo que se elige se lee en un panel lateral que se actualiza (en pantallas angostas, debajo de la fila o de la matriz).\n" +
      "// Usa window.A29Carta de carta.js como biblioteca (datos, textos, ayudas y rueda en SVG); acá solo se arma la pantalla.",
      "// matriz planeta por planeta. La carta se muestra sola, sin textos de interpretación (S15).\n" +
      "// Usa window.A29Carta de carta.js como biblioteca (datos, ayudas y rueda en SVG); acá solo se arma la pantalla.");
    t = parche(t, A, " function tx(v) { return v && typeof v === 'object' ? v.texto : v; } // las funciones de textos devuelven {texto, propio} o la oración\n", "");
    // S15: la cinta ya no recibe los textos
    t = parche(t, A, " function cinta(carta, sig, modo) {", " function cinta(carta) {");
    t = parche(t, A, "A.filasAngulos(carta, sig, modo).filter(", "A.filasAngulos(carta).filter(");
    t = parche(t, A, "A.filasCuerpos(carta, sig, modo).map(function (f) { return { g: f.glifo,", "A.filasCuerpos(carta).map(function (f) { return { g: f.glifo,");
    t = parche(t, A, " var uniq = 0;\n", "");
    // S10: la hora es obligatoria, no hay carta sin hora
    t = parche(t, A, " var SIN_HORA_URL = MODO === 'natal' && new URLSearchParams(location.search).get('sinhora') === '1';",
      " var SIN_HORA_URL = false; // la hora de nacimiento es obligatoria (S10): no hay carta sin hora");
    t = parche(t, A, "  var q = new URLSearchParams(location.search), f = q.get('fecha')", "  var q = new URLSearchParams((location.hash || '').replace(/^#/, '')), f = q.get('fecha')");
    // Rótulos: sin «ejemplo», sin «Opción 2», la del momento en vivo (doc 03 §3, §11.3 y §11.6); los enlaces de ejemplo no van (§11.2)
    t = parcheTramo(t, A, "  $('[data-kicker]').textContent = m ?", "sh.href = sin ? PAGINA : PAGINA + '?sinhora=1';\n",
      "  $('[data-kicker]').textContent = m ? 'Carta del momento' : 'Carta natal';\n" +
      "  $('[data-titulo]').textContent = m ? 'La carta del momento' : 'Tu carta natal';\n" +
      "  document.title = 'Anaretico 29 · ' + (m ? 'La carta del momento' : 'Tu carta natal');\n" +
      "  if (m) {\n" +
      "   $('[data-bajada]').textContent = i\n" +
      "    ? 'El cielo de ahora: ' + A.formato.fecha(i.date) + ', ' + i.time + ' de Buenos Aires (' + carta.meta.utc_instant.slice(11, 16) + ' UTC). Las posiciones, casas, balance de elementos y aspectos.'\n" +
      "    : 'Las posiciones, casas, balance de elementos y aspectos del cielo de ahora, para Buenos Aires.';\n" +
      "   $('[data-sello]').textContent = 'Cielo de ahora';\n" +
      "  } else {\n" +
      "   $('[data-bajada]').textContent = 'Tus posiciones, casas, balance de elementos y aspectos.';\n" +
      "   $('[data-sello]').textContent = 'Con tus datos';\n" +
      "  }\n" +
      "  var otro = $('[data-otro]');\n" +
      "  otro.hidden = m; otro.textContent = 'Ver la carta del momento'; otro.href = '/carta?modo=momento';\n",
      (x) => x.includes("'Corte fijo · no en vivo'") && x.includes("$('[data-solo=\"natal\"]').hidden = m;") && x.includes("(ejemplo) · Opción 2"));
    // S15: «Cómo leer» y el cierre de la consulta no van
    t = parche(t, A, "  $('[data-leer-t]').textContent = m ? 'Cómo leer esta carta' : 'Cómo leer tu carta';\n", "");
    t = parche(t, A, "  var cie = $('[data-cierre-t]');\n  if (cie) cie.textContent = m ? 'En una consulta leemos el cielo de un momento con tus preguntas, sin atajos.' : 'En una consulta miramos la carta completa con tu historia y tus preguntas, sin atajos.';\n", "");
    t = parche(t, A, "   campo(dl, 'Fecha del corte', A.formato.fecha(i.date));", "   campo(dl, 'Fecha', A.formato.fecha(i.date));");
    t = parche(t, A, "   campo(dl, 'Hora del corte', i.time + ' (hora de Buenos Aires)');", "   campo(dl, 'Hora', i.time + ' (hora de Buenos Aires)');");
    t = parche(t, A, "   p.appendChild(document.createTextNode(partes + '. Esta es una vista previa: la carta que ves se calculó con los datos del ejemplo (' + A.formato.fecha(i.date) + ', ' + (A.sinHora(carta) ? 'sin hora' : i.time) + ', ' + i.place + '). Con la calculadora conectada, se calcula con los tuyos.'));",
      "   p.appendChild(document.createTextNode(partes + '.'));");
    // S15 y S18: de la selección hasta el final de pintar(), la pantalla sin textos de interpretación y sin cartas a medias. Ahí quedan
    // también el balance con el criterio de la portada (Fernando: sin la nota «puede diferir») y el botón del PDF solo en la natal (S14).
    t = parcheTramo(t, A, " // ---------------------------------------------------------------- selección: un solo lugar de lectura (panel lateral o debajo de la fila)\n",
      "  if (ANCHO.matches) seleccionar({ t: 'cuerpo', id: 'sun' }); // en pantalla ancha el panel arranca con el Sol\n }\n", PANTALLA_SOLA,
      (x) => x.includes("'Posible significado · borrador'") && x.includes("function comoLeer(") && x.includes("function pintar(") && x.includes("A.textos."));
    t = parcheTramo(t, A, " encabezado(MODO, SIN_HORA_URL, null); // antes de pedir los datos", "})();", SIN_CARTA,
      (x) => x.includes("No pudimos cargar la carta de ejemplo."));
    const queda = /.{0,40}(?:signific|borrador|textos\.\w|\bsig\b|Cómo leer|data-panel|data-leer|data-cierre|data-mx-inline|ob-mean).{0,40}/i.exec(t);
    if (queda) falla(`${A}: quedó un texto de interpretación: ${queda[0]}`);
    return t;
  },
  "variantes/carta-op2.css": (t) => {
    const fin = "@media (prefers-reduced-motion:reduce){.ob *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}";
    if (!t.trimEnd().endsWith(fin)) falla("carta-op2.css: no termina como se esperaba");
    return t.trimEnd() + "\n" + CSS_CARTA.trim() + "\n";
  },
  // S9: sin el campo de mail, la grilla de escritorio del formulario pasa de 4 a 3 columnas
  "variantes/herramientas.css": (t) => parche(t, "herramientas.css",
    ".t3 form{grid-template-columns:150px 150px minmax(0,1fr) minmax(0,1.3fr)}",
    ".t3 form{grid-template-columns:150px 150px minmax(0,1fr)}"),
  "variantes/herramientas.js": (t) => {
    const carta = destino("carta.html", D);
    const H = "herramientas.js";
    // S9 y S10: sin mail, con la hora obligatoria (mismo estilo de aviso que la fecha)
    t = parche(t, H, "// Herramientas. Carta natal: fecha, lugar y mail son obligatorios; con datos válidos el formulario lleva a carta.html (pantalla de resultado con una carta de ejemplo).",
      "// Herramientas. Carta natal: fecha, hora y lugar son obligatorios; con datos válidos el formulario lleva a /carta con los datos después del #\n" +
      "// (el navegador no manda esa parte de la dirección: la carta se pide por POST y no queda en ningún registro).");
    t = parche(t, H, "// Sin hora de nacimiento el enlace lleva sinhora=1 (la pantalla muestra la carta sin Ascendente ni casas).\n", "");
    t = parche(t, H, "// \"Ver la carta de ahora\" lleva a carta.html?modo=momento. Los datos tipeados viajan en la URL solo para mostrarse en el encabezado: nada se guarda y el mail no viaja.",
      `// "Ver la carta de ahora" lleva a ${destino("carta.html?modo=momento", D)}. Nada se guarda.`);
    t = parcheTramo(t, H, " fecha:v=>v?'':'Ingresá tu fecha de nacimiento.',", "'Revisá el mail: parece incompleto.')\n",
      " fecha:v=>v?'':'Ingresá tu fecha de nacimiento.',\n hora:v=>v?'':'Ingresá tu hora de nacimiento.',\n lugar:v=>v.trim()?'':'Ingresá el lugar de nacimiento.'\n",
      (x) => x.includes(" lugar:v=>v.trim()?'':'Ingresá el lugar de nacimiento.',") && x.includes(" email:v=>"));
    t = parche(t, H, "if(f.elements.hora&&f.elements.hora.value)q.set('hora',f.elements.hora.value);else q.set('sinhora','1');",
      "q.set('hora',f.elements.hora.value);");
    t = parche(t, "herramientas.js", `location.assign('carta.html?modo=momento')`, `location.assign('${destino("carta.html?modo=momento", D)}')`);
    if (carta !== "/carta") falla(`herramientas.js: la carta no se publica en /carta (${carta})`);
    // S4: el diálogo de la carta del momento hablaba del corte fijo del cielo; esa frase no va
    t = parche(t, "herramientas.js",
      `<p>Los datos del panel "El cielo de hoy" siguen siendo un corte fijo del 20/10/2026.</p>`, "");
    return parche(t, "herramientas.js", `location.assign('carta.html?'+q.toString())`, `location.assign('${carta}#'+q.toString())`);
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
    escribir(rel, archivo === "combinado.html" ? plantillaPortada(html) : html);
  } else if (rel === "variantes/datos/visibilidad.json") {
    escribir(rel, JSON.stringify(D, null, 1) + "\n");
  } else if (propios.has(rel)) {
    // ya está en su lugar (src/web/assets/fuentes): no se copia
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

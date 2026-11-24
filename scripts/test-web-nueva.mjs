// Test de la web nueva: las páginas publicadas (la carta tiene además su test,
// test-carta.mjs), sus archivos, Próximamente
// para lo demás, las redirecciones viejas y el portero delante de todo.
//
// Levanta el router en 127.0.0.1 con un puerto libre y le pide cosas: no sale a
// internet. La base se arma en un temporal descartable: nunca toca
// data/anaretico.db.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { caracteres } from "./woff2-cmap.mjs";
import { refsHtml, refsCss, fetchsJs, rutasJson, refsSvg, fotosCarrusel, esExterna } from "./web-refs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "..", "src", "web");
const VERSION = "20261124.4";
const SITIO = "https://www.anaretico29.com";
const LEGAL = "Contenido astrológico y educativo. No constituye asesoramiento ni recomendación de inversión.";
const GOOGLE = /fonts\.(?:googleapis|gstatic)\.com/;
// Los glifos que tienen que salir como texto con las fuentes Noto propias (S11)
const GLIFOS = "☉☽☿♀♂♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓□☍→℞☌⚹△☊⚷";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "web-nueva-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");
process.env.UPLOADS_DIR = path.join(tmp, "subidas");
process.env.ADMIN_PASSWORD = "clave-de-prueba"; // sin clave, /panel/entrar contesta 503 por su cuenta

const { initDb } = await import("../src/db.js");
initDb();
const express = (await import("express")).default;
const { default: app } = await import("../src/app.js");
const { setEnDesarrollo } = await import("../src/lib/portero.js");
const { crearSesion } = await import("../src/lib/sesion.js");

const server = express();
server.use(app);
const http = server.listen(0, "127.0.0.1");
await once(http, "listening");
const BASE = `http://127.0.0.1:${http.address().port}`;

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};
const igual = (nombre, real, esperado) => cierto(nombre, real === esperado, `dio ${JSON.stringify(real)}, esperaba ${JSON.stringify(esperado)}`);

let galleta = null;
async function pedir(ruta, { metodo = "GET", sesion = false } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo, redirect: "manual",
    headers: sesion && galleta ? { cookie: galleta } : {},
  });
  const cuerpo = Buffer.from(await r.arrayBuffer());
  return { codigo: r.status, donde: r.headers.get("location"), tipo: r.headers.get("content-type") || "", cuerpo, texto: cuerpo.toString("utf8") };
}

const PAGINAS = [
  { ruta: "/", archivo: "combinado.html" },
  { ruta: "/sobre-mi", archivo: "sobre-mi.html" },
  { ruta: "/proximamente?p=servicios", archivo: "proximamente.html" },
  { ruta: "/carta", archivo: "carta.html" },
];
const enDisco = (archivo) => {
  try { return fs.readFileSync(path.join(WEB, "variantes", archivo), "utf8"); } catch { return null; }
};
// La portada es una plantilla: lleva marcas {{clave}} que se rellenan con el
// cielo del motor (src/lib/portada.js; test propio en test-cielo-portada.mjs).
// Fuera de esas marcas tiene que ser el archivo en disco byte a byte.
const esLaPagina = (texto, archivo) => {
  const disco = enDisco(archivo);
  if (disco === null) return false;
  if (!disco.includes("{{")) return texto === disco;
  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !texto.includes("{{") && new RegExp("^" + disco.split(/\{\{\w+\}\}/).map(escapar).join("[\\s\\S]*?") + "$").test(texto);
};

// El orden de hojas y scripts de cada página, tal como lo listan la guía (§3)
// y el documento 05 (§4.1). Cada uno lleva la versión para vaciar la caché.
const v = (lista) => lista.map((x) => `/${x}?v=${VERSION}`);
const ORDEN = {
  "combinado.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "linea-tiempo/panorama.css",
      "paletas/pizarra-auto.css", "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css",
      "arreglos.css", "menu.css", "presentacion.css", "herramientas.css", "canales.css", "oferta.css",
      "portada.css", "tonos.css", "movimiento.css", "portada-plaza.css", "linea-tiempo/opciones-lt.css",
      "assets/fuentes/simbolos.css"]),
    scripts: v(["data.js", "app.js", "compact.js", "arreglos.js", "presentacion.js", "herramientas.js",
      "oferta.js", "portada.js", "portada-plaza.js", "menu.js", "movimiento.js", "rich.js",
      "linea-tiempo/opciones-lt.js"]),
  },
  "sobre-mi.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "paletas/pizarra-auto.css",
      "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css",
      "canales.css", "sobre-mi.css", "tonos.css", "movimiento.css", "assets/fuentes/simbolos.css"]),
    scripts: v(["data.js", "app.js", "menu.js", "movimiento.js", "sobre-mi.js"]),
  },
  "proximamente.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "paletas/pizarra-auto.css",
      "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css",
      "canales.css", "oferta.css", "portada.css", "proximamente.css", "tonos.css", "movimiento.css",
      "portada-plaza.css", "servicios-op2.css"]),
    scripts: v(["data.js", "app.js", "menu.js", "movimiento.js", "proximamente.js"]),
  },
  // Doc 03 §1.2: la hoja de símbolos (antes Google) en su lugar, antes de tonos.css
  "carta.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "paletas/pizarra-auto.css",
      "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css",
      "canales.css", "movimiento.css", "carta-op2.css", "assets/fuentes/simbolos.css", "tonos.css"]),
    scripts: v(["data.js", "app.js", "menu.js", "movimiento.js", "carta.js", "carta-op2.js"]),
  },
};
const locales = (lista) => lista.filter((u) => !esExterna(u));

try {
  console.log("— Portero cerrado, visitante anónimo: el cartel también tapa las páginas nuevas");
  for (const r of ["/", "/sobre-mi", "/proximamente?p=servicios", "/styles.css", "/assets/logo.png", "/datos/servicios.json"]) {
    const x = await pedir(r);
    cierto(`${r} da 503`, x.codigo === 503, `dio ${x.codigo}`);
    cierto(`${r} no filtra la web nueva`, !/Próximamente|Astrología financiera/.test(x.texto));
  }
  cierto("el panel sigue entrando con el portero cerrado", (await pedir("/panel/entrar")).codigo === 200);

  console.log("— Portero cerrado, con sesión del panel");
  galleta = `anaretico_panel=${crearSesion("127.0.0.1")}`;
  for (const { ruta, archivo } of PAGINAS) {
    const x = await pedir(ruta, { sesion: true });
    cierto(`${ruta} da 200 con sesión`, x.codigo === 200, `dio ${x.codigo}`);
    cierto(`${ruta} es ${archivo}`, esLaPagina(x.texto, archivo));
  }

  console.log("— Portero abierto: las cuatro páginas");
  setEnDesarrollo(false);
  const servidas = {};
  for (const { ruta, archivo } of PAGINAS) {
    const x = await pedir(ruta);
    servidas[archivo] = x.texto;
    cierto(`${ruta} da 200`, x.codigo === 200, `dio ${x.codigo}`);
    cierto(`${ruta} es HTML`, x.tipo.startsWith("text/html"), x.tipo);
    cierto(`${ruta} es ${archivo}`, esLaPagina(x.texto, archivo));
    cierto(`${ruta} sigue con noindex,nofollow`, x.texto.includes('<meta name="robots" content="noindex,nofollow">'));
    cierto(`${ruta} trae el texto legal del pie sin tocar`, x.texto.includes(LEGAL));
    // AGPL §13: quien usa el sitio por red tiene que poder llegar al código fuente
    cierto(`${ruta} enlaza el código fuente (AGPL) en el pie`,
      /<footer>[\s\S]*<a href="https:\/\/github\.com\/nahuerpcmacservice\/anaretico29"[^>]*>Código fuente \(AGPL\)<\/a><\/small><\/footer>/.test(x.texto));
    // S12: «Imágenes: Anaretico 29» en lugar de «Fotografías con sus créditos», entre el texto legal y el código fuente
    cierto(`${ruta} el pie dice «Imágenes: Anaretico 29»`,
      x.texto.includes(`${LEGAL}<br>Imágenes: Anaretico 29<br><a href="https://github.com/nahuerpcmacservice/anaretico29" rel="noopener">Código fuente (AGPL)</a></small></footer>`));
    cierto(`${ruta} ya no dice «Fotografías con sus créditos»`, !x.texto.includes("Fotografías con sus créditos"));
    // S11: nada se le pide a Google desde el navegador
    cierto(`${ruta} no le pide nada a Google Fonts`, !GOOGLE.test(x.texto));
    cierto(`${ruta} og:image absoluto en ${SITIO}`,
      x.texto.includes(`<meta property="og:image" content="${SITIO}/assets/og-anaretico29.jpg">`));
    const { hojas, scripts } = refsHtml(x.texto);
    const orden = ORDEN[archivo];
    cierto(`${ruta} hojas en el orden del prototipo y con ?v=`, JSON.stringify(locales(hojas)) === JSON.stringify(orden.hojas),
      JSON.stringify(locales(hojas)));
    cierto(`${ruta} scripts en el orden del prototipo y con ?v=`, JSON.stringify(locales(scripts)) === JSON.stringify(orden.scripts),
      JSON.stringify(locales(scripts)));
  }
  for (const r of ["/sobre-mi/", "/proximamente/?p=academia"]) {
    const x = await pedir(r);
    cierto(`${r} pierde la barra final`, x.codigo === 301 && x.donde === r.replace("/?", "?").replace(/\/$/, ""), `${x.codigo} ${x.donde}`);
  }
  for (const [r, a] of [["/combinado.html", "/"], ["/sobre-mi.html", "/sobre-mi"], ["/proximamente.html?p=academia", "/proximamente?p=academia"],
    ["/carta.html", "/carta"], ["/carta.html?modo=momento", "/carta?modo=momento"], ["/combinado.html?modo=momento", "/"]]) {
    const x = await pedir(r);
    cierto(`${r} → ${a} (301)`, x.codigo === 301 && x.donde === a, `${x.codigo} ${x.donde}`);
  }

  console.log("— Cada archivo que cargan las cuatro páginas responde");
  const vistos = new Map(); // url → { codigo, tipo, texto }
  const traer = async (u) => {
    if (!vistos.has(u)) vistos.set(u, await pedir(u));
    return vistos.get(u);
  };
  const resolver = (ref, desde) => { const u = new URL(ref, BASE + desde); return u.origin === BASE ? u.pathname + u.search : null; };
  const pendientes = [];
  for (const { ruta, archivo } of PAGINAS) {
    const html = servidas[archivo];
    const { recursos, scripts } = refsHtml(html);
    for (const ref of recursos) {
      if (ref.startsWith(SITIO + "/")) { pendientes.push(ref.slice(SITIO.length)); continue; }
      const u = esExterna(ref) ? null : resolver(ref, ruta);
      if (u) pendientes.push(u);
    }
    // Lo que piden los scripts con fetch se resuelve contra la página
    for (const s of locales(scripts)) {
      const js = await traer(resolver(s, ruta));
      for (const f of fetchsJs(js.texto)) {
        const u = resolver(f, ruta);
        pendientes.push(u);
        const dato = await traer(u);
        if (u.split("?")[0].endsWith(".json") && dato.codigo === 200) {
          for (const r of rutasJson(JSON.parse(dato.texto))) pendientes.push(resolver(r, ruta));
        }
        if (u.split("?")[0].endsWith(".svg") && dato.codigo === 200) {
          for (const r of refsSvg(dato.texto)) pendientes.push(resolver(r, u));
        }
      }
    }
  }
  // Las fotos del carrusel las arma portada-plaza.js desde data.js
  const dataJs = await traer(`/data.js?v=${VERSION}`);
  for (const f of fotosCarrusel(dataJs.texto)) pendientes.push("/" + f);
  // Las hojas pueden pedir más (url(), @import)
  for (let i = 0; i < pendientes.length; i++) {
    const u = pendientes[i];
    const x = await traer(u);
    if (u.split("?")[0].endsWith(".css") && x.codigo === 200) {
      for (const r of refsCss(x.texto)) if (!esExterna(r)) pendientes.push(resolver(r, u));
    }
  }
  const unicos = [...new Set(pendientes)];
  console.log(`  (${unicos.length} archivos locales pedidos)`);
  const rotos = [];
  for (const u of unicos) if ((await traer(u)).codigo !== 200) rotos.push(`${u} (${vistos.get(u).codigo})`);
  cierto(`los ${unicos.length} archivos locales responden 200`, rotos.length === 0, rotos.join(", "));
  cierto("las hojas salen como text/css", unicos.filter((u) => u.split("?")[0].endsWith(".css")).every((u) => vistos.get(u).tipo.startsWith("text/css")));
  cierto("los scripts salen como JavaScript", unicos.filter((u) => u.split("?")[0].endsWith(".js")).every((u) => /javascript/.test(vistos.get(u).tipo)));
  cierto("las fotos del carrusel están (4 × 3 anchos × 2 formatos)", fotosCarrusel(dataJs.texto).length === 24);

  console.log("— S11: las fuentes salen de acá, no de Google");
  const conGoogle = unicos.filter((u) => /\.(?:css|js|json|svg)$/.test(u.split("?")[0]) && GOOGLE.test(vistos.get(u).texto));
  cierto("ningún HTML, CSS, JS ni dato servido nombra fonts.googleapis.com ni fonts.gstatic.com", conGoogle.length === 0, conGoogle.join(", "));
  const styles = vistos.get(`/styles.css?v=${VERSION}`);
  cierto("styles.css importa nuestra hoja de Fraunces e Inter", styles && styles.texto.startsWith(`@import url('assets/fuentes/texto.css?v=${VERSION}');`));
  const fuentes = unicos.filter((u) => u.split("?")[0].endsWith(".woff2"));
  igual("se piden los 16 archivos woff2 (13 de texto y 3 de símbolos)", fuentes.length, 16);
  cierto("cada fuente responde 200 como font/woff2", fuentes.every((u) => vistos.get(u).codigo === 200 && vistos.get(u).tipo.startsWith("font/woff2")),
    fuentes.map((u) => `${u} ${vistos.get(u).codigo} ${vistos.get(u).tipo}`).join(", "));
  const texto = (await traer("/assets/fuentes/texto.css")).texto;
  const caras = [...texto.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1]);
  const cara = (fam, estilo, peso) => caras.filter((c) => c.includes(`font-family: '${fam}'`) && c.includes(`font-style: ${estilo}`) && c.includes(`font-weight: ${peso};`));
  for (const [fam, estilo, peso, n] of [["Fraunces", "normal", "300 600", 3], ["Fraunces", "italic", "300 500", 3],
    ["Inter", "normal", "400", 7], ["Inter", "normal", "500", 7], ["Inter", "normal", "600", 7], ["Inter", "normal", "700", 7]]) {
    const c = cara(fam, estilo, peso);
    cierto(`${fam} ${estilo} ${peso}: los ${n} subconjuntos de Google, con su unicode-range`, c.length === n && c.every((x) => /unicode-range:/.test(x)) && c.some((x) => x.includes("U+0000-00FF")), `${c.length}`);
  }
  const simbolos = (await traer(`/assets/fuentes/simbolos.css?v=${VERSION}`)).texto;
  cierto("simbolos.css: Noto Sans Symbols, Symbols 2 y Noto Sans, con display block",
    ["Noto Sans Symbols", "Noto Sans Symbols 2", "Noto Sans"].every((f) => simbolos.includes(`font-family: '${f}';`)) && (simbolos.match(/font-display: block/g) || []).length === 3);
  const cubiertos = new Set();
  for (const m of simbolos.matchAll(/src: url\(([^)]+)\)/g)) for (const c of caracteres((await traer(`/assets/fuentes/${m[1]}`)).cuerpo)) cubiertos.add(c);
  const faltan = [...GLIFOS].filter((g) => !cubiertos.has(g.codePointAt(0)));
  cierto(`los ${[...GLIFOS].length} glifos (□ ☉ ℞ ☊… ☌ ⚹ △ y los signos) están en las Noto propias`, faltan.length === 0, `faltan ${faltan.join(" ")}`);
  for (const lic of ["OFL-fraunces.txt", "OFL-inter.txt", "OFL-noto-sans.txt", "OFL-noto-sans-symbols.txt", "OFL-noto-sans-symbols-2.txt"]) {
    const x = await traer(`/assets/fuentes/${lic}`);
    cierto(`${lic} se publica junto a las fuentes`, x.codigo === 200 && x.texto.includes("SIL OPEN FONT LICENSE Version 1.1"), `${x.codigo}`);
  }

  console.log("— S9 y S10: la carta natal sin mail y con la hora obligatoria");
  {
    const inicio = servidas["combinado.html"];
    const form = (/<form novalidate aria-label="Datos para calcular tu carta natal">[\s\S]*?<\/form>/.exec(inicio) || [""])[0];
    cierto("el formulario de la carta está", form.length > 0);
    cierto("la hora es obligatoria", form.includes('<label><span>Hora</span><input type="time" name="hora" required aria-describedby="err-hora"><span class="t3-err" id="err-hora" role="alert"></span></label>'));
    cierto("ya no dice «(opcional)»", !inicio.includes("(opcional)"));
    cierto("no pide mail", !/type="email"|name="email"|Tu mail|t3-mail|hint-email/.test(form));
    // Sin el mail, la grilla de escritorio no puede dejar una columna vacía al lado de Lugar
    const hcss = fs.readFileSync(path.join(WEB, "variantes", "herramientas.css"), "utf8");
    const ultima = [...hcss.matchAll(/^\.t3 form\{grid-template-columns:([^}]+)\}/gm)].at(-1)?.[1] || "";
    const columnas = ultima.trim().split(/\s+(?![^(]*\))/).length;
    const campos = (form.match(/<label\b/g) || []).length;
    cierto("la grilla de escritorio tiene una columna por campo", columnas === campos, `${columnas} columnas, ${campos} campos`);
    cierto("el texto de Fernando, sin la promesa del mail",
      inicio.includes('<p class="t-text">Calculada con tu fecha, hora y lugar de nacimiento. Te la mostramos en pantalla.</p>'));
    cierto("el botón queda solo", form.includes('<div class="t3-submit"><button type="submit" class="t-btn primary">Ver mi carta →</button></div>'));
    // herramientas.js con un DOM mínimo: la hora vacía se rechaza con su aviso y no se sale de la página
    const js = (await traer(`/herramientas.js?v=${VERSION}`)).texto;
    const correr = (valores) => {
      const errores = {}, idas = [];
      const campo = (n) => ({ value: valores[n], addEventListener() {}, setAttribute() {}, focus() { errores.foco = n; } });
      const elements = { fecha: campo("fecha"), hora: campo("hora"), lugar: campo("lugar") };
      let enviar = null;
      const f = { elements, reset() {}, addEventListener: (ev, fn) => { if (ev === "submit") enviar = fn; },
        querySelector: (q) => { const n = q.replace("#err-", ""); return { set textContent(t) { errores[n] = t; } }; } };
      const s = { document: { querySelectorAll: (q) => (q === ".tools form" ? [f] : []) }, location: { assign: (u) => idas.push(u) }, URLSearchParams, openDialog() {} };
      vm.createContext(s);
      vm.runInContext(js, s);
      enviar({ preventDefault() {} });
      return { errores, idas };
    };
    const sinHora = correr({ fecha: "1980-05-04", hora: "", lugar: "Rosario, Argentina" });
    igual("sin hora: «Ingresá tu hora de nacimiento.»", sinHora.errores.hora, "Ingresá tu hora de nacimiento.");
    cierto("sin hora: el foco va a la hora y no se sale de la página", sinHora.errores.foco === "hora" && sinHora.idas.length === 0);
    const completo = correr({ fecha: "1980-05-04", hora: "14:30", lugar: "Rosario, Argentina" });
    // T8: a la carta, con los datos después del # (no llegan al servidor en la dirección)
    cierto("con fecha, hora y lugar: va a /carta#fecha=…&lugar=…&hora=…", completo.idas.join() === "/carta#fecha=1980-05-04&lugar=Rosario%2C+Argentina&hora=14%3A30" && completo.errores.hora === "", completo.idas.join());
    const sinFecha = correr({ fecha: "", hora: "", lugar: "" });
    cierto("la fecha y el lugar siguen siendo obligatorios", sinFecha.errores.fecha === "Ingresá tu fecha de nacimiento." && sinFecha.errores.lugar === "Ingresá el lugar de nacimiento." && sinFecha.errores.foco === "fecha");
    cierto("herramientas.js ya no valida ni nombra un mail", !/mail/i.test(js));
  }

  console.log("— Respaldos y variantes del prototipo NO se publican");
  for (const r of ["/combinado-v1-oliva.html", "/variantes/combinado-v1-oliva.html", "/combinado-v10-antes-entrega.html",
    "/carta-opcion-1.html", "/carta-opciones.html", "/carta-op3.css", "/carta-op3.js", "/recorrido.css",
    "/servicios-v1-borrador.html", "/mundana-gratis.html", "/paletas.html", "/admin-visibilidad.html",
    "/admin-visibilidad.js", "/variantes/rich.css", "/web/styles.css", "/datos/shop.json", "/datos/membresia.json",
    "/datos/generar-mapa.py", "/datos/carta-ejemplo.json", "/ESTADO-Y-DECISIONES.md", "/formato-1.html"]) {
    const x = await pedir(r);
    cierto(`${r} da 404`, x.codigo === 404, `dio ${x.codigo}${x.donde ? " → " + x.donde : ""}`);
  }

  console.log("— Los enlaces de las páginas van a la web nueva o a Próximamente");
  const vis = JSON.parse((await traer("/datos/visibilidad.json")).texto);
  const ids = new Set(vis.paginas.flatMap((p) => [p.id, ...(p.partes || []).map((x) => x.id)]));
  const destinos = new Set();
  for (const { ruta, archivo } of PAGINAS) {
    for (const e of refsHtml(servidas[archivo]).enlaces) {
      if (esExterna(e)) continue;
      cierto(`${ruta}: ${e} no es un .html`, !/\.html\b/.test(e));
      const bien = /^\/(?:#[\w-]+)?$/.test(e) || /^\/sobre-mi(?:#[\w-]+)?$/.test(e) || /^\/carta(?:\?modo=momento)?$/.test(e) ||
        (/^\/proximamente\?p=([\w-]+)$/.test(e) && ids.has(e.split("=")[1]));
      cierto(`${ruta}: ${e} es una página publicada`, bien);
      destinos.add(e.split("#")[0]);
    }
  }
  for (const d of destinos) cierto(`${d} responde 200`, (await pedir(d)).codigo === 200);
  const nav = (html) => (/<nav aria-label="Navegación principal">([\s\S]*?)<\/nav>/.exec(html) || [, ""])[1];
  for (const id of ["servicios", "research", "academia", "revista", "membresia"]) {
    for (const { ruta, archivo } of PAGINAS) {
      cierto(`${ruta}: el menú lleva ${id} a Próximamente`, nav(servidas[archivo]).includes(`href="/proximamente?p=${id}"`));
    }
    cierto(`/proximamente: ${id} lleva la marca «Pronto» en el menú`,
      new RegExp(`href="/proximamente\\?p=${id}"[^>]*>[^<]*<span class="pronto">Pronto</span></a>`).test(nav(servidas["proximamente.html"])));
  }

  console.log("— Lo que se apaga: Servicios, Research, Academia, Revista y Membresía (la carta ya no: T8)");
  const pagVisible = (p) => p.bloqueada === true || p.visible !== false;
  for (const id of ["servicios", "research", "academia", "revista", "membresia"]) {
    cierto(`visibilidad.json: ${id} apagada`, !pagVisible(vis.paginas.find((p) => p.id === id)));
  }
  for (const id of ["inicio", "recorrido", "enfoque", "carta"]) {
    cierto(`visibilidad.json: ${id} visible`, pagVisible(vis.paginas.find((p) => p.id === id)));
  }
  cierto("«Mi recorrido» lleva a /sobre-mi", vis.paginas.find((p) => p.id === "recorrido").ruta === "/sobre-mi");
  const inicio = servidas["combinado.html"];
  cierto("la portada no ofrece «Sumarme» (Membresía apagada)", !/>Sumarme</.test(inicio));
  cierto("la portada no trae la franja «Conocer la membresía»", !/m-feature|Conocer la membresía/.test(inicio));
  const menuJs = (await traer(`/menu.js?v=${VERSION}`)).texto;
  cierto("menu.js no agrega «Sumarme» al encabezado", !/appendChild\(cta\)/.test(menuJs) && !menuJs.includes("membresia.html"));
  const herrJs = (await traer(`/herramientas.js?v=${VERSION}`)).texto;
  cierto("el formulario y «Ver la carta de ahora» llevan a /carta, no a una carta de ejemplo",
    !/location\.assign\([^)]*carta\.html/.test(herrJs) && herrJs.includes("location.assign('/carta#'+q.toString())") && herrJs.includes("location.assign('/carta?modo=momento')"));
  const ofertaJs = (await traer(`/oferta.js?v=${VERSION}`)).texto;
  cierto("las puertas de «Cuatro áreas» van a Próximamente", !ofertaJs.includes("servicios.html") && ofertaJs.includes('href="/proximamente?p=servicios"'));
  const proxJs = (await traer(`/proximamente.js?v=${VERSION}`)).texto;
  cierto("proximamente.js apunta a /proximamente", proxJs.includes("'/proximamente?p='") && !proxJs.includes("'proximamente.html?p='"));
  cierto("app.js encuentra su script aunque lleve ?v=", !(await traer(`/app.js?v=${VERSION}`)).texto.includes('src$="app.js"'));
  const prox = servidas["proximamente.html"];
  cierto("la franja de aprobación [SOLO MAQUETA] no va", !prox.includes("pr-demo") && !prox.includes("no va en la web real"));
  cierto("«Ver servicios» no se ofrece con Servicios apagada", !prox.includes("data-pr-servicios"));
  cierto("Próximamente conserva «Volver al inicio»", /<a class="btn pr-primario" href="\/">Volver al inicio<\/a>/.test(prox));

  console.log("— Rutas viejas: ya no muestran las vistas anteriores");
  const VIEJAS_302 = [
    ["/servicios", "/proximamente?p=servicios"], ["/research", "/proximamente?p=research"],
    ["/shop", "/proximamente?p=research"], ["/academia", "/proximamente?p=academia"],
    ["/revista", "/proximamente?p=revista"], ["/membresia", "/proximamente?p=membresia"],
    ["/servicios.html#personal", "/proximamente?p=servicios"], ["/curso.html?id=1", "/proximamente?p=academia"],
    ["/carta-natal", "/#herramientas"], ["/carta-natal?fecha=2000-01-01&ciudad=Rosario", "/#herramientas"],
    ["/proximamente?p=carta", "/carta"],
    ["/cielo", "/#cielo"], ["/herramientas", "/#herramientas"],
    ["/revista/carril/trabajo", "/proximamente?p=revista"], ["/revista/una-nota", "/proximamente?p=revista"],
    ["/recorrido", "/sobre-mi"], ["/estoy-trabado", "/proximamente?p=servicios"], ["/empezar", "/proximamente?p=servicios"],
    ["/casos", "/proximamente?p=servicios"], ["/agenda", "/proximamente?p=servicios"],
    ["/consultas", "/proximamente?p=servicios"], ["/cursos", "/proximamente?p=academia"],
    ["/preguntas", "/proximamente"], ["/p/algo", "/proximamente"],
    ["/luna", "/#cielo"], ["/calendario", "/#agenda"], ["/las-fechas", "/#agenda"],
  ];
  for (const [r, a] of VIEJAS_302) {
    const x = await pedir(r);
    cierto(`${r} → ${a} (302)`, x.codigo === 302 && x.donde === a, `${x.codigo} ${x.donde}`);
  }
  {
    const x = await pedir("/newsletter", { metodo: "POST" });
    cierto("POST /newsletter ya no anota a nadie y vuelve a la portada", x.codigo === 303 && x.donde === "/#canales", `${x.codigo} ${x.donde}`);
  }
  const VIEJAS_301 = [
    ["/about", "/sobre-mi"], ["/about.html", "/sobre-mi"], ["/anaretico-29", "/"], ["/home", "/"],
    ["/index.html", "/"], ["/appointments", "/servicios"], ["/contact", "/servicios"],
    ["/miembros", "/membresia"], ["/pagina-nueva", "/revista"], ["/pagina-nueva-1", "/"],
  ];
  for (const [r, a] of VIEJAS_301) {
    const x = await pedir(r);
    cierto(`${r} → ${a} (301)`, x.codigo === 301 && x.donde === a, `${x.codigo} ${x.donde}`);
  }
  // Una 301 a Próximamente le diría al buscador que la página se mudó ahí para siempre
  cierto("ninguna 301 apunta a Próximamente", VIEJAS_301.every(([, a]) => !a.startsWith("/proximamente")));
  // Item 3: TODA ruta vieja del Squarespace sigue siendo 301, llega a una página (200) y en 2 saltos o menos
  const { VIEJAS } = await import("../src/routes/viejas.js");
  for (const vieja of Object.keys(VIEJAS)) {
    let x = await pedir(vieja), saltos = 0;
    const primero = x.codigo;
    while (x.codigo >= 300 && x.codigo < 400 && saltos < 4) { saltos++; x = await pedir(x.donde); }
    cierto(`${vieja}: 301, termina en 200 en ≤ 2 saltos`, primero === 301 && x.codigo === 200 && saltos <= 2,
      `primero ${primero}, final ${x.codigo}, ${saltos} saltos`);
  }

  console.log("— Se vuelve a cerrar");
  setEnDesarrollo(true);
  cierto("cerrado de nuevo, / vuelve a dar 503", (await pedir("/")).codigo === 503);
  cierto("y /sobre-mi también", (await pedir("/sobre-mi")).codigo === 503);
} catch (e) {
  fallo++;
  console.log("  ✗ el test se cortó:", e.stack || e);
} finally {
  http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

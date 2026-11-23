// Test de la web nueva: las tres páginas publicadas, sus archivos, Próximamente
// para lo demás, las redirecciones viejas y el portero delante de todo.
//
// Levanta el router en 127.0.0.1 con un puerto libre y le pide cosas: no sale a
// internet. La base se arma en un temporal descartable: nunca toca
// data/anaretico.db.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { refsHtml, refsCss, fetchsJs, rutasJson, refsSvg, fotosCarrusel, esExterna } from "./web-refs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "..", "src", "web");
const VERSION = "20261123.5";
const SITIO = "https://www.anaretico29.com";
const LEGAL = "Contenido astrológico y educativo. No constituye asesoramiento ni recomendación de inversión.";

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
      "portada.css", "tonos.css", "movimiento.css", "portada-plaza.css", "linea-tiempo/opciones-lt.css"]),
    scripts: v(["data.js", "app.js", "compact.js", "arreglos.js", "presentacion.js", "herramientas.js",
      "oferta.js", "portada.js", "portada-plaza.js", "menu.js", "movimiento.js", "rich.js",
      "linea-tiempo/opciones-lt.js"]),
  },
  "sobre-mi.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "paletas/pizarra-auto.css",
      "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css",
      "canales.css", "sobre-mi.css", "tonos.css", "movimiento.css"]),
    scripts: v(["data.js", "app.js", "menu.js", "movimiento.js", "sobre-mi.js"]),
  },
  "proximamente.html": {
    hojas: v(["styles.css", "compact.css", "rich.css", "combinado.css", "paletas/pizarra-auto.css",
      "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css",
      "canales.css", "oferta.css", "portada.css", "proximamente.css", "tonos.css", "movimiento.css",
      "portada-plaza.css", "servicios-op2.css"]),
    scripts: v(["data.js", "app.js", "menu.js", "movimiento.js", "proximamente.js"]),
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

  console.log("— Portero abierto: las tres páginas");
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
  for (const [r, a] of [["/combinado.html", "/"], ["/sobre-mi.html", "/sobre-mi"], ["/proximamente.html?p=academia", "/proximamente?p=academia"]]) {
    const x = await pedir(r);
    cierto(`${r} → ${a} (301)`, x.codigo === 301 && x.donde === a, `${x.codigo} ${x.donde}`);
  }

  console.log("— Cada archivo que cargan las tres páginas responde");
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
      // /suscripcion es el action del formulario de la franja (POST: test-suscripcion.mjs)
      if (e === "/suscripcion") { cierto(`${ruta}: /suscripcion solo como destino del formulario`, servidas[archivo].includes('<form class="boletin" action="/suscripcion" method="post"')); continue; }
      const bien = /^\/(?:#[\w-]+)?$/.test(e) || /^\/sobre-mi(?:#[\w-]+)?$/.test(e) || e === "/privacidad" ||
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

  console.log("— Lo que se apaga: Servicios, Research, Academia, Revista, Membresía y la carta");
  const pagVisible = (p) => p.bloqueada === true || p.visible !== false;
  for (const id of ["servicios", "research", "academia", "revista", "membresia", "carta"]) {
    cierto(`visibilidad.json: ${id} apagada`, !pagVisible(vis.paginas.find((p) => p.id === id)));
  }
  for (const id of ["inicio", "recorrido", "enfoque"]) {
    cierto(`visibilidad.json: ${id} visible`, pagVisible(vis.paginas.find((p) => p.id === id)));
  }
  cierto("«Mi recorrido» lleva a /sobre-mi", vis.paginas.find((p) => p.id === "recorrido").ruta === "/sobre-mi");
  const inicio = servidas["combinado.html"];
  cierto("la portada no ofrece «Sumarme» (Membresía apagada)", !/>Sumarme</.test(inicio));
  cierto("la portada no trae la franja «Conocer la membresía»", !/m-feature|Conocer la membresía/.test(inicio));
  const menuJs = (await traer(`/menu.js?v=${VERSION}`)).texto;
  cierto("menu.js no agrega «Sumarme» al encabezado", !/appendChild\(cta\)/.test(menuJs) && !menuJs.includes("membresia.html"));
  const herrJs = (await traer(`/herramientas.js?v=${VERSION}`)).texto;
  cierto("el formulario de la carta no lleva a una carta de ejemplo",
    !/location\.assign\([^)]*carta\.html/.test(herrJs) && (herrJs.match(/location\.assign\('\/proximamente\?p=carta'\)/g) || []).length === 2);
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
    ["/carta.html?modo=momento", "/proximamente?p=carta"],
    ["/carta-natal", "/proximamente?p=carta"], ["/carta-natal?fecha=2000-01-01&ciudad=Rosario", "/proximamente?p=carta"],
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

// Test de «El cielo de hoy» y «La línea de tiempo» de la portada con el motor
// real (S4): reloj fijo inyectado, sin red, SQLite descartable en un temporal.
//
// Dos partes:
//   1. El motor contra el corte del prototipo (doc 01 §6.1 y §7.2): con el
//      instante del corte (20/10/2026 12:00 de Buenos Aires) tiene que dar los
//      mismos valores que Fernando dejó escritos a mano. Así se sabe que la
//      regla (redondeos, horas planetarias, criterio de eventos) es la misma.
//   2. La portada servida con otro reloj: el HTML trae las posiciones del motor
//      para ese instante, nada del corte fijo, el mismo marcado y el mismo orden
//      de hojas y scripts; data.js trae la ventana del mes y la línea de tiempo
//      marca «Hoy» en la fecha inyectada (se ejecuta opciones-lt.js con un DOM
//      mínimo, en la vista de celular, que arma todo con texto).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { refsHtml, esExterna } from "./web-refs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "..", "src", "web");
const VERSION = "20261123.5";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cielo-portada-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");
process.env.UPLOADS_DIR = path.join(tmp, "subidas");
process.env.CACHE_CIELO_MIN = "60";

const { initDb } = await import("../src/db.js");
initDb();
const express = (await import("express")).default;
const { default: app } = await import("../src/app.js");
const { setEnDesarrollo } = await import("../src/lib/portero.js");
const { fijarReloj, cieloPortada, tramo } = await import("../src/lib/cielo-portada.js");
const { valoresPortada, datosA29 } = await import("../src/lib/portada.js");
const { posiciones } = await import("../src/lib/efemerides.js");

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};
const igual = (nombre, real, esperado) => cierto(nombre, real === esperado, `dio ${JSON.stringify(real)}, esperaba ${JSON.stringify(esperado)}`);

// Grado y minuto dentro del signo, redondeado al minuto (doc 02 §4.7). Escrito
// aparte del código del sitio a propósito: si los dos se equivocan igual, el
// cruce contra el corte de la parte 1 lo agarra.
const SIGNOS = ["Aries", "Tauro", "Géminis", "Cáncer", "Leo", "Virgo", "Libra", "Escorpio", "Sagitario", "Capricornio", "Acuario", "Piscis"];
const posTexto = (lon) => {
  const i = Math.floor(lon / 30), tot = Math.min(1799, Math.round((lon - i * 30) * 60));
  return `${SIGNOS[i]} ${String(Math.floor(tot / 60)).padStart(2, "0")}°${String(tot % 60).padStart(2, "0")}′`;
};
const bloques = (html) => {
  const a = html.indexOf('<section class="compact-sky section" id="cielo">'), b = html.indexOf('<section class="of doors" id="areas"');
  return a >= 0 && b > a ? html.slice(a, b) : "";
};
const PROHIBIDO = ["20/10/2026", "20/10", "corte de referencia", "corte fijo", "Corte de referencia", "{{"];

const server = express();
server.use(app);
const http = server.listen(0, "127.0.0.1");
await once(http, "listening");
const BASE = `http://127.0.0.1:${http.address().port}`;
const pedir = async (ruta) => {
  const r = await fetch(BASE + ruta, { redirect: "manual" });
  return { codigo: r.status, tipo: r.headers.get("content-type") || "", cache: r.headers.get("cache-control") || "", texto: await r.text() };
};

try {
  console.log("— 1. El motor contra el corte del prototipo (20/10/2026 12:00 BA)");
  {
    const corte = new Date("2026-10-20T15:00:00Z");
    const c = await cieloPortada(corte);
    const v = valoresPortada(c);
    igual("fecha", v.fecha, "Martes, 20 de octubre");
    igual("año", v.anio, "2026");
    igual("reloj", v.hora + v.segundos, "12:00:00");
    igual("día planetario", v.diaPlanetario, "♂ Marte");
    igual("hora planetaria", v.horaPlanetaria, "♄ Saturno");
    igual("número de hora", v.horaNumero, "Hora 6 de 24");
    igual("rango de la hora", v.horaRango, "11:32 — 12:38");
    igual("amanecer", v.amanecer, "06:05");
    igual("ocaso", v.ocaso, "19:12");
    igual("iluminación", v.iluminada, "68,5% iluminada");
    igual("Luna: signo", v.lunaSigno, "Acuario");
    igual("Luna: grados", v.lunaGrado, "18°50′");
    igual("próximo ingreso", `${v.ingresoSigno} ${v.ingresoFecha}`, "Piscis 21 oct · 09:35");
    igual("próxima llena", `${v.llenaSigno} ${v.llenaFecha}`, "Tauro 26 oct · 01:11");
    igual("curso", v.curso, "Luna no vacía de curso");
    igual("radar: hora", v.radarHora, "14:42");
    igual("radar: aspecto", `☽ ${v.radarGlifo} ${v.radarOtro} ${v.radarAspecto} ${v.radarPlaneta}`, "☽ □ ☿ cuadratura Mercurio");
    igual("barómetro: tensión", v.baroTension, "60");
    igual("barómetro: modalidad", `${v.baroModalidad} ${v.baroModalidadNombre}`, "64 Fija");
    igual("barómetro: elemento", v.baroElementoNombre, "Aire");
    igual("retrógrados", v.retroCuenta, "4 ACTIVOS");
    const CINTA = [["☉", "Sol", "Libra 27°14′", false], ["☽", "Luna", "Acuario 18°50′", false], ["☿", "Mercurio", "Escorpio 20°10′", false],
      ["♀", "Venus", "Escorpio 02°53′", true], ["♂", "Marte", "Leo 12°42′", false], ["♃", "Júpiter", "Leo 22°48′", false],
      ["♄", "Saturno", "Aries 10°04′", true], ["♅", "Urano", "Géminis 05°03′", true], ["♆", "Neptuno", "Aries 02°21′", true],
      ["♇", "Plutón", "Acuario 03°04′", false]];
    igual("la cinta es la del corte", v.cinta, CINTA.map(([g, n, p, r]) => `<span class="ticker-item"><i>${g}</i> ${n} <strong>${p}</strong>${r ? "<b>℞</b>" : ""}</span>`).join(""));
    igual("lista de retrógrados", v.retro, CINTA.filter((x) => x[3]).map(([g, n, p]) => `<li><span><b>${g}</b> ${n}</span><strong>${p}</strong></li>`).join(""));
    igual("ciclos de fondo", v.ciclos, "<li><span><b>♃</b> Júpiter</span><strong>Leo</strong></li><li><span><b>♄</b> Saturno</span><strong>Aries</strong></li><li><span><b>♇</b> Plutón</span><strong>Acuario</strong></li>");
    // Los 11 eventos de doc 01 §7.2: fecha y hora de Buenos Aires, tipo, título y nombre corto
    const EVENTOS = [
      ["2026-10-20", "03:56", "aspect", "Venus en cuadratura con Plutón", "Venus · Plutón"],
      ["2026-10-23", "06:37", "ingress", "Sol ingresa en Escorpio", "Sol a Escorpio"],
      ["2026-10-24", "04:12", "station", "Mercurio inicia retrogradación", "Mercurio retrógrado"],
      ["2026-10-25", "06:09", "ingress", "Venus vuelve a Libra", "Venus a Libra"],
      ["2026-10-26", "01:11", "lunation", "Luna llena en Tauro", "Luna llena"],
      ["2026-10-26", "09:11", "aspect", "Sol en cuadratura con Plutón", "Sol · Plutón"],
      ["2026-10-30", "14:20", "aspect", "Mercurio en cuadratura con Marte", "Mercurio · Marte"],
      ["2026-11-09", "04:02", "lunation", "Luna nueva en Escorpio", "Luna nueva"],
      ["2026-11-13", "12:53", "station", "Mercurio retoma movimiento directo", "Mercurio directo"],
      ["2026-11-13", "21:27", "station", "Venus retoma movimiento directo", "Venus directo"],
      ["2026-11-18", "06:38", "aspect", "Sol en cuadratura con Júpiter", "Sol · Júpiter"],
    ];
    const d = datosA29(c, "2.10.03");
    igual("la ventana del corte arranca el 20/10 a las 00:00 BA", d.agenda.inicio, "2026-10-20T03:00:00.000Z");
    igual("la ventana dura 30 días", d.agenda.dias, 30);
    igual("los eventos del corte", JSON.stringify(d.events.map((e) => [e.date, e.time, e.kind, e.title, e.short])), JSON.stringify(EVENTOS));
    cierto("cada evento lleva su índice", d.events.every((e, i) => e.index === i));
  }

  console.log("— 2. La portada servida con el reloj inyectado (23/11/2026 15:47 BA)");
  const INYECTADO = new Date("2026-11-23T18:47:12Z");
  fijarReloj(() => INYECTADO);
  setEnDesarrollo(false);
  const ref = tramo(INYECTADO);
  igual("el tramo de caché es la hora en punto", ref.toISOString(), "2026-11-23T18:00:00.000Z");
  const x = await pedir("/");
  igual("/ da 200", x.codigo, 200);
  cierto("/ es HTML", x.tipo.startsWith("text/html"), x.tipo);
  cierto("/ no se cachea", x.cache.includes("no-cache"), x.cache);
  const html = x.texto, cielo = bloques(html);
  cierto("están los dos bloques", cielo.includes('id="agenda"'));
  const pos = await posiciones(ref);
  for (const clave of ["sol", "luna", "mercurio", "venus", "marte", "jupiter", "saturno", "urano", "neptuno", "pluton"]) {
    const p = pos.find((y) => y.clave === clave);
    const item = `<span class="ticker-item"><i>${p.glifo}</i> ${p.nombre} <strong>${posTexto(p.longitud)}</strong>${p.retro ? "<b>℞</b>" : ""}</span>`;
    cierto(`la cinta trae ${p.nombre} del motor (${posTexto(p.longitud)}) en las dos copias`, cielo.split(item).length - 1 === 2);
  }
  const luna = pos.find((y) => y.clave === "luna");
  cierto("la tarjeta de la Luna trae signo y grados del motor", cielo.includes(`<p>en ${posTexto(luna.longitud).replace(" ", " <span>")}</span></p>`));
  cierto("el reloj dice la hora de referencia: 15:00:00", cielo.includes("<time>15:00<span>:00</span></time><small>HORA DE REFERENCIA</small>"));
  cierto("la fecha es la inyectada", cielo.includes('<h3>Lunes, 23 de noviembre</h3><p class="clock-year">2026</p>'));
  cierto("la nota dice el instante de los datos", cielo.includes('<p class="reference-note">Datos del cielo: 23/11/2026, 15:00 de Buenos Aires. La cinta muestra esas posiciones en movimiento.</p>'));
  cierto("el período es el del mes que arranca hoy", cielo.includes('<span class="period">23 NOV — 22 DIC 2026<br>BUENOS AIRES · ART</span>'));
  cierto("la cinta ya no se presenta como corte", cielo.includes('<div class="planet-ticker" aria-label="Posiciones planetarias del día">'));
  for (const s of PROHIBIDO) cierto(`los bloques no dicen «${s}»`, !cielo.includes(s));
  // S4: el corte fijo no puede quedar en NINGUNA parte de la portada (también Herramientas)
  for (const s of PROHIBIDO.slice(0, 5)) cierto(`la portada entera no dice «${s}»`, !html.includes(s));
  cierto("no queda ninguna marca sin rellenar en la página", !html.includes("{{"));
  // Mismo marcado: fuera de las marcas, la página es byte a byte la plantilla
  const plantilla = fs.readFileSync(path.join(WEB, "variantes", "combinado.html"), "utf8");
  const marcas = plantilla.match(/\{\{\w+\}\}/g) || [];
  cierto("la plantilla tiene marcas del cielo", marcas.length >= 30, `${marcas.length}`);
  const molde = new RegExp("^" + plantilla.split(/\{\{\w+\}\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*?") + "$");
  cierto("fuera de los valores, la página es la plantilla tal cual", molde.test(html));
  cierto("la plantilla no tiene marcas fuera de los dos bloques",
    plantilla.indexOf("{{") > plantilla.indexOf('id="cielo"') && plantilla.lastIndexOf("}}") < plantilla.indexOf('id="areas"'));
  igual("la cinta sigue con 20 posiciones (dos copias)", (cielo.match(/<span class="ticker-item">/g) || []).length, 20);
  igual("balances: 4 elementos + 3 modalidades", (cielo.match(/<div class="bar-row">/g) || []).length, 7);
  // Mismo orden de hojas y scripts que el prototipo
  const v = (l) => l.map((u) => `/${u}?v=${VERSION}`);
  const { hojas, scripts } = refsHtml(html);
  igual("hojas en el orden del prototipo", JSON.stringify(hojas.filter((u) => !esExterna(u))), JSON.stringify(v(["styles.css", "compact.css", "rich.css", "combinado.css", "linea-tiempo/panorama.css",
    "paletas/pizarra-auto.css", "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css",
    "arreglos.css", "menu.css", "presentacion.css", "herramientas.css", "canales.css", "oferta.css",
    "portada.css", "tonos.css", "movimiento.css", "portada-plaza.css", "linea-tiempo/opciones-lt.css"])));
  igual("scripts en el orden del prototipo", JSON.stringify(scripts.filter((u) => !esExterna(u))), JSON.stringify(v(["data.js", "app.js", "compact.js", "arreglos.js", "presentacion.js", "herramientas.js",
    "oferta.js", "portada.js", "portada-plaza.js", "menu.js", "movimiento.js", "rich.js", "linea-tiempo/opciones-lt.js"])));

  console.log("— Caché: el mismo tramo da lo mismo; el siguiente, otro instante");
  fijarReloj(() => new Date("2026-11-23T18:59:59Z"));
  igual("dentro del mismo tramo, la misma página", (await pedir("/")).texto, html);
  fijarReloj(() => new Date("2026-11-23T19:00:01Z"));
  cierto("en el tramo siguiente, el reloj pasa a 16:00", bloques((await pedir("/")).texto).includes("<time>16:00<span>:00</span></time>"));
  fijarReloj(() => INYECTADO);

  console.log("— data.js: la línea de tiempo del mes, desde el motor");
  const dj = await pedir(`/data.js?v=${VERSION}`);
  igual("/data.js da 200", dj.codigo, 200);
  cierto("/data.js es JavaScript", /javascript/.test(dj.tipo), dj.tipo);
  cierto("/data.js se revalida siempre", dj.cache.includes("no-cache"), dj.cache);
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(dj.texto, ctx);
  const D = ctx.A29_DATA;
  cierto("A29_SLIDES sigue siendo el del prototipo (4 fotos)", Array.isArray(ctx.A29_SLIDES) && ctx.A29_SLIDES.length === 4);
  igual("A29_DATA.utc es el instante de referencia", D.utc, "2026-11-23T18:00:00.000Z");
  igual("la ventana arranca hoy a las 00:00 BA", D.agenda.inicio, "2026-11-23T03:00:00.000Z");
  igual("y termina 30 días después", D.agenda.fin, "2026-12-23T03:00:00.000Z");
  cierto("hay eventos en el mes", D.events.length > 0, `${D.events.length}`);
  const ini = Date.parse(D.agenda.inicio), fin = Date.parse(D.agenda.fin);
  cierto("todos los eventos caen dentro de la ventana", D.events.every((e) => Date.parse(e.utc) >= ini && Date.parse(e.utc) < fin));
  cierto("ordenados y con su índice", D.events.every((e, i) => e.index === i && (i === 0 || Date.parse(D.events[i - 1].utc) <= Date.parse(e.utc))));
  const CAMPOS = ["id", "kind", "utc", "jd", "body", "longitude", "local", "offsetSeconds", "timezone", "title", "short", "category", "index", "date", "time", "displayDate"];
  cierto("cada evento trae los campos de data.js del prototipo", D.events.every((e) => CAMPOS.every((k) => k in e)),
    JSON.stringify(D.events.find((e) => !CAMPOS.every((k) => k in e))));
  cierto("solo los cuatro tipos del prototipo", D.events.every((e) => ["lunation", "aspect", "ingress", "station"].includes(e.kind)));
  cierto("hay una lunación en el mes", D.events.some((e) => e.kind === "lunation"));
  cierto("los aspectos son cuadraturas u oposiciones sin la Luna", D.events.filter((e) => e.kind === "aspect").every((e) => [90, 180].includes(e.angle) && e.body !== 1 && e.otherBody !== 1));
  const dialogos = JSON.stringify(D.cielo);
  for (const s of PROHIBIDO.slice(0, 5)) cierto(`los diálogos del cielo no dicen «${s}»`, !dialogos.includes(s));
  cierto("el diálogo solar es del día inyectado", D.cielo.solar.cuerpo.startsWith("<p>Para el 23 de noviembre de 2026, en Buenos Aires,"));

  console.log("— La línea de tiempo marca «Hoy» en la fecha inyectada");
  const ltJs = (await pedir(`/linea-tiempo/opciones-lt.js?v=${VERSION}`)).texto;
  cierto("opciones-lt.js ya no trae el corte escrito a mano", !ltJs.includes("2026-10-20") && !ltJs.includes("'Venus · Plutón'") && !ltJs.includes("corte de referencia del 20/10"));
  const correr = (ahoraMs) => {
    const el = () => ({ innerHTML: "", textContent: "", dataset: { ltOption: "mes" }, clientWidth: 390,
      classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {}, setAttribute() {}, querySelector: () => null, scrollIntoView() {} });
    const host = el(), panel = el(), count = el(), paso = el(), pista = el();
    const s = {
      console, A29_DATA: D, Math, JSON, Object, Array, String, Number, Date: class extends Date { static now() { return ahoraMs; } },
      matchMedia: () => ({ matches: true, addEventListener() {} }),
      ResizeObserver: class { observe() {} },
      document: {
        querySelector: (q) => ({ "[data-lt-option]": host, ".astro-inspector": panel, ".astro-count": count, ".astro-controls > span": paso, ".astro-instruction": pista }[q] || null),
        querySelectorAll: () => [], addEventListener() {},
      },
    };
    s.window = s;
    vm.createContext(s);
    vm.runInContext(ltJs, s);
    return { host: host.innerHTML, panel: panel.innerHTML, cuenta: count.textContent };
  };
  const conReloj = correr(INYECTADO.getTime());
  cierto("con el reloj del navegador en la fecha inyectada: «Hoy · lun 23/11»", conReloj.host.includes("Hoy · lun 23/11"), conReloj.host.slice(0, 300));
  cierto("el riel arranca en noviembre", conReloj.host.includes('<li class="lt-rail-month">noviembre</li>'));
  cierto("el panel muestra un tránsito del mes", D.events.some((e) => conReloj.panel.includes(e.title)));
  igual("la cuenta ya no dice «corte de referencia»", conReloj.cuenta, `${D.events.length} tránsitos · horarios de Buenos Aires`);
  const relojRoto = correr(Date.parse("2031-01-01T12:00:00Z"));
  cierto("con un reloj del navegador fuera de la ventana, «Hoy» es la fecha del servidor", relojRoto.host.includes("Hoy · lun 23/11"));

  console.log("— Los diálogos y app.js no hablan del corte fijo");
  for (const [u, n] of [["/app.js", "app.js"], ["/compact.js", "compact.js"], ["/rich.js", "rich.js"]]) {
    const t = (await pedir(`${u}?v=${VERSION}`)).texto;
    for (const s of ["20/10/2026", "corte fijo", "corte de referencia", "En el corte"]) cierto(`${n} no dice «${s}»`, !t.includes(s));
  }
  const appJs = (await pedir(`/app.js?v=${VERSION}`)).texto;
  cierto("el diálogo del evento toma el año del evento", appJs.includes("e.displayDate+'/'+e.date.slice(0,4)+' · '") && !appJs.includes("'/2026 · '"));
  cierto("«El enfoque» conserva el resto del texto de Fernando", appJs.includes("<p><strong>Tensión:</strong> 100 × (cuadraturas + oposiciones)"));

  console.log("— Lo que no se toca");
  setEnDesarrollo(true);
  igual("con el portero cerrado, / sigue dando 503", (await pedir("/")).codigo, 503);
  igual("y /data.js también", (await pedir(`/data.js?v=${VERSION}`)).codigo, 503);
} catch (e) {
  fallo++;
  console.log("  ✗ el test se cortó:", e.stack || e);
} finally {
  fijarReloj(null);
  http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

// Test de la carta natal y de la carta del momento (T8: S9, S10, S13, S14;
// T9: S15 sin textos de interpretación ni frases de contacto, S16 el momento sin
// PDF, S17 desde 1900, S18 latitud polar → mensaje claro y ninguna carta).
//
//   1. El cálculo (src/lib/carta.js) contra las cartas de referencia del doc 02
//      §8 (posiciones dentro de 1′, Ascendente, Medio Cielo, cúspides, casa de
//      cada cuerpo, huso histórico) y contra cuentas hechas ACÁ desde las
//      longitudes crudas: aspectos con los orbes de Fernando, aplicativo /
//      separativo, casas por intervalos y balance de 50 puntos. Lo esperado
//      no sale del módulo bajo prueba: la tabla de Fernando se escribe de nuevo.
//   2. Los bordes: orbe justo en 8°, 6° y 4° (entra), un pelo más (no entra),
//      un planeta justo en la cúspide (va a la casa que empieza ahí), todos
//      empatados («Equilibrio»).
//   3. La API (POST /api/carta, GET /api/carta/momento): sin hora → 400 y nada
//      de carta, lugar desconocido → error claro, no-store, nada guardado ni
//      escrito en los registros.
//   4. La pantalla publicada (/carta): sin «corte fijo» ni «ejemplo», sin
//      Google, sin respaldos, el botón del PDF, el límite de 2 cartas por
//      semana (la función de conteo, corrida tal cual se sirve) y
//      /proximamente?p=carta → /carta.
//   5. La pantalla corrida tal cual se sirve (carta.js + carta-op2.js sobre un
//      DOM mínimo, contra la API de verdad): la natal y la del momento sin
//      textos de interpretación, el PDF solo en la natal, y la latitud polar
//      (o una carta incompleta) sin rueda ni tablas, como cuando falta la hora.
//
// Sin red: la base es un SQLite descartable con siete ciudades.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { caracteres } from "./woff2-cmap.mjs";
import { refsHtml, esExterna } from "./web-refs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(HERE, "..", "src", "web");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "carta-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");
process.env.UPLOADS_DIR = path.join(tmp, "subidas");

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};
const igual = (nombre, real, esperado) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  cierto(nombre, a === b, `dio ${a}, esperaba ${b}`);
};

// --- La tabla de Fernando, escrita de nuevo (no se importa criterios.js) -----
const PLANETAS = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const PESOS = { sun: 7, moon: 7, mercury: 4, venus: 4, mars: 4, jupiter: 3, saturn: 3, uranus: 2, neptune: 1, pluto: 1, asc: 10, mc: 4 };
const ORBES = [["conjunction", 0, 8], ["sextile", 60, 4], ["square", 90, 6], ["trine", 120, 6], ["opposition", 180, 8]];
const ELEM = ["fire", "earth", "air", "water"], MODA = ["cardinal", "fixed", "mutable"];
const SIGNOS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const N360 = (x) => ((x % 360) + 360) % 360;
const signo = (lon) => Math.floor(N360(lon) / 30);
const sep = (a, b) => { const d = N360(a - b); return d > 180 ? 360 - d : d; };
const UN_MINUTO = 1 / 60;

/** Aspectos esperados entre los diez planetas, con el orbe y la fase calculados acá. */
function aspectosEsperados(bodies) {
  const p = PLANETAS.map((id) => bodies.find((b) => b.id === id));
  const out = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const d = sep(p[i].longitude, p[j].longitude);
    for (const [tipo, ang, orbe] of ORBES) {
      const o = Math.abs(d - ang);
      if (o <= orbe) {
        const dt = 1e-4; // días: el orbe un instante después, con las velocidades
        const luego = Math.abs(sep(p[i].longitude + p[i].speed * dt, p[j].longitude + p[j].speed * dt) - ang);
        const fase = o < 1 / 3600 ? "exacto" : luego < o ? "aplicativo" : "separativo";
        out.push({ a: p[i].id, b: p[j].id, type: tipo, orb: o, max_orb: orbe, phase: fase });
        break;
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}

/** Balance esperado: 50 puntos, cada factor todo su peso a su elemento y modalidad. */
function balanceEsperado(carta) {
  const lon = Object.fromEntries([...carta.bodies, ...carta.angles].map((x) => [x.id, x.longitude]));
  const el = Object.fromEntries(ELEM.map((k) => [k, 0])), mo = Object.fromEntries(MODA.map((k) => [k, 0]));
  let total = 0;
  for (const [id, peso] of Object.entries(PESOS)) {
    el[ELEM[signo(lon[id]) % 4]] += peso;
    mo[MODA[signo(lon[id]) % 3]] += peso;
    total += peso;
  }
  const pc = (n) => Math.round((100 * n) / total);
  const dom = (g) => { const max = Math.max(...Object.values(g)); return Object.keys(g).filter((k) => g[k] === max); };
  return {
    total,
    elements: ELEM.map((k) => ({ id: k, count: el[k], percent: pc(el[k]) })),
    modalities: MODA.map((k) => ({ id: k, count: mo[k], percent: pc(mo[k]) })),
    dominant_elements: dom(el), dominant_modalities: dom(mo),
  };
}

/** Casa por intervalos entre cúspides (la cúspide exacta abre la casa). */
function casaEsperada(lon, cusps) {
  for (let k = 0; k < 12; k++) {
    const desde = cusps[k], ancho = N360(cusps[(k + 1) % 12] - desde);
    if (N360(lon - desde) < ancho) return k + 1;
  }
  return null;
}
const gm = (p) => `${p.degree}°${String(p.minute).padStart(2, "0")}′`;

/**
 * La pantalla /carta corrida tal cual se sirve: carta.js y carta-op2.js sobre un DOM mínimo (solo lo que usan), con fetch a la API
 * de verdad. La rueda se cuenta (dibujarRueda), no se mide. Devuelve lo que quedó a la vista de cada caso.
 */
async function pantallas({ cartaJs, op2, base, n1 }) {
  class Nodo {
    constructor(tag) {
      this.tagName = tag; this.hijos = []; this.attrs = {}; this.propio = ""; this.hidden = false; this.quitado = false; this.parentNode = null;
      this.style = { setProperty() {}, display: "" }; this.cl = new Set(); this.oyentes = {};
      const cl = this.cl;
      this.classList = { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c), toggle: (c, on) => { if (on === undefined ? !cl.has(c) : on) cl.add(c); else cl.delete(c); } };
    }
    set className(v) { this.cl.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) this.cl.add(c); }
    get className() { return [...this.cl].join(" "); }
    set textContent(v) { this.hijos = []; this.propio = v == null ? "" : String(v); }
    get textContent() { return this.propio + this.hijos.map((h) => h.textContent).join(""); }
    appendChild(n) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.hijos.push(n); return n; }
    insertBefore(n, ref) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; const i = ref ? this.hijos.indexOf(ref) : -1; if (i < 0) this.hijos.push(n); else this.hijos.splice(i, 0, n); return n; }
    removeChild(n) { this.hijos = this.hijos.filter((h) => h !== n); n.parentNode = null; return n; }
    remove() { this.quitado = true; if (this.parentNode) this.parentNode.removeChild(this); }
    get firstChild() { return this.hijos[0] || null; }
    get lastChild() { return this.hijos[this.hijos.length - 1] || null; }
    get nextSibling() { const p = this.parentNode; return p ? p.hijos[p.hijos.indexOf(this) + 1] || null : null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, f) { (this.oyentes[t] ||= []).push(f); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    todos() { return [this, ...this.hijos.flatMap((h) => h.todos())]; }
  }
  const correr = async ({ search = "", hash = "", guardadoAntes = null, respuesta = null }) => {
    const nodos = new Map(), cont = new Nodo("div"), raiz = new Nodo("main");
    raiz.querySelector = (sel) => {
      if (!nodos.has(sel)) { const n = new Nodo("div"); cont.appendChild(n); nodos.set(sel, n); }
      const n = nodos.get(sel);
      return n.quitado ? null : n;
    };
    raiz.querySelectorAll = (lista) => lista.split(",").map((x) => raiz.querySelector(x.trim())).filter(Boolean);
    const guardado = new Map(guardadoAntes ? [["a29-cartas-natales", JSON.stringify(guardadoAntes)]] : []);
    let dibujos = 0;
    const s = {
      document: {
        currentScript: null, title: "",
        querySelector: (sel) => (sel === "[data-carta-observatorio]" ? raiz : null),
        createElement: (t) => new Nodo(t), createElementNS: (_, t) => new Nodo(t),
        createTextNode: (t) => { const n = new Nodo("#text"); n.propio = String(t); return n; },
      },
      location: { href: "https://www.anaretico29.com/carta" + search + hash, search, hash, pathname: "/carta", replace() {}, reload() {} },
      localStorage: { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) },
      fetch: (u, o) => (respuesta ? Promise.resolve(respuesta(String(u), o)) : fetch(base + u, o)),
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener() {}, print() {},
      URLSearchParams, URL, Promise, JSON, Date, Math, String, Array, Object, Error, Number, isFinite, console: { error() {}, log() {} },
    };
    s.window = s;
    vm.createContext(s);
    vm.runInContext(cartaJs, s);
    s.window.A29Carta.dibujarRueda = () => { dibujos++; };
    vm.runInContext(op2, s);
    const cargando = () => nodos.get("[data-cargando]");
    for (let i = 0; i < 200 && !raiz.cl.has("is-listo") && !(cargando() && cargando().propio); i++) await new Promise((r) => setTimeout(r, 25));
    const vivos = [...nodos.entries()].filter(([, n]) => !n.quitado && n.style.display !== "none");
    const texto = vivos.flatMap(([, n]) => n.todos()).map((x) => [x.propio, ...Object.values(x.attrs), x.title || "", x.href || ""].join(" ")).join(" ");
    const pdf = nodos.get("[data-pdf]");
    const enlace = (() => { const c = cargando(); const p = c && c.nextSibling; const a = p && p.hijos[0]; return a ? `${a.textContent} → ${a.href}` : ""; })();
    const tb = (sel) => (nodos.get(sel) ? nodos.get(sel).hijos : []);
    return {
      listo: raiz.cl.has("is-listo"), dibujos, texto,
      error: raiz.cl.has("is-listo") ? "" : (cargando() ? cargando().propio : ""),
      esError: !!(cargando() && cargando().cl.has("is-error")),
      ocultas: [".ob-lado", ".ob-ficha", ".ob-cinta", ".ob-mesa-w", "#balance"].filter((x) => nodos.get(x) && nodos.get(x).style.display === "none"),
      enlace,
      pdf: !pdf ? "sin tocar" : pdf.quitado ? "quitado" : pdf.hidden ? "oculto" : "visible",
      limite: JSON.parse(guardado.get("a29-cartas-natales") || "[]").length,
      filas: (sel) => tb(sel).length,
      celdas: (sel) => [...new Set(tb(sel).map((tr) => tr.hijos.length))],
      textoDe: (sel) => (nodos.get(sel) ? nodos.get(sel).textContent : ""),
    };
  };
  const otra = [{ h: "aaaaaaaa", t: Date.now() - 1000 }];
  const incompleta = JSON.parse(JSON.stringify(n1)); incompleta.houses = [];
  return {
    natal: await correr({ hash: "#fecha=1985-03-15&hora=14%3A30&lugar=Buenos+Aires" }),
    momento: await correr({ search: "?modo=momento" }),
    polar: await correr({ hash: "#fecha=1990-05-12&hora=08%3A30&lugar=Longyearbyen", guardadoAntes: otra }),
    sinHora: await correr({ hash: "#fecha=1990-05-12&hora=&lugar=Buenos+Aires", guardadoAntes: otra }),
    incompleta: await correr({ hash: "#fecha=1985-03-15&hora=14%3A30&lugar=Buenos+Aires", respuesta: () => ({ ok: true, status: 200, json: async () => incompleta }) }),
  };
}

let http = null;
try {
  const { initDb, getDb } = await import("../src/db.js");
  initDb();
  const db = getDb();
  // Cinco ciudades del padrón (GeoNames), con su índice de palabras
  const CIUDADES = [
    [3435910, "Buenos Aires", "AR", null, -34.6037, -58.3816, "America/Argentina/Buenos_Aires", 13076300],
    [3860259, "Córdoba", "AR", "Córdoba", -31.4135, -64.18105, "America/Argentina/Cordoba", 1428214],
    [2519240, "Córdoba", "ES", "Andalucía", 37.89155, -4.77275, "Europe/Madrid", 328428],
    [3838583, "Rosario", "AR", "Santa Fe", -32.94682, -60.63932, "America/Argentina/Cordoba", 1173533],
    [5128581, "New York City", "US", "New York", 40.71427, -74.00597, "America/New_York", 8804190],
    // S18: más allá de los círculos polares Placidus no existe
    [2729907, "Longyearbyen", "SJ", null, 78.2232, 15.6267, "Arctic/Longyearbyen", 2060],
    [6696480, "McMurdo Station", "AQ", null, -77.846, 166.676, "Antarctica/McMurdo", 1258],
  ];
  const { normalizar } = await import("../src/lib/geo.js");
  for (const [id, nombre, pais, admin1, lat, lon, tz, poblacion] of CIUDADES) {
    db.prepare("INSERT INTO ciudades (id, nombre, nombre_norm, pais, admin1, lat, lon, tz, poblacion) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, nombre, normalizar(nombre), pais, admin1, lat, lon, tz, poblacion);
    for (const w of new Set(normalizar(nombre).split(" "))) db.prepare("INSERT INTO ciudad_palabra (palabra, ciudad_id) VALUES (?, ?)").run(w, id);
  }

  const carta = await import("../src/lib/carta.js");
  const { fijarReloj } = await import("../src/lib/cielo-portada.js");

  // ===========================================================================
  console.log("— 1. Carta natal de referencia (doc 02 §8.1): 15/03/1985 14:30, Buenos Aires");
  const n1 = await carta.calcularNatal({ fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires, Argentina" });
  igual("siete claves, en el orden del contrato", Object.keys(n1), ["meta", "bodies", "angles", "houses", "aspects", "balance", "aspect_rules"]);
  igual("meta.kind / hora_conocida / ejemplo", [n1.meta.kind, n1.meta.hora_conocida, n1.meta.ejemplo], ["natal", true, false]);
  igual("tropical, Placidus, nodo verdadero", [n1.meta.zodiac, n1.meta.house_system, n1.meta.house_system_code, n1.meta.node], ["tropical", "Placidus", "P", "true"]);
  igual("datos usados: sin nombre ni mail", Object.keys(n1.meta.input), ["name", "date", "time", "place", "latitude", "longitude", "timezone"]);
  igual("datos usados", [n1.meta.input.name, n1.meta.input.date, n1.meta.input.time, n1.meta.input.place, n1.meta.input.timezone],
    [null, "1985-03-15", "14:30", "Buenos Aires, Argentina", "America/Argentina/Buenos_Aires"]);
  igual("huso del día y UTC", [n1.meta.utc_offset, n1.meta.utc_instant], ["-03:00", "1985-03-15T17:30:00Z"]);
  cierto("día juliano UT", Math.abs(n1.meta.jd_ut - 2446140.229164) < 2e-5, `${n1.meta.jd_ut}`);
  cierto("el motor y los archivos usados constan", /^Swiss Ephemeris 2\.10\.03/.test(n1.meta.engine) && n1.meta.ephemeris_files.length === 3
    && n1.meta.ephemeris_files.every((f) => /^se(pl|mo|as)_18\.se1$/.test(f.file) && /^[0-9a-f]{64}$/.test(f.sha256)), n1.meta.engine);
  igual("12 cuerpos en el orden del contrato", n1.bodies.map((b) => b.id), [...PLANETAS, "node", "chiron"]);
  igual("4 ángulos (asc, mc, dsc, ic) y 12 casas", [n1.angles.map((a) => a.id), n1.houses.length], [["asc", "mc", "dsc", "ic"], 12]);
  const REF1 = [
    ["sun", 355.078059, "pisces", "25°05′", 9, false], ["moon", 289.480554, "capricorn", "19°29′", 7, false],
    ["venus", 22.217499, "aries", "22°13′", 10, true], ["saturn", 238.069516, "scorpio", "28°04′", 5, true],
    ["node", 49.916848, "taurus", "19°55′", 11, true], ["chiron", 63.9253, "gemini", "3°56′", 11, false],
  ];
  const punto = (c, id) => [...c.bodies, ...c.angles].find((x) => x.id === id);
  const conRef = (c, filas, etiqueta) => {
    for (const [id, lon, sg, g, casa, rx] of filas) {
      const p = punto(c, id);
      cierto(`${etiqueta}: ${id} a menos de 1′ (${lon})`, Math.abs(sep(p.longitude, lon)) < UN_MINUTO, `${p.longitude}`);
      // Doc 02 §8: signo, grado y minuto coinciden, salvo que entre la referencia y el motor caiga un cambio de minuto
      const medio = (x) => Math.floor(N360(x) * 60 + 0.5);
      if (medio(p.longitude) !== medio(lon) && Math.abs(sep(p.longitude, lon)) < UN_MINUTO) {
        cierto(`${etiqueta}: ${id} en ${sg}, a un lado y otro de un cambio de minuto (${g} en la referencia, ${gm(p)} acá)`, p.sign === sg);
      } else igual(`${etiqueta}: ${id} en ${sg} ${g}`, [p.sign, gm(p)], [sg, g]);
      if (casa !== undefined && casa !== null) igual(`${etiqueta}: ${id} en la casa ${casa}`, p.house, casa);
      if (rx !== undefined) igual(`${etiqueta}: ${id} retrógrado = ${rx}`, p.retrograde, rx);
    }
  };
  conRef(n1, REF1, "natal");
  conRef(n1, [["asc", 89.970732, "gemini", "29°58′", 1], ["mc", 18.8338, "aries", "18°50′", 10],
    ["dsc", 269.970732, "sagittarius", "29°58′", 7], ["ic", 198.8338, "libra", "18°50′", 4]], "natal");
  for (const [casa, cusp, sg, g] of [[2, 125.952248, "leo", "5°57′"], [3, 164.788148, "virgo", "14°47′"], [5, 225.887915, "scorpio", "15°53′"],
    [6, 248.478204, "sagittarius", "8°29′"], [11, 45.887915, "taurus", "15°53′"], [12, 68.478204, "gemini", "8°29′"],
    [1, 89.970732, "gemini", "29°58′"], [4, 198.8338, "libra", "18°50′"], [7, 269.970732, "sagittarius", "29°58′"], [10, 18.8338, "aries", "18°50′"]]) {
    const h = n1.houses[casa - 1];
    cierto(`cúspide ${casa} a menos de 1′`, h.house === casa && Math.abs(sep(h.cusp, cusp)) < UN_MINUTO, `${h.cusp}`);
    igual(`cúspide ${casa} en ${sg} ${g}`, [h.sign, gm(h)], [sg, g]);
  }
  const cusps1 = n1.houses.map((h) => h.cusp);
  cierto("la casa de cada cuerpo sale de los intervalos entre cúspides (sin pasar a la siguiente por cercanía)",
    n1.bodies.every((b) => b.house === casaEsperada(b.longitude, cusps1)), n1.bodies.map((b) => `${b.id}:${b.house}`).join(" "));
  cierto("signo, grado y minuto salen de la longitud real (redondeo al minuto, tope 29°59′)",
    n1.bodies.every((b) => b.sign === SIGNOS[signo(b.longitude)] && b.degree * 60 + b.minute === Math.min(1799, Math.floor((N360(b.longitude) - 30 * signo(b.longitude)) * 60 + 0.5))));
  cierto("retrógrado = velocidad negativa", n1.bodies.every((b) => b.retrograde === b.speed < 0));

  console.log("— Aspectos con los orbes de Fernando (8/8/6/6/4, iguales para todos, solo los diez planetas)");
  const esperar = (c, etiqueta) => {
    const esp = aspectosEsperados(c.bodies);
    igual(`${etiqueta}: los mismos pares, tipos y orden`, c.aspects.map((a) => `${a.a}-${a.b}-${a.type}`), esp.map((a) => `${a.a}-${a.b}-${a.type}`));
    cierto(`${etiqueta}: orbe exacto con 4 decimales`, c.aspects.every((a, i) => esp[i] && Math.abs(a.orb - esp[i].orb) < 6e-5), JSON.stringify(c.aspects.map((a) => a.orb)));
    cierto(`${etiqueta}: max_orb es el orbe del tipo`, c.aspects.every((a, i) => esp[i] && a.max_orb === esp[i].max_orb));
    cierto(`${etiqueta}: aplicativo / separativo / exacto según las velocidades`, c.aspects.every((a, i) => esp[i] && a.phase === esp[i].phase && a.applying === (a.phase === "aplicativo")));
    cierto(`${etiqueta}: ni Ascendente, ni Medio Cielo, ni nodo, ni Quirón forman aspectos`, c.aspects.every((a) => PLANETAS.includes(a.a) && PLANETAS.includes(a.b)));
    cierto(`${etiqueta}: orb_dm al minuto`, c.aspects.every((a) => a.orb_dm === `${Math.floor(Math.round(a.orb * 60) / 60)}°${String(Math.round(a.orb * 60) % 60).padStart(2, "0")}′`));
    igual(`${etiqueta}: aspect_rules`, [c.aspect_rules.orbs, c.aspect_rules.luminary_bonus, c.aspect_rules.points],
      [{ conjunction: 8, sextile: 4, square: 6, trine: 6, opposition: 8 }, 0, PLANETAS]);
  };
  esperar(n1, "natal");
  cierto("natal: el par más exacto es Neptuno–Plutón sextil (0°51′, aplicativo)", n1.aspects[0].a === "neptune" && n1.aspects[0].b === "pluto" && n1.aspects[0].orb_dm === "0°51′");

  console.log("— Balance de 50 puntos, contado acá desde las longitudes");
  const balEsp = (c, etiqueta) => {
    const e = balanceEsperado(c);
    igual(`${etiqueta}: total 50`, c.balance.total, 50);
    igual(`${etiqueta}: elementos (puntos y Math.round)`, c.balance.elements.map((x) => ({ id: x.id, count: x.count, percent: x.percent })), e.elements);
    igual(`${etiqueta}: modalidades (puntos y Math.round)`, c.balance.modalities.map((x) => ({ id: x.id, count: x.count, percent: x.percent })), e.modalities);
    igual(`${etiqueta}: dominantes (antes de redondear, empates todos)`, [c.balance.dominant_elements, c.balance.dominant_modalities], [e.dominant_elements, e.dominant_modalities]);
    igual(`${etiqueta}: sin «Equilibrio»`, [c.balance.balanced_elements, c.balance.balanced_modalities], [false, false]);
    igual(`${etiqueta}: puntos que entran (sin nodo, Quirón, DSC ni IC)`, c.balance.points, [...PLANETAS, "asc", "mc"]);
    cierto(`${etiqueta}: cada factor está en la fila de su elemento`, c.balance.elements.every((x) => x.points.every((id) => ELEM[signo(punto(c, id).longitude) % 4] === x.id))
      && c.balance.elements.reduce((s, x) => s + x.points.length, 0) === 12);
  };
  balEsp(n1, "natal");
  cierto("la regla del balance dice 50 puntos y los pesos", /50 puntos/.test(n1.balance.rule) && n1.balance.rule.includes("Ascendente 10") && n1.balance.rule.includes("Medio Cielo 4"));

  // ===========================================================================
  console.log("— 2. La misma fecha a las 12:00 (doc 02 §8.2, ahora con hora)");
  const n2 = await carta.calcularNatal({ fecha: "1985-03-15", hora: "12:00", lugar: "Buenos Aires" });
  igual("UTC", n2.meta.utc_instant, "1985-03-15T15:00:00Z");
  cierto("día juliano UT", Math.abs(n2.meta.jd_ut - 2446140.124997) < 2e-5, `${n2.meta.jd_ut}`);
  conRef(n2, [["sun", 354.974286, "pisces", "24°58′"], ["moon", 288.132381, "capricorn", "18°08′"], ["chiron", 63.921318, "gemini", "3°55′"]], "12:00");
  esperar(n2, "12:00");
  balEsp(n2, "12:00");

  // ===========================================================================
  console.log("— 3. Carta del momento (doc 02 §8.3): el corte del 20/10/2026 12:00 de Buenos Aires");
  fijarReloj(() => new Date("2026-10-20T15:00:41Z"));
  const m = await carta.calcularMomento();
  igual("kind momento, Buenos Aires", [m.meta.kind, m.meta.input.place, m.meta.input.timezone, m.meta.input.latitude, m.meta.input.longitude],
    ["momento", "Buenos Aires, Argentina", "America/Argentina/Buenos_Aires", -34.6037, -58.3816]);
  igual("el instante es el minuto en curso (caché de un minuto)", [m.meta.utc_instant, m.meta.input.date, m.meta.input.time, m.meta.utc_offset],
    ["2026-10-20T15:00:00Z", "2026-10-20", "12:00", "-03:00"]);
  cierto("día juliano UT", Math.abs(m.meta.jd_ut - 2461334.125004) < 2e-5, `${m.meta.jd_ut}`);
  conRef(m, [["sun", 207.239169, "libra", "27°14′", 10, false], ["moon", 318.8256, "aquarius", "18°50′", 1, false],
    ["venus", 212.877532, "scorpio", "2°53′", 10, true], ["chiron", 28.602781, "aries", "28°36′", 4, true],
    ["asc", 298.506861, "capricorn", "28°30′", 1], ["mc", 197.041785, "libra", "17°03′", 10]], "momento");
  for (const [casa, cusp, sg, g] of [[2, 320.270672, "aquarius", "20°16′"], [3, 345.869964, "pisces", "15°52′"], [5, 52.538052, "taurus", "22°32′"], [6, 87.520146, "gemini", "27°31′"]]) {
    const h = m.houses[casa - 1];
    cierto(`momento: cúspide ${casa}`, Math.abs(sep(h.cusp, cusp)) < UN_MINUTO && h.sign === sg && gm(h) === g, `${h.cusp} ${gm(h)}`);
  }
  esperar(m, "momento");
  balEsp(m, "momento");
  cierto("momento: el par más exacto es Venus–Plutón cuadratura (0°12′, separativo)", m.aspects[0].a === "venus" && m.aspects[0].b === "pluto" && m.aspects[0].type === "square" && m.aspects[0].orb_dm === "0°12′" && m.aspects[0].phase === "separativo");
  fijarReloj(() => new Date("2026-10-20T15:00:59Z"));
  cierto("dentro del mismo minuto se devuelve la misma carta (caché ≤ 1 minuto)", (await carta.calcularMomento()) === m);
  fijarReloj(() => new Date("2026-10-20T15:01:00Z"));
  igual("al minuto siguiente se recalcula", (await carta.calcularMomento()).meta.utc_instant, "2026-10-20T15:01:00Z");
  fijarReloj(null);

  // ===========================================================================
  console.log("— 4. Huso histórico (doc 02 §8.4, base IANA de Node)");
  // Doc 02 §8.4 pide comparar contra la base IANA de la máquina. Con la 2026a (Node y Python de acá) el 15/01/2000
  // da −03:00 y no el −02:00 de la tabla del doc: en octubre de 1999 la Argentina pasó a −04:00 con horario de
  // verano −03:00, así que los relojes no cambiaron. Se prueba lo que dice la base.
  for (const [fecha, off, utc] of [["1920-06-01", "-04:00", "1920-06-01T16:00:00Z"], ["1990-01-15", "-02:00", "1990-01-15T14:00:00Z"],
    ["1990-07-15", "-03:00", "1990-07-15T15:00:00Z"], ["2000-01-15", "-03:00", "2000-01-15T15:00:00Z"],
    ["2008-12-15", "-02:00", "2008-12-15T14:00:00Z"], ["2010-01-15", "-03:00", "2010-01-15T15:00:00Z"]]) {
    const c = await carta.calcularNatal({ fecha, hora: "12:00", lugar: "Buenos Aires" });
    igual(`${fecha} 12:00 en Buenos Aires → ${off}`, [c.meta.utc_offset, c.meta.utc_instant], [off, utc]);
  }
  const ny = await carta.calcularNatal({ fecha: "2020-07-15", hora: "09:00", lugar: "New York City" });
  igual("otra zona: Nueva York en verano", [ny.meta.input.timezone, ny.meta.utc_offset, ny.meta.utc_instant], ["America/New_York", "-04:00", "2020-07-15T13:00:00Z"]);
  const es = await carta.calcularNatal({ fecha: "1990-05-12", hora: "08:30", lugar: "Córdoba, España" });
  igual("«Córdoba, España» elige la de España", [es.meta.input.place, es.meta.input.timezone, es.meta.utc_offset], ["Córdoba, Andalucía, España", "Europe/Madrid", "+02:00"]);
  const ar = await carta.calcularNatal({ fecha: "1990-05-12", hora: "08:30", lugar: "Córdoba" });
  igual("«Córdoba» sola elige la de la Argentina", [ar.meta.input.place, ar.meta.input.timezone], ["Córdoba, Argentina", "America/Argentina/Cordoba"]);

  // ===========================================================================
  console.log("— 5. Bordes: orbes inclusivos, cúspide exacta, «Equilibrio»");
  const cuerpo = (id, longitude, speed = 1) => ({ id, longitude, speed });
  const relleno = (lon) => PLANETAS.slice(2).map((id, k) => cuerpo(id, lon + 0.37 * k, 0.01)); // apiñados lejos: no aspectan con el par
  for (const [tipo, b, orbe] of [["conjunction", 8, 8], ["sextile", 64, 4], ["square", 96, 6], ["trine", 126, 6], ["opposition", 172, 8]]) {
    const dentro = carta.aspectosCarta([cuerpo("sun", 0, 1), cuerpo("moon", b, 13), ...relleno(240)]).find((a) => a.a === "sun" && a.b === "moon");
    cierto(`${tipo}: orbe justo de ${orbe}° entra (límite inclusivo, también con la Luna)`, dentro && dentro.type === tipo && dentro.orb === orbe && dentro.max_orb === orbe, JSON.stringify(dentro));
    const fuera = carta.aspectosCarta([cuerpo("sun", 0, 1), cuerpo("moon", tipo === "opposition" ? b - 0.0001 : b + 0.0001, 13), ...relleno(240)]).find((a) => a.a === "sun" && a.b === "moon");
    cierto(`${tipo}: un pelo más de ${orbe}° no entra`, !fuera, JSON.stringify(fuera));
  }
  cierto("sin orbe extra para las luminarias: Sol–Luna a 9° no es conjunción", !carta.aspectosCarta([cuerpo("sun", 0), cuerpo("moon", 9), ...relleno(240)]).some((a) => a.a === "sun" && a.b === "moon"));
  const exacto = carta.aspectosCarta([cuerpo("sun", 10, 1), cuerpo("mars", 100 + 0.5 / 3600, 0.5), ...relleno(240).filter((x) => x.id !== "mars")]).find((a) => a.a === "sun" && a.b === "mars");
  cierto("orbe menor a 1″: «exacto»", exacto && exacto.phase === "exacto" && exacto.applying === false, JSON.stringify(exacto));
  const CUSPS = [10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340];
  for (const k of [0, 4, 11]) {
    igual(`un planeta justo en la cúspide ${k + 1} va a la casa ${k + 1}`, carta.casaCarta(CUSPS[k], CUSPS), k + 1);
    igual(`un pelo antes de la cúspide ${k + 1} sigue en la casa anterior`, carta.casaCarta(CUSPS[k] - 1e-9, CUSPS), k === 0 ? 12 : k);
  }
  {
    // Con los pesos de Fernando no puede haber empate total (50 no se divide en 4 ni en 3): se prueba la regla con pesos de a 1
    const iguales = carta.balanceCarta([{ id: "sun", longitude: 5 }, { id: "moon", longitude: 35 }, { id: "mercury", longitude: 65 }, { id: "venus", longitude: 95 }],
      { sun: 1, moon: 1, mercury: 1, venus: 1 });
    igual("los cuatro elementos empatados: «Equilibrio»", [iguales.balanced_elements, iguales.dominant_elements], [true, ["fire", "earth", "air", "water"]]);
    igual("y los porcentajes, Math.round de 25", iguales.elements.map((x) => x.percent), [25, 25, 25, 25]);
    const tres = carta.balanceCarta([{ id: "sun", longitude: 5 }, { id: "moon", longitude: 35 }, { id: "mercury", longitude: 65 }], { sun: 1, moon: 1, mercury: 1 });
    igual("las tres modalidades empatadas: «Equilibrio»", [tres.balanced_modalities, tres.dominant_modalities, tres.modalities.map((x) => x.percent)], [true, ["cardinal", "fixed", "mutable"], [33, 33, 33]]);
    const dos = carta.balanceCarta([{ id: "sun", longitude: 5 }, { id: "moon", longitude: 35 }], { sun: 1, moon: 1 });
    igual("empate de dos: se muestran los dos, sin «Equilibrio»", [dos.dominant_elements, dos.balanced_elements], [["fire", "earth"], false]);
    const porRedondeo = carta.balanceCarta([{ id: "sun", longitude: 5 }, { id: "moon", longitude: 35 }, { id: "mars", longitude: 65 }],
      { sun: 333, moon: 334, mars: 333 });
    igual("el dominante se compara antes de redondear (33,4 % le gana a 33,3 %, los dos se ven 33)", [porRedondeo.dominant_elements, porRedondeo.elements.map((x) => x.percent)], [["earth"], [33, 33, 33, 0]]);
  }

  // ===========================================================================
  console.log("— 6. Validación (S10: sin hora no hay carta)");
  const rechazo = async (entrada) => { try { await carta.calcularNatal(entrada); return null; } catch (e) { return e instanceof carta.ErrorCarta ? { campo: e.campo, mensaje: e.message } : { otro: String(e) }; } };
  igual("sin hora", await rechazo({ fecha: "1985-03-15", hora: "", lugar: "Buenos Aires" }), { campo: "hora", mensaje: "Ingresá tu hora de nacimiento." });
  igual("hora ausente", await rechazo({ fecha: "1985-03-15", lugar: "Buenos Aires" }), { campo: "hora", mensaje: "Ingresá tu hora de nacimiento." });
  igual("hora mal escrita", await rechazo({ fecha: "1985-03-15", hora: "2:3", lugar: "Buenos Aires" }), { campo: "hora", mensaje: "La hora va como 07:42." });
  igual("hora imposible", await rechazo({ fecha: "1985-03-15", hora: "25:00", lugar: "Buenos Aires" }), { campo: "hora", mensaje: "Esa hora no existe." });
  igual("sin fecha", await rechazo({ fecha: "", hora: "10:00", lugar: "Buenos Aires" }), { campo: "fecha", mensaje: "Ingresá tu fecha de nacimiento." });
  igual("fecha que no existe", await rechazo({ fecha: "1985-02-30", hora: "10:00", lugar: "Buenos Aires" }), { campo: "fecha", mensaje: "Esa fecha no existe. Revisá el día y el mes." });
  igual("fecha futura", await rechazo({ fecha: "2999-01-01", hora: "10:00", lugar: "Buenos Aires" }), { campo: "fecha", mensaje: "La fecha de nacimiento no puede ser futura." });
  igual("sin lugar", await rechazo({ fecha: "1985-03-15", hora: "10:00", lugar: "  " }), { campo: "lugar", mensaje: "Ingresá el lugar de nacimiento." });
  igual("lugar desconocido: error claro", await rechazo({ fecha: "1985-03-15", hora: "10:00", lugar: "Ciudad Inventada, Narnia" }),
    { campo: "lugar", mensaje: "No encontré «Ciudad Inventada». Probá con la ciudad grande más cercana." });
  igual("una hora que el reloj se salteó (horario de verano)", await rechazo({ fecha: "2020-03-08", hora: "02:30", lugar: "New York City" }),
    { campo: "hora", mensaje: "Esa hora no existió en ese lugar: ese día se adelantaron los relojes. Revisá la hora de nacimiento." });
  igual("campos que no son texto cuentan como vacíos", await rechazo({ fecha: ["1985-03-15"], hora: 1430, lugar: "Buenos Aires" }), { campo: "fecha", mensaje: "Ingresá tu fecha de nacimiento." });

  console.log("— S17: nacimientos desde 1900");
  igual("1899-12-31: rechazado con un mensaje claro", await rechazo({ fecha: "1899-12-31", hora: "23:59", lugar: "Buenos Aires" }),
    { campo: "fecha", mensaje: "Por ahora calculo desde 1900 en adelante." });
  const n1900 = await carta.calcularNatal({ fecha: "1900-01-01", hora: "00:00", lugar: "Buenos Aires" });
  igual("1900-01-01 00:00: se calcula completa", [n1900.meta.input.date, n1900.meta.input.time, n1900.bodies.length, n1900.houses.length, n1900.angles.length],
    ["1900-01-01", "00:00", 12, 12, 4]);

  console.log("— S18: latitud polar, sin casas Placidus → mensaje claro y ninguna carta");
  const POLAR = "Para este lugar de nacimiento no es posible calcular las casas de la carta.";
  igual("Longyearbyen (78° N)", await rechazo({ fecha: "1990-05-12", hora: "08:30", lugar: "Longyearbyen" }), { campo: "lugar", mensaje: POLAR });
  igual("McMurdo (78° S)", await rechazo({ fecha: "1990-05-12", hora: "20:00", lugar: "McMurdo Station" }), { campo: "lugar", mensaje: POLAR });
  cierto("la regla de completitud se exporta", typeof carta.verificarCompleta === "function");
  if (typeof carta.verificarCompleta === "function") {
    const tira = (c) => { try { carta.verificarCompleta(c); return null; } catch (e) { return e instanceof carta.ErrorCarta ? { campo: e.campo, mensaje: e.message } : { otro: true }; } };
    const copia = () => JSON.parse(JSON.stringify(n1));
    igual("una carta completa pasa", tira(copia()), null);
    const sinCusp = copia(); sinCusp.houses[4].cusp = null;
    igual("una cúspide que no se calculó: el mismo mensaje de las casas", tira(sinCusp), { campo: "lugar", mensaje: POLAR });
    const sinCasas = copia(); sinCasas.houses = sinCasas.houses.slice(0, 11);
    igual("11 casas: el mismo mensaje de las casas", tira(sinCasas), { campo: "lugar", mensaje: POLAR });
    const sinAsc = copia(); sinAsc.angles[0].longitude = NaN;
    igual("un ángulo que no se calculó: el mismo mensaje de las casas", tira(sinAsc), { campo: "lugar", mensaje: POLAR });
    const sinLuna = copia(); sinLuna.bodies[1].longitude = NaN;
    igual("un planeta que no se calculó: no hay carta (error del motor, no de la persona)", tira(sinLuna), { otro: true });
    const sinQuiron = copia(); sinQuiron.bodies = sinQuiron.bodies.slice(0, 11);
    igual("un cuerpo de menos: no hay carta", tira(sinQuiron), { otro: true });
    const sinBalance = copia(); sinBalance.balance.total = NaN;
    igual("un balance que no se calculó: no hay carta", tira(sinBalance), { otro: true });
    const sinAspectos = copia(); delete sinAspectos.aspects;
    igual("sin la lista de aspectos: no hay carta", tira(sinAspectos), { otro: true });
  }

  // ===========================================================================
  console.log("— 7. La API y la pantalla, servidas");
  const express = (await import("express")).default;
  const { default: app } = await import("../src/app.js");
  const { setEnDesarrollo } = await import("../src/lib/portero.js");
  const { frenoRobots } = await import("../src/routes/carta.js");
  const server = express();
  server.set("trust proxy", true);
  server.use(app);
  http = server.listen(0, "127.0.0.1");
  await once(http, "listening");
  const BASE = `http://127.0.0.1:${http.address().port}`;
  const pedir = async (ruta, { metodo = "GET", json, ip, tipo, cabeceras } = {}) => {
    const headers = { ...(cabeceras || {}) };
    if (json !== undefined) headers["content-type"] = tipo || "application/json";
    if (ip) headers["x-forwarded-for"] = ip;
    const r = await fetch(BASE + ruta, { method: metodo, redirect: "manual", headers, body: json === undefined ? undefined : (typeof json === "string" ? json : JSON.stringify(json)) });
    const texto = await r.text();
    let cuerpo = null; try { cuerpo = JSON.parse(texto); } catch { /* no es JSON */ }
    return { codigo: r.status, donde: r.headers.get("location"), cab: r.headers, texto, cuerpo };
  };
  // Lo que el proceso escribe en la consola durante los pedidos: no puede llevar datos de nacimiento
  const registro = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const escuchar = () => { for (const k of Object.keys(original)) console[k] = (...a) => { registro.push(a.map(String).join(" ")); }; };
  const soltar = () => Object.assign(console, original);
  const filas = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => `${t.name}:${db.prepare(`SELECT COUNT(*) n FROM "${t.name}"`).get().n}`).join(",");

  cierto("con el portero cerrado, la API también da 503", (await pedir("/api/carta/momento")).codigo === 503);
  setEnDesarrollo(false);
  const antes = filas();
  escuchar();
  let r;
  try {
    r = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires, Argentina" } });
    var sinHora = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1977-08-09", hora: "", lugar: "Rosario, Santa Fe, Argentina" } });
    var lugarMal = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1977-08-09", hora: "06:41", lugar: "Pueblo Inventado" } });
    var conRosario = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1977-08-09", hora: "06:41", lugar: "Rosario, Santa Fe, Argentina" } });
    var noJson = await pedir("/api/carta", { metodo: "POST", json: "fecha=1977-08-09&hora=06:41&lugar=Rosario", tipo: "application/x-www-form-urlencoded" });
    var porGet = await pedir("/api/carta?fecha=1977-08-09&hora=06:41&lugar=Rosario");
    var roto = await pedir("/api/carta", { metodo: "POST", json: '{"fecha":"1977-08-09","hora":"06:41","lugar":"Rosario"' });
    var mom = await pedir("/api/carta/momento");
    var polar = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1990-05-12", hora: "08:30", lugar: "Longyearbyen" } });
    var antes1899 = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1899-12-31", hora: "10:00", lugar: "Buenos Aires" } });
    var en1900 = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1900-01-01", hora: "00:00", lugar: "Buenos Aires" } });
  } finally { soltar(); }
  igual("S18: latitud polar → 400 con el mensaje exacto, sin carta, no-store", [polar.codigo, polar.cuerpo, polar.cab.get("cache-control"), polar.texto.includes("bodies")],
    [400, { campo: "lugar", mensaje: "Para este lugar de nacimiento no es posible calcular las casas de la carta." }, "no-store", false]);
  igual("S17: 1899 → 400 claro; 1900-01-01 → 200", [antes1899.codigo, antes1899.cuerpo, en1900.codigo, en1900.cuerpo?.meta?.input?.date],
    [400, { campo: "fecha", mensaje: "Por ahora calculo desde 1900 en adelante." }, 200, "1900-01-01"]);
  igual("POST /api/carta: 200", r.codigo, 200);
  cierto("POST /api/carta: JSON", (r.cab.get("content-type") || "").startsWith("application/json"));
  igual("POST /api/carta: no-store y sin referer", [r.cab.get("cache-control"), r.cab.get("referrer-policy")], ["no-store", "no-referrer"]);
  igual("POST /api/carta: la misma carta que el cálculo", { ...r.cuerpo, meta: { ...r.cuerpo.meta, generated_at: 0 } }, { ...n1, meta: { ...n1.meta, generated_at: 0 } });
  igual("sin hora → 400 con el campo y el mensaje, y nada de carta", [sinHora.codigo, sinHora.cuerpo], [400, { campo: "hora", mensaje: "Ingresá tu hora de nacimiento." }]);
  igual("sin hora → también no-store", sinHora.cab.get("cache-control"), "no-store");
  igual("lugar desconocido → 400 claro", [lugarMal.codigo, lugarMal.cuerpo], [400, { campo: "lugar", mensaje: "No encontré «Pueblo Inventado». Probá con la ciudad grande más cercana." }]);
  igual("Rosario, Santa Fe: la zona IANA de Rosario y el huso de 1977", [conRosario.codigo, conRosario.cuerpo?.meta.input.place, conRosario.cuerpo?.meta.input.timezone, conRosario.cuerpo?.meta.utc_offset],
    [200, "Rosario, Santa Fe, Argentina", "America/Argentina/Cordoba", "-03:00"]);
  cierto("un formulario que no es JSON no se calcula (415)", noJson.codigo === 415 && !noJson.texto.includes("bodies"), `${noJson.codigo}`);
  cierto("los datos de nacimiento no viajan en la dirección: GET /api/carta?… no calcula", porGet.codigo === 404 && !porGet.texto.includes("bodies"), `${porGet.codigo}`);
  igual("un JSON roto: 400, sin carta y sin pasar por el registro de errores", [roto.codigo, roto.cuerpo?.campo, roto.texto.includes("bodies")], [400, "", false]);
  igual("GET /api/carta/momento: 200, momento", [mom.codigo, mom.cuerpo?.meta.kind], [200, "momento"]);
  const maxAge = Number((/max-age=(\d+)/.exec(mom.cab.get("cache-control") || "") || [])[1]);
  cierto("el momento se puede cachear hasta un minuto", maxAge > 0 && maxAge <= 60, mom.cab.get("cache-control"));
  igual("nada se escribió en la base", filas(), antes);
  cierto("nada se escribió en la consola con datos de nacimiento", !registro.some((l) => /1985|1977|Rosario|Buenos Aires|14:30|06:41|Inventado/.test(l)), registro.join(" | "));

  // A2: cualquier error del lector del cuerpo (juego de caracteres o codificación que no lee) es un 4xx corto en JSON, sin pasar por el registro de errores
  const errores = [];
  console.error = (...a) => { errores.push(a.map(String).join(" ")); };
  let latin9, rara;
  try {
    latin9 = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires" }, tipo: "application/json; charset=latin9" });
    rara = await pedir("/api/carta", { metodo: "POST", json: { fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires" }, cabeceras: { "content-encoding": "x-rara" } });
  } finally { soltar(); }
  const forma = (x) => [x.codigo, (x.cab.get("content-type") || "").split(";")[0], x.cab.get("cache-control"), x.cuerpo && Object.keys(x.cuerpo).sort(), typeof x.cuerpo?.mensaje, x.texto.includes("1985")];
  igual("charset o codificación que no se lee: 415 en JSON, no-store, y nada en el registro de errores", [forma(latin9), forma(rara), errores],
    [[415, "application/json", "no-store", ["campo", "mensaje"], "string", false], [415, "application/json", "no-store", ["campo", "mensaje"], "string", false], []]);

  console.log("— Freno de robots: en memoria, sin guardar la IP");
  frenoRobots.configurar({ max: 3, ventanaMs: 60_000 });
  const ip = "203.0.113.77";
  const tres = [];
  for (let i = 0; i < 4; i++) tres.push((await pedir("/api/carta", { metodo: "POST", ip, json: { fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires" } })).codigo);
  igual("al cuarto pedido seguido de la misma IP: 429", tres, [200, 200, 200, 429]);
  const otra = await pedir("/api/carta", { metodo: "POST", ip: "198.51.100.3", json: { fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires" } });
  igual("otra IP sigue pudiendo", otra.codigo, 200);
  cierto("el freno no guarda la IP (solo una huella con sal del proceso)", frenoRobots.claves().every((k) => !k.includes(ip) && /^[0-9a-f]{64}$/.test(k)) && frenoRobots.claves().length >= 1);
  const muchos = [];
  for (let i = 0; i < 5; i++) muchos.push((await pedir("/api/carta/momento", { ip })).codigo);
  cierto("la carta del momento no tiene límite", muchos.every((c) => c === 200), muchos.join());
  frenoRobots.configurar(null);

  console.log("— La pantalla /carta");
  const pag = await pedir("/carta");
  igual("/carta da 200", pag.codigo, 200);
  igual("/carta: no-store y sin referer", [pag.cab.get("cache-control"), pag.cab.get("referrer-policy")], ["no-store", "no-referrer"]);
  const html = pag.texto;
  cierto("/carta es carta.html publicado", html === fs.readFileSync(path.join(WEB, "variantes", "carta.html"), "utf8"));
  cierto("/carta sigue con noindex", html.includes('<meta name="robots" content="noindex,nofollow">'));
  for (const x of ["(ejemplo)", "Opción 2", "Prototipo", "Carta de ejemplo", "ob-proto", "sinhora=", "data-sinhora-link", "Ver el ejemplo", "También te la enviamos por mail", "ob-mail", "Fotografías con sus créditos"]) {
    cierto(`/carta no dice «${x}»`, !html.includes(x));
  }
  igual("título", (/<title>([^<]*)<\/title>/.exec(html) || [])[1], "Anaretico 29 · Tu carta natal");
  cierto("og:title y descripciones sin «ejemplo»", html.includes('<meta property="og:title" content="Anaretico 29 · Tu carta natal">')
    && html.includes('<meta property="og:description" content="Carta natal y carta del momento de Anaretico 29.">')
    && html.includes('<meta name="description" content="Tu carta natal y la carta del momento: rueda, posiciones, casas, balance de elementos y aspectos.">'));
  cierto("S11: /carta no le pide nada a Google", !/fonts\.(googleapis|gstatic)\.com|google/i.test(html));
  const { hojas, scripts, recursos, enlaces } = refsHtml(html);
  const V = JSON.parse(fs.readFileSync(path.join(WEB, "publicado.json"), "utf8")).version;
  igual("hojas en el orden del prototipo (los símbolos en el lugar de Google) y con ?v=", hojas, ["styles.css", "compact.css", "rich.css", "combinado.css",
    "paletas/pizarra-auto.css", "paletas/pizarra.css", "tipos/recomendado.css", "esquinas/media.css", "arreglos.css", "menu.css", "canales.css",
    "movimiento.css", "carta-op2.css", "assets/fuentes/simbolos.css", "tonos.css"].map((h) => `/${h}?v=${V}`));
  igual("scripts en el orden del prototipo y con ?v=", scripts, ["data.js", "app.js", "menu.js", "movimiento.js", "carta.js", "carta-op2.js"].map((s) => `/${s}?v=${V}`));
  const RESPALDO = /carta-opcion|carta-opciones|carta-op1|carta-op3|\/carta\.css|ejemplo\.json|generar-carta|\.py\b/;
  const publicado = new Set(JSON.parse(fs.readFileSync(path.join(WEB, "publicado.json"), "utf8")).archivos.map((a) => "/" + a.replace(/^variantes\//, "")));
  const locales = recursos.filter((u) => !esExterna(u) && !u.startsWith("https://www.anaretico29.com/"));
  cierto("/carta no carga ningún respaldo ni variante", ![...locales, ...enlaces].some((u) => RESPALDO.test(u)), [...locales, ...enlaces].filter((u) => RESPALDO.test(u)).join(", "));
  const rotos = [];
  for (const u of locales) { const x = await pedir(u); if (x.codigo !== 200 || !publicado.has(u.split("?")[0])) rotos.push(`${u} ${x.codigo}`); }
  cierto(`los ${locales.length} archivos que carga /carta están publicados y responden 200`, rotos.length === 0, rotos.join(", "));
  const hojasTexto = await Promise.all(hojas.map(async (h) => (await pedir(h)).texto));
  cierto("ninguna hoja de /carta le pide nada a Google", !hojasTexto.some((t) => /fonts\.(googleapis|gstatic)\.com/.test(t)));
  for (const u of ["/datos/carta-ejemplo.json", "/datos/carta-momento-ejemplo.json", "/datos/carta-sinhora-ejemplo.json", "/datos/generar-carta-ejemplo.py",
    "/carta-opcion-1.html", "/carta-opcion-2.html", "/carta-opcion-3.html", "/carta-opciones.html", "/carta.css", "/carta-op3.css", "/carta-op3.js"]) {
    igual(`${u} da 404`, (await pedir(u)).codigo, 404);
  }
  igual("S15: los textos de significados ya no se publican (404)", (await pedir("/datos/significados.json")).codigo, 404);
  cierto("S15: publicado.json no lista significados.json", ![...publicado].some((u) => u.includes("significados")));
  const enlacesLocales = enlaces.filter((e) => !esExterna(e));
  cierto("los enlaces de /carta van a páginas publicadas o a Próximamente", enlacesLocales.every((e) => /^\/(?:#[\w-]+)?$|^\/sobre-mi$|^\/carta\?modo=momento$|^\/proximamente\?p=[\w-]+$/.test(e)), enlacesLocales.join(" "));

  const cartaJs = (await pedir(`/carta.js?v=${V}`)).texto;
  const op2 = (await pedir(`/carta-op2.js?v=${V}`)).texto;
  const css = (await pedir(`/carta-op2.css?v=${V}`)).texto;
  console.log("— S4 / 03 §11: la carta del momento es en vivo, sin rótulos de prototipo");
  for (const x of ["Corte fijo", "corte fijo", "no en vivo", "En la versión final", "Nacimiento ficticio", "· ejemplo", "(ejemplo)", "de ejemplo", "Opción 2",
    "carta-ejemplo.json", "carta-momento-ejemplo.json", "carta-sinhora-ejemplo.json", "sinhora=", "data-sinhora-link", "Ver el ejemplo", "vista previa",
    "data-carta-almanaque", "puede diferir del balance ponderado"]) {
    cierto(`carta.js / carta-op2.js no dicen «${x}»`, !cartaJs.includes(x) && !op2.includes(x));
  }
  cierto("los títulos no llevan «(ejemplo)» ni «Opción 2»", op2.includes("document.title = 'Anaretico 29 · ' + (m ? 'La carta del momento' : 'Tu carta natal');"));
  cierto("«Cómo leer»: los ángulos ya no forman aspectos", !op2.includes("(y los ángulos AC y MC)"));

  console.log("— S14: «Descargar mi carta en PDF» (impresión del navegador, sin servicios de terceros)");
  igual("el botón, con el texto exacto", (html.match(/<button type="button" class="ob-btn" data-pdf-btn>Descargar mi carta en PDF<\/button>/g) || []).length, 1);
  cierto("el botón arma la impresión con window.print()", /data-pdf-btn[\s\S]*window\.print\(\)/.test(op2));
  const print = (/@media print\{([\s\S]*)\}\s*$/.exec(css) || [])[1] || "";
  cierto("carta-op2.css trae la hoja de impresión", print.length > 0);
  cierto("la impresión saca el menú, los canales y los botones", ["header nav", "#canales", ".ob-pdf", ".strap"].every((s) => print.includes(s)));

  console.log("— S15: la carta se muestra sola (sin textos de interpretación ni frases que inviten a contactar a Fernando)");
  const PROHIBIDO = [/signific/i, /borrador/i, /Lectura de lo elegido/, /Cómo leer/, /Una lectura más cercana/, /Ver servicios/, /Una consulta/, /En una consulta/,
    /Elí una fila|Elegí una fila|Tocá una fila|Elegí una celda|Elegí un cuerpo/, /data-panel|data-mx-inline|data-leer|data-cierre|ob-cierre|ob-mean|ob-lec\b|ob-lec-/,
    /cada una marca un área/, /Área</, /se expresa |se ubica en el terreno/];
  for (const [nombre, texto] of [["carta.html", html], ["carta.js", cartaJs], ["carta-op2.js", op2]]) {
    const hallados = PROHIBIDO.filter((re) => re.test(texto)).map(String);
    cierto(`${nombre}: sin textos de interpretación`, hallados.length === 0, hallados.join(" "));
  }
  // El menú del sitio («Servicios», /#agenda de la línea de tiempo), los canales y el pie quedan (L21): se mira el contenido de la carta, <main>
  const principal = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  igual("carta.html: ninguna frase de contacto (consulta, WhatsApp, agendá, servicios)", [/consulta/i.test(html), /wa\.me|whatsapp/i.test(html), /agend/i.test(principal), /servicios/i.test(principal), principal.length > 1000],
    [false, false, false, false, true]);
  igual("carta.js: ninguna frase de contacto", [/consulta|wa\.me|whatsapp|agend/i.test(cartaJs)], [false]);
  igual("carta-op2.js: lo único de contacto es el aviso del límite y su botón (S14)", [(op2.match(/consulta/gi) || []).length, (op2.match(/wa\.me/g) || []).length, (op2.match(/agend/gi) || []).length],
    [2, 1, 2]);
  cierto("carta.js ya no pide ningún archivo de textos", !/datos\/|pedir\(/.test(cartaJs));
  cierto("las casas, sin la columna «Área»", html.includes('<caption class="ob-sr">Las doce casas con su cúspide</caption><thead><tr><th scope="col" class="ob-r">Casa</th><th scope="col">Cúspide</th></tr></thead>'));
  cierto("quedan la rueda, las posiciones, los aspectos (matriz y lista), las casas, el balance y los datos",
    ["data-rueda", 'id="posiciones"', "data-matriz", "data-aspectos", 'id="casas"', 'id="balance"', "data-datos"].every((x) => html.includes(x)));
  cierto("sin el panel, la mesa queda en una columna (la regla del prototipo hasta 1099 px, en todos los anchos)",
    css.lastIndexOf(".ob-mesa{display:block}") > css.indexOf(".ob-mesa{display:grid") && !/<aside class="ob-panel"/.test(html));

  console.log("— S16: la carta del momento sin PDF; la natal con «Descargar mi carta en PDF»");
  cierto("el botón y su nota viven solo dentro de [data-pdf]", /<div class="ob-pdf" data-pdf hidden><button type="button" class="ob-btn" data-pdf-btn>Descargar mi carta en PDF<\/button><p class="ob-peq">[^<]*PDF[^<]*<\/p><\/div>/.test(html)
    && (html.match(/PDF/g) || []).length === 2);
  cierto("la impresión conserva los colores de la rueda y el pie legal", /print-color-adjust:exact/.test(print) && !/footer\{display:none/.test(print));

  console.log("— S14: el límite de 2 cartas natales cada 7 días (contado en el navegador)");
  igual("el aviso, con las palabras de Fernando", (op2.match(/Ya calculaste tus 2 cartas de esta semana\. Si querés una lectura completa, agendá una consulta/g) || []).length, 1);
  cierto("con el botón al mismo WhatsApp de la portada", /Ya calculaste[\s\S]{0,400}https:\/\/wa\.me\/5491153144378/.test(op2)
    && fs.readFileSync(path.join(WEB, "variantes", "combinado.html"), "utf8").includes('href="https://wa.me/5491153144378"'));
  // carta.js tal cual se sirve, con lo mínimo de un navegador
  const navegador = ({ hash = "", search = "", respuesta = null } = {}) => {
    const guardado = new Map(), pedidos = [];
    const s = {
      document: { currentScript: null, querySelector: () => null },
      location: { href: "https://www.anaretico29.com/carta" + search + hash, search, hash, pathname: "/carta" },
      localStorage: { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: (k) => guardado.delete(k) },
      fetch: (u, o) => { pedidos.push({ u: String(u), o }); const rr = String(u).includes("significados") ? { ok: true, status: 200, json: async () => ({}) } : respuesta(String(u), o); return Promise.resolve(rr); },
      URLSearchParams, URL, Promise, JSON, Date, Math, String, Array, Object, Error, console: { error() {}, log() {} },
    };
    s.window = s;
    vm.createContext(s);
    vm.runInContext(cartaJs, s);
    return { A: s.window.A29Carta, guardado, pedidos, s };
  };
  const { A } = navegador();
  const L = A.limite;
  cierto("A29Carta.limite existe", L && typeof L.puede === "function" && typeof L.anotar === "function" && typeof L.huella === "function");
  igual("2 cartas, 7 días", [L.max, L.ventana], [2, 7 * 864e5]);
  const T0 = Date.UTC(2026, 10, 1), DIA = 864e5;
  const ha = L.huella({ fecha: "1985-03-15", hora: "14:30", lugar: "Buenos Aires" });
  const hb = L.huella({ fecha: "1990-05-12", hora: "08:30", lugar: "Córdoba" });
  const hc = L.huella({ fecha: "2001-01-01", hora: "00:00", lugar: "Rosario" });
  igual("la misma persona escrita distinto da la misma huella", L.huella({ fecha: "1985-03-15", hora: "14:30", lugar: "  buenos   AIRES " }), ha);
  igual("y acentos aparte", L.huella({ fecha: "1990-05-12", hora: "08:30", lugar: "Cordoba" }), hb);
  cierto("otra hora es otra carta", L.huella({ fecha: "1985-03-15", hora: "14:31", lugar: "Buenos Aires" }) !== ha);
  cierto("la huella no lleva los datos (8 cifras hexadecimales)", /^[0-9a-f]{8}$/.test(ha), ha);
  let lista = [];
  cierto("sin cartas: puede", L.puede(lista, ha, T0));
  lista = L.anotar(lista, ha, T0);
  cierto("una carta: puede otra", L.puede(lista, hb, T0 + 1000));
  lista = L.anotar(lista, hb, T0 + 1000);
  igual("dos cartas anotadas", lista.length, 2);
  cierto("la tercera, distinta: NO", !L.puede(lista, hc, T0 + 2000));
  cierto("repetir una ya calculada no gasta un lugar", L.puede(lista, ha, T0 + 3000) && L.anotar(lista, ha, T0 + 3000).length === 2);
  cierto("un milisegundo antes de los 7 días de la primera, sigue el tope", !L.puede(lista, hc, T0 + 7 * DIA - 1));
  cierto("a los 7 días justos de la primera se libera un lugar (ventana corrida)", L.puede(lista, hc, T0 + 7 * DIA));
  igual("al anotar se olvidan las vencidas", L.anotar(lista, hc, T0 + 7 * DIA).map((x) => x.h), [hb, hc]);
  cierto("una lista rota no traba a nadie", L.puede("basura", ha, T0) && L.puede([{ h: 1 }, null], ha, T0));

  console.log("— El flujo en la página: la carta natal se pide por POST, con el límite");
  const datos = "#fecha=1985-03-15&hora=14%3A30&lugar=Buenos+Aires";
  const bien = (u, o) => ({ ok: true, status: 200, json: async () => ({ meta: { kind: "natal" }, bodies: [] }) });
  const n = navegador({ hash: datos, respuesta: bien });
  const r1 = await n.A.cargar("natal");
  const pc = n.pedidos.find((p) => p.u.includes("/api/carta"));
  cierto("la carta se pide a /api/carta por POST, con los datos en el cuerpo", pc && pc.u === "/api/carta" && pc.o.method === "POST" && JSON.parse(pc.o.body).hora === "14:30" && !pc.u.includes("1985"), JSON.stringify(pc));
  cierto("y se anota en el navegador", r1.modo === "natal" && JSON.parse(n.guardado.get(n.A.limite.clave)).length === 1);
  const malo = navegador({ hash: "#fecha=1985-03-15&hora=&lugar=Buenos+Aires", respuesta: () => ({ ok: false, status: 400, json: async () => ({ campo: "hora", mensaje: "Ingresá tu hora de nacimiento." }) }) });
  let err = null;
  try { await malo.A.cargar("natal"); } catch (e) { err = e; }
  cierto("un 400 no dibuja nada: cargar() falla con el mensaje del servidor", err && err.mensaje === "Ingresá tu hora de nacimiento." && err.campo === "hora");
  cierto("y no gasta un lugar del límite", !malo.guardado.has(malo.A.limite.clave));
  const lleno = navegador({ hash: datos, respuesta: bien });
  lleno.guardado.set(lleno.A.limite.clave, JSON.stringify([{ h: "aaaaaaaa", t: Date.now() - 1000 }, { h: "bbbbbbbb", t: Date.now() - 500 }]));
  err = null;
  try { await lleno.A.cargar("natal"); } catch (e) { err = e; }
  cierto("con 2 cartas esta semana, la tercera no se pide al servidor", err && err.limite === true && !lleno.pedidos.some((p) => p.u.includes("/api/carta")));
  const mo = navegador({ search: "?modo=momento", respuesta: (u) => ({ ok: true, status: 200, json: async () => ({ meta: { kind: "momento" } }) }) });
  mo.guardado.set(mo.A.limite.clave, JSON.stringify([{ h: "aaaaaaaa", t: Date.now() }, { h: "bbbbbbbb", t: Date.now() }]));
  const rm = await mo.A.cargar();
  cierto("la carta del momento no tiene límite ni se anota", rm.modo === "momento" && mo.pedidos.some((p) => p.u === "/api/carta/momento") && JSON.parse(mo.guardado.get(mo.A.limite.clave)).length === 2);
  const vacio = navegador({ respuesta: bien });
  err = null;
  try { await vacio.A.cargar("natal"); } catch (e) { err = e; }
  cierto("/carta sin datos no calcula nada (la página vuelve al formulario)", err && err.sinDatos === true && !vacio.pedidos.some((p) => p.u.includes("/api/carta")));
  cierto("la página, sin datos, vuelve al formulario", op2.includes("location.replace('/#herramientas')"));
  cierto("ante un error o el límite, la página no deja la carta a medias", /\.ob-lado, \.ob-ficha, \.ob-cinta, \.ob-mesa-w, #balance'/.test(op2));
  // A3: si cambian los datos después del #, la página se calcula de nuevo como al abrirla (los mismos datos no gastan otro lugar: misma huella)
  const hc0 = navegador({ hash: datos, respuesta: bien });
  const k0 = typeof hc0.A.claveNatal === "function" ? hc0.A.claveNatal() : null;
  hc0.s.location.hash = "#fecha=1985-03-15&hora=14%3A30&lugar=++buenos+AIRES"; const kMismo = k0 && hc0.A.claveNatal();
  hc0.s.location.hash = "#fecha=1990-05-12&hora=08%3A30&lugar=C%C3%B3rdoba"; const kOtro = k0 && hc0.A.claveNatal();
  hc0.s.location.hash = "#inicio"; const kAncla = k0 && hc0.A.claveNatal();
  igual("hashchange: otros datos recalculan como al abrir; los mismos o un ancla (#inicio) no",
    [k0 === ha, kMismo === ha, kOtro === hb, kAncla, /addEventListener\('hashchange', function \(\) \{ var k = A\.claveNatal\(\); if \(MODO === 'natal' && k && k !== CLAVE\) location\.reload\(\); \}\)/.test(op2)],
    [true, true, true, "", true]);
  // A4: en el aviso sin carta (el límite) la cabecera pasa a una columna: sin la rueda no queda la mitad izquierda vacía
  cierto("sin carta, la cabecera en una sola columna (la clase en la grilla y su regla en carta-op2.css)",
    /function sinCarta\(err\) \{\n  raiz\.querySelector\('\.ob-top'\)\.classList\.add\('ob-top-sola'\);/.test(op2)
    && /@media \(min-width:1280px\)\{\.ob-top\.ob-top-sola\{grid-template-columns:minmax\(0,1fr\);grid-template-rows:auto;row-gap:28px\}\.ob-top\.ob-top-sola \.ob-intro\{grid-column:1;grid-row:1\}\}/.test(css));

  console.log("— La pantalla corrida tal cual se sirve (DOM mínimo, API de verdad)");
  const resP = await pantallas({ cartaJs, op2, base: BASE, n1 });
  const { natal: pN, momento: pM, polar: pP, sinHora: pH, incompleta: pI } = resP;
  const LIMPIO = (t) => !/signific|borrador|consulta|agend|whatsapp|wa\.me|servicios|lectura|Cómo leer|se expresa|terreno/i.test(t);
  igual("natal: se dibuja una vez y queda lista", [pN.listo, pN.dibujos, pN.error], [true, 1, ""]);
  cierto("natal: nada de lo que se muestra interpreta ni invita a contactar", LIMPIO(pN.texto), pN.texto.slice(0, 300));
  igual("natal: 12 cuerpos, 12 casas (número y cúspide, sin área) y 4 ángulos", [pN.filas("[data-tabla] tbody"), pN.filas("[data-casas] tbody"), pN.celdas("[data-casas] tbody"), pN.filas("[data-angulos] tbody")], [12, 12, [2], 4]);
  igual("natal: el balance dice solo qué predomina", [/^Predominan? .+\(\d+ de 50\)\.$/.test(pN.textoDe("[data-dom-elementos]")), /^Predominan? .+\(\d+ de 50\)\.$/.test(pN.textoDe("[data-dom-modalidades]"))], [true, true]);
  igual("natal: el PDF está y se muestra", [pN.pdf], ["visible"]);
  igual("natal: gasta un lugar del límite", pN.limite, 1);
  igual("momento: se dibuja una vez y queda lista", [pM.listo, pM.dibujos, pM.error], [true, 1, ""]);
  cierto("momento: nada de lo que se muestra interpreta ni invita a contactar", LIMPIO(pM.texto), pM.texto.slice(0, 300));
  igual("S16: momento sin botón ni nota del PDF (salen de la página)", pM.pdf, "quitado");
  igual("S18: latitud polar: el mensaje exacto, sin rueda ni carta", [pP.listo, pP.dibujos, pP.error, pP.esError],
    [false, 0, "Para este lugar de nacimiento no es posible calcular las casas de la carta.", true]);
  igual("S18: latitud polar: todas las partes de la carta ocultas", pP.ocultas, [".ob-lado", ".ob-ficha", ".ob-cinta", ".ob-mesa-w", "#balance"]);
  igual("S18: latitud polar: no gasta un lugar del límite (tenía 1, sigue 1)", pP.limite, 1);
  igual("S18: la misma presentación que cuando falta la hora", [pP.ocultas, pP.esError, pP.enlace, pP.listo, pP.dibujos], [pH.ocultas, pH.esError, pH.enlace, pH.listo, pH.dibujos]);
  igual("sin hora: su mensaje y «Volver al formulario»", [pH.error, pH.enlace], ["Ingresá tu hora de nacimiento.", "Volver al formulario → /#herramientas"]);
  igual("S18 en general: una carta a la que le faltan las casas no se dibuja (nada a medias)", [pI.listo, pI.dibujos, pI.ocultas.length, pI.filas("[data-tabla] tbody")], [false, 0, 5, 0]);

  console.log("— El formulario de la portada lleva a /carta con los datos después del #");
  const herr = (await pedir(`/herramientas.js?v=${V}`)).texto;
  cierto("herramientas.js: /carta#…", herr.includes("location.assign('/carta#'+q.toString())") && !herr.includes("/proximamente?p=carta"));
  cierto("«Ver la carta de ahora» va a /carta?modo=momento", herr.includes("location.assign('/carta?modo=momento')")
    && fs.readFileSync(path.join(WEB, "variantes", "combinado.html"), "utf8").includes('href="/carta?modo=momento" data-tool="momento"'));

  console.log("— Redirecciones");
  igual("/proximamente?p=carta → /carta (302)", await pedir("/proximamente?p=carta").then((x) => [x.codigo, x.donde]), [302, "/carta"]);
  igual("/carta.html?modo=momento → /carta?modo=momento (301)", await pedir("/carta.html?modo=momento").then((x) => [x.codigo, x.donde]), [301, "/carta?modo=momento"]);
  igual("/carta-natal → el formulario (302)", await pedir("/carta-natal?fecha=2000-01-01&ciudad=Rosario").then((x) => [x.codigo, x.donde]), [302, "/#herramientas"]);
  const vis = JSON.parse((await pedir("/datos/visibilidad.json")).texto);
  const pc2 = vis.paginas.find((p) => p.id === "carta");
  igual("visibilidad.json: la carta, visible en /carta", [pc2.visible, pc2.ruta], [true, "/carta"]);
  igual("la parte del mail sigue apagada", pc2.partes.find((x) => x.id === "mail-carta").visible, false);

  console.log("— S11: los glifos de la carta, con las Noto propias (incluidos ☊ y ⚷)");
  const sim = (await pedir(`/assets/fuentes/simbolos.css`)).texto;
  const cubiertos = new Set();
  for (const mm of sim.matchAll(/src: url\(([^)]+)\)/g)) for (const c of caracteres(fs.readFileSync(path.join(WEB, "assets", "fuentes", mm[1])))) cubiertos.add(c);
  const faltan = [..."☉☽☿♀♂♃♄♅♆♇☊⚷♈♉♊♋♌♍♎♏♐♑♒♓☌⚹□△☍℞"].filter((g) => !cubiertos.has(g.codePointAt(0)));
  cierto("todos los glifos de la carta están en simbolos.css", faltan.length === 0, `faltan ${faltan.join(" ")}`);
  setEnDesarrollo(true);
} catch (e) {
  fallo++;
  console.log("  ✗ el test se cortó:", e.stack || e);
} finally {
  if (http) http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

// Motor de efemérides. Es la ÚNICA fuente de posiciones planetarias del sitio:
// de acá salen la cinta, la rueda, los elementos, las modalidades, la tensión,
// la fase lunar y la línea de treinta días (regla 09 del brief). Ningún módulo
// calcula posiciones por su cuenta.
//
// Swiss Ephemeris 2.10.03 compilado a WebAssembly, con los archivos DE441
// (1800-2399). Verificado contra astronomy-engine —una implementación
// independiente— en scripts/test-efemerides.mjs: coinciden por debajo de
// 0,25 minutos de arco, contra el minuto que exige el brief.
//
// LICENCIA: Swiss Ephemeris es AGPL-3.0-or-later. Servirlo por red obliga a
// publicar el código de este sitio bajo una licencia compatible. Está asumido.
import { createSwissEph, Body, HouseSystem, RiseTransit } from "@kuntay/swisseph";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CUERPOS, SIGNOS } from "./astro-config.js";

const BODY_DE = {
  sol: Body.Sun, luna: Body.Moon, mercurio: Body.Mercury, venus: Body.Venus,
  marte: Body.Mars, jupiter: Body.Jupiter, saturno: Body.Saturn,
  urano: Body.Uranus, neptuno: Body.Neptune, pluton: Body.Pluto,
};

export const norm360 = (d) => ((d % 360) + 360) % 360;

// Diferencia angular con signo, en (-180, 180]. Es continua alrededor del cero,
// que es lo que permite buscar un cruce por bisección sin que el salto de
// 359° a 0° invente una raíz que no existe.
export function difAngular(a, b) {
  return norm360(a - b + 180) - 180;
}

let swePromise = null;

async function motor() {
  if (!swePromise) {
    swePromise = (async () => {
      const swe = await createSwissEph();
      // Sin los .se1 Swiss Ephemeris NO falla: cae en silencio a su teoría
      // interna (Moshier), que es peor. Por eso se verifica que hayan montado.
      const dir = path.join(
        path.dirname(fileURLToPath(import.meta.resolve("@kuntay/swisseph-data/manifest.json"))),
        "ephe",
      );
      swe.mountEphemerisDirectory(dir);
      const prueba = swe.calc(swe.julianDay(2026, 1, 1, 0), Body.Sun);
      if (prueba.ephemeris !== "swiss") {
        console.warn(`[efemerides] OJO: los archivos DE441 no cargaron (${dir}). ` +
          `Swiss Ephemeris cayó a "${prueba.ephemeris}", que es menos preciso.`);
      }
      return swe;
    })();
  }
  return swePromise;
}

/** Precalienta el WASM al arrancar, para que el primer visitante no lo espere. */
export async function iniciarMotor() {
  const swe = await motor();
  return swe;
}

/** Día juliano (UT) de un instante. La entrada es siempre un Date en UTC. */
export async function jdDe(fecha) {
  const swe = await motor();
  const f = fecha instanceof Date ? fecha : new Date(fecha);
  return swe.julianDay(
    f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate(),
    f.getUTCHours() + f.getUTCMinutes() / 60 + f.getUTCSeconds() / 3600,
  );
}

/** El instante (Date UTC) de un día juliano. Inversa de jdDe(). */
export async function fechaDe(jd) {
  const swe = await motor();
  const c = swe.calendarDate(jd);
  const h = Math.trunc(c.hour), m = Math.trunc((c.hour - h) * 60);
  const s = Math.round((((c.hour - h) * 60) - m) * 60);
  return new Date(Date.UTC(c.year, c.month - 1, c.day, h, m, Math.min(s, 59)));
}

function conSigno(pos, def) {
  const lon = norm360(pos.longitude);
  const idx = Math.floor(lon / 30) % 12;
  return {
    clave: def.clave, nombre: def.nombre, glifo: def.glifo, peso: def.peso,
    longitud: lon,
    latitud: pos.latitude,
    // El retrógrado sale de la VELOCIDAD, nunca de una lista escrita a mano
    // (regla 09 del brief). Una lista fija se desactualiza y nadie se entera.
    velocidad: pos.longitudeSpeed,
    retro: pos.longitudeSpeed < 0,
    signoIdx: idx,
    signo: SIGNOS[idx].nombre,
    signoGlifo: SIGNOS[idx].glifo,
    elemento: SIGNOS[idx].elemento,
    modalidad: SIGNOS[idx].modalidad,
    grado: lon - idx * 30,
  };
}

/** Los diez cuerpos en un instante dado. */
export async function posiciones(fecha) {
  const swe = await motor();
  const jd = await jdDe(fecha);
  return CUERPOS.map((def) => conSigno(swe.calc(jd, BODY_DE[def.clave]), def));
}

/** Longitud de un solo cuerpo, por día juliano. Para las búsquedas de cruces. */
async function lonEn(clave, jd) {
  const swe = await motor();
  return norm360(swe.calc(jd, BODY_DE[clave]).longitude);
}

async function velEn(clave, jd) {
  const swe = await motor();
  return swe.calc(jd, BODY_DE[clave]).longitudeSpeed;
}

/**
 * Casas y ángulos. Requiere hora y lugar: sin eso no hay Ascendente ni casas,
 * y el brief pide decirlo en pantalla en vez de inventarlos.
 */
export async function casas(fecha, lat, lon, sistema = HouseSystem.Placidus) {
  const swe = await motor();
  const jd = await jdDe(fecha);
  const h = swe.houses(jd, lat, lon, sistema);
  return {
    ascendente: norm360(h.ascendant),
    medioCielo: norm360(h.midheaven),
    // Placidus no existe pasando el círculo polar: Swiss Ephemeris sustituye
    // por Porphyry y devuelve cúspides válidas igual. Hay que decirlo, no
    // tragárselo: si no, la carta usa un sistema que nadie eligió.
    sustituido: !!h.substituted,
    aviso: h.warning || null,
    cuspides: h.cusps.map(norm360),
  };
}

/** En qué casa cae una longitud, con las cúspides ya calculadas. */
export function casaDe(longitud, cuspides) {
  const l = norm360(longitud);
  for (let i = 0; i < 12; i++) {
    const desde = cuspides[i], hasta = cuspides[(i + 1) % 12];
    const ancho = norm360(hasta - desde);
    if (norm360(l - desde) < ancho) return i + 1;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Búsqueda de momentos: un solo camino para lunaciones, ingresos y estaciones.
// Se muestrea día a día y se afina por bisección. Es más lento que pedirle el
// cruce a Swiss Ephemeris, pero maneja solo los retrógrados (un planeta puede
// cruzar el mismo grado tres veces) y es un único código para los tres casos.
// ---------------------------------------------------------------------------

async function bisectar(f, a, b, pasos = 40) {
  let fa = await f(a);
  for (let i = 0; i < pasos; i++) {
    const m = (a + b) / 2;
    const fm = await f(m);
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
  }
  return (a + b) / 2;
}

async function cruces(f, jdIni, jdFin, paso = 1) {
  const out = [];
  let x0 = jdIni, y0 = await f(x0);
  for (let x1 = jdIni + paso; x1 <= jdFin + 1e-9; x1 += paso) {
    const y1 = await f(x1);
    // El cambio de signo tiene que venir con un salto CHICO. Las funciones de
    // acá son diferencias angulares, que saltan de +180 a -180 al dar la vuelta:
    // ese salto también cambia de signo y no es una raíz. Sin esta guarda, la
    // luna nueva y la llena salían en el mismo instante — la vuelta de una era
    // leída como el cruce de la otra.
    if (y0 !== 0 && (y0 < 0) !== (y1 < 0) && Math.abs(y1 - y0) < 180) {
      out.push(await bisectar(f, x0, x1));
    }
    x0 = x1; y0 = y1;
  }
  return out;
}

/** Elongación Luna-Sol en grados [0,360). 0 = luna nueva, 180 = llena. */
async function elongacion(jd) {
  return norm360((await lonEn("luna", jd)) - (await lonEn("sol", jd)));
}

const FASES = [
  { hasta: 0.5,   nombre: "Luna nueva" },
  { hasta: 89.5,  nombre: "Creciente cóncava" },
  { hasta: 90.5,  nombre: "Cuarto creciente" },
  { hasta: 179.5, nombre: "Creciente gibosa" },
  { hasta: 180.5, nombre: "Luna llena" },
  { hasta: 269.5, nombre: "Menguante gibosa" },
  { hasta: 270.5, nombre: "Cuarto menguante" },
  { hasta: 360,   nombre: "Menguante cóncava" },
];

/** Fase lunar: porcentaje iluminado, nombre y la próxima nueva y llena. */
export async function faseLunar(fecha) {
  const jd = await jdDe(fecha);
  const e = await elongacion(jd);
  const iluminacion = (1 - Math.cos((e * Math.PI) / 180)) / 2;
  const nombre = FASES.find((f) => e < f.hasta).nombre;

  const proximas = [];
  for (const [objetivo, tipo] of [[0, "nueva"], [180, "llena"]]) {
    const f = async (x) => difAngular(await elongacion(x), objetivo);
    const [primer] = await cruces(f, jd, jd + 31, 1);
    if (primer !== undefined) {
      const fechaCruce = await fechaDe(primer);
      const lonLuna = await lonEn("luna", primer);
      proximas.push({
        tipo, jd: primer, fecha: fechaCruce,
        signo: SIGNOS[Math.floor(norm360(lonLuna) / 30) % 12].nombre,
        dias: Math.round(primer - jd),
      });
    }
  }
  proximas.sort((a, b) => a.jd - b.jd);
  return {
    iluminacion,
    porcentaje: Math.round(iluminacion * 100),
    nombre,
    creciendo: e < 180,
    proxima: proximas[0] || null,
    proximas,
  };
}

// La Luna cambia de signo cada dos días y medio: en una línea de treinta días
// serían doce marcas y taparían todo lo demás. Por eso no entra.
const SIN_INGRESOS = new Set(["luna"]);

const NOMBRE_ESTACIONAL = { 0: "Equinoccio de otoño", 3: "Solsticio de invierno",
                            6: "Equinoccio de primavera", 9: "Solsticio de verano" };

/**
 * Los hitos de una ventana de tiempo: lunaciones, ingresos de signo y
 * estaciones (cambios de dirección). Es lo que alimenta la línea de 30 días.
 * Las estaciones son del hemisferio SUR, que es donde está el lector.
 */
export async function hitos(desde, dias = 30) {
  const jdIni = await jdDe(desde);
  const jdFin = jdIni + dias;
  const out = [];

  for (const [objetivo, tipo, etiqueta] of [[0, "nueva", "Luna nueva"], [180, "llena", "Luna llena"]]) {
    const f = async (x) => difAngular(await elongacion(x), objetivo);
    for (const jd of await cruces(f, jdIni, jdFin, 1)) {
      const signo = SIGNOS[Math.floor((await lonEn("luna", jd)) / 30) % 12].nombre;
      out.push({ jd, fecha: await fechaDe(jd), clase: "lunacion", tipo,
                 titulo: etiqueta, detalle: signo, principal: true });
    }
  }

  for (const def of CUERPOS) {
    if (SIN_INGRESOS.has(def.clave)) continue;
    // Un ingreso es cruzar un múltiplo de 30°. Se muestrea el signo día a día y
    // sólo se afina donde CAMBIÓ. Así un retrógrado que cruza el mismo borde
    // tres veces aparece las tres, sin tener que adivinar qué bordes mirar.
    let jd0 = jdIni, lon0 = await lonEn(def.clave, jd0);
    for (let jd1 = jdIni + 1; jd1 <= jdFin + 1e-9; jd1 += 1) {
      const lon1 = await lonEn(def.clave, jd1);
      const i0 = Math.floor(lon0 / 30) % 12, i1 = Math.floor(lon1 / 30) % 12;
      if (i0 !== i1) {
        // El borde depende del sentido de la marcha: yendo para adelante es el
        // que abre el signo nuevo; yendo para atrás, el que abre el que deja.
        const haciaAdelante = difAngular(lon1, lon0) > 0;
        const borde = 30 * (haciaAdelante ? i1 : i0);
        const f = async (x) => difAngular(await lonEn(def.clave, x), borde);
        const jd = await bisectar(f, jd0, jd1);
        const idx = Math.round(borde / 30) % 12;
        const estacional = def.clave === "sol" ? NOMBRE_ESTACIONAL[idx] : null;
        out.push({
          jd, fecha: await fechaDe(jd), clase: "ingreso", tipo: def.clave,
          titulo: estacional || `${def.nombre} entra en`,
          detalle: estacional ? `Sol en ${SIGNOS[idx].nombre}` : SIGNOS[idx].nombre,
          principal: def.clave === "sol" || def.peso <= 1.5,
        });
      }
      jd0 = jd1; lon0 = lon1;
    }
  }

  for (const def of CUERPOS) {
    if (def.clave === "sol" || def.clave === "luna") continue; // nunca retrogradan
    const f = async (x) => velEn(def.clave, x);
    for (const jd of await cruces(f, jdIni, jdFin, 1)) {
      const despues = await velEn(def.clave, jd + 0.5);
      out.push({
        jd, fecha: await fechaDe(jd), clase: "estacion", tipo: def.clave,
        titulo: def.nombre, detalle: despues < 0 ? "retrógrado" : "directo",
        principal: false,
      });
    }
  }

  out.sort((a, b) => a.jd - b.jd);
  return out;
}

// ---------------------------------------------------------------------------
// Lo que pide la portada además de los hitos: el instante exacto de los
// aspectos, el próximo ingreso de un cuerpo y el Sol en el horizonte.
// ---------------------------------------------------------------------------

/**
 * Fracción iluminada de la Luna con el ÁNGULO DE FASE verdadero (Sol-Luna-
 * Tierra, con las distancias y la latitud de la Luna), no con la elongación en
 * longitud que usa faseLunar(): esa aproximación se corre unas décimas y la
 * portada muestra la iluminación con un decimal ("68,5% iluminada").
 */
export async function iluminacionLunar(fecha) {
  const swe = await motor();
  const jd = await jdDe(fecha);
  const vec = (p) => {
    const l = (p.longitude * Math.PI) / 180, b = (p.latitude * Math.PI) / 180;
    return [p.distance * Math.cos(b) * Math.cos(l), p.distance * Math.cos(b) * Math.sin(l), p.distance * Math.sin(b)];
  };
  const m = vec(swe.calc(jd, Body.Moon)), s = vec(swe.calc(jd, Body.Sun));
  const aTierra = m.map((x) => -x), aSol = s.map((x, i) => x - m[i]);
  const punto = aTierra.reduce((t, x, i) => t + x * aSol[i], 0);
  const largo = (v) => Math.hypot(...v);
  return (1 + punto / (largo(aTierra) * largo(aSol))) / 2;
}

/** Instante (Date) de un día juliano UT, con milisegundos. */
export const fechaExacta = (jd) => new Date(Math.round((jd - 2440587.5) * 86400000));

/**
 * Aspectos EXACTOS entre dos grupos de cuerpos dentro de una ventana: el
 * instante en que la separación cruza el ángulo. Cada par se mira una sola vez
 * (el de menor índice en CUERPOS va primero) y cada ángulo distinto de 0° y
 * 180° se busca a los dos lados (90° y 270° son la misma cuadratura).
 * `paso` es el muestreo en días: 1 alcanza para los planetas; la Luna, que se
 * mueve 13° por día, pide menos.
 */
export async function aspectosExactos(desde, hasta, { a, b, angulos, paso = 1 }) {
  const jdIni = await jdDe(desde), jdFin = await jdDe(hasta);
  const orden = (clave) => CUERPOS.findIndex((c) => c.clave === clave);
  const pares = [];
  for (const x of a) for (const y of b) {
    if (x === y) continue;
    const [p, q] = orden(x) < orden(y) ? [x, y] : [y, x];
    if (!pares.some(([m, n]) => m === p && n === q)) pares.push([p, q]);
  }
  const out = [];
  for (const [p, q] of pares) {
    for (const angulo of angulos) {
      const objetivos = angulo === 0 || angulo === 180 ? [angulo] : [angulo, 360 - angulo];
      for (const objetivo of objetivos) {
        const f = async (x) => difAngular((await lonEn(p, x)) - (await lonEn(q, x)), objetivo);
        for (const jd of await cruces(f, jdIni, jdFin, paso)) {
          out.push({ jd, fecha: fechaExacta(jd), a: p, b: q, angulo,
                     lonA: await lonEn(p, jd), lonB: await lonEn(q, jd) });
        }
      }
    }
  }
  return out.sort((x, y) => x.jd - y.jd);
}

/** El próximo cambio de signo de un cuerpo después de `desde` (null si no hay en `dias`). */
export async function proximoIngreso(clave, desde, dias = 3, paso = 0.25) {
  const jdIni = await jdDe(desde);
  let jd0 = jdIni, lon0 = await lonEn(clave, jd0);
  for (let jd1 = jdIni + paso; jd1 <= jdIni + dias + 1e-9; jd1 += paso) {
    const lon1 = await lonEn(clave, jd1);
    const i0 = Math.floor(lon0 / 30) % 12, i1 = Math.floor(lon1 / 30) % 12;
    if (i0 !== i1) {
      const haciaAdelante = difAngular(lon1, lon0) > 0;
      const borde = 30 * (haciaAdelante ? i1 : i0);
      const jd = await bisectar(async (x) => difAngular(await lonEn(clave, x), borde), jd0, jd1);
      // Para los dos sentidos, el signo al que entra es el de la muestra nueva
      const signoIdx = i1;
      return { jd, fecha: fechaExacta(jd), signoIdx, signo: SIGNOS[signoIdx].nombre, retro: !haciaAdelante };
    }
    jd0 = jd1; lon0 = lon1;
  }
  return null;
}

/**
 * Próxima salida o puesta del Sol después de `desde`, en un lugar. Borde
 * superior del disco, horizonte plano y refracción estándar (lo que Swiss
 * Ephemeris hace por defecto).
 */
export async function solEnHorizonte(desde, lugar, evento) {
  const swe = await motor();
  const r = swe.riseTransit(await jdDe(desde), Body.Sun,
    { latitude: lugar.latitud, longitude: lugar.longitud },
    evento === "salida" ? RiseTransit.Rise : RiseTransit.Set);
  return r.occurs && r.jd !== null ? fechaExacta(r.jd) : null;
}

/** Longitud y velocidad de un cuerpo en un día juliano (para armar eventos). */
export async function estadoEn(clave, jd) {
  return { longitud: await lonEn(clave, jd), velocidad: await velEn(clave, jd) };
}

/**
 * Los eventos de la agenda de la portada en una ventana: lunaciones (nueva y
 * llena), ingresos de signo sin la Luna, estaciones, y cuadraturas y
 * oposiciones exactas entre el Sol y los planetas (sin la Luna). Es la regla
 * que declara el prototipo ("lunaciones, cuadraturas, oposiciones, ingresos
 * sin Luna y estaciones"). Devuelve datos crudos; los textos los arma quien
 * los muestra.
 */
export async function eventosAgenda(desde, hasta) {
  const jdIni = await jdDe(desde), jdFin = await jdDe(hasta);
  const out = [];
  for (const [objetivo, fase] of [[0, "new"], [180, "full"]]) {
    const f = async (x) => difAngular(await elongacion(x), objetivo);
    for (const jd of await cruces(f, jdIni, jdFin, 1)) {
      out.push({ kind: "lunation", jd, phase: fase, angle: objetivo, body: "luna", otherBody: "sol",
                 longitude: await lonEn("luna", jd), otherLongitude: await lonEn("sol", jd) });
    }
  }
  for (const def of CUERPOS) {
    if (SIN_INGRESOS.has(def.clave)) continue;
    let jd0 = jdIni, lon0 = await lonEn(def.clave, jd0);
    for (let jd1 = jdIni + 1; jd1 <= jdFin + 1e-9; jd1 += 1) {
      const lon1 = await lonEn(def.clave, jd1);
      const i0 = Math.floor(lon0 / 30) % 12, i1 = Math.floor(lon1 / 30) % 12;
      if (i0 !== i1) {
        const haciaAdelante = difAngular(lon1, lon0) > 0;
        const borde = 30 * (haciaAdelante ? i1 : i0);
        const jd = await bisectar(async (x) => difAngular(await lonEn(def.clave, x), borde), jd0, jd1);
        if (jd >= jdIni && jd < jdFin) {
          out.push({ kind: "ingress", jd, body: def.clave, longitude: borde % 360,
                     signIndex: i1, retrograde: !haciaAdelante });
        }
      }
      jd0 = jd1; lon0 = lon1;
    }
  }
  for (const def of CUERPOS) {
    if (def.clave === "sol" || def.clave === "luna") continue;
    for (const jd of await cruces(async (x) => velEn(def.clave, x), jdIni, jdFin, 1)) {
      out.push({ kind: "station", jd, body: def.clave, longitude: await lonEn(def.clave, jd),
                 retrograde: (await velEn(def.clave, jd + 0.5)) < 0 });
    }
  }
  const sinLuna = CUERPOS.map((c) => c.clave).filter((c) => c !== "luna");
  for (const x of await aspectosExactos(desde, hasta, { a: sinLuna, b: sinLuna, angulos: [90, 180] })) {
    out.push({ kind: "aspect", jd: x.jd, body: x.a, otherBody: x.b, angle: x.angulo,
               longitude: x.lonA, otherLongitude: x.lonB });
  }
  return out.filter((e) => e.jd >= jdIni && e.jd < jdFin).sort((p, q) => p.jd - q.jd);
}

export { HouseSystem, Body };

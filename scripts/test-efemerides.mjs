// Verifica el motor de efemérides contra astronomy-engine, que es una
// implementación INDEPENDIENTE (MIT, sin relación con Swiss Ephemeris). Si dos
// motores distintos coinciden al minuto de arco, los dos están bien; es la
// única forma de verificar sin tener una efeméride profesional impresa al lado.
//
// El brief lo pide en la sección 10: "mismas posiciones al minuto de arco".
// No necesita server, base ni red.
import * as A from "astronomy-engine";
import {
  posiciones, casas, faseLunar, hitos, jdDe, fechaDe, difAngular, norm360, casaDe,
} from "../src/lib/efemerides.js";

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};

const AE = {
  Sol: A.Body.Sun, Luna: A.Body.Moon, Mercurio: A.Body.Mercury, Venus: A.Body.Venus,
  Marte: A.Body.Mars, "Júpiter": A.Body.Jupiter, Saturno: A.Body.Saturn,
  Urano: A.Body.Uranus, Neptuno: A.Body.Neptune, "Plutón": A.Body.Pluto,
};

// Geocéntrica aparente J2000 -> eclíptica VERDADERA DE LA FECHA, que es el
// marco en el que se dibuja una carta. Sin esta rotación la diferencia contra
// Swiss Ephemeris sería la precesión acumulada (~0,36° desde J2000): parecería
// un error del motor y sería un error de la comparación.
function lonIndependiente(cuerpo, fecha) {
  const t = A.MakeTime(fecha);
  const v = cuerpo === A.Body.Moon ? A.GeoMoon(t) : A.GeoVector(cuerpo, t, true);
  return norm360(A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), v)).lon);
}
const arcmin = (a, b) => Math.abs(difAngular(a, b)) * 60;

const FECHAS = [
  new Date(Date.UTC(1978, 2, 14, 10, 42)),
  new Date(Date.UTC(2026, 7, 30, 12, 0)),
  new Date(Date.UTC(1950, 0, 1, 0, 0)),
  new Date(Date.UTC(2000, 0, 1, 12, 0)),
  new Date(Date.UTC(2035, 10, 21, 3, 15)),
];

console.log("— Posiciones contra un motor independiente");
let peor = 0, peorQuien = "";
for (const f of FECHAS) {
  for (const p of await posiciones(f)) {
    const d = arcmin(p.longitud, lonIndependiente(AE[p.nombre], f));
    if (d > peor) { peor = d; peorQuien = `${p.nombre} @ ${f.toISOString().slice(0, 10)}`; }
    cierto(`${p.nombre} ${f.toISOString().slice(0, 10)}`, d < 1, `${d.toFixed(2)}' de arco`);
  }
}
console.log(`  peor diferencia: ${peor.toFixed(3)}' de arco (${peorQuien})`);

console.log("— Signo y grado derivados de la longitud");
for (const p of await posiciones(FECHAS[1])) {
  cierto(`${p.nombre}: el grado cae dentro del signo`, p.grado >= 0 && p.grado < 30);
  cierto(`${p.nombre}: signo coherente con la longitud`,
    p.signoIdx === Math.floor(p.longitud / 30) % 12);
  cierto(`${p.nombre}: retrógrado = velocidad negativa`, p.retro === (p.velocidad < 0));
}

console.log("— Ascendente y Medio Cielo (fórmula clásica, camino independiente)");
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
function ascMcClasico(fecha, lat, lonEste) {
  const t = A.MakeTime(fecha);
  const ramc = norm360(A.SiderealTime(t) * 15 + lonEste);
  const eps = rad(23.4392911 - 0.0130042 * (t.tt / 36525)); // t.tt son días desde J2000
  const R = rad(ramc), P = rad(lat);
  let mc = norm360(deg(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(eps))));
  let asc = norm360(deg(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(eps) + Math.tan(P) * Math.sin(eps)))));
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180); // el Asc sigue al MC
  return { asc, mc };
}
const LUGARES = [
  ["Buenos Aires 1978", new Date(Date.UTC(1978, 2, 14, 10, 42)), -34.6037, -58.3816],
  ["Londres 2000",      new Date(Date.UTC(2000, 0, 1, 12, 0)),    51.5074,  -0.1278],
  ["Tokio 2010",        new Date(Date.UTC(2010, 5, 21, 9, 30)),   35.6762, 139.6503],
  ["Ushuaia 1990",      new Date(Date.UTC(1990, 7, 15, 6, 0)),   -54.8019, -68.3030],
];
for (const [nombre, f, lat, lon] of LUGARES) {
  const c = await casas(f, lat, lon);
  const ref = ascMcClasico(f, lat, lon);
  cierto(`${nombre}: Ascendente`, arcmin(c.ascendente, ref.asc) < 2, `${arcmin(c.ascendente, ref.asc).toFixed(2)}'`);
  cierto(`${nombre}: Medio Cielo`, arcmin(c.medioCielo, ref.mc) < 2, `${arcmin(c.medioCielo, ref.mc).toFixed(2)}'`);
  cierto(`${nombre}: 12 cúspides`, c.cuspides.length === 12);
  cierto(`${nombre}: la casa 7 es la 1 + 180°`, arcmin(c.cuspides[6], norm360(c.cuspides[0] + 180)) < 1);
  cierto(`${nombre}: la casa 10 es el Medio Cielo`, arcmin(c.cuspides[9], c.medioCielo) < 1);
  cierto(`${nombre}: el Ascendente cae en la casa 1`, casaDe(c.ascendente + 0.01, c.cuspides) === 1);
  cierto(`${nombre}: fuera del círculo polar no se sustituye el sistema`, !c.sustituido);
}

console.log("— Fase lunar");
for (const f of FECHAS) {
  const luna = await faseLunar(f);
  const ref = A.Illumination(A.Body.Moon, A.MakeTime(f)).phase_fraction * 100;
  cierto(`iluminación ${f.toISOString().slice(0, 10)}`, Math.abs(luna.porcentaje - ref) <= 1,
    `nuestro ${luna.porcentaje}% vs ${ref.toFixed(1)}%`);
  cierto(`la próxima lunación es futura`, luna.proxima && luna.proxima.fecha > f);
}
// La nueva y la llena NUNCA pueden caer en el mismo instante: es el bug que
// tuvo la primera versión, donde el salto de +180° a -180° de la diferencia
// angular se leía como un cruce.
const dosFases = (await faseLunar(FECHAS[1])).proximas;
cierto("la luna nueva y la llena no caen en el mismo instante",
  dosFases.length === 2 && Math.abs(dosFases[0].jd - dosFases[1].jd) > 5);

console.log("— Hitos de treinta días");
const desde = new Date(Date.UTC(2026, 7, 30, 12, 0));
const linea = await hitos(desde, 30);
const jdDesde = await jdDe(desde);
cierto("hay hitos", linea.length > 0);
cierto("vienen ordenados en el tiempo", linea.every((h, i) => i === 0 || h.jd >= linea[i - 1].jd));
cierto("todos caen dentro de la ventana",
  linea.every((h) => h.jd >= jdDesde - 1e-6 && h.jd <= jdDesde + 30 + 1e-6));
cierto("hay al menos una lunación", linea.some((h) => h.clase === "lunacion"));
cierto("el equinoccio del 23-09-2026 está",
  linea.some((h) => h.titulo.includes("Equinoccio") && h.fecha.toISOString().startsWith("2026-09-23")));
cierto("la Luna no ensucia la línea con un ingreso cada dos días",
  !linea.some((h) => h.clase === "ingreso" && h.tipo === "luna"));
// La luna nueva de septiembre 2026 es el 11, verificable contra astronomy-engine.
const nuevaRef = A.SearchMoonPhase(0, A.MakeTime(desde), 40).date;
const nuestra = linea.find((h) => h.clase === "lunacion" && h.tipo === "nueva");
cierto("la luna nueva coincide con el otro motor (menos de 2 minutos)",
  nuestra && Math.abs(nuestra.fecha - nuevaRef) < 2 * 60 * 1000,
  nuestra ? `${nuestra.fecha.toISOString()} vs ${nuevaRef.toISOString()}` : "no se encontró");

console.log("— Ida y vuelta del día juliano");
for (const f of FECHAS) {
  const vuelta = await fechaDe(await jdDe(f));
  cierto(`jd ida y vuelta ${f.toISOString().slice(0, 10)}`, Math.abs(vuelta - f) < 1500);
}

console.log(`\n${ok} chequeos bien, ${fallo} mal.`);
process.exit(fallo ? 1 : 0);

// Test del geocodificador y de la zona horaria histórica.
//
// La parte de husos es PURA (sale de la tzdb de Node) y corre siempre. La de
// búsqueda necesita el padrón cargado con importar-ciudades.mjs; si no está,
// se saltea avisando en vez de dar un falso verde.
import { initDb, getDb } from "../src/db.js";
import {
  normalizar, buscarCiudades, localAUtc, offsetEnFecha, etiquetaOffset,
  etiquetaCiudad, nombrePais,
} from "../src/lib/geo.js";

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};

console.log("— Normalización");
cierto("saca acentos", normalizar("Córdoba") === "cordoba");
cierto("saca la ñ sin romperla", normalizar("Cañuelas") === "canuelas");
cierto("colapsa espacios y puntuación", normalizar("  Río  Cuarto, ") === "rio cuarto");
cierto("aguanta null", normalizar(null) === "");

console.log("— Zona horaria histórica de la Argentina");
const Z = "America/Argentina/Buenos_Aires";
// El huso VIGENTE EN LA FECHA, no el de hoy. Si todos dieran -180, la tzdb no
// se estaría consultando por fecha y toda carta anterior a 2009 saldría mal.
const CASOS_TZ = [
  [1930, 6, 15, 12, 0, -240, "antes del primer horario de verano: GMT-4"],
  [1974, 2, 10, 12, 0, -120, "horario de verano de 1974: GMT-2"],
  [1978, 3, 14,  7, 42, -180, "la fecha del mockup del brief: GMT-3"],
  [1990, 1, 15, 12, 0, -120, "verano 1989-90: GMT-2"],
  [2008, 12, 20, 12, 0, -120, "el último horario de verano: GMT-2"],
  [2026, 8, 30, 12, 0, -180, "hoy: GMT-3"],
];
for (const [y, m, d, hh, mm, esperado, nota] of CASOS_TZ) {
  const r = localAUtc(Z, y, m, d, hh, mm);
  cierto(nota, r.offsetMin === esperado, `dio ${etiquetaOffset(r.offsetMin)}`);
}
cierto("no todos los años dan el mismo huso",
  new Set(CASOS_TZ.map(([y, m, d, hh, mm]) => localAUtc(Z, y, m, d, hh, mm).offsetMin)).size > 1);

console.log("— Ida y vuelta local ↔ UTC");
for (const [y, m, d, hh, mm] of CASOS_TZ) {
  const { utc } = localAUtc(Z, y, m, d, hh, mm);
  const pared = new Intl.DateTimeFormat("es-AR", {
    timeZone: Z, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(utc);
  const p = Object.fromEntries(pared.map((x) => [x.type, x.value]));
  cierto(`${d}/${m}/${y} ${hh}:${mm} vuelve a la misma hora de pared`,
    +p.year === y && +p.month === m && +p.day === d && +p.hour % 24 === hh && +p.minute === mm,
    `dio ${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`);
}

console.log("— Otras zonas");
cierto("Nueva York en invierno es GMT-5",
  offsetEnFecha("America/New_York", Date.UTC(2020, 0, 15, 12)) === -300);
cierto("Nueva York en verano es GMT-4",
  offsetEnFecha("America/New_York", Date.UTC(2020, 6, 15, 12)) === -240);
cierto("Katmandú tiene un huso de 45 minutos",
  offsetEnFecha("Asia/Kathmandu", Date.UTC(2020, 0, 15, 12)) === 345);
cierto("y la etiqueta lo muestra", etiquetaOffset(345) === "GMT+05:45");
cierto("la etiqueta negativa también", etiquetaOffset(-180) === "GMT-03:00");

console.log("— Nombres de país en castellano");
cierto("GB es Reino Unido", nombrePais("GB") === "Reino Unido");
cierto("un código raro no rompe", typeof nombrePais("ZZ") === "string");

initDb();
const hay = getDb().prepare("SELECT COUNT(*) n FROM ciudades").get().n;
if (!hay) {
  console.log("\n⚠ El padrón de ciudades está vacío: se saltean las búsquedas.");
  console.log("  Cargalo con: node scripts/importar-ciudades.mjs --apply");
} else {
  console.log(`— Búsqueda de ciudades (${hay.toLocaleString("es-AR")} en el padrón)`);
  const primera = (q) => buscarCiudades(q, 5)[0];
  const contiene = (q, nombre) => buscarCiudades(q, 8).some((c) => c.nombre === nombre);

  cierto("Tandil", primera("tandil")?.nombre === "Tandil");
  cierto("Venado Tuerto aparece", contiene("venado tuerto", "Venado Tuerto"));
  cierto("Ushuaia", primera("ushuaia")?.nombre === "Ushuaia");
  cierto("Córdoba trae la argentina primero", primera("cordoba")?.pais === "AR");
  cierto("sin acento encuentra igual", primera("cordoba")?.id === primera("Córdoba")?.id);

  // Exónimos: el sitio está en castellano y nadie escribe "London".
  cierto("Londres trae London", primera("londres")?.nombre === "London");
  cierto("Nueva York trae New York City", primera("nueva york")?.nombre === "New York City");
  cierto("Roma trae Rome", primera("roma")?.nombre === "Rome");
  cierto("Moscú trae Moscow", primera("moscu")?.nombre === "Moscow");
  cierto("Ginebra trae Geneva", primera("ginebra")?.nombre === "Geneva");
  // …pero el homónimo argentino no se pierde: los dos tienen que estar.
  cierto("y Londres de Catamarca sigue en la lista", contiene("londres", "Londres"));

  // Los alias son SÓLO castellanos y sólo vigentes. Con los de todos los
  // idiomas, "Concordia" traía El Paso (Texas), que se llamó así hace un siglo,
  // antes que Concordia de Entre Ríos.
  cierto("Concordia trae la de Entre Ríos, no El Paso",
    primera("concordia")?.pais === "AR", primera("concordia")?.etiqueta);
  cierto("un nombre histórico de otra ciudad no tapa a la que se llama así hoy",
    buscarCiudades("concordia", 5).every((c) => normalizar(c.nombre).includes("concordia")));

  // Los alias son abreviaturas y códigos en todos los idiomas: escribiendo
  // pocas letras no pueden tapar a una ciudad que sí se llama así.
  cierto("«tan» no trae ciudades que no empiecen con tan",
    buscarCiudades("tan", 5).every((c) => normalizar(c.nombre).startsWith("tan")));

  cierto("una letra sola no busca", buscarCiudades("a", 5).length === 0);
  cierto("una consulta sin resultados devuelve lista vacía",
    buscarCiudades("xqzptvw", 5).length === 0);
  cierto("respeta el límite", buscarCiudades("san", 3).length === 3);

  const c = primera("tandil");
  cierto("trae zona horaria", !!c.tz);
  cierto("trae coordenadas", Number.isFinite(c.lat) && Number.isFinite(c.lon));
  cierto("la etiqueta dice ciudad, provincia y país",
    etiquetaCiudad(c) === "Tandil, Buenos Aires, Argentina", etiquetaCiudad(c));
  // La etiqueta no repite el nombre cuando la ciudad se llama igual que su provincia.
  const cba = buscarCiudades("cordoba", 5).find((x) => x.pais === "AR" && x.nombre === "Córdoba");
  cierto("no repite «Córdoba, Córdoba»", !/Córdoba,\s*Córdoba/.test(etiquetaCiudad(cba)), etiquetaCiudad(cba));

  const t0 = Date.now();
  for (let i = 0; i < 20; i++) buscarCiudades("tandil", 8);
  const ms = (Date.now() - t0) / 20;
  cierto(`una búsqueda por prefijo tarda menos de 15 ms (${ms.toFixed(1)} ms)`, ms < 15);
}

console.log(`\n${ok} chequeos bien, ${fallo} mal.`);
process.exit(fallo ? 1 : 0);

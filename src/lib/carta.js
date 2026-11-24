// La carta natal y la carta del momento, calculadas en el servidor para la
// pantalla publicada (/carta, la opción 2 «Observatorio» del prototipo).
//
// Devuelve EXACTAMENTE el JSON que lee window.A29Carta (doc 02 §5, doc 03 §8):
// meta, bodies, angles, houses, aspects, balance, aspect_rules, en ese orden.
// Con los criterios de Fernando (24/11/2026, src/lib/criterios.js), que mandan
// sobre el prototipo donde difieren:
//   - tropical, casas Placidus, nodo verdadero; la casa de cada cuerpo sale de
//     los intervalos entre cúspides (en la cúspide exacta, la casa que empieza
//     ahí; nunca se pasa a la siguiente por cercanía);
//   - balance de 50 puntos (PESOS_CARTA), Math.round, dominante antes de
//     redondear, empates todos, todos empatados «Equilibrio»;
//   - aspectos solo entre los diez planetas, orbes 8/8/6/6/4 inclusivos e
//     iguales para todos (sin el +2 de las luminarias del prototipo);
//   - aplicativo / separativo / exacto (< 1″) según las velocidades.
//
// La hora de nacimiento es obligatoria (S10): sin hora no se calcula nada.
// Y la carta va completa o no va (S18, Fernando: «si la carta no se puede
// calcular completa, no se muestra»): sin casas Placidus (latitud polar) o con
// cualquier parte que no se pudo calcular, no sale ninguna carta.
// No se guarda nada y no se escribe nada en los registros (S9): los errores de
// validación vuelven al que pidió y no se loguean.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { posiciones, casas, casaDe, nodoYQuiron, versionMotor, jdDe, HouseSystem } from "./efemerides.js";
import {
  PESOS_CARTA, ASPECTOS, ORBE_EXACTO, balance, aspectos, aplicacion, gradoMinuto, signoDe, elementoDe, modalidadDe,
} from "./criterios.js";
import { buscarCiudades, localAUtc, normalizar } from "./geo.js";
import { ahora, partesBA } from "./cielo-portada.js";
import { LUGAR_SITIO } from "./astro-config.js";
import { TZ_SITIO } from "../config.js";

/** Un error de lo que mandó la persona: va de vuelta con su campo, nunca al registro. */
export class ErrorCarta extends Error {
  constructor(campo, mensaje) { super(mensaje); this.campo = campo; }
}

/** S18, con las palabras de Fernando: en lugar del error técnico, cuando las casas no se pueden calcular. */
export const MENSAJE_SIN_CASAS = "Para este lugar de nacimiento no es posible calcular las casas de la carta.";

const finito = (x) => typeof x === "number" && Number.isFinite(x);

/**
 * S18: la carta va completa o no va. Sin las doce cúspides o los cuatro
 * ángulos es el mensaje de las casas (400, lo ve la persona); si falta otra
 * parte (un cuerpo, el balance, los aspectos) es un error del motor (500,
 * «No pudimos calcular la carta»). En ningún caso sale una carta a medias.
 */
export function verificarCompleta(c) {
  const casasOk = Array.isArray(c?.houses) && c.houses.length === 12 && c.houses.every((h) => finito(h.cusp))
    && Array.isArray(c?.angles) && c.angles.length === 4 && c.angles.every((a) => finito(a.longitude));
  if (!casasOk) throw new ErrorCarta("lugar", MENSAJE_SIN_CASAS);
  const resto = Array.isArray(c.bodies) && c.bodies.length === 12
    && c.bodies.every((b) => finito(b.longitude) && finito(b.latitude) && finito(b.speed) && Number.isInteger(b.house))
    && Array.isArray(c.aspects) && c.aspects.every((a) => finito(a.orb))
    && c.balance && finito(c.balance.total) && Array.isArray(c.balance.elements) && Array.isArray(c.balance.modalities)
    && [...(c.balance.elements || []), ...(c.balance.modalities || [])].every((g) => finito(g.count) && finito(g.percent));
  if (!resto) throw new Error("carta incompleta: falta una parte del cálculo");
  return c;
}

// --- Nombres del contrato (doc 02 §4) ----------------------------------------
const SIGNOS = [
  ["aries", "Aries"], ["taurus", "Tauro"], ["gemini", "Géminis"], ["cancer", "Cáncer"], ["leo", "Leo"], ["virgo", "Virgo"],
  ["libra", "Libra"], ["scorpio", "Escorpio"], ["sagittarius", "Sagitario"], ["capricorn", "Capricornio"], ["aquarius", "Acuario"], ["pisces", "Piscis"],
];
/** id del contrato → clave de criterios.js (y del motor) y nombre. */
const CUERPOS = [
  ["sun", "sol", "Sol"], ["moon", "luna", "Luna"], ["mercury", "mercurio", "Mercurio"], ["venus", "venus", "Venus"],
  ["mars", "marte", "Marte"], ["jupiter", "jupiter", "Júpiter"], ["saturn", "saturno", "Saturno"], ["uranus", "urano", "Urano"],
  ["neptune", "neptuno", "Neptuno"], ["pluto", "pluton", "Plutón"],
];
const EXTRAS = [["node", "nodo", "Nodo norte (verdadero)"], ["chiron", "quiron", "Quirón"]];
const CLAVE = Object.fromEntries([...CUERPOS.map(([id, c]) => [id, c]), ["asc", "ascendente"], ["mc", "medioCielo"]]);
const ID = Object.fromEntries(Object.entries(CLAVE).map(([id, c]) => [c, id]));
const NOMBRE_PUNTO = { asc: "Ascendente", mc: "Medio Cielo" };
const TIPO = { conjuncion: "conjunction", sextil: "sextile", cuadratura: "square", trigono: "trine", oposicion: "opposition" };
const ELEMENTOS = { fuego: ["fire", "Fuego"], tierra: ["earth", "Tierra"], aire: ["air", "Aire"], agua: ["water", "Agua"] };
const MODALIDADES = { cardinal: ["cardinal", "Cardinal"], fijo: ["fixed", "Fija"], mutable: ["mutable", "Mutable"] };
const PLANETAS_ID = CUERPOS.map(([id]) => id);

const r = (x, d) => { const f = 10 ** d; return Math.round(x * f) / f; };
const dos = (n) => String(n).padStart(2, "0");
const n360 = (x) => ((x % 360) + 360) % 360;
const isoSegundos = (fecha) => fecha.toISOString().replace(/\.\d{3}Z$/, "Z");
const offsetTexto = (min) => `${min < 0 ? "-" : "+"}${dos(Math.floor(Math.abs(min) / 60))}:${dos(Math.abs(min) % 60)}`;
const posicion = (longitud) => {
  const g = gradoMinuto(longitud);
  return { sign: SIGNOS[g.signo][0], sign_name: SIGNOS[g.signo][1], degree: g.grado, minute: g.minuto };
};
const orbeTexto = (orbe) => { const t = Math.round(orbe * 60); return `${Math.floor(t / 60)}°${dos(t % 60)}′`; };

// --- El motor que corre (meta.engine, meta.ephemeris_files) -------------------
const leerJson = (especificador, relativo) => {
  const base = path.dirname(fileURLToPath(import.meta.resolve(especificador)));
  return JSON.parse(fs.readFileSync(path.join(base, relativo), "utf8"));
};
const DATOS = leerJson("@kuntay/swisseph-data/manifest.json", "manifest.json");
const PAQUETE = leerJson("@kuntay/swisseph", "../package.json");
const EFEMERIDES = `Archivos de Swiss Ephemeris (sepl_18, semo_18, seas_18: ${DATOS.coverage.fromYear}–${DATOS.coverage.toYear}, ` +
  `comprimidos a partir de JPL ${DATOS.jplEphemeris})`;
const ARCHIVOS = DATOS.files.filter((f) => /^se(pl|mo|as)_18\.se1$/.test(f.file)).map((f) => ({ file: f.file, sha256: f.sha256 }));

// --- Reglas puras (exportadas para los tests) ---------------------------------

/** Casa Placidus de una longitud: por intervalos entre cúspides (efemerides.casaDe). */
export const casaCarta = (longitud, cuspides) => casaDe(longitud, cuspides);

/**
 * Aspectos entre los diez planetas con los criterios de Fernando.
 * `cuerpos`: [{ id, longitude, speed }] con los id del contrato; lo que no es
 * planeta se ignora. Ordenados por orbe y, si empatan, por a y b.
 */
export function aspectosCarta(cuerpos) {
  const pos = cuerpos.filter((c) => PLANETAS_ID.includes(c.id))
    .sort((x, y) => PLANETAS_ID.indexOf(x.id) - PLANETAS_ID.indexOf(y.id))
    .map((c) => ({ clave: CLAVE[c.id], longitud: c.longitude, velocidad: c.speed }));
  return aspectos(pos)
    .map((x) => {
      const fase = aplicacion(x.a, x.b, x.aspecto);
      return {
        a: ID[x.a.clave], b: ID[x.b.clave], type: TIPO[x.aspecto.clave],
        type_name: x.aspecto.nombre.charAt(0).toUpperCase() + x.aspecto.nombre.slice(1), angle: x.aspecto.angulo,
        orb: r(x.orbe, 4), orb_dm: orbeTexto(x.orbe), max_orb: x.aspecto.orbe,
        applying: fase === "aplicativo", phase: fase, _orbe: x.orbe,
      };
    })
    .sort((x, y) => x._orbe - y._orbe || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
    .map(({ _orbe, ...a }) => a);
}

/**
 * El balance de la carta (`balance` del contrato), sobre criterios.balance().
 * `factores`: [{ id, longitude }] con los id del contrato (asc, mc incluidos).
 * `pesos` (por id del contrato) existe para probar la regla; la carta usa PESOS_CARTA.
 */
export function balanceCarta(factores, pesos = null) {
  const pesosClave = pesos ? Object.fromEntries(Object.entries(pesos).map(([id, p]) => [CLAVE[id], p])) : PESOS_CARTA;
  const fac = factores.map((f) => ({ clave: CLAVE[f.id], longitud: f.longitude, id: f.id })).filter((f) => pesosClave[f.clave]);
  const grupo = (campo, tabla, de) => {
    const b = balance(fac, campo, pesosClave);
    const filas = Object.entries(tabla).map(([clave, [id, name]]) => {
      const g = b.grupos.find((x) => x.clave === clave);
      return { id, name, count: g.puntos, percent: g.pc, points: fac.filter((f) => de(f.longitud) === clave).map((f) => f.id) };
    });
    return { filas, dominantes: b.dominantes.map((k) => tabla[k][0]), equilibrio: b.equilibrio, total: b.total };
  };
  const el = grupo("elemento", ELEMENTOS, elementoDe), mo = grupo("modalidad", MODALIDADES, modalidadDe);
  return {
    rule: reglaBalance(),
    points: fac.map((f) => f.id),
    total: el.total,
    elements: el.filas,
    modalities: mo.filas,
    dominant_elements: el.dominantes,
    dominant_modalities: mo.dominantes,
    balanced_elements: el.equilibrio,
    balanced_modalities: mo.equilibrio,
  };
}

function reglaBalance() {
  const total = Object.values(PESOS_CARTA).reduce((s, p) => s + p, 0);
  const lista = Object.entries(PESOS_CARTA).map(([c, p]) => `${ID[c] in NOMBRE_PUNTO ? NOMBRE_PUNTO[ID[c]] : CUERPOS.find((x) => x[1] === c)[2]} ${p}`);
  return `Balance ponderado de ${total} puntos: ${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}. ` +
    "Cada factor aporta todo su peso al elemento y a la modalidad del signo que ocupa. " +
    "El nodo, Quirón, el Descendente y el Fondo del Cielo no se cuentan. " +
    `El porcentaje es puntos del grupo / ${total}, redondeado. Si empatan todos los grupos: «Equilibrio».`;
}

function reglasAspectos() {
  const orbs = Object.fromEntries(ASPECTOS.map((a) => [TIPO[a.clave], a.orbe]));
  const lista = ASPECTOS.map((a) => `${a.nombre} ${a.orbe}°`);
  return {
    orbs,
    luminary_bonus: 0,
    points: PLANETAS_ID,
    rule: "Aspectos mayores (conjunción, sextil, cuadratura, trígono, oposición) solo entre los diez planetas, del Sol a Plutón. " +
      `Orbes: ${lista.join(", ")}, con el límite incluido y el mismo orbe para todos los cuerpos, también la Luna. ` +
      "El orbe indicado es la diferencia exacta con el ángulo perfecto. \"Aplicativo\" si el orbe se achica con el movimiento diario, " +
      `"separativo" si crece, "exacto" si es menor a ${Math.round(ORBE_EXACTO * 3600)}″. ` +
      "El Ascendente, el Medio Cielo, el nodo y Quirón no forman aspectos.",
  };
}

// --- La carta ------------------------------------------------------------------

/**
 * Arma el JSON del contrato para un instante y un lugar.
 * `lugar`: { place, latitude, longitude, timezone }; `local`: { date, time }.
 */
async function armar({ kind, instante, offsetMin, lugar, local }) {
  const [pos, extra, cas, version, jd] = await Promise.all([
    posiciones(instante), nodoYQuiron(instante), casas(instante, lugar.latitude, lugar.longitude, HouseSystem.Placidus),
    versionMotor(), jdDe(instante),
  ]);
  // Más allá del círculo polar Placidus no existe y Swiss Ephemeris pasa a
  // Porphyry: la carta no se arma con un sistema que nadie eligió (S18).
  if (cas.sustituido || !Array.isArray(cas.cuspides) || cas.cuspides.length !== 12 || !cas.cuspides.every(finito)
    || !finito(cas.ascendente) || !finito(cas.medioCielo)) {
    throw new ErrorCarta("lugar", MENSAJE_SIN_CASAS);
  }
  const cusps = cas.cuspides;
  const ascSigno = signoDe(cas.ascendente);
  const signoEntero = (lon) => ((signoDe(lon) - ascSigno + 12) % 12) + 1;

  const crudos = [
    ...CUERPOS.map(([id, clave, name]) => { const p = pos.find((x) => x.clave === clave); return { id, name, lon: p.longitud, lat: p.latitud, vel: p.velocidad }; }),
    ...EXTRAS.map(([id, clave, name]) => ({ id, name, lon: extra[clave].longitud, lat: extra[clave].latitud, vel: extra[clave].velocidad })),
  ];
  const bodies = crudos.map((c) => ({
    id: c.id, name: c.name, longitude: r(c.lon, 6), latitude: r(c.lat, 6), ...posicion(c.lon),
    house: casaCarta(c.lon, cusps), house_whole_sign: signoEntero(c.lon), speed: r(c.vel, 5), retrograde: c.vel < 0,
  }));
  const angulos = [["asc", "Ascendente", cas.ascendente, 1], ["mc", "Medio Cielo", cas.medioCielo, 10],
    ["dsc", "Descendente", n360(cas.ascendente + 180), 7], ["ic", "Fondo del Cielo", n360(cas.medioCielo + 180), 4]];
  const angles = angulos.map(([id, name, lon, house]) => ({ id, name, longitude: r(lon, 6), ...posicion(lon), house }));
  const houses = cusps.map((c, k) => ({ house: k + 1, cusp: r(c, 6), ...posicion(c), whole_sign_start: 30 * ((ascSigno + k) % 12) }));
  // Aspectos y balance con las longitudes sin redondear
  const aspects = aspectosCarta(crudos.map((c) => ({ id: c.id, longitude: c.lon, speed: c.vel })));
  const balanceJson = balanceCarta([...crudos.map((c) => ({ id: c.id, longitude: c.lon })),
    { id: "asc", longitude: cas.ascendente }, { id: "mc", longitude: cas.medioCielo }]);

  return verificarCompleta({
    meta: {
      ejemplo: false,
      kind,
      hora_conocida: true,
      engine: `Swiss Ephemeris ${version} (${PAQUETE.name} ${PAQUETE.version}, WebAssembly)`,
      ephemeris: EFEMERIDES,
      ephemeris_files: ARCHIVOS,
      zodiac: "tropical",
      house_system: "Placidus",
      house_system_code: "P",
      node: "true",
      input: { name: null, date: local.date, time: local.time, place: lugar.place, latitude: lugar.latitude, longitude: lugar.longitude, timezone: lugar.timezone },
      utc_instant: isoSegundos(instante),
      utc_offset: offsetTexto(offsetMin),
      utc_offset_rule: `Resuelto con la base de zonas horarias IANA (${lugar.timezone}) para esa fecha y hora, nunca a mano.`,
      jd_ut: r(jd, 6),
      generated_at: isoSegundos(new Date()),
    },
    bodies,
    angles,
    houses,
    aspects,
    balance: balanceJson,
    aspect_rules: reglasAspectos(),
  });
}

// --- Entrada de la carta natal --------------------------------------------------
const ANIO_MIN = 1900;
const texto = (v) => (typeof v === "string" ? v.trim() : "");

function validarFecha(v) {
  const t = texto(v);
  if (!t) throw new ErrorCarta("fecha", "Ingresá tu fecha de nacimiento.");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const anio = m ? Number(m[1]) : NaN, mes = m ? Number(m[2]) : NaN, dia = m ? Number(m[3]) : NaN;
  const prueba = new Date(Date.UTC(anio, mes - 1, dia));
  if (!m || prueba.getUTCFullYear() !== anio || prueba.getUTCMonth() !== mes - 1 || prueba.getUTCDate() !== dia) {
    throw new ErrorCarta("fecha", "Esa fecha no existe. Revisá el día y el mes.");
  }
  if (anio < ANIO_MIN) throw new ErrorCarta("fecha", `Por ahora calculo desde ${ANIO_MIN} en adelante.`);
  const hoy = partesBA(new Date());
  if (t > `${hoy.anio}-${dos(hoy.mes)}-${dos(hoy.dia)}`) throw new ErrorCarta("fecha", "La fecha de nacimiento no puede ser futura.");
  return { anio, mes, dia, date: t };
}

function validarHora(v) {
  const t = texto(v);
  if (!t) throw new ErrorCarta("hora", "Ingresá tu hora de nacimiento.");
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new ErrorCarta("hora", "La hora va como 07:42.");
  const hora = Number(m[1]), minuto = Number(m[2]);
  if (hora > 23 || minuto > 59) throw new ErrorCarta("hora", "Esa hora no existe.");
  return { hora, minuto, time: `${dos(hora)}:${dos(minuto)}` };
}

/**
 * Del texto libre del formulario («Ciudad, provincia, país») a una ciudad del
 * padrón (geo.js, todo local). La primera parte se busca; las otras, si están,
 * eligen entre los candidatos («Córdoba, España»). Sin pistas gana el primero
 * del buscador (la Argentina primero, después la población).
 */
function resolverLugar(v) {
  const t = texto(v).slice(0, 120);
  if (!t) throw new ErrorCarta("lugar", "Ingresá el lugar de nacimiento.");
  const [primera = "", ...resto] = t.split(",").map((s) => s.trim()).filter(Boolean);
  const candidatos = buscarCiudades(primera, 25);
  if (!candidatos.length) throw new ErrorCarta("lugar", `No encontré «${primera}». Probá con la ciudad grande más cercana.`);
  const pistas = resto.map(normalizar).filter(Boolean);
  const elegida = (pistas.length && candidatos.find((c) => pistas.every((p) => normalizar(c.etiqueta).includes(p)))) || candidatos[0];
  return { place: elegida.etiqueta, latitude: elegida.lat, longitude: elegida.lon, timezone: elegida.tz };
}

/** La carta natal. `entrada`: { fecha: "AAAA-MM-DD", hora: "HH:MM", lugar }. */
export async function calcularNatal(entrada = {}) {
  const f = validarFecha(entrada.fecha);
  const h = validarHora(entrada.hora);
  const lugar = resolverLugar(entrada.lugar);
  const { utc, offsetMin, inexistente } = localAUtc(lugar.timezone, f.anio, f.mes, f.dia, h.hora, h.minuto);
  if (inexistente) {
    throw new ErrorCarta("hora", "Esa hora no existió en ese lugar: ese día se adelantaron los relojes. Revisá la hora de nacimiento.");
  }
  return armar({ kind: "natal", instante: utc, offsetMin, lugar, local: { date: f.date, time: h.time } });
}

// --- La carta del momento -----------------------------------------------------------
// Buenos Aires, ahora. Caché de un minuto (doc 02 §5.7): el instante es el
// comienzo del minuto en curso, así la hora que se muestra es la de los datos.
let cacheMomento = null;

export async function calcularMomento() {
  const minuto = Math.floor(ahora().getTime() / 60000) * 60000;
  if (cacheMomento && cacheMomento.minuto === minuto) return cacheMomento.carta;
  const instante = new Date(minuto);
  const p = partesBA(instante);
  const carta = await armar({
    kind: "momento", instante, offsetMin: Math.round(p.desfase / 60000),
    lugar: { place: "Buenos Aires, Argentina", latitude: LUGAR_SITIO.latitud, longitude: LUGAR_SITIO.longitud, timezone: TZ_SITIO },
    local: { date: `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`, time: `${dos(p.hora)}:${dos(p.minuto)}` },
  });
  cacheMomento = { minuto, carta };
  return carta;
}

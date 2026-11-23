// El cielo de la portada («El cielo de hoy» y «La línea de tiempo»), armado
// con el motor (efemerides.js + cielo.js) y cacheado: es igual para todos los
// visitantes, como cielo-hoy.js.
//
// CACHÉ: el instante de referencia es el comienzo del tramo de
// config.cacheCieloMin minutos (con 60, la hora en punto de Buenos Aires). Todo
// el que pide la portada dentro del mismo tramo recibe lo mismo; al cambiar de
// tramo se recalcula. Así el reloj de la tarjeta («HORA DE REFERENCIA») dice
// exactamente el instante de los datos.
//
// Qué se calcula y a qué hora (regla del prototipo, doc 01 §6):
//   - la tarjeta del reloj, la Luna, el radar, la cinta, los balances, los
//     retrógrados y los ciclos de fondo: en el instante de referencia;
//   - el barómetro: a las 12:00 de Buenos Aires del día ("Referencia diaria:
//     12:00 Buenos Aires", diez astros y sin ángulos, como dice su diálogo);
//   - la línea de tiempo: 30 días desde las 00:00 de hoy (como el corte del
//     prototipo, que eran 30 días desde el día del corte).
import { config, TZ_SITIO } from "../config.js";
import {
  posiciones, faseLunar, iluminacionLunar, aspectosExactos, proximoIngreso, solEnHorizonte, eventosAgenda,
} from "./efemerides.js";
import { elementos, modalidades, tension } from "./cielo.js";
import { CUERPOS, LUGAR_SITIO } from "./astro-config.js";

/** Días de la línea de tiempo (opción «El mes completo a la vista»). */
export const DIAS_AGENDA = 30;
const DIA = 86400000;

// --- Reloj inyectable (para los tests) ----------------------------------------
let reloj = () => new Date();
/** Los tests fijan la hora; sin argumento vuelve al reloj real. */
export function fijarReloj(fn) { reloj = fn || (() => new Date()); limpiarCache(); }
export const ahora = () => reloj();

// --- Hora de Buenos Aires --------------------------------------------------------
const FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ_SITIO, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** Las partes de un instante en hora de Buenos Aires, más su desfase con UTC. */
export function partesBA(fecha) {
  const p = Object.fromEntries(FMT.formatToParts(fecha).map((x) => [x.type, x.value]));
  const anio = +p.year, mes = +p.month, dia = +p.day, hora = p.hour === "24" ? 0 : +p.hour;
  const minuto = +p.minute, segundo = +p.second;
  const desfase = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo) - (fecha.getTime() - fecha.getUTCMilliseconds());
  return {
    anio, mes, dia, hora, minuto, segundo, ms: fecha.getUTCMilliseconds(), desfase,
    diaSemana: new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(),
  };
}

/** 00:00 de Buenos Aires del día de `fecha`. */
export function medianocheBA(fecha) {
  const p = partesBA(fecha);
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia) - p.desfase);
}

// --- Horas planetarias -------------------------------------------------------------
// Regente del día por día de la semana (domingo = Sol) y orden caldeo de las
// horas: la primera hora del día, desde la salida del Sol, es del regente del
// día. El día planetario va de salida a salida: antes del amanecer sigue la
// noche del día anterior.
const REGENTE_DIA = ["sol", "luna", "marte", "mercurio", "jupiter", "venus", "saturno"];
const CALDEO = ["saturno", "jupiter", "marte", "sol", "venus", "mercurio", "luna"];

async function horaPlanetaria(ref, medianoche) {
  const salida = await solEnHorizonte(medianoche, LUGAR_SITIO, "salida");
  const puesta = await solEnHorizonte(salida, LUGAR_SITIO, "puesta");
  let desde, hasta, diaSemana = partesBA(ref).diaSemana, base;
  if (ref < salida) {
    desde = await solEnHorizonte(new Date(medianoche.getTime() - DIA), LUGAR_SITIO, "puesta");
    hasta = salida; diaSemana = (diaSemana + 6) % 7; base = 12;
  } else if (ref < puesta) {
    desde = salida; hasta = puesta; base = 0;
  } else {
    desde = puesta; hasta = await solEnHorizonte(puesta, LUGAR_SITIO, "salida"); base = 12;
  }
  const largo = (hasta - desde) / 12;
  const enTramo = Math.min(11, Math.floor((ref - desde) / largo));
  const numero = base + enTramo + 1; // 1..24
  const regenteDia = REGENTE_DIA[diaSemana];
  const regenteHora = CALDEO[(CALDEO.indexOf(regenteDia) + numero - 1) % 7];
  return {
    salida, puesta, regenteDia, regenteHora, numero, deDia: base === 0,
    inicio: new Date(desde.getTime() + enTramo * largo),
    fin: new Date(desde.getTime() + (enTramo + 1) * largo),
  };
}

// --- El cálculo --------------------------------------------------------------------
const OTROS_LUNA = CUERPOS.map((c) => c.clave).filter((c) => c !== "luna");
const ASPECTOS_MAYORES = [0, 60, 90, 120, 180];

async function calcular(ref) {
  const medianoche = medianocheBA(ref);
  const mediodia = new Date(medianoche.getTime() + 12 * 3600000);

  const pos = await posiciones(ref);
  const posMediodia = await posiciones(mediodia);
  const luna = await faseLunar(ref);
  const ingreso = await proximoIngreso("luna", ref, 3);
  // Luna vacía de curso: sin aspectos mayores exactos con el Sol y los planetas
  // hasta Plutón entre ahora y su próximo ingreso (criterio del prototipo).
  const antesDelIngreso = ingreso
    ? await aspectosExactos(ref, ingreso.fecha, { a: ["luna"], b: OTROS_LUNA, angulos: ASPECTOS_MAYORES, paso: 0.25 })
    : [];
  const vacia = antesDelIngreso.length === 0;
  // El radar muestra el próximo aspecto mayor exacto; si está vacía de curso,
  // el primero después del ingreso.
  let radar = antesDelIngreso[0] || null;
  if (!radar) {
    const desde = ingreso ? ingreso.fecha : ref;
    radar = (await aspectosExactos(desde, new Date(desde.getTime() + 3 * DIA),
      { a: ["luna"], b: OTROS_LUNA, angulos: ASPECTOS_MAYORES, paso: 0.25 }))[0] || null;
  }

  const finAgenda = new Date(medianoche.getTime() + DIAS_AGENDA * DIA);
  return {
    referencia: ref,
    medianoche,
    mediodia,
    posiciones: pos,
    retrogrados: pos.filter((p) => p.retro),
    ciclo: pos.filter((p) => ["jupiter", "saturno", "pluton"].includes(p.clave)),
    elementos: elementos(pos),
    modalidades: modalidades(pos),
    barometro: { tension: tension(posMediodia), elementos: elementos(posMediodia), modalidades: modalidades(posMediodia) },
    luna,
    iluminacion: await iluminacionLunar(ref),
    lunaPos: pos.find((p) => p.clave === "luna"),
    ingreso,
    llena: luna.proximas.find((x) => x.tipo === "llena") || null,
    vacia,
    radar,
    horas: await horaPlanetaria(ref, medianoche),
    agenda: { inicio: medianoche, fin: finAgenda, eventos: await eventosAgenda(medianoche, finAgenda) },
  };
}

// La entrada guarda la PROMESA: los que llegan juntos al cambiar de tramo
// esperan el mismo cálculo en vez de lanzar uno cada uno.
let cache = null;

/** Comienzo del tramo de caché que contiene `instante`. */
export function tramo(instante) {
  const ms = Math.max(1, config.cacheCieloMin) * 60000;
  return new Date(Math.floor(instante.getTime() / ms) * ms);
}

/** El cielo de la portada para el tramo de `instante` (por defecto, ahora). */
export async function cieloPortada(instante = ahora()) {
  const ref = tramo(instante);
  if (cache && cache.clave === ref.getTime()) return cache.promesa;
  const promesa = calcular(ref);
  cache = { clave: ref.getTime(), promesa, extra: {} };
  promesa.catch(() => { if (cache && cache.promesa === promesa) cache = null; });
  return promesa;
}

/** Lo que se deriva del mismo tramo (el HTML, el data.js) se guarda junto a él. */
export async function derivado(nombre, instante, fabricar) {
  const datos = await cieloPortada(instante);
  const entrada = cache && cache.clave === datos.referencia.getTime() ? cache : null;
  if (entrada && nombre in entrada.extra) return entrada.extra[nombre];
  const valor = fabricar(datos);
  if (entrada) entrada.extra[nombre] = valor;
  return valor;
}

export function limpiarCache() { cache = null; }

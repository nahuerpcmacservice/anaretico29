// Cálculos derivados del cielo: balance de elementos, modalidades, tensión y
// las lecturas en castellano. El brief (sección 05) dice que el JavaScript del
// mockup ES la especificación, así que esto lo replica al número: hay un test
// que compara contra los valores del mockup (scripts/test-cielo.mjs).
//
// Todo acá es PURO: recibe posiciones y devuelve números. No toca el motor de
// efemérides ni la base. Por eso se puede testear sin server.
import {
  ASPECTOS, ORDEN_ELEMENTOS, ORDEN_MODALIDADES, TRAMOS_TENSION,
} from "./astro-config.js";
import { norm360 } from "./efemerides.js";

/**
 * Reparto PONDERADO, no conteo simple: cada cuerpo aporta su peso al elemento
 * (o modalidad) de su signo.
 *
 * Los porcentajes se redondean con REPARTO EXACTO DE RESTOS: se toma el piso de
 * cada uno y el sobrante se le da a los de mayor parte decimal. Redondear cada
 * uno por su cuenta da sumas de 99 o 101, y un balance que no suma 100 se lee
 * como un error de cálculo aunque no lo sea.
 */
export function reparto(posiciones, campo, orden) {
  const total = posiciones.reduce((a, p) => a + p.peso, 0);
  const crudo = orden.map((clave) => {
    const peso = posiciones.filter((p) => p[campo] === clave).reduce((a, p) => a + p.peso, 0);
    return { clave, peso, exacto: total ? (peso / total) * 100 : 0, pc: 0 };
  });
  crudo.forEach((x) => { x.pc = Math.floor(x.exacto); });
  // Sin cuerpos no hay nada que repartir. Sin este corte, el reparto de restos
  // le da un punto a cada uno y sale un balance inventado sobre una lista vacía.
  if (!total) return crudo;
  let falta = 100 - crudo.reduce((a, x) => a + x.pc, 0);
  crudo.slice()
    .sort((a, b) => (b.exacto % 1) - (a.exacto % 1))
    .forEach((x) => { if (falta > 0) { x.pc++; falta--; } });
  // El sort es ESTABLE: en un empate manda el orden de la lista de entrada, que
  // es el que fija astro-config. Cardinal y mutable empatan seguido y de ese
  // desempate depende qué lectura sale.
  return crudo.sort((a, b) => b.pc - a.pc);
}

export const elementos = (pos) => reparto(pos, "elemento", ORDEN_ELEMENTOS);
export const modalidades = (pos) => reparto(pos, "modalidad", ORDEN_MODALIDADES);

/**
 * Todos los aspectos entre pares de cuerpos, con los orbes de astro-config.
 * Con diez cuerpos son 45 pares.
 */
export function aspectos(posiciones) {
  const out = [];
  for (let i = 0; i < posiciones.length; i++) {
    for (let j = i + 1; j < posiciones.length; j++) {
      let d = norm360(posiciones[i].longitud - posiciones[j].longitud);
      if (d > 180) d = 360 - d;
      const asp = ASPECTOS.find((a) => Math.abs(d - a.angulo) <= a.orbe);
      if (!asp) continue;
      out.push({
        a: posiciones[i], b: posiciones[j], aspecto: asp,
        separacion: d, orbe: Math.abs(d - asp.angulo),
      });
    }
  }
  return out;
}

/**
 * Tensión del cielo: duros sobre el total de duros y blandos. La conjunción
 * queda afuera de la cuenta por neutra — su carácter lo da qué se junta con qué.
 */
export function tension(posiciones) {
  const lista = aspectos(posiciones);
  const duros = lista.filter((x) => x.aspecto.tipo === "duro").length;
  const blandos = lista.filter((x) => x.aspecto.tipo === "blando").length;
  const total = duros + blandos;
  const porcentaje = total ? Math.round((duros / total) * 100) : 0;
  return { duros, blandos, total, porcentaje, aspectos: lista };
}

// --- Lecturas: textos FIJOS indexados por resultado, no texto generado -------
const LEC_ELEMENTO = {
  tierra: "Cielo de <b>tierra</b>: día para ejecutar y ordenar, no para lanzar nada nuevo.",
  fuego:  "Cielo de <b>fuego</b>: empuja a arrancar. Cuidado con comprometerse de más.",
  aire:   "Cielo de <b>aire</b>: día de reuniones, contratos y conversaciones, no de producir.",
  agua:   "Cielo de <b>agua</b>: rinde para negociar y leer al otro, no para decidir solo.",
};
const LEC_MODALIDAD = {
  cardinal: "Predomina <b>cardinal</b>: el cielo pide abrir. Buen momento para poner algo en marcha.",
  fijo:     "Predomina <b>fijo</b>: el cielo pide sostener. Lo que se empuja hoy se traba.",
  mutable:  "Predomina <b>mutable</b>: el cielo pide ajustar. Corregí lo que ya está andando en vez de empezar.",
};

export const lecturaElemento = (rep) => LEC_ELEMENTO[rep[0]?.clave] || "";
export const lecturaModalidad = (rep) => LEC_MODALIDAD[rep[0]?.clave] || "";

export function lecturaTension(pc) {
  if (pc >= TRAMOS_TENSION.trabado) {
    return "Cielo <b>trabado</b>. Esperá para firmar y usá el día para resolver pendientes.";
  }
  if (pc >= TRAMOS_TENSION.normal) {
    return "Tensión <b>normal</b>. Nada empuja ni frena de más: día común de trabajo.";
  }
  return "Cielo <b>fluido</b>. Poca fricción: sirve para avanzar y para cerrar acuerdos.";
}

// Etiquetas de los elementos y las modalidades. La identidad la lleva el
// TEXTO y no el color: ninguna combinación de cuatro colores pasó el control
// de daltonismo, así que las barras van en una sola tonalidad escalonada
// (regla 09 del brief, "nunca información sólo por color").
export const META_ELEMENTO = {
  fuego:  { nombre: "Fuego",  sub: "Impulso"   },
  tierra: { nombre: "Tierra", sub: "Ejecución" },
  aire:   { nombre: "Aire",   sub: "Análisis"  },
  agua:   { nombre: "Agua",   sub: "Vínculo"   },
};
export const META_MODALIDAD = {
  cardinal: { nombre: "Cardinal", sub: "Iniciar"  },
  fijo:     { nombre: "Fijo",     sub: "Sostener" },
  mutable:  { nombre: "Mutable",  sub: "Ajustar"  },
};

/** Compara dos repartos (la carta de alguien contra el cielo del día). */
export function comparar(repartoA, repartoB) {
  const mapa = (r) => Object.fromEntries(r.map((x) => [x.clave, x.pc]));
  const a = mapa(repartoA), b = mapa(repartoB);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .map((clave) => ({ clave, propio: a[clave] ?? 0, hoy: b[clave] ?? 0 }))
    .sort((x, y) => y.propio - x.propio);
}

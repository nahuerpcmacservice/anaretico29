// Cálculos derivados del cielo: balance de elementos, modalidades, tensión y
// las lecturas en castellano. Los criterios (pesos, orbes, porcentajes,
// dominante, tensión) son los de Fernando y viven en criterios.js: acá solo se
// les da la forma que esperan la portada y las vistas.
//
// Todo acá es PURO: recibe posiciones y devuelve números. No toca el motor de
// efemérides ni la base. Por eso se puede testear sin server.
import { TRAMOS_TENSION } from "./astro-config.js";
import {
  balance, aspectos as aspectosCriterio, tension as tensionCriterio, PESOS_BAROMETRO,
} from "./criterios.js";

/**
 * Reparto PONDERADO con los pesos de criterios.js (sin ángulos: 36 puntos):
 * cada cuerpo aporta todo su peso al elemento (o modalidad) de su signo.
 * Porcentajes con Math.round(100 × puntos / total), cada uno por su cuenta:
 * la suma puede dar 99 o 101 (criterio de Fernando).
 *
 * Devuelve los grupos ordenados por puntos ({ clave, puntos, pc, dominante });
 * en empate manda el orden de la lista (fuego, tierra, aire, agua / cardinal,
 * fijo, mutable). La lista lleva además `dominantes` (todas las claves
 * empatadas arriba, comparando puntos y no porcentajes) y `equilibrio` (empatan
 * todos).
 */
export function reparto(posiciones, campo, pesos = PESOS_BAROMETRO) {
  const b = balance(posiciones, campo, pesos);
  const lista = b.grupos.map((g) => ({ ...g, dominante: b.dominantes.includes(g.clave) }));
  return Object.assign(lista, { total: b.total, dominantes: b.dominantes, equilibrio: b.equilibrio });
}

export const elementos = (pos, pesos) => reparto(pos, "elemento", pesos);
export const modalidades = (pos, pesos) => reparto(pos, "modalidad", pesos);

/** Los aspectos mayores entre los diez planetas, con los orbes de criterios.js. */
export const aspectos = (posiciones) => aspectosCriterio(posiciones);

/**
 * Tensión del cielo: tensos (cuadraturas y oposiciones) sobre tensos más
 * fluidos (trígonos y sextiles); la conjunción queda afuera. Sin aspectos que
 * cuenten, `porcentaje` es null (la portada muestra «—»). `duros`/`blandos`
 * son los mismos números con el nombre que usan las vistas viejas.
 */
export function tension(posiciones) {
  const lista = aspectos(posiciones);
  const t = tensionCriterio(lista);
  return { ...t, duros: t.tensos, blandos: t.fluidos, aspectos: lista };
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

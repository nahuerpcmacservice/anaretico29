// Los criterios de cálculo de Anaretico 29 (Fernando, 24/11/2026): "se usan en
// toda la web (portada, carta natal y carta del momento)". UN SOLO LUGAR para
// los pesos, los orbes y las reglas: la portada (cielo.js, cielo-portada.js) y
// la carta los leen de acá.
//
// La tabla de Fernando, punto por punto:
//   - Balance de elementos y modalidades: 50 puntos (PESOS_CARTA). Cada factor
//     aporta todo su peso al elemento y a la modalidad del signo que ocupa.
//     Nodos, Quirón, Descendente, Fondo del Cielo y cualquier otro punto no
//     entran (un factor sin peso en la tabla se ignora).
//   - Barómetro diario (portada): el mismo reparto sin ángulos, 36 puntos
//     (PESOS_BAROMETRO).
//   - Porcentajes: Math.round(100 × puntos del grupo / total).
//   - Dominante: el grupo con más puntos, comparando ANTES de redondear. Empate:
//     se muestran todos los empatados. Empatan todos: «Equilibrio».
//   - Aspectos: conjunción 0° orbe 8°, oposición 180° 8°, cuadratura 90° 6°,
//     trígono 120° 6°, sextil 60° 4°. Límites inclusivos, el mismo orbe para
//     todos los cuerpos (incluida la Luna), sin aspectos menores, solo pares
//     entre los diez planetas.
//   - Aplicativo / separativo: exacto si el orbe es menor a 1″; si el orbe se
//     achica con las velocidades, aplicativo; si crece, separativo.
//   - Tensión: 100 × tensos / (tensos + fluidos), con Math.round y sin ponderar.
//     Tensos: cuadraturas y oposiciones. Fluidos: trígonos y sextiles. Las
//     conjunciones no cuentan. Sin aspectos: «—» (porcentaje null).
//
// Todo acá es PURO: recibe longitudes y devuelve números.

/** Los diez planetas, del Sol a Plutón: los únicos que forman aspectos. */
export const PLANETAS = ["sol", "luna", "mercurio", "venus", "marte", "jupiter", "saturno", "urano", "neptuno", "pluton"];

/** Carta natal y carta del momento: 50 puntos, con Ascendente y Medio Cielo. */
export const PESOS_CARTA = Object.freeze({
  sol: 7, luna: 7, mercurio: 4, venus: 4, marte: 4, jupiter: 3, saturno: 3, urano: 2, neptuno: 1, pluton: 1,
  ascendente: 10, medioCielo: 4,
});
/** Barómetro de la portada: el mismo reparto sin ángulos, 36 puntos. */
export const PESOS_BAROMETRO = Object.freeze(Object.fromEntries(PLANETAS.map((c) => [c, PESOS_CARTA[c]])));

/** Signo → elemento y modalidad (zodíaco tropical, Aries = 0). */
const ELEMENTO_SIGNO = ["fuego", "tierra", "aire", "agua"];
const MODALIDAD_SIGNO = ["cardinal", "fijo", "mutable"];
export const ORDEN_ELEMENTOS = ["fuego", "tierra", "aire", "agua"];
export const ORDEN_MODALIDADES = ["cardinal", "fijo", "mutable"];

const norm360 = (x) => ((x % 360) + 360) % 360;
export const signoDe = (longitud) => Math.floor(norm360(longitud) / 30) % 12;
export const elementoDe = (longitud) => ELEMENTO_SIGNO[signoDe(longitud) % 4];
export const modalidadDe = (longitud) => MODALIDAD_SIGNO[signoDe(longitud) % 3];

/**
 * Los aspectos mayores con su orbe. `tipo`: "duro" = tenso (cuadratura y
 * oposición), "blando" = fluido (trígono y sextil), "neutro" = la conjunción,
 * que no entra en la tensión.
 */
export const ASPECTOS = Object.freeze([
  { clave: "conjuncion", nombre: "conjunción", angulo: 0,   orbe: 8, tipo: "neutro" },
  { clave: "sextil",     nombre: "sextil",     angulo: 60,  orbe: 4, tipo: "blando" },
  { clave: "cuadratura", nombre: "cuadratura", angulo: 90,  orbe: 6, tipo: "duro"   },
  { clave: "trigono",    nombre: "trígono",    angulo: 120, orbe: 6, tipo: "blando" },
  { clave: "oposicion",  nombre: "oposición",  angulo: 180, orbe: 8, tipo: "duro"   },
].map(Object.freeze));

/** Por debajo de este orbe (1″) el aspecto es exacto. */
export const ORBE_EXACTO = 1 / 3600;

/**
 * Reparto de los factores en grupos (elementos o modalidades).
 *
 * `factores`: [{ clave, longitud }]. `campo`: "elemento" | "modalidad".
 * Devuelve { total, grupos, dominantes, equilibrio }:
 *   - grupos: [{ clave, puntos, pc }] ordenados por puntos (en empate, el orden
 *     de la lista: fuego, tierra, aire, agua / cardinal, fijo, mutable);
 *   - dominantes: las claves con más puntos (todas las empatadas), comparando
 *     los puntos, no los porcentajes redondeados;
 *   - equilibrio: true si empatan todos los grupos.
 */
export function balance(factores, campo, pesos = PESOS_BAROMETRO) {
  const orden = campo === "elemento" ? ORDEN_ELEMENTOS : ORDEN_MODALIDADES;
  const de = campo === "elemento" ? elementoDe : modalidadDe;
  const puntos = Object.fromEntries(orden.map((k) => [k, 0]));
  let total = 0;
  for (const f of factores) {
    const peso = pesos[f.clave];
    if (!peso) continue; // nodos, Quirón, Descendente, Fondo del Cielo…: no entran
    puntos[de(f.longitud)] += peso;
    total += peso;
  }
  const grupos = orden
    .map((clave) => ({ clave, puntos: puntos[clave], pc: total ? Math.round((100 * puntos[clave]) / total) : 0 }))
    .sort((a, b) => b.puntos - a.puntos); // sort estable: en empate manda el orden de la lista
  const max = total ? grupos[0].puntos : null;
  const dominantes = total ? grupos.filter((g) => g.puntos === max).map((g) => g.clave) : [];
  return { total, grupos, dominantes, equilibrio: total > 0 && dominantes.length === orden.length };
}

/** Separación angular entre dos longitudes, de 0 a 180. */
export const separacion = (a, b) => { const d = norm360(a - b); return d > 180 ? 360 - d : d; };

/** El aspecto mayor que forman dos longitudes (límite inclusivo), o null. */
export function aspectoEntre(lonA, lonB) {
  const d = separacion(lonA, lonB);
  for (const a of ASPECTOS) {
    const orbe = Math.abs(d - a.angulo);
    if (orbe <= a.orbe) return { aspecto: a, separacion: d, orbe };
  }
  return null;
}

/**
 * Aplicativo, separativo o exacto, según cómo cambia el orbe con las
 * velocidades (grados por día): se mira el orbe un instante después.
 */
export function aplicacion(a, b, aspecto) {
  const orbe = (lonA, lonB) => Math.abs(separacion(lonA, lonB) - aspecto.angulo);
  const ahora = orbe(a.longitud, b.longitud);
  if (ahora < ORBE_EXACTO) return "exacto";
  const dt = 1 / 1440; // un minuto
  const luego = orbe(a.longitud + (a.velocidad || 0) * dt, b.longitud + (b.velocidad || 0) * dt);
  return luego < ahora ? "aplicativo" : "separativo";
}

/**
 * Todos los aspectos entre pares de los diez planetas. Lo que no es planeta
 * (Ascendente, Medio Cielo, nodos, Quirón) se ignora.
 */
export function aspectos(posiciones) {
  const planetas = posiciones.filter((p) => PLANETAS.includes(p.clave));
  const out = [];
  for (let i = 0; i < planetas.length; i++) {
    for (let j = i + 1; j < planetas.length; j++) {
      const x = aspectoEntre(planetas[i].longitud, planetas[j].longitud);
      if (x) out.push({ a: planetas[i], b: planetas[j], ...x });
    }
  }
  return out;
}

/** Tensión: { tensos, fluidos, porcentaje } — porcentaje null sin aspectos («—»). */
export function tension(lista) {
  const tensos = lista.filter((x) => x.aspecto.tipo === "duro").length;
  const fluidos = lista.filter((x) => x.aspecto.tipo === "blando").length;
  const total = tensos + fluidos;
  return { tensos, fluidos, total, porcentaje: total ? Math.round((100 * tensos) / total) : null };
}

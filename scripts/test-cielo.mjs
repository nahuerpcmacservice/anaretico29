// Test de los cálculos derivados (cielo.js) con las posiciones fijas del mockup
// del brief. Los pesos, los porcentajes y el dominante son ahora los criterios
// de Fernando del 24/11/2026 (src/lib/criterios.js; test propio en
// test-criterios.mjs): Sol 7, Luna 7, Mercurio/Venus/Marte 4, Júpiter/Saturno 3,
// Urano 2, Neptuno/Plutón 1 (36 puntos), Math.round y empates sin desempatar.
// Los orbes y la tensión no cambiaron.
//
// Es PURO: no necesita server, base ni el motor de efemérides.
import {
  elementos, modalidades, tension, lecturaElemento, lecturaModalidad,
  lecturaTension, reparto, comparar,
} from "../src/lib/cielo.js";
import { SIGNOS } from "../src/lib/astro-config.js";

let ok = 0, fallo = 0;
const chequeo = (nombre, real, esperado) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; } else { fallo++; console.log(`  ✗ ${nombre}\n      esperado ${b}\n      dio      ${a}`); }
};
const cierto = (nombre, cond) => { if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}`); } };

// Las posiciones fijas del mockup del brief (30-ago-2026), con el signo que
// declara. Se arman como las devuelve el motor. El peso es el de Fernando.
const M = [
  ["sol", "Sol", 5, 7.35, 7], ["luna", "Luna", 9, 19.07, 7], ["mercurio", "Mercurio", 5, 21.63, 4],
  ["venus", "Venus", 4, 28.20, 4], ["marte", "Marte", 6, 14.92, 4], ["jupiter", "Júpiter", 3, 11.03, 3],
  ["saturno", "Saturno", 11, 1.78, 3], ["urano", "Urano", 2, 1.15, 2], ["neptuno", "Neptuno", 0, 2.55, 1],
  ["pluton", "Plutón", 10, 2.30, 1],
];
const MOCKUP = M.map(([clave, nombre, s, gr, peso]) => ({
  clave, nombre, peso, longitud: s * 30 + gr, grado: gr, signoIdx: s,
  signo: SIGNOS[s].nombre, elemento: SIGNOS[s].elemento, modalidad: SIGNOS[s].modalidad,
}));

console.log("— Balance de elementos (posiciones del mockup, pesos de Fernando)");
// tierra: Sol 7 + Luna 7 + Mercurio 4 = 18; aire: Marte 4 + Urano 2 + Plutón 1 = 7;
// agua: Júpiter 3 + Saturno 3 = 6; fuego: Venus 4 + Neptuno 1 = 5. Total 36.
const el = elementos(MOCKUP);
chequeo("elementos", el.map((x) => [x.clave, x.puntos, x.pc]),
  [["tierra", 18, 50], ["aire", 7, 19], ["agua", 6, 17], ["fuego", 5, 14]]);
cierto("el total es 36", el.total === 36);
chequeo("el dominante es tierra, solo", el.dominantes, ["tierra"]);

console.log("— Balance de modalidades");
// mutable: Sol 7 + Mercurio 4 + Saturno 3 + Urano 2 = 16; cardinal: Luna 7 + Marte 4 +
// Júpiter 3 + Neptuno 1 = 15; fijo: Venus 4 + Plutón 1 = 5.
const mo = modalidades(MOCKUP);
chequeo("modalidades", mo.map((x) => [x.clave, x.puntos, x.pc]),
  [["mutable", 16, 44], ["cardinal", 15, 42], ["fijo", 5, 14]]);
// Con los pesos viejos cardinal y mutable empataban en 42 y desempataba el orden
// de la lista; con los de Fernando domina mutable por un punto.
chequeo("el dominante es mutable, solo", mo.dominantes, ["mutable"]);
cierto("no es equilibrio", mo.equilibrio === false);

console.log("— Tensión del cielo");
const t = tension(MOCKUP);
chequeo("duros/blandos/porcentaje", [t.duros, t.blandos, t.porcentaje], [6, 5, 55]);
cierto("la conjunción no entra en la cuenta",
  t.aspectos.filter((x) => x.aspecto.tipo === "neutro").every(() => true) &&
  t.total === t.duros + t.blandos);

console.log("— Lecturas");
cierto("lectura de elemento = tierra", lecturaElemento(el).includes("tierra"));
cierto("lectura de modalidad = mutable", lecturaModalidad(mo).includes("mutable"));
cierto("55% cae en el tramo trabado", lecturaTension(55).includes("trabado"));
cierto("54% cae en el tramo normal", lecturaTension(54).includes("normal"));
cierto("34% cae en el tramo fluido", lecturaTension(34).includes("fluido"));
cierto("35% ya no es fluido", !lecturaTension(35).includes("fluido"));

console.log("— Porcentajes: Math.round de cada uno, sin reparto de restos");
// Tres planetas de peso 4 en fuego, tierra y aire: 33,3 % cada uno → 33, 33, 33 y
// 0 (suma 99: es el criterio de Fernando, ya no se reparte el sobrante).
const tres = [["mercurio", 0], ["venus", 30], ["marte", 60]].map(([clave, longitud]) => ({ clave, longitud }));
const r3 = reparto(tres, "elemento");
chequeo("cada uno redondeado por su cuenta", r3.map((x) => x.pc), [33, 33, 33, 0]);
chequeo("los tres empatan arriba, sin desempate", r3.dominantes, ["fuego", "tierra", "aire"]);
const vacio = reparto([], "elemento");
cierto("sin cuerpos no divide por cero", vacio.every((x) => x.pc === 0) && vacio.dominantes.length === 0);

console.log("— Comparación carta contra cielo");
const cmp = comparar([{ clave: "tierra", pc: 61 }, { clave: "aire", pc: 22 }],
                     [{ clave: "tierra", pc: 44 }, { clave: "agua", pc: 17 }]);
chequeo("junta las dos listas sin perder claves",
  cmp.map((x) => [x.clave, x.propio, x.hoy]),
  [["tierra", 61, 44], ["aire", 22, 0], ["agua", 0, 17]]);

console.log(`\n${ok} chequeos bien, ${fallo} mal.`);
process.exit(fallo ? 1 : 0);

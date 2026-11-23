// Test de los cálculos derivados. El brief (sección 10, "Cómo se aprueba") dice
// que el motor se aprueba contra los mismos porcentajes de elementos y
// modalidades que el mockup con los mismos datos de entrada. Esto es eso.
//
// Es PURO: no necesita server, base ni el motor de efemérides.
import {
  elementos, modalidades, tension, lecturaElemento, lecturaModalidad,
  lecturaTension, reparto, comparar,
} from "../src/lib/cielo.js";
import { SIGNOS, ORDEN_ELEMENTOS } from "../src/lib/astro-config.js";

let ok = 0, fallo = 0;
const chequeo = (nombre, real, esperado) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) { ok++; } else { fallo++; console.log(`  ✗ ${nombre}\n      esperado ${b}\n      dio      ${a}`); }
};
const cierto = (nombre, cond) => { if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}`); } };

// Las posiciones fijas del mockup del brief (30-ago-2026), con el signo y el
// peso que declara. Se arman como las devuelve el motor.
const M = [
  ["Sol", 5, 7.35, 3], ["Luna", 9, 19.07, 3], ["Mercurio", 5, 21.63, 2],
  ["Venus", 4, 28.20, 2], ["Marte", 6, 14.92, 2], ["Júpiter", 3, 11.03, 1.5],
  ["Saturno", 11, 1.78, 1.5], ["Urano", 2, 1.15, 1], ["Neptuno", 0, 2.55, 1],
  ["Plutón", 10, 2.30, 1],
];
const MOCKUP = M.map(([nombre, s, gr, peso]) => ({
  nombre, peso, longitud: s * 30 + gr, grado: gr, signoIdx: s,
  signo: SIGNOS[s].nombre, elemento: SIGNOS[s].elemento, modalidad: SIGNOS[s].modalidad,
}));

console.log("— Balance de elementos (contra el mockup del brief)");
const el = elementos(MOCKUP);
chequeo("elementos", el.map((x) => [x.clave, x.pc]),
  [["tierra", 44], ["aire", 22], ["fuego", 17], ["agua", 17]]);
cierto("los elementos suman 100", el.reduce((a, x) => a + x.pc, 0) === 100);
cierto("el dominante es tierra", el[0].clave === "tierra");

console.log("— Balance de modalidades");
const mo = modalidades(MOCKUP);
chequeo("modalidades", mo.map((x) => [x.clave, x.pc]),
  [["cardinal", 42], ["mutable", 42], ["fijo", 16]]);
cierto("las modalidades suman 100", mo.reduce((a, x) => a + x.pc, 0) === 100);
// Cardinal y mutable empatan en 42: el desempate lo tiene que resolver el orden
// de ORDEN_MODALIDADES, no el azar del sort. De eso depende qué lectura sale.
cierto("en el empate 42-42 gana cardinal por orden de lista", mo[0].clave === "cardinal");

console.log("— Tensión del cielo");
const t = tension(MOCKUP);
chequeo("duros/blandos/porcentaje", [t.duros, t.blandos, t.porcentaje], [6, 5, 55]);
cierto("la conjunción no entra en la cuenta",
  t.aspectos.filter((x) => x.aspecto.tipo === "neutro").every(() => true) &&
  t.total === t.duros + t.blandos);

console.log("— Lecturas");
cierto("lectura de elemento = tierra", lecturaElemento(el).includes("tierra"));
cierto("lectura de modalidad = cardinal", lecturaModalidad(mo).includes("cardinal"));
cierto("55% cae en el tramo trabado", lecturaTension(55).includes("trabado"));
cierto("54% cae en el tramo normal", lecturaTension(54).includes("normal"));
cierto("34% cae en el tramo fluido", lecturaTension(34).includes("fluido"));
cierto("35% ya no es fluido", !lecturaTension(35).includes("fluido"));

console.log("— Reparto de restos");
// Tres cuerpos de peso igual: 33,33% cada uno. Sin reparto de restos daría 99.
const tres = ["fuego", "tierra", "aire"].map((elemento, i) => ({
  nombre: `p${i}`, peso: 1, elemento, modalidad: "cardinal",
}));
const r3 = reparto(tres, "elemento", ORDEN_ELEMENTOS);
cierto("tres tercios suman 100 igual", r3.reduce((a, x) => a + x.pc, 0) === 100);
chequeo("y el sobrante va a uno solo", r3.map((x) => x.pc).sort((a, b) => b - a), [34, 33, 33, 0]);
const vacio = reparto([], "elemento", ORDEN_ELEMENTOS);
cierto("sin cuerpos no divide por cero", vacio.every((x) => x.pc === 0));

console.log("— Comparación carta contra cielo");
const cmp = comparar([{ clave: "tierra", pc: 61 }, { clave: "aire", pc: 22 }],
                     [{ clave: "tierra", pc: 44 }, { clave: "agua", pc: 17 }]);
chequeo("junta las dos listas sin perder claves",
  cmp.map((x) => [x.clave, x.propio, x.hoy]),
  [["tierra", 61, 44], ["aire", 22, 0], ["agua", 0, 17]]);

console.log(`\n${ok} chequeos bien, ${fallo} mal.`);
process.exit(fallo ? 1 : 0);

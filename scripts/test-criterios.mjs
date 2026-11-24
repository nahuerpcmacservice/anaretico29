// Test de los criterios de cálculo de Fernando (S13): el módulo compartido
// (src/lib/criterios.js) y la portada servida con un reloj fijo.
//
// La parte 2 NO usa el módulo bajo prueba para armar lo esperado: toma las
// longitudes crudas del motor (efemerides.js) y hace las cuentas acá, con la
// tabla de Fernando escrita de nuevo. Si las dos implementaciones dicen lo
// mismo, el HTML de la portada tiene que traer esos números.
//
// Sin red; SQLite descartable en un temporal.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "criterios-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");
process.env.UPLOADS_DIR = path.join(tmp, "subidas");
process.env.CACHE_CIELO_MIN = "60";

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};
const igual = (nombre, real, esperado) => {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  cierto(nombre, a === b, `dio ${a}, esperaba ${b}`);
};

let http = null;
try {
  const C = await import("../src/lib/criterios.js");

  console.log("— 1. La tabla de Fernando en el módulo compartido");
  igual("pesos de la carta (50 puntos)", C.PESOS_CARTA, {
    sol: 7, luna: 7, mercurio: 4, venus: 4, marte: 4, jupiter: 3, saturno: 3, urano: 2, neptuno: 1, pluton: 1, ascendente: 10, medioCielo: 4,
  });
  igual("la carta suma 50", Object.values(C.PESOS_CARTA).reduce((a, b) => a + b, 0), 50);
  igual("barómetro: los diez planetas, sin ángulos", Object.keys(C.PESOS_BAROMETRO), C.PLANETAS);
  igual("el barómetro suma 36", Object.values(C.PESOS_BAROMETRO).reduce((a, b) => a + b, 0), 36);
  igual("orbes", C.ASPECTOS.map((a) => [a.clave, a.angulo, a.orbe]),
    [["conjuncion", 0, 8], ["sextil", 60, 4], ["cuadratura", 90, 6], ["trigono", 120, 6], ["oposicion", 180, 8]]);

  const f = (clave, longitud, velocidad = 0) => ({ clave, longitud, velocidad });
  // Aries 0°, Tauro 30°, Géminis 60°, Cáncer 90°, Leo 120°…
  console.log("— Balance: reparto, porcentajes y dominante");
  {
    const b = C.balance([f("sol", 5), f("luna", 35), f("mercurio", 65), f("venus", 95), f("marte", 125),
      f("jupiter", 0), f("saturno", 0), f("urano", 0), f("neptuno", 0), f("pluton", 0)], "elemento");
    // fuego: Sol 7 + Marte 4 + Júpiter 3 + Saturno 3 + Urano 2 + Neptuno 1 + Plutón 1 = 21; tierra 7; aire 4; agua 4
    igual("cada factor da todo su peso al elemento de su signo", b.grupos.map((g) => [g.clave, g.puntos]),
      [["fuego", 21], ["tierra", 7], ["aire", 4], ["agua", 4]]);
    igual("porcentajes con Math.round(100 × puntos / total)", b.grupos.map((g) => g.pc), [58, 19, 11, 11]);
    igual("total 36", b.total, 36);
    igual("un solo dominante", b.dominantes, ["fuego"]);
    cierto("no es equilibrio", b.equilibrio === false);
  }
  {
    const b = C.balance([f("sol", 5), f("luna", 35)], "elemento");
    igual("empate: se muestran todos los empatados", b.dominantes, ["fuego", "tierra"]);
    igual("y valen lo mismo", b.grupos.slice(0, 2).map((g) => g.pc), [50, 50]);
    cierto("dos de cuatro no es equilibrio", b.equilibrio === false);
  }
  {
    // 7 / 7 / 4+3 / 4+3: los cuatro elementos en 7
    const b = C.balance([f("sol", 5), f("luna", 35), f("mercurio", 65), f("saturno", 70), f("venus", 95), f("jupiter", 100)], "elemento");
    cierto("empatan los cuatro elementos: «Equilibrio»", b.equilibrio === true, JSON.stringify(b));
    igual("los cuatro dominantes", b.dominantes, ["fuego", "tierra", "aire", "agua"]);
    igual("25 % cada uno", b.grupos.map((g) => g.pc), [25, 25, 25, 25]);
  }
  {
    // cardinal (Aries) 7, fijo (Tauro) 7, mutable (Géminis) 4 + 3
    const b = C.balance([f("sol", 5), f("luna", 35), f("mercurio", 65), f("jupiter", 70)], "modalidad");
    cierto("empatan las tres modalidades: «Equilibrio»", b.equilibrio === true, JSON.stringify(b));
    igual("33 % cada una", b.grupos.map((g) => g.pc), [33, 33, 33]);
  }
  {
    // 1001 contra 1000 redondea a 50 y 50: el dominante se compara ANTES de redondear
    const b = C.balance([f("x", 5), f("y", 35)], "elemento", { x: 1000, y: 1001 });
    igual("redondeados empatan", b.grupos.slice(0, 2).map((g) => g.pc), [50, 50]);
    igual("pero domina el de más puntos", b.dominantes, ["tierra"]);
  }
  {
    const b = C.balance([f("sol", 5), f("nodoNorte", 35), f("quiron", 35), f("descendente", 35), f("fondoCielo", 35)], "elemento");
    igual("nodos, Quirón, Descendente y Fondo del Cielo no entran", [b.total, b.dominantes], [7, ["fuego"]]);
    const carta = C.balance([f("sol", 5), f("ascendente", 35), f("medioCielo", 65)], "elemento", C.PESOS_CARTA);
    igual("en la carta, Ascendente 10 y Medio Cielo 4", carta.grupos.map((g) => [g.clave, g.puntos]), [["tierra", 10], ["fuego", 7], ["aire", 4], ["agua", 0]]);
    const baro = C.balance([f("sol", 5), f("ascendente", 35), f("medioCielo", 65)], "elemento");
    igual("en el barómetro, los ángulos no entran", baro.total, 7);
    const vacio = C.balance([], "elemento");
    cierto("sin factores: sin dominante y sin dividir por cero", vacio.total === 0 && vacio.dominantes.length === 0 && vacio.grupos.every((g) => g.pc === 0) && !vacio.equilibrio);
  }

  console.log("— Aspectos y orbes (límites inclusivos, mismo orbe para la Luna)");
  {
    const par = (a, b) => C.aspectoEntre(a, b)?.aspecto.clave ?? null;
    igual("conjunción a 8° justos", par(0, 8), "conjuncion");
    igual("conjunción a 8,01°: nada", par(0, 8.01), null);
    igual("sextil a 64°", par(0, 64), "sextil");
    igual("sextil a 64,01°: nada", par(0, 64.01), null);
    igual("cuadratura a 96°", par(0, 96), "cuadratura");
    igual("cuadratura a 96,01°: nada", par(0, 96.01), null);
    igual("trígono a 126°", par(0, 126), "trigono");
    igual("trígono a 126,01°: nada", par(0, 126.01), null);
    igual("oposición a 172°", par(0, 172), "oposicion");
    igual("oposición a 171,99°: nada", par(0, 171.99), null);
    igual("pasando por 0° Aries", par(358, 4), "conjuncion");
    const conLuna = C.aspectos([f("luna", 0), f("sol", 96.5)]);
    igual("la Luna no tiene orbe propio (96,5° no es cuadratura)", conLuna.length, 0);
    const soloPlanetas = C.aspectos([f("sol", 0), f("ascendente", 1), f("medioCielo", 90), f("nodoNorte", 2), f("quiron", 180), f("luna", 90)]);
    igual("solo pares entre los diez planetas", soloPlanetas.map((x) => [x.a.clave, x.b.clave, x.aspecto.clave]), [["sol", "luna", "cuadratura"]]);
  }
  {
    const asp = C.ASPECTOS.find((a) => a.clave === "conjuncion");
    igual("el orbe se achica: aplicativo", C.aplicacion(f("sol", 0, 1), f("venus", 5, 0), asp), "aplicativo");
    igual("el orbe crece: separativo", C.aplicacion(f("sol", 5, 1), f("venus", 0, 0), asp), "separativo");
    igual("orbe menor a 1″: exacto", C.aplicacion(f("sol", 10, 1), f("venus", 10 + 0.5 / 3600, 0), asp), "exacto");
    const op = C.ASPECTOS.find((a) => a.clave === "oposicion");
    igual("oposición que se completa: aplicativo", C.aplicacion(f("luna", 0, 13), f("marte", 185, 0.5), op), "aplicativo");
  }

  console.log("— Tensión");
  {
    const t = (posiciones) => C.tension(C.aspectos(posiciones)).porcentaje;
    igual("sin aspectos: null («—»)", t([f("sol", 0), f("luna", 45)]), null);
    igual("solo una conjunción: null (no cuenta)", t([f("sol", 0), f("luna", 3)]), null);
    igual("una cuadratura y un trígono: 50", t([f("sol", 0), f("luna", 90), f("marte", 210)]), 50);
    // Sol□Luna, Sol☍Marte, Luna□Marte, Sol△Venus, Marte⚹Venus: 3 tensos, 2 fluidos → 60
    igual("tensos sobre tensos más fluidos", t([f("sol", 0), f("luna", 90), f("marte", 180), f("venus", 120)]), 60);
    // Sol□Luna, Marte□Venus y Sol△Júpiter (el resto, fuera de orbe): 2 tensos y 1 fluido → 66,7 → 67
    igual("2 tensos y 1 fluido: 67 (Math.round)", t([f("sol", 0), f("luna", 90), f("marte", 200), f("venus", 290), f("jupiter", 120)]), 67);
    const r = C.tension(C.aspectos([f("sol", 0), f("luna", 60), f("marte", 120), f("venus", 90)]));
    // Sol⚹Luna, Sol△Marte, Luna⚹Marte, Sol□Venus, Luna: 30° de Venus (nada), Marte: 30° de Venus (nada) → 1 tenso, 3 fluidos → 25
    igual("1 tenso y 3 fluidos: 25", [r.tensos, r.fluidos, r.porcentaje], [1, 3, 25]);
  }

  console.log("— Cómo lo muestra el barómetro (empates, «Equilibrio», «—»)");
  {
    const { elementos, modalidades, tension } = await import("../src/lib/cielo.js");
    const { barometroTextos } = await import("../src/lib/portada.js");
    const textos = (pos) => barometroTextos({ elementos: elementos(pos), modalidades: modalidades(pos), tension: tension(pos) });
    const empate = textos([f("sol", 5), f("luna", 35)]); // Aries / Tauro: fuego y tierra; cardinal y fijo
    igual("empate de elementos: los dos nombres", [empate.baroElemento, empate.baroElementoNombre], ["50", "Fuego · Tierra"]);
    igual("empate de modalidades: las dos", empate.baroModalidadNombre, "Cardinal · Fija");
    igual("la frase nombra a los empatados", empate.baroResumen, "Predominio de fuego y tierra; énfasis en iniciar y sostener.");
    igual("sin aspectos, la tensión es «—» y la barra va vacía", [empate.baroTension, empate.baroTensionAncho], ["—", "0"]);
    const todos = textos([f("sol", 5), f("luna", 35), f("mercurio", 65), f("saturno", 70), f("venus", 95), f("jupiter", 100)]);
    igual("empatan los cuatro: «Equilibrio»", [todos.baroElemento, todos.baroElementoNombre], ["25", "Equilibrio"]);
    const tres = textos([f("sol", 5), f("luna", 35), f("mercurio", 65), f("jupiter", 70)]);
    igual("empatan las tres modalidades: «Equilibrio»", [tres.baroModalidad, tres.baroModalidadNombre], ["33", "Equilibrio"]);
    igual("y la frase lo dice", tres.baroResumen, "Predominio de fuego, tierra y aire; equilibrio de modalidades.");
    const conTension = textos([f("sol", 0), f("luna", 90), f("marte", 210)]);
    igual("con aspectos, el número lleva su %", [conTension.baroTension, conTension.baroTensionAncho], ["50<small>%</small>", "50"]);
  }

  console.log("— 2. La portada servida, contra la cuenta hecha a mano (23/11/2026, tramo de las 15:00)");
  {
    const { posiciones } = await import("../src/lib/efemerides.js");
    // La tabla de Fernando, escrita de nuevo (no se importa nada del módulo bajo prueba)
    const PESO = { sol: 7, luna: 7, mercurio: 4, venus: 4, marte: 4, jupiter: 3, saturno: 3, urano: 2, neptuno: 1, pluton: 1 };
    const ELEM = ["fuego", "tierra", "aire", "agua"], MODA = ["cardinal", "fijo", "mutable"];
    const NOMBRE = { fuego: "Fuego", tierra: "Tierra", aire: "Aire", agua: "Agua", cardinal: "Cardinal", fijo: "Fija", mutable: "Mutable" };
    const ORBE = [[0, 8, null], [60, 4, "f"], [90, 6, "t"], [120, 6, "f"], [180, 8, "t"]];
    const cuenta = (pos) => {
      const signo = (lon) => Math.floor((((lon % 360) + 360) % 360) / 30);
      const grupo = (lista, de) => {
        const pts = Object.fromEntries(lista.map((k) => [k, 0]));
        for (const p of pos) pts[de(signo(p.longitud))] += PESO[p.clave];
        const filas = lista.map((k) => [k, Math.round((100 * pts[k]) / 36), pts[k]]).sort((a, b) => b[2] - a[2]);
        const max = filas[0][2], dom = filas.filter((x) => x[2] === max).map((x) => x[0]);
        return { filas, nombre: dom.length === lista.length ? "Equilibrio" : dom.map((k) => NOMBRE[k]).join(" · "), pc: filas[0][1] };
      };
      let t = 0, fl = 0;
      for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) {
        let d = Math.abs(pos[i].longitud - pos[j].longitud) % 360; if (d > 180) d = 360 - d;
        const hit = ORBE.find(([ang, orbe]) => Math.abs(d - ang) <= orbe);
        if (hit?.[2] === "t") t++; else if (hit?.[2] === "f") fl++;
      }
      return {
        elementos: grupo(ELEM, (s) => ELEM[s % 4]), modalidades: grupo(MODA, (s) => MODA[s % 3]),
        tension: t + fl ? Math.round((100 * t) / (t + fl)) : null, tensos: t, fluidos: fl,
      };
    };
    const mediodia = await posiciones(new Date("2026-11-23T15:00:00Z")); // barómetro: 12:00 de Buenos Aires
    const tramo = await posiciones(new Date("2026-11-23T18:00:00Z"));    // balances: el instante de referencia (15:00)
    igual("son los diez planetas", mediodia.map((p) => p.clave), Object.keys(PESO));
    const B = cuenta(mediodia), T = cuenta(tramo);
    console.log(`    a mano: tensión ${B.tension} (${B.tensos} tensos / ${B.fluidos} fluidos), ${B.elementos.pc} ${B.elementos.nombre}, ${B.modalidades.pc} ${B.modalidades.nombre}`);
    // Lo mismo, fijado a mano con los signos del 23/11 (Sol Sagitario, Luna Tauro, Mercurio Escorpio, Venus Libra,
    // Marte y Júpiter Leo, Saturno y Neptuno Aries, Urano Géminis, Plutón Acuario): fuego 18/36, fijo 19/36.
    igual("fijado: barómetro", [B.tension, B.elementos.pc, B.elementos.nombre, B.modalidades.pc, B.modalidades.nombre], [45, 50, "Fuego", 53, "Fija"]);
    igual("fijado: balance de elementos", T.elementos.filas.map((x) => [x[0], x[1]]), [["fuego", 50], ["tierra", 19], ["aire", 19], ["agua", 11]]);
    igual("fijado: modalidades", T.modalidades.filas.map((x) => [x[0], x[1]]), [["fijo", 53], ["mutable", 25], ["cardinal", 22]]);

    const express = (await import("express")).default;
    const { initDb } = await import("../src/db.js");
    initDb();
    const { default: app } = await import("../src/app.js");
    const { setEnDesarrollo } = await import("../src/lib/portero.js");
    const { fijarReloj } = await import("../src/lib/cielo-portada.js");
    const server = express();
    server.use(app);
    http = server.listen(0, "127.0.0.1");
    await once(http, "listening");
    fijarReloj(() => new Date("2026-11-23T18:47:12Z"));
    setEnDesarrollo(false);
    const html = await (await fetch(`http://127.0.0.1:${http.address().port}/`)).text();
    const lectura = (nombre, valor, ancho) => `<strong>${valor}</strong><b>${nombre}</b><div class="mini-track"><i style="width:${ancho}%"></i></div>`;
    cierto(`barómetro: tensión ${B.tension} %`, html.includes(lectura("Tensión", `${B.tension}<small>%</small>`, B.tension)));
    cierto(`barómetro: ${B.elementos.pc} % ${B.elementos.nombre}`, html.includes(lectura(B.elementos.nombre, `${B.elementos.pc}<small>%</small>`, B.elementos.pc)));
    cierto(`barómetro: ${B.modalidades.pc} % ${B.modalidades.nombre}`, html.includes(lectura(B.modalidades.nombre, `${B.modalidades.pc}<small>%</small>`, B.modalidades.pc)));
    const filas = (titulo) => {
      const i = html.indexOf(`<h3>${titulo}</h3>`);
      const bloque = html.slice(i, html.indexOf("</article>", i));
      return [...bloque.matchAll(/<div class="bar-row"><div><strong>([^<]+)<\/strong>[\s\S]*?aria-valuenow="(\d+)"[\s\S]*?<span class="bar-number">(\d+)%<\/span><\/div>/g)].map((m) => [m[1], +m[2], +m[3]]);
    };
    igual("«Balance de elementos» en el orden y con los números a mano", filas("Balance de elementos"), T.elementos.filas.map((x) => [NOMBRE[x[0]], x[1], x[1]]));
    igual("«Modalidades» en el orden y con los números a mano", filas("Modalidades"), T.modalidades.filas.map((x) => [NOMBRE[x[0]], x[1], x[1]]));
    cierto("«El enfoque» sigue diciendo «balance ponderado de 50 puntos»",
      (await (await fetch(`http://127.0.0.1:${http.address().port}/app.js`)).text()).includes("balance ponderado de 50 puntos"));
    fijarReloj(null);
  }
} catch (e) {
  fallo++;
  console.log("  ✗ el test se cortó:", e.stack || e);
} finally {
  if (http) http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

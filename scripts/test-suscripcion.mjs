// Test de "la web no junta ningún dato de los visitantes" (S5, S9): reemplaza
// al de la suscripción mensual, que se sacó (Fernando, 24/11/2026: "Newsletter
// apagado por ahora, en «Próximamente». Sacá la suscripción que guarda mails").
//
// Levanta el router en 127.0.0.1 con un puerto libre (no sale a internet) y una
// base descartable en un temporal: nunca toca data/anaretico.db. Lo guardado se
// mira por donde lo mira Fernando: el CSV y la lista del panel (Newsletter).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { refsHtml, fetchsJs, esExterna } from "./web-refs.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sin-datos-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");
process.env.UPLOADS_DIR = path.join(tmp, "subidas");
process.env.ADMIN_PASSWORD = "clave-de-prueba";

const { initDb } = await import("../src/db.js");
initDb();
const express = (await import("express")).default;
const { default: app } = await import("../src/app.js");
const { setEnDesarrollo } = await import("../src/lib/portero.js");
const { crearSesion } = await import("../src/lib/sesion.js");

const server = express();
server.set("trust proxy", true); // como server.js
server.use(app);
const http = server.listen(0, "127.0.0.1");
await once(http, "listening");
const BASE = `http://127.0.0.1:${http.address().port}`;

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};

const galleta = `anaretico_panel=${crearSesion("127.0.0.1")}`;
async function pedir(ruta, { metodo = "GET", sesion = false, cuerpo = null, json = false, ip = "198.51.100.9" } = {}) {
  const headers = { "x-forwarded-for": ip };
  if (sesion) headers.cookie = galleta;
  if (json) headers.accept = "application/json";
  const r = await fetch(BASE + ruta, { method: metodo, redirect: "manual", headers, body: cuerpo ? new URLSearchParams(cuerpo) : undefined });
  return { codigo: r.status, donde: r.headers.get("location"), texto: await r.text() };
}
/** Las filas del CSV del panel (sin la cabecera). */
const filas = async () => (await pedir("/panel/suscriptores.csv", { sesion: true })).texto.replace(/^﻿/, "").split("\n").slice(1).filter(Boolean);

const PAGINAS = ["/", "/sobre-mi", "/proximamente?p=boletin"];
// Lo que prometía o pedía un mail en las páginas publicadas
const PROMESA = /tu mail|por mail|a tu mail|tu e-?mail|copia de la carta|el cielo del mes en tu/i;

try {
  setEnDesarrollo(false);

  console.log("— Las páginas no piden ningún dato");
  const servidas = {};
  for (const r of PAGINAS) {
    const x = await pedir(r);
    servidas[r] = x.texto;
    cierto(`${r} da 200`, x.codigo === 200, `${x.codigo}`);
    cierto(`${r}: ningún campo de mail`, !/type="email"|name="email"/.test(x.texto));
    cierto(`${r}: ninguna casilla de consentimiento ni campo señuelo`, !/consentimiento|name="web"|bo-oculto/.test(x.texto));
    cierto(`${r}: ningún enlace a /privacidad ni a /suscripcion`, !/\/privacidad|\/suscripcion/.test(x.texto));
    cierto(`${r}: nada promete un mail`, !PROMESA.test(x.texto), (PROMESA.exec(x.texto) || [])[0]);
  }
  const inicio = servidas["/"];
  cierto("la franja de canales sigue, sin el formulario del cielo del mes",
    inicio.includes('<section class="channels" id="canales"') && !inicio.includes('class="boletin"') && !inicio.includes("Suscribirme"));
  cierto("los canales del prototipo siguen", ["YouTube", "Spotify", "Instagram", "LinkedIn", "Facebook", "X"].every((n) => inicio.includes(`<strong>${n}</strong>`)));

  console.log("— Los scripts y los datos que cargan tampoco");
  const scripts = new Set(), datos = new Set();
  for (const r of PAGINAS) for (const s of refsHtml(servidas[r]).scripts) if (!esExterna(s)) scripts.add(s);
  for (const s of scripts) {
    const js = (await pedir(s)).texto;
    for (const f of fetchsJs(js)) datos.add(new URL(f, BASE + "/").pathname);
    cierto(`${s.split("?")[0]}: no manda nada a /suscripcion ni enlaza /privacidad`, !/\/suscripcion|\/privacidad|fetch\(f\.action/.test(js));
  }
  const portada = (await pedir([...scripts].find((s) => s.startsWith("/portada.js")))).texto;
  cierto("portada.js ya no tiene la suscripción", !/boletin|email|consentimiento|Suscripci/.test(portada));
  for (const d of datos) {
    const t = (await pedir(d)).texto;
    cierto(`${d}: no nombra /privacidad ni /suscripcion`, !/\/privacidad|\/suscripcion/.test(t));
  }
  const vis = JSON.parse((await pedir("/datos/visibilidad.json")).texto);
  const parte = (pag, id) => vis.paginas.find((p) => p.id === pag).partes.find((x) => x.id === id);
  cierto("visibilidad.json: «Recibí el cielo del mes en tu mail» apagada (Próximamente)", parte("inicio", "boletin").visible === false);
  cierto("visibilidad.json: «También te la enviamos por mail» de la carta, apagada", parte("carta", "mail-carta").visible === false);
  cierto("visibilidad.json: la franja de canales sigue encendida", parte("inicio", "canales").visible !== false);

  console.log("— POST /suscripcion ya no existe y no guarda nada");
  {
    const antes = (await filas()).length;
    cierto("la base de prueba arranca sin filas", antes === 0, `${antes}`);
    const campos = { email: "ana@ejemplo.com", consentimiento: "si", pagina: "/", web: "" };
    const conJs = await pedir("/suscripcion", { metodo: "POST", json: true, cuerpo: campos });
    cierto("con JS: 404", conJs.codigo === 404, `${conJs.codigo}`);
    const sinJs = await pedir("/suscripcion", { metodo: "POST", cuerpo: campos });
    cierto("sin JS: 404, sin vuelta a #canales", sinJs.codigo === 404 && !sinJs.donde, `${sinJs.codigo} ${sinJs.donde}`);
    // Sin freno por IP: veinte intentos seguidos desde la misma IP dan lo mismo (no hay contador)
    const codigos = [];
    for (let i = 0; i < 20; i++) codigos.push((await pedir("/suscripcion", { metodo: "POST", json: true, cuerpo: { email: `r${i}@ejemplo.com`, consentimiento: "si" }, ip: "203.0.113.7" })).codigo);
    cierto("sin freno: los 20 intentos dan 404 (ningún 429)", codigos.every((c) => c === 404), codigos.join(","));
    cierto("y no se guardó nada", (await filas()).length === 0);
    const nl = await pedir("/newsletter", { metodo: "POST", cuerpo: { email: "viejo@ejemplo.com" } });
    cierto("POST /newsletter vuelve a #canales sin guardar", nl.codigo === 303 && nl.donde === "/#canales" && (await filas()).length === 0, `${nl.codigo} ${nl.donde}`);
    cierto("el aviso de la vieja suscripción ya no se pinta", !(await pedir("/?suscripcion=ok")).texto.includes("Gracias por sumarte"));
  }

  console.log("— /privacidad se retiró");
  for (const r of ["/privacidad", "/privacidad/"]) {
    const x = await pedir(r);
    cierto(`${r} → 404`, x.codigo === 404, `${x.codigo} ${x.donde || ""}`);
    cierto(`${r} no muestra el lugar provisorio`, !x.texto.includes("A COMPLETAR"));
  }
  cierto("con sesión del panel también 404", (await pedir("/privacidad", { sesion: true })).codigo === 404);

  console.log("— El panel sigue entero (Newsletter vacío)");
  {
    const p = await pedir("/panel/suscriptores", { sesion: true });
    cierto("Newsletter responde 200", p.codigo === 200 && p.texto.includes("<h1>Newsletter</h1>"), `${p.codigo}`);
    cierto("sin filas", !p.texto.includes("@ejemplo.com"));
  }

  console.log("— Portero cerrado");
  setEnDesarrollo(true);
  {
    const r = await pedir("/suscripcion", { metodo: "POST", json: true, cuerpo: { email: "anonimo@ejemplo.com" } });
    cierto("el anónimo recibe el 503 del cartel", r.codigo === 503, `${r.codigo}`);
    cierto("y nada se guarda", (await filas()).length === 0);
  }
} catch (e) {
  fallo++;
  console.log("  ✗ el test se cortó:", e.stack || e);
} finally {
  http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

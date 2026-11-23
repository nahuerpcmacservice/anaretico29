// Test de la suscripción al cielo del mes (franja de canales) y de /privacidad.
//
// Levanta el router en 127.0.0.1 con un puerto libre (no sale a internet) y una
// base descartable en un temporal: nunca toca data/anaretico.db. Lo guardado se
// mira por donde lo mira Fernando: el CSV y la lista del panel (Newsletter).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suscripcion-"));
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
server.set("trust proxy", true); // como server.js: la IP sale de X-Forwarded-For
server.use(app);
const http = server.listen(0, "127.0.0.1");
await once(http, "listening");
const BASE = `http://127.0.0.1:${http.address().port}`;

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};

const galleta = `anaretico_panel=${crearSesion("127.0.0.1")}`;
let ipN = 0;
const ipNueva = () => `198.51.100.${++ipN}`;

async function pedir(ruta, { metodo = "GET", sesion = false, cuerpo = null, json = false, ip = ipNueva(), crudo = null } = {}) {
  const headers = { "x-forwarded-for": ip };
  if (sesion) headers.cookie = galleta;
  if (json) headers.accept = "application/json";
  let body;
  if (crudo !== null) { body = crudo; headers["content-type"] = "application/x-www-form-urlencoded"; }
  else if (cuerpo) body = new URLSearchParams(cuerpo);
  const r = await fetch(BASE + ruta, { method: metodo, redirect: "manual", headers, body });
  const texto = await r.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { /* no es JSON */ }
  return { codigo: r.status, donde: r.headers.get("location"), tipo: r.headers.get("content-type") || "", robots: r.headers.get("x-robots-tag"), texto, datos };
}

const suscribir = (campos, op = {}) => pedir("/suscripcion", { metodo: "POST", cuerpo: campos, json: true, ...op });

/** Las filas del CSV del panel (sin la cabecera). */
async function filas() {
  const r = await pedir("/panel/suscriptores.csv", { sesion: true });
  const lineas = r.texto.replace(/^﻿/, "").split("\n");
  return { cabecera: lineas[0], filas: lineas.slice(1).filter(Boolean) };
}
const cuantas = async () => (await filas()).filas.length;

const CONSENTIMIENTO = "Acepto recibir el mail mensual y la política de privacidad.";
const MSJ = {
  ok: "Gracias por sumarte: tu mail quedó anotado para el cielo del mes.",
  vacio: "Escribí tu mail.",
  mail: "Revisá el mail: parece incompleto.",
  consentimiento: "Para anotarte, marcá la casilla de consentimiento.",
  espera: "Hiciste muchos intentos seguidos. Probá de nuevo en unos minutos.",
};

try {
  setEnDesarrollo(false);

  console.log("— El formulario de la portada");
  {
    const r = await pedir("/");
    const form = (/<form class="boletin"[\s\S]*?<\/form>/.exec(r.texto) || [""])[0];
    cierto("la portada tiene el formulario", form.length > 0);
    cierto("postea a /suscripcion", /<form class="boletin" action="\/suscripcion" method="post" novalidate aria-labelledby="bo-titulo">/.test(form), form.slice(0, 120));
    const casilla = (/<input [^>]*type="checkbox"[^>]*>/.exec(form) || [""])[0];
    cierto("tiene la casilla de consentimiento", casilla.includes('name="consentimiento"') && casilla.includes("required"), casilla);
    cierto("la casilla NO viene tildada", casilla.length > 0 && !/\bchecked\b/.test(casilla), casilla);
    const etiqueta = (/<label class="bo-text bo-consentimiento">([\s\S]*?)<\/label>/.exec(form) || ["", ""])[1];
    cierto("el texto de la casilla es el acordado", etiqueta.replace(/<[^>]+>/g, "").trim() === CONSENTIMIENTO, etiqueta);
    cierto("enlaza a la política de privacidad", etiqueta.includes('<a href="/privacidad">política de privacidad</a>'), etiqueta);
    cierto("tiene el campo señuelo, oculto y fuera del tabulador",
      /<div class="bo-oculto" aria-hidden="true"><label for="bo-web">[^<]+<\/label><input id="bo-web" type="text" name="web" tabindex="-1" autocomplete="off"><\/div>/.test(form));
    cierto("dice desde qué página se anota", form.includes('<input type="hidden" name="pagina" value="/">'));
    cierto("conserva el campo del mail del prototipo",
      form.includes('<input id="bo-mail" type="email" name="email" placeholder="nombre@correo.com" required autocomplete="email" inputmode="email" aria-describedby="bo-err">'));
    cierto("conserva el botón y la zona de aviso", form.includes('<button type="submit" class="hc-btn primary">Suscribirme</button>') && form.includes('<span class="bo-err" id="bo-err" role="alert"></span>'));
    const js = (await pedir((/<script src="(\/portada\.js\?v=[^"]+)"/.exec(r.texto) || ["", "/portada.js"])[1])).texto;
    cierto("portada.js manda el formulario al servidor", js.includes("fetch(f.action") && js.includes("application/json"));
    cierto("portada.js ya no dice que es una vista previa", !js.includes("vista previa") && !js.includes("no se guardó"));
    cierto("portada.js pide la casilla antes de mandar", js.includes(MSJ.consentimiento));
    cierto("portada.js conserva la validación del prototipo", js.includes(String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)`));
  }

  console.log("— Alta válida");
  {
    const antes = await cuantas();
    const r = await suscribir({ email: "  Ana.Perez@Ejemplo.COM ", consentimiento: "si", pagina: "/", web: "" });
    cierto("200 y ok", r.codigo === 200 && r.datos?.ok === true, `${r.codigo} ${r.texto.slice(0, 100)}`);
    cierto("con el mensaje de éxito", r.datos?.mensaje === MSJ.ok, r.datos?.mensaje);
    const { cabecera, filas: f } = await filas();
    cierto("quedó UNA fila más", f.length === antes + 1, `${antes} → ${f.length}`);
    cierto("el CSV lleva consentimiento, versión y página", cabecera === "email,origen,alta,baja,consentimiento,version_consentimiento,pagina", cabecera);
    const fila = f.find((x) => x.includes("ana.perez@ejemplo.com")) || "";
    cierto("el mail se guarda normalizado (minúsculas, sin espacios)", fila.startsWith('"ana.perez@ejemplo.com","canales"'), fila);
    cierto("con la fecha del consentimiento", /"\d{4}-\d\d-\d\dT[^"]+","2026-11-23","\/"$/.test(fila), fila);
    const panel = await pedir("/panel/suscriptores", { sesion: true });
    cierto("la sección Newsletter del panel la lista", panel.codigo === 200 && panel.texto.includes("ana.perez@ejemplo.com"));
    cierto("y muestra el consentimiento", panel.texto.includes("<th>Consentimiento</th>") && panel.texto.includes("2026-11-23"));
    cierto("el panel no muestra ninguna IP", !panel.texto.includes("198.51.100."));
  }

  console.log("— Duplicado: misma respuesta, una sola fila");
  {
    const antes = await cuantas();
    const primero = await suscribir({ email: "dupli@ejemplo.com", consentimiento: "si" });
    const segundo = await suscribir({ email: "DUPLI@ejemplo.com", consentimiento: "si" });
    cierto("las dos respuestas son idénticas", primero.codigo === 200 && segundo.codigo === primero.codigo && primero.texto === segundo.texto, `${primero.texto} / ${segundo.texto}`);
    const f = (await filas()).filas;
    cierto("una sola fila", f.length === antes + 1 && f.filter((x) => x.startsWith('"dupli@ejemplo.com"')).length === 1);
  }

  console.log("— Sin consentimiento: rechazo y nada guardado");
  for (const consentimiento of [undefined, "", "no", "off"]) {
    const antes = await cuantas();
    const campos = { email: `sin-ok-${consentimiento ?? "falta"}@ejemplo.com` };
    if (consentimiento !== undefined) campos.consentimiento = consentimiento;
    const r = await suscribir(campos);
    cierto(`consentimiento=${JSON.stringify(consentimiento)} → 400`, r.codigo === 400 && r.datos?.ok === false && r.datos?.campo === "consentimiento", `${r.codigo} ${r.texto}`);
    cierto(`  con el mensaje de la casilla`, r.datos?.mensaje === MSJ.consentimiento, r.datos?.mensaje);
    cierto(`  el contador no cambia`, (await cuantas()) === antes);
  }

  console.log("— Mail inválido: rechazo y nada guardado");
  const largo = "a".repeat(250) + "@ej.com"; // 257 > 254
  for (const [email, mensaje] of [["", MSJ.vacio], ["   ", MSJ.vacio], ["ana@", MSJ.mail], ["ana@ejemplo", MSJ.mail],
    ["ana ejemplo@x.com", MSJ.mail], ["ana@@ejemplo.com", MSJ.mail], ["ana..b@ejemplo.com", MSJ.mail], ["ana@ejemplo.c", MSJ.mail],
    [largo, MSJ.mail], ["<script>@x.com", MSJ.mail]]) {
    const antes = await cuantas();
    const r = await suscribir({ email, consentimiento: "si" });
    cierto(`${JSON.stringify(email.slice(0, 30))} → 400`, r.codigo === 400 && r.datos?.ok === false && r.datos?.campo === "email", `${r.codigo} ${r.texto}`);
    cierto(`  mensaje «${mensaje}»`, r.datos?.mensaje === mensaje, r.datos?.mensaje);
    cierto(`  nada guardado`, (await cuantas()) === antes);
  }

  console.log("— Campo señuelo lleno: parece éxito, no se guarda");
  {
    const antes = await cuantas();
    const r = await suscribir({ email: "bot@ejemplo.com", consentimiento: "si", web: "http://spam.example" });
    cierto("contesta lo mismo que un alta", r.codigo === 200 && r.datos?.ok === true && r.datos?.mensaje === MSJ.ok, r.texto);
    cierto("no se guarda", (await cuantas()) === antes && !(await filas()).filas.some((x) => x.includes("bot@ejemplo.com")));
  }

  console.log("— Página de origen: solo las del sitio");
  {
    const r = await suscribir({ email: "origen@ejemplo.com", consentimiento: "si", pagina: "https://otro.example/x" });
    const fila = (await filas()).filas.find((x) => x.includes("origen@ejemplo.com")) || "";
    cierto("una página ajena se guarda como /", r.codigo === 200 && fila.endsWith('"/"'), fila);
    const s = await suscribir({ email: "desde-sobre@ejemplo.com", consentimiento: "si", pagina: "/sobre-mi" });
    const fila2 = (await filas()).filas.find((x) => x.includes("desde-sobre@ejemplo.com")) || "";
    cierto("/sobre-mi se respeta", s.codigo === 200 && fila2.endsWith('"/sobre-mi"'), fila2);
  }

  console.log("— Límite de tamaño");
  {
    const antes = await cuantas();
    const r = await pedir("/suscripcion", { metodo: "POST", json: true, crudo: `email=grande%40ejemplo.com&consentimiento=si&web=${"x".repeat(4096)}` });
    cierto("un cuerpo de más de 2 KB → 413", r.codigo === 413 && r.datos?.ok === false, `${r.codigo} ${r.texto.slice(0, 80)}`);
    cierto("nada guardado", (await cuantas()) === antes);
  }

  console.log("— Sin JavaScript: POST y vuelta a #canales");
  {
    const antes = await cuantas();
    const r = await pedir("/suscripcion", { metodo: "POST", cuerpo: { email: "sinjs@ejemplo.com", consentimiento: "si", pagina: "/" } });
    cierto("303 a /?suscripcion=ok#canales", r.codigo === 303 && r.donde === "/?suscripcion=ok#canales", `${r.codigo} ${r.donde}`);
    cierto("y se guardó", (await cuantas()) === antes + 1);
    const sin = await pedir("/suscripcion", { metodo: "POST", cuerpo: { email: "sinjs2@ejemplo.com", pagina: "/" } });
    cierto("sin casilla: 303 a /?suscripcion=consentimiento#canales", sin.codigo === 303 && sin.donde === "/?suscripcion=consentimiento#canales", `${sin.codigo} ${sin.donde}`);
    const mal = await pedir("/suscripcion", { metodo: "POST", cuerpo: { email: "nada", consentimiento: "si", pagina: "/sobre-mi" } });
    cierto("mail inválido: 303 a la página de origen con el aviso", mal.codigo === 303 && mal.donde === "/sobre-mi?suscripcion=mail#canales", `${mal.codigo} ${mal.donde}`);
    cierto("y no se guardó nada más", (await cuantas()) === antes + 1);
    const aviso = (texto) => (/<span class="bo-err" id="bo-err" role="alert">([^<]*)<\/span>/.exec(texto) || [])[1];
    cierto("la portada muestra el aviso de éxito", aviso((await pedir("/?suscripcion=ok")).texto) === MSJ.ok);
    cierto("y el de la casilla", aviso((await pedir("/?suscripcion=consentimiento")).texto) === MSJ.consentimiento);
    cierto("un código desconocido no muestra nada (no se refleja)", aviso((await pedir("/?suscripcion=%3Cscript%3E")).texto) === "");
    cierto("sin código, la zona de aviso queda vacía", aviso((await pedir("/")).texto) === "");
  }

  console.log("— Límite por IP");
  {
    const ip = "203.0.113.7";
    const antes = await cuantas();
    const codigos = [];
    for (let i = 0; i < 8; i++) codigos.push((await suscribir({ email: `rafaga${i}@ejemplo.com`, consentimiento: "si" }, { ip })).codigo);
    cierto("los primeros 8 pasan", codigos.every((c) => c === 200), codigos.join(","));
    const r = await suscribir({ email: "rafaga-extra@ejemplo.com", consentimiento: "si" }, { ip });
    cierto("el 9.º → 429", r.codigo === 429 && r.datos?.ok === false && r.datos?.mensaje === MSJ.espera, `${r.codigo} ${r.texto}`);
    cierto("y no se guarda", (await cuantas()) === antes + 8);
    const sinjs = await pedir("/suscripcion", { metodo: "POST", ip, cuerpo: { email: "rafaga-sinjs@ejemplo.com", consentimiento: "si" } });
    cierto("sin JS: 303 con el aviso de espera", sinjs.codigo === 303 && sinjs.donde === "/?suscripcion=espera#canales", `${sinjs.codigo} ${sinjs.donde}`);
    const otra = await suscribir({ email: "otra-ip@ejemplo.com", consentimiento: "si" });
    cierto("otra IP sigue pasando", otra.codigo === 200);
  }

  console.log("— /privacidad");
  {
    const r = await pedir("/privacidad");
    cierto("200 HTML", r.codigo === 200 && r.tipo.includes("text/html"), `${r.codigo}`);
    cierto("noindex en la página", r.texto.includes('<meta name="robots" content="noindex,nofollow">'));
    cierto("noindex en la cabecera", r.robots === "noindex, nofollow", r.robots);
    cierto("título propio", r.texto.includes("<title>Anaretico 29 · Política de privacidad</title>"));
    cierto("dice que la política está en preparación", r.texto.includes("Estamos preparando la política de privacidad de Anaretico 29."));
    for (const marca of ["[RESPONSABLE: A COMPLETAR]", "[DOMICILIO: A COMPLETAR]", "[CONTACTO: A COMPLETAR]"]) {
      cierto(`lleva el lugar para ${marca}`, r.texto.includes(marca));
    }
    const sobreMi = (await pedir("/sobre-mi")).texto;
    const header = (t) => (/<header>[\s\S]*?<\/header>/.exec(t) || [""])[0];
    const footer = (t) => (/<footer>[\s\S]*?<\/footer>/.exec(t) || [""])[0];
    cierto("mismo encabezado que Sobre mí", header(r.texto).length > 0 && header(r.texto) === header(sobreMi));
    cierto("mismo pie que Sobre mí (texto legal intacto)", footer(r.texto).length > 0 && footer(r.texto) === footer(sobreMi));
    cierto("no trae el contenido de Sobre mí", !r.texto.includes("Mi recorrido en 5 puntos"));
    cierto("/privacidad/ → 301 a /privacidad", (await pedir("/privacidad/")).donde === "/privacidad");
  }

  console.log("— Portero cerrado");
  setEnDesarrollo(true);
  {
    const antes = await cuantas();
    const r = await suscribir({ email: "anonimo@ejemplo.com", consentimiento: "si" });
    cierto("el anónimo recibe 503", r.codigo === 503, `${r.codigo}`);
    cierto("y no se guarda", (await cuantas()) === antes);
    const sinjs = await pedir("/suscripcion", { metodo: "POST", cuerpo: { email: "anonimo2@ejemplo.com", consentimiento: "si" } });
    cierto("sin JS también 503", sinjs.codigo === 503 && (await cuantas()) === antes, `${sinjs.codigo}`);
    cierto("/privacidad anónimo → 503", (await pedir("/privacidad")).codigo === 503);
    const p = await pedir("/privacidad", { sesion: true });
    cierto("/privacidad con sesión del panel → 200", p.codigo === 200 && p.texto.includes("[RESPONSABLE: A COMPLETAR]"), `${p.codigo}`);
    const s = await suscribir({ email: "fernando@ejemplo.com", consentimiento: "si" }, { sesion: true });
    cierto("con sesión del panel, la suscripción funciona (para probarla)", s.codigo === 200 && (await cuantas()) === antes + 1, `${s.codigo}`);
  }

  console.log("— Lo de antes sigue igual");
  {
    setEnDesarrollo(false);
    const x = await pedir("/newsletter", { metodo: "POST", cuerpo: { email: "viejo@ejemplo.com" } });
    cierto("POST /newsletter sigue sin anotar a nadie y vuelve a #canales", x.codigo === 303 && x.donde === "/#canales" && !(await filas()).filas.some((f) => f.includes("viejo@ejemplo.com")));
  }
} finally {
  http.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

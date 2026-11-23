// Test del portero: quién pasa y quién ve el cartel de "En desarrollo".
//
// La base se arma en un temporal descartable: nunca toca data/anaretico.db.
// No necesita server ni red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "portero-"));
process.env.DB_PATH = path.join(tmp, "prueba.db");

const { initDb } = await import("../src/db.js");
initDb();
const { portero, esLibre, enDesarrollo, setEnDesarrollo, sesionActual } =
  await import("../src/lib/portero.js");
const { crearSesion } = await import("../src/lib/sesion.js");

let ok = 0, fallo = 0;
const cierto = (nombre, cond, extra = "") => {
  if (cond) ok++; else { fallo++; console.log(`  ✗ ${nombre}${extra ? " — " + extra : ""}`); }
};

/** Un par req/res de mentira, lo justo para lo que mira el portero. */
function pedido(ruta, { cookie = null } = {}) {
  const req = { path: ruta, originalUrl: ruta, headers: cookie ? { cookie } : {} };
  const res = {
    codigo: 200, cuerpo: null, tipo: null, cabeceras: {},
    status(c) { this.codigo = c; return this; },
    set(k, v) { this.cabeceras[String(k).toLowerCase()] = v; return this; },
    type(t) { this.tipo = t; return this; },
    send(c) { this.cuerpo = c; return this; },
  };
  let paso = false, sesionVista;
  portero(req, res, () => { paso = true; sesionVista = sesionActual(); });
  return { req, res, paso, sesionVista };
}

console.log("— Rutas libres (el corte va en el límite de segmento)");
for (const r of ["/panel", "/panel/notas", "/panel", "/panel/entrar", "/salud", "/estatico/f.css"]) {
  cierto(`pasa ${r}`, esLibre(r));
}
for (const r of ["/", "/carta-natal", "/revista/algo", "/subidas/foto.jpg", "/panel-publico", "/estaticos", "/saludos"]) {
  cierto(`NO pasa ${r}`, !esLibre(r));
}
// El de abajo es el que importa: con un startsWith pelado, una ruta futura que
// empiece igual heredaría el permiso y quedaría abierta sin que nadie lo note.
cierto("/panelcito no hereda el permiso", !esLibre("/panelcito"));

console.log("— Arranca CERRADO");
cierto("sin nada guardado, el sitio está en desarrollo", enDesarrollo() === true);

console.log("— Visitante anónimo, sitio cerrado");
{
  const { res, paso } = pedido("/");
  cierto("no llega al sitio", !paso);
  cierto("contesta 503 y no 200", res.codigo === 503, `dio ${res.codigo}`);
  cierto("pide que vuelvan", res.cabeceras["retry-after"] === "86400");
  cierto("no se cachea", String(res.cabeceras["cache-control"]).includes("no-store"));
  cierto("dice que está en desarrollo", /En desarrollo/i.test(res.cuerpo));
  cierto("le pide al buscador que no lo indexe", /noindex/.test(res.cuerpo));
  // Que el cartel NO traiga el sitio adentro: si se filtrara el menú, se estaría
  // publicando la estructura de lo que todavía no se muestra.
  cierto("no filtra el menú del sitio", !/Membres|Herramientas|Revista/.test(res.cuerpo));
}
{
  const { res, paso } = pedido("/carta-natal");
  cierto("tampoco entra a la carta natal", !paso && res.codigo === 503);
}
{
  const { res, paso } = pedido("/subidas/foto.jpg");
  cierto("tampoco sirve las imágenes subidas", !paso && res.codigo === 503);
}
{
  const { res } = pedido("/robots.txt");
  cierto("robots.txt cierra la puerta a los buscadores", /Disallow: \//.test(res.cuerpo));
}
for (const r of ["/panel/entrar", "/salud", "/estatico/fuentes/fuentes.css"]) {
  cierto(`${r} pasa igual con el portero cerrado`, pedido(r).paso);
}

console.log("— Con sesión abierta, sitio cerrado");
{
  const token = crearSesion("127.0.0.1");
  const galleta = `otra=1; anaretico_panel=${token}`;
  const { paso, sesionVista } = pedido("/", { cookie: galleta });
  cierto("ve el sitio entero", paso);
  // Sin esto la barra de administrador no sale en ninguna página y no hay forma
  // de darse cuenta de que lo que uno ve no lo ve el público.
  cierto("la sesión llega a las vistas", !!sesionVista && sesionVista.token === token);
  cierto("un token inventado no abre nada",
    !pedido("/", { cookie: "anaretico_panel=nada" }).paso);
  cierto("sin sesión no hay sesión en las vistas", pedido("/panel/entrar").sesionVista == null);
}

console.log("— Sitio abierto");
setEnDesarrollo(false);
cierto("el interruptor quedó guardado", enDesarrollo() === false);
cierto("el anónimo ve el sitio", pedido("/").paso);
cierto("y también la carta natal", pedido("/carta-natal").paso);
setEnDesarrollo(true);
cierto("y se puede volver a cerrar", enDesarrollo() === true && !pedido("/").paso);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${fallo ? "✗" : "✓"} ${ok} bien, ${fallo} mal`);
process.exit(fallo ? 1 : 0);

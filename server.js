// Entrypoint del sitio de Anaretico 29. Corre detrás de un proxy inverso
// que termina el TLS.
import "./src/config.js"; // fija la zona horaria antes que nada
import express from "express";
import { config } from "./src/config.js";
import { initDb } from "./src/db.js";
import { iniciarMotor } from "./src/lib/efemerides.js";
import app from "./src/app.js";

const server = express();
server.disable("x-powered-by");
server.set("trust proxy", true); // detrás del proxy, la IP real viene en el header

// El sitio viejo redirigía la raíz a www con un 301 y hay links dando vueltas
// con esa forma. Se respeta para no partir el posicionamiento en dos hosts.
server.use((req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if (config.hostCanonico && host && host !== config.hostCanonico && host.endsWith("anaretico29.com")) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    return res.redirect(301, `${proto}://${config.hostCanonico}${req.url}`);
  }
  next();
});

server.get("/salud", (req, res) => res.json({ ok: true, ts: Date.now() }));
server.use(app);

initDb();
// Se precalienta el motor al arrancar: el WASM y los archivos de efemérides
// tardan lo suyo en cargar y no tiene por qué esperarlos el primer visitante.
await iniciarMotor();

server.listen(config.puerto, config.bind, () => {
  console.log(`anaretico29 escuchando en http://${config.bind}:${config.puerto} (${config.entorno})`);
});

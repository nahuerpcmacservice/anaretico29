// La API de la carta (la pantalla /carta la pide con fetch; src/lib/carta.js
// hace la cuenta).
//
//   POST /api/carta          { fecha, hora, lugar } en JSON → la carta natal
//   GET  /api/carta/momento  → la carta del momento (Buenos Aires, ahora)
//
// Por qué POST y los datos después del # en la página (S9, la web no junta
// datos de los visitantes): la fecha, la hora y el lugar de nacimiento NO
// viajan en ninguna dirección que llegue al servidor. La página es /carta#…
// (el navegador nunca manda lo que va después del #) y la cuenta se pide por
// POST con los datos en el cuerpo, así que no quedan en los registros de
// acceso de los proxies intermedios, que guardan la dirección pero no el cuerpo.
// Recargar, imprimir y el límite del navegador siguen andando porque los
// datos quedan en la dirección de la pestaña.
//
// Nada se guarda: ni base, ni archivo, ni registro. La respuesta natal sale con
// no-store. Lo único en memoria es el freno de robots: una huella con sal (la
// sal se sortea al arrancar y no se guarda en ningún lado) y un contador que
// vence solo; la IP no se guarda nunca.
import express from "express";
import crypto from "node:crypto";
import { calcularNatal, calcularMomento, ErrorCarta } from "../lib/carta.js";

const router = express.Router();

// --- Freno de robots, en memoria -------------------------------------------------
const FRENO = { max: 30, ventanaMs: 10 * 60 * 1000 };
const SAL = crypto.randomBytes(32);
let conteos = new Map(); // huella → { n, desde }
let reglas = { ...FRENO };

const huella = (ip) => crypto.createHmac("sha256", SAL).update(String(ip || "")).digest("hex");

export const frenoRobots = {
  /** Para los tests: otro tope y otra ventana (null vuelve a los de fábrica). Vacía los contadores. */
  configurar(r) { reglas = { ...FRENO, ...(r || {}) }; conteos = new Map(); },
  /** Las claves que hay en memoria (huellas, nunca IPs). */
  claves: () => [...conteos.keys()],
  /** ¿Pasa este pedido? Suma uno a la cuenta de su huella. */
  pasa(ip, ahora = Date.now()) {
    for (const [k, v] of conteos) if (ahora - v.desde >= reglas.ventanaMs) conteos.delete(k);
    const k = huella(ip);
    const c = conteos.get(k) || { n: 0, desde: ahora };
    c.n++;
    conteos.set(k, c);
    return c.n <= reglas.max;
  },
};

const sinGuardar = (res) => res.set({ "cache-control": "no-store", "referrer-policy": "no-referrer" });

router.post("/api/carta", express.json({ limit: "2kb" }), (req, res, next) => {
  sinGuardar(res);
  if (!req.is("application/json")) return res.status(415).json({ campo: "", mensaje: "La carta se pide desde la página." });
  if (!frenoRobots.pasa(req.ip)) {
    return res.status(429).json({ campo: "", mensaje: "Demasiados pedidos seguidos. Probá de nuevo en unos minutos." });
  }
  const b = req.body && typeof req.body === "object" ? req.body : {};
  calcularNatal({ fecha: b.fecha, hora: b.hora, lugar: b.lugar }).then(
    (carta) => res.json(carta),
    (err) => {
      if (err instanceof ErrorCarta) return res.status(400).json({ campo: err.campo, mensaje: err.message });
      // Un error del motor: al registro va solo lo técnico, sin los datos de nacimiento
      console.error("[carta] no se pudo calcular:", err && err.name, err && err.message);
      res.status(500).json({ campo: "", mensaje: "No pudimos calcular la carta. Probá de nuevo en un rato." });
    },
  ).catch(next);
});

// Un JSON roto (o demasiado grande) no llega a la cuenta y no se registra
router.use("/api/carta", (err, req, res, next) => {
  if (err && (err.type === "entity.parse.failed" || err.type === "entity.too.large")) {
    return sinGuardar(res).status(400).json({ campo: "", mensaje: "No pudimos leer los datos. Volvé al formulario y probá de nuevo." });
  }
  next(err);
});

// La del momento es la misma para todos durante el minuto: se puede cachear
// hasta que termine ese minuto (nunca más de 60 segundos)
router.get("/api/carta/momento", (req, res, next) => {
  calcularMomento().then((carta) => {
    const resta = Math.max(1, 60 - Math.floor((Date.now() - Date.parse(carta.meta.utc_instant)) / 1000));
    res.set("cache-control", `public, max-age=${Math.min(60, resta)}`).json(carta);
  }, next);
});

export default router;

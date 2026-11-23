// POST /suscripcion — el alta al cielo del mes desde la franja de canales.
//
// Mejora progresiva: sin JS el formulario postea y vuelve con 303 a la página
// de origen (#canales) con un código de aviso; con JS, portada.js manda el
// mismo POST con `Accept: application/json` y muestra el aviso del prototipo.
//
// Va DESPUÉS del portero (app.js): con el sitio cerrado, el anónimo recibe el
// 503 del cartel y no se anota nada. Y va ANTES del urlencoded general de
// app.js, para que valga el límite de tamaño propio de acá.
import express from "express";
import { anotarSuscripcion } from "../db.js";
import {
  AVISOS, ORIGEN, CONSENTIMIENTO_VERSION, validarEmail, consintio, paginaDe, frenar,
} from "../lib/suscripcion.js";

const router = express.Router();

// El formulario son cuatro campos cortos: 2 KB sobra.
const leerCuerpo = express.urlencoded({ extended: false, limit: "2kb", parameterLimit: 10 });

const ESTADO = { ok: 200, vacio: 400, mail: 400, consentimiento: 400, espera: 429, grande: 413, error: 400 };
const CAMPO = { vacio: "email", mail: "email", consentimiento: "consentimiento" };

function responder(req, res, codigo) {
  const quiereJson = (req.get("accept") || "").includes("application/json");
  if (!quiereJson) {
    // Sin JS: vuelta a la franja. Solo viaja el CÓDIGO: el texto lo pone el servidor.
    const aviso = codigo === "grande" ? "error" : codigo;
    return res.redirect(303, `${paginaDe(req.body?.pagina)}?suscripcion=${aviso}#canales`);
  }
  res.set("cache-control", "no-store");
  const cuerpo = codigo === "ok" ? { ok: true, mensaje: AVISOS.ok }
    : { ok: false, ...(CAMPO[codigo] ? { campo: CAMPO[codigo] } : {}), mensaje: AVISOS[codigo] || AVISOS.error };
  return res.status(ESTADO[codigo] || 400).json(cuerpo);
}

router.post("/suscripcion", (req, res, next) => {
  // El freno va antes de leer nada: cuenta todos los intentos, buenos o malos.
  if (frenar(req.ip)) return responder(req, res, "espera");
  leerCuerpo(req, res, (err) => {
    if (err) return responder(req, res, err.type === "entity.too.large" || err.status === 413 ? "grande" : "error");
    try {
      const b = req.body || {};
      // Campo señuelo lleno: un robot. Se le contesta como a un alta para que no aprenda nada.
      if (typeof b.web === "string" && b.web.trim() !== "") return responder(req, res, "ok");
      const { email, error } = validarEmail(b.email);
      if (error) return responder(req, res, error);
      if (!consintio(b.consentimiento)) return responder(req, res, "consentimiento");
      // Repetido: misma respuesta que un alta nueva, una sola fila (no se revela quién estaba)
      anotarSuscripcion({
        email, origen: ORIGEN, pagina: paginaDe(b.pagina),
        consentimientoAt: Date.now(), consentimientoVersion: CONSENTIMIENTO_VERSION,
      });
      return responder(req, res, "ok");
    } catch (e) { return next(e); }
  });
});

export default router;

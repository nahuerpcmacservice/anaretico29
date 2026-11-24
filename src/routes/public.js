// Rutas públicas de la primera versión del sitio (portada, /carta-natal, /cielo)
// y el autocompletado de ciudades.
//
// La portada ahora es la web nueva (routes/web.js). Las otras dos ya no
// muestran las vistas viejas: van a lo que las reemplaza en la web nueva, con
// 302 como siempre. /carta-natal va al formulario de la portada: la carta
// natal se calcula desde ahí (los datos viajan después del #, ver
// routes/carta.js), así que los de la dirección vieja no se usan.
import express from "express";
import { buscarCiudades } from "../lib/geo.js";

const router = express.Router();

export const PUBLICAS_VIEJAS = {
  "/carta-natal": "/#herramientas", // con o sin datos: el formulario de la carta natal
  "/cielo": "/#cielo",                     // «El cielo de hoy», en la portada
};

for (const [vieja, nueva] of Object.entries(PUBLICAS_VIEJAS)) {
  router.get(vieja, (req, res) => res.redirect(302, nueva));
}

/** Autocompletado de ciudades. Todo local: no sale un solo dato a un tercero. */
router.get("/api/ciudades", (req, res) => {
  const q = String(req.query.q || "").slice(0, 80);
  let ciudades = [];
  try {
    ciudades = buscarCiudades(q, 8).map((c) => ({ id: c.id, etiqueta: c.etiqueta, tz: c.tz }));
  } catch { /* padrón sin cargar: se contesta vacío, no se rompe el formulario */ }
  res.set("cache-control", "public, max-age=3600");
  res.json({ ciudades });
});

export default router;

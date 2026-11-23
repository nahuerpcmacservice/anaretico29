// Redirecciones desde el sitio anterior (Squarespace). Son 301: hay links
// guardados, compartidos por mail y indexados por los buscadores, y perderlos
// es perder el posicionamiento que el dominio ya tiene.
//
// El mapeo sale de los títulos reales de aquellas páginas, no de adivinar por
// el nombre del archivo: "pagina-nueva" era Insights y "pagina-nueva-1", FAQs.
//
// Apuntan a las URLs de la web nueva. Las que hoy están en Próximamente
// (/servicios, /membresia, /revista) apuntan a su nombre limpio, que es el que
// va a quedar, y ESE hace la 302 a Próximamente (routes/web.js): una 301
// directo a Próximamente le diría al buscador que la página se mudó ahí para
// siempre (doc 05 §6.3).
import express from "express";

const router = express.Router();

export const VIEJAS = {
  "/about": "/sobre-mi",             // "Sobre mí"
  "/anaretico-29": "/",              // "General 1"
  "/appointments": "/servicios",     // "Citas": las consultas son Servicios
  "/contact": "/servicios",          // "Contacto"
  "/cart": "/",
  "/home": "/",
  "/index": "/",
  "/index.html": "/",
  "/miembros": "/membresia",         // "Miembros"
  "/pagina-nueva": "/revista",       // "Insights"
  "/pagina-nueva-1": "/",            // "FAQs": la web nueva no tiene preguntas generales
};

for (const [viejo, nuevo] of Object.entries(VIEJAS)) {
  // También la forma con .html, que es como quedaron servidas en la copia.
  const rutas = viejo.endsWith(".html") ? [viejo] : [viejo, `${viejo}.html`];
  for (const ruta of rutas) router.get(ruta, (req, res) => res.redirect(301, nuevo));
}

export default router;

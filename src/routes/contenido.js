// Rutas de contenido de la primera versión del sitio: revista, páginas de
// perfil, casos, preguntas, agenda, herramientas, "en camino" y el alta al
// newsletter.
//
// La web nueva (routes/web.js) las reemplaza: ninguna muestra ya su vista
// vieja. Cada una va a lo que la reemplaza — una parte de la portada, "Sobre
// mí" o Próximamente — con 302, porque lo apagado es temporal (doc 05 §6.3).
// El contenido sigue en la base y en el panel: el día que la Revista se
// encienda, se decide cómo vuelve.
import express from "express";

const router = express.Router();

const SERVICIOS = "/proximamente?p=servicios";

export const CONTENIDO_VIEJO = {
  "/revista": "/proximamente?p=revista",
  "/recorrido": "/sobre-mi",
  // Las cuatro puertas por perfil y su índice: hoy eso es Servicios
  "/estoy-trabado": SERVICIOS,
  "/quiero-emprender": SERVICIOS,
  "/decido-solo": SERVICIOS,
  "/armo-equipo": SERVICIOS,
  "/empezar": SERVICIOS,
  // Consultas: casos, agenda y la página "en camino"
  "/consultas": SERVICIOS,
  "/casos": SERVICIOS,
  "/agenda": SERVICIOS,
  "/cursos": "/proximamente?p=academia",
  // Herramientas: viven en la portada
  "/herramientas": "/#herramientas",
  "/luna": "/#cielo",
  "/calendario": "/#agenda",
  "/las-fechas": "/#agenda",
  // Sin equivalente en la web nueva: el aviso genérico
  "/preguntas": "/proximamente",
};

for (const [vieja, nueva] of Object.entries(CONTENIDO_VIEJO)) {
  router.get(vieja, (req, res) => res.redirect(302, nueva));
}
router.get("/revista/*resto", (req, res) => res.redirect(302, CONTENIDO_VIEJO["/revista"]));
router.get("/p/:handle", (req, res) => res.redirect(302, "/proximamente"));

// El alta vieja: no guarda nada (la web no junta datos de los visitantes) y
// vuelve a la franja de canales de la portada.
router.post("/newsletter", (req, res) => res.redirect(303, "/#canales"));

export default router;

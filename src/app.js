// Router raíz del sitio. Se monta en server.js y también se puede montar
// por hostname dentro de otro proceso.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { paginaError } from "./views/layout.js";
import publicRoutes from "./routes/public.js";
import contenidoRoutes from "./routes/contenido.js";
import viejasRoutes from "./routes/viejas.js";
import webRoutes from "./routes/web.js";
import panelRoutes from "./routes/panel.js";
import suscripcionRoutes from "./routes/suscripcion.js";
import { portero } from "./lib/portero.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// El portero va PRIMERO DE TODO, incluso antes de los estáticos: si fuera
// después, /subidas serviría las imágenes del sitio con el portero cerrado.
// Las fuentes que necesita la propia página del cartel pasan porque /estatico
// está en la lista de rutas libres.
router.use(portero);

// Estáticos: fuentes autoalojadas y assets del sitio. Llevan caché larga porque
// el nombre de archivo cambia cuando cambia el contenido.
router.use("/estatico", express.static(path.join(HERE, "estatico"), {
  maxAge: "365d", immutable: true, fallthrough: true,
}));
router.use("/subidas", express.static(config.uploadsDir, { maxAge: "30d", fallthrough: true }));

// La suscripción lee su propio cuerpo con un límite chico (2 KB): va antes del
// urlencoded general, que si no lo leería primero con el límite del panel.
router.use(suscripcionRoutes);

router.use(express.urlencoded({ extended: false, limit: "256kb" }));

router.use(viejasRoutes);
// La web nueva (src/web/, ver routes/web.js): /, /sobre-mi, /proximamente y
// los archivos que esas tres páginas cargan.
router.use(webRoutes);
router.use(publicRoutes);
router.use(panelRoutes);
router.use(contenidoRoutes);

router.use((req, res) => {
  res.status(404).send(paginaError(404, "Puede que la dirección esté mal escrita o que la página ya no exista."));
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, _next) => {
  console.error("[anaretico]", err);
  res.status(500).send(paginaError(500, "Quedó registrado y lo voy a mirar. Probá de nuevo en un rato."));
});

export default router;

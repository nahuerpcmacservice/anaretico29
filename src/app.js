// Router raíz del sitio. Se monta en server.js y también se puede montar
// por hostname dentro de otro proceso.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import publicRoutes from "./routes/public.js";
import cartaRoutes from "./routes/carta.js";
import contenidoRoutes from "./routes/contenido.js";
import viejasRoutes from "./routes/viejas.js";
import webRoutes from "./routes/web.js";
import panelRoutes from "./routes/panel.js";
import { portero } from "./lib/portero.js";
import { noEncontrada, manejarError } from "./lib/errores.js";

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

router.use(express.urlencoded({ extended: false, limit: "256kb" }));

router.use(viejasRoutes);
// La web nueva (src/web/, ver routes/web.js): /, /sobre-mi, /proximamente y
// los archivos que esas tres páginas cargan.
router.use(webRoutes);
// La API de la carta natal y del momento (la pide /carta; nada se guarda)
router.use(cartaRoutes);
router.use(publicRoutes);
router.use(panelRoutes);
router.use(contenidoRoutes);

// 404 y 500 con el diseño de la web nueva (src/lib/errores.js): noindex,
// no-store y, en el 500, nada del error en la página ni del pedido en el registro.
router.use(noEncontrada);
router.use(manejarError);

export default router;

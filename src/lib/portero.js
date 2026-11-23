// El portero del sitio.
//
// Mientras "en desarrollo" está prendido, el visitante anónimo ve un cartel y
// nada más; el que tiene sesión del panel ve el sitio entero, para poder
// revisarlo antes de abrirlo al público.
//
// El interruptor vive en la BASE y no en el .env ni en el código: así el sitio
// se abre desde el panel el día que se decida, sin deploy y sin reiniciar el
// proceso. Arranca PRENDIDO: un sitio a medio hacer es privado hasta que
// alguien diga lo contrario, y no al revés.
import { AsyncLocalStorage } from "node:async_hooks";
import { getAjuste, setAjuste } from "../db.js";
import { sesionDe } from "./sesion.js";
import { obraHtml } from "../views/obra.js";

export const AJUSTE = "sitio_en_desarrollo";

export const enDesarrollo = () => getAjuste(AJUSTE, true) !== false;
export const setEnDesarrollo = (v) => setAjuste(AJUSTE, !!v);

// La sesión viaja por acá y no como parámetro de pagina(): son veintipico de
// llamadas repartidas por las vistas y, a la que se agregue una página nueva,
// alguien se olvida de pasarla y esa página queda sin la barra de administrador
// — o sea, sin la única señal de que lo que se está viendo el público no lo ve.
const almacen = new AsyncLocalStorage();

/** La sesión del pedido en curso, o null. Sin contexto (un script, un test) da null. */
export const sesionActual = () => almacen.getStore()?.sesion || null;

/**
 * Rutas que pasan SIEMPRE, aun con el portero cerrado: el panel (si no, no se
 * puede entrar a abrirlo), la salud (la mira el monitoreo) y los
 * estáticos, que son las fuentes que usa la propia página del cartel.
 */
export const LIBRES = ["/panel", "/salud", "/estatico"];

/**
 * El corte va en el LÍMITE DE SEGMENTO. Con un `startsWith` pelado, un futuro
 * `/panel-publico` heredaría el permiso sin que nadie lo note.
 */
export const esLibre = (ruta) =>
  LIBRES.some((l) => ruta === l || ruta.startsWith(l + "/"));

/** Middleware: va PRIMERO de todo, antes de cualquier ruta del sitio. */
export function portero(req, res, next) {
  const sesion = sesionDe(req);
  return almacen.run({ sesion }, () => {
    if (sesion || esLibre(req.path) || !enDesarrollo()) return next();

    // robots.txt propio mientras está cerrado: que ningún buscador se lleve el
    // cartel como si fuera el contenido del sitio.
    if (req.path === "/robots.txt") {
      res.set("cache-control", "no-store");
      return res.type("text/plain").send("User-agent: *\nDisallow: /\n");
    }

    // 503 y NO 200. Un 200 hace que Google indexe este cartel como si fuera el
    // sitio, y lo que se cuidó con los 301 del Squarespace viejo (routes/viejas.js)
    // fue justamente el posicionamiento que el dominio ya tiene. El 503 dice
    // "vuelvo en un rato" y no lo toca.
    res.status(503);
    res.set("retry-after", "86400");
    res.set("cache-control", "no-store");
    return res.send(obraHtml());
  });
}

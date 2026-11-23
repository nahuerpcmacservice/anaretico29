// La suscripción al cielo del mes (franja de canales de la web nueva).
//
// Acá vive lo que comparten la importación (scripts/importar-web.mjs, que pone
// la casilla y los textos en el HTML y en portada.js) y el servidor
// (routes/suscripcion.js): el texto del consentimiento y su versión, los
// avisos, la validación del mail y el freno por IP. Un solo lugar, para que el
// texto que se guarda como "aceptado" sea el mismo que vio el visitante.
//
// Pendiente (no se manda ningún mail todavía): la doble confirmación por mail
// (columnas `confirmado` y `token` de la tabla, sin uso hasta entonces) y el
// texto definitivo de la política de privacidad, que escribe Fernando.
import crypto from "node:crypto";
import { PAGINAS } from "./web-nueva.js";

/**
 * Versión del texto del consentimiento. Se guarda con cada alta: si el texto
 * cambia, SUBIR la versión, así se sabe qué aceptó cada uno.
 */
export const CONSENTIMIENTO_VERSION = "2026-11-23";
/** Lo que dice la casilla (sin tildar de fábrica). «política de privacidad» enlaza a /privacidad. */
export const CONSENTIMIENTO_TEXTO = "Acepto recibir el mail mensual y la política de privacidad.";
export const CONSENTIMIENTO_HTML = CONSENTIMIENTO_TEXTO.replace(
  "política de privacidad", '<a href="/privacidad">política de privacidad</a>');

/** Etiqueta de origen en el panel (Newsletter): por dónde entró. */
export const ORIGEN = "canales";

/** Los avisos, por código. El código viaja en la URL sin JS; el texto nunca. */
export const AVISOS = {
  ok: "Gracias por sumarte: tu mail quedó anotado para el cielo del mes.",
  vacio: "Escribí tu mail.",
  mail: "Revisá el mail: parece incompleto.",
  consentimiento: "Para anotarte, marcá la casilla de consentimiento.",
  espera: "Hiciste muchos intentos seguidos. Probá de nuevo en unos minutos.",
  error: "No pudimos anotarte. Probá de nuevo en un rato.",
};

/** La página de origen: solo una de las publicadas; cualquier otra cosa es la portada. */
export const paginaDe = (v) => (typeof v === "string" && Object.hasOwn(PAGINAS, v) ? v : "/");

const ETIQUETA = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

/**
 * Normaliza y valida un mail. Devuelve { email } o { error: "vacio" | "mail" }.
 * Más estricta que la del navegador (no se confía en él): largo máximo 254
 * (64 la parte local), sin puntos dobles ni en los bordes, dominio con al
 * menos un punto y un final de 2 letras o más.
 */
export function validarEmail(v) {
  const email = (typeof v === "string" ? v : "").trim().toLowerCase();
  if (!email) return { error: "vacio" };
  if (email.length > 254) return { error: "mail" };
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at), dominio = email.slice(at + 1);
  if (at < 1 || local.length > 64 || !LOCAL.test(local)) return { error: "mail" };
  const partes = dominio.split(".");
  if (partes.length < 2 || !partes.every((p) => ETIQUETA.test(p)) || !/^[a-z]{2,}$/.test(partes.at(-1))) return { error: "mail" };
  return { email };
}

/** La casilla tildada manda "si" (value del checkbox). Nada más vale como consentimiento. */
export const consintio = (v) => v === "si";

// --- Freno por IP ------------------------------------------------------------
// En memoria, como el freno del panel: se pierde al reiniciar y está bien así.
// La clave es un hash de la IP, no la IP: ni en memoria queda en claro.
export const FRENO_MAX = 8;
export const FRENO_VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map(); // hash(ip) -> { n, desde }
const sal = crypto.randomBytes(16);

const claveDe = (ip) => crypto.createHash("sha256").update(sal).update(String(ip || "")).digest("base64url");

/** Anota un intento y dice si la IP se pasó del límite de la ventana. */
export function frenar(ip, ahora = Date.now()) {
  const k = claveDe(ip);
  let f = intentos.get(k);
  if (!f || ahora - f.desde >= FRENO_VENTANA_MS) { f = { n: 0, desde: ahora }; intentos.set(k, f); }
  f.n += 1;
  // Se limpia sola: un barrido de IPs distintas no puede hacerla crecer sin techo
  if (intentos.size > 5000) {
    for (const [c, v] of intentos) if (ahora - v.desde >= FRENO_VENTANA_MS) intentos.delete(c);
  }
  return f.n > FRENO_MAX;
}

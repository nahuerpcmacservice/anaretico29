// Sesión del panel. Cookie propia y tabla propia: nada de terceros y nada de
// sesiones en memoria, que se pierden en cada deploy.
import crypto from "node:crypto";
import { getDb } from "../db.js";
import { config } from "../config.js";

const COOKIE = "anaretico_panel";

/**
 * Compara contra ADMIN_PASSWORD en tiempo CONSTANTE. Un `===` filtra por
 * cuánto tarda en fallar y deja adivinar la clave carácter a carácter.
 */
export function claveValida(intento) {
  const esperada = config.adminPassword;
  if (!esperada) return false;
  const a = Buffer.from(String(intento || ""));
  const b = Buffer.from(esperada);
  // timingSafeEqual exige el mismo largo, así que se hashea antes: si no, el
  // largo de la clave se filtra igual por la excepción.
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function crearSesion(ip) {
  const token = crypto.randomBytes(32).toString("hex");
  const ahora = Date.now();
  getDb().prepare("INSERT INTO sesiones (token, creada_at, expira_at, ip) VALUES (?, ?, ?, ?)")
    .run(token, ahora, ahora + config.sesionHoras * 3600 * 1000, ip || null);
  return token;
}

export function cerrarSesion(token) {
  if (token) getDb().prepare("DELETE FROM sesiones WHERE token = ?").run(token);
}

function leerCookie(req, nombre) {
  const crudo = req.headers.cookie;
  if (!crudo) return null;
  for (const parte of crudo.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function ponerCookie(res, token) {
  const seguro = config.entorno === "production" ? "; Secure" : "";
  res.setHeader("set-cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${config.sesionHoras * 3600}${seguro}`);
}

export function borrarCookie(res) {
  res.setHeader("set-cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** El token del pedido, o null. Lo usan el portero y el botón de salir. */
export const tokenDe = (req) => leerCookie(req, COOKIE);

/**
 * La sesión viva del pedido, o null. NO redirige ni corta: lo llama el portero
 * en TODOS los pedidos, incluidos los del visitante anónimo, que es el caso
 * normal.
 */
export function sesionDe(req) {
  const token = leerCookie(req, COOKIE);
  if (!token) return null;
  try {
    return getDb().prepare("SELECT * FROM sesiones WHERE token = ? AND expira_at > ?")
      .get(token, Date.now()) || null;
  } catch {
    // La base todavía no abrió: se trata como "sin sesión". Es el único
    // resultado seguro — dar por buena una sesión que no se pudo verificar
    // abriría el sitio entero.
    return null;
  }
}

/** Middleware: deja pasar sólo con sesión viva. */
export function exigirSesion(req, res, next) {
  const s = sesionDe(req);
  if (s) { req.sesion = s; return next(); }
  // Se guarda a dónde iba, para volver ahí después de entrar.
  const destino = encodeURIComponent(req.originalUrl || "/panel");
  res.redirect(302, `/panel/entrar?volver=${destino}`);
}

/** Limpia las vencidas de vez en cuando. */
export function limpiarSesiones() {
  try { getDb().prepare("DELETE FROM sesiones WHERE expira_at < ?").run(Date.now()); } catch { /* nada */ }
}

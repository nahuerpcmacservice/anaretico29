// Configuración del sitio.
import path from "node:path";
import { fileURLToPath } from "node:url";

// El .env lo lee Node solo desde la 21.7: no hace falta dotenv. PM2 tampoco lo
// carga por su cuenta, así que sin esto la clave del panel nunca llega al
// proceso y el panel queda inaccesible sin ningún error visible.
try { process.loadEnvFile(); } catch { /* sin .env se usan los valores por defecto */ }

// La zona horaria se fija ACÁ y no en el .env ni en PM2: así viaja con el
// deploy y un restore no la pierde. El sitio muestra todo en hora de Buenos
// Aires; todo lo que se calcula y se guarda es UTC (regla 09 del brief).
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(HERE, "..");

const num = (v, def) => (v === undefined || v === "" || isNaN(Number(v)) ? def : Number(v));
const bool = (v, def) => (v === undefined || v === "" ? def : v === "1" || v === "true");

export const config = {
  puerto: num(process.env.PORT, 3101),
  bind: process.env.BIND || "127.0.0.1",
  entorno: process.env.NODE_ENV || "development",

  // Host canónico. El sitio viejo redirigía la raíz a www con un 301 y hay links
  // dando vueltas con esa forma, así que se respeta. Vacío = no redirigir.
  hostCanonico: (process.env.HOST_CANONICO ?? "www.anaretico29.com").toLowerCase(),
  sitioUrl: process.env.SITIO_URL || "https://www.anaretico29.com",

  dbPath: process.env.DB_PATH || path.join(RAIZ, "data", "anaretico.db"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(RAIZ, "data", "uploads"),

  adminPassword: process.env.ADMIN_PASSWORD || "",
  sesionHoras: num(process.env.SESSION_TTL_HOURS, 24 * 14),

  // El cielo del día es igual para todos los visitantes: se calcula una vez y se
  // cachea (regla del brief, sección 05). Sólo la carta natal se computa por pedido.
  cacheCieloMin: num(process.env.CACHE_CIELO_MIN, 60),

  // Sistema de casas por defecto. Placidus es el que espera cualquiera que haya
  // visto una carta en castellano; queda como parámetro porque Fernando lo
  // tiene marcado como pendiente en el brief (sección 10).
  sistemaCasas: process.env.SISTEMA_CASAS || "P",

  mostrarBanner: bool(process.env.BANNER_OBRA, false),
};

export const TZ_SITIO = "America/Argentina/Buenos_Aires";

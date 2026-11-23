// Geocodificador y zona horaria. Los dos son offline a propósito:
//
//  1. El brief pide que los datos de nacimiento no se compartan con terceros
//     (regla 09). Una API de geocoding se lleva "dónde y cuándo nació" a otro
//     server en cada consulta.
//  2. La zona horaria tiene que ser la VIGENTE EN LA FECHA DE NACIMIENTO y no
//     la de hoy — es la fuente de error más común de una carta. Node trae la
//     tzdb completa, así que Intl la resuelve sin ninguna dependencia.
import { getDb } from "../db.js";

/** Saca acentos y baja a minúscula, para que "Córdoba" matchee "cordoba". */
export function normalizar(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// El sitio es argentino y su público también: empatando, las ciudades de acá
// van primero. Está acá arriba y no perdido en el SQL porque es una decisión de
// producto, no un detalle de la consulta.
const PAIS_PROPIO = "AR";

const paises = new Intl.DisplayNames(["es"], { type: "region" });
export function nombrePais(codigo) {
  try { return paises.of(codigo) || codigo; } catch { return codigo; }
}

export function etiquetaCiudad(c) {
  if (!c) return "";
  const partes = [c.nombre];
  if (c.admin1 && normalizar(c.admin1) !== normalizar(c.nombre)) partes.push(c.admin1);
  partes.push(nombrePais(c.pais));
  return partes.join(", ");
}

/**
 * Busca ciudades por nombre. Ordena por: empieza con lo tipeado, después
 * población. El match exacto de una ciudad chica tiene que poder ganarle a una
 * grande que apenas la contiene.
 */
export function buscarCiudades(consulta, limite = 8) {
  const q = normalizar(consulta);
  if (q.length < 2) return [];
  const [desdeTok, hastaTok] = rangoPrefijo(q.split(" ")[0]);
  const [desdeQ, hastaQ] = rangoPrefijo(q);
  // RANGO: 3 nombre o alias exacto · 2 nombre que empieza así · 1 alias que
  // empieza así · 0 el nombre lo contiene. Dentro de un rango manda la población.
  //
  // La población es lo que hace que "Londres" traiga la capital del Reino Unido
  // y no el pueblo de Catamarca: los dos son match exacto y sin ese criterio
  // ganaba el pueblo por ser el nombre propio.
  //
  // El alias vale menos que el nombre cuando el match es parcial. Los alias
  // vienen en todos los idiomas, así que escribiendo pocas letras taparían a la
  // ciudad que de verdad se llama así.
  //
  // Empatando, la ARGENTINA VA PRIMERO, pero sólo cuando el match es parcial:
  // el que escribe "san mart" es casi siempre alguien buscando San Martín de
  // los Andes, no San Martín Texmelucan. Con el match exacto no se aplica, y a
  // propósito: si no, "Londres" traería el pueblo de Catamarca antes que la
  // capital del Reino Unido, que es justo el caso para el que existen los alias.
  const filas = getDb().prepare(
    `SELECT c.*, MAX(x.rango) AS rango
       FROM (
         SELECT p.ciudad_id AS cid,
                CASE WHEN ci.nombre_norm = ? THEN 3
                     WHEN ci.nombre_norm >= ? AND ci.nombre_norm < ? THEN 2 ELSE 0 END AS rango
           FROM ciudad_palabra p
           JOIN ciudades ci ON ci.id = p.ciudad_id
          WHERE p.palabra >= ? AND p.palabra < ?
            AND ci.nombre_norm LIKE ? ESCAPE '\\'
         UNION ALL
         SELECT ciudad_id, CASE WHEN alias_norm = ? THEN 3 ELSE 1 END
           FROM ciudad_alias WHERE alias_norm >= ? AND alias_norm < ?
       ) x
       JOIN ciudades c ON c.id = x.cid
      GROUP BY c.id
      ORDER BY rango DESC, (MAX(x.rango) < 3 AND c.pais = ?) DESC, c.poblacion DESC
      LIMIT ?`,
  ).all(
    q, desdeQ, hastaQ, desdeTok, hastaTok, `%${escaparLike(q)}%`,
    q, desdeQ, hastaQ, PAIS_PROPIO, limite,
  );
  return filas.map((c) => ({ ...c, etiqueta: etiquetaCiudad(c) }));
}

// Prefijo como RANGO en vez de LIKE. En SQLite un `LIKE 'tandil%'` no usa el
// índice —porque por defecto LIKE ignora mayúsculas y el índice es binario—,
// así que la búsqueda recorría las tablas enteras: 38 ms por tecla. Con
// `>= 'tandil' AND < 'tandil\uffff'` el índice entra y baja a menos de uno.
function rangoPrefijo(s) {
  // Sin escapar: una comparación de rango no interpreta comodines, así que un
  // "%" tipeado por el visitante es un carácter más y no un patrón.
  return [s, s + "\uffff"];
}

const escaparLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export const ciudadPorId = (id) => {
  const c = getDb().prepare("SELECT * FROM ciudades WHERE id = ?").get(Number(id));
  return c ? { ...c, etiqueta: etiquetaCiudad(c) } : null;
};

/** Offset de una zona IANA, en minutos, para un instante dado. */
export function offsetEnFecha(zona, utcMs) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const comoSiFueraUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (comoSiFueraUtc - utcMs) / 60000;
}

/**
 * Hora local de pared -> instante UTC, con el huso VIGENTE ESA FECHA.
 *
 * Se itera porque el offset depende del instante que estamos buscando y el
 * instante depende del offset. Dos pasadas alcanzan siempre salvo dentro de la
 * hora que el reloj se saltea al entrar el horario de verano; ahí esa hora
 * local no existió y se avisa en vez de devolver cualquier cosa.
 */
export function localAUtc(zona, anio, mes, dia, hora, minuto) {
  const pared = Date.UTC(anio, mes - 1, dia, hora, minuto);
  let off = offsetEnFecha(zona, pared);
  let utc = pared - off * 60000;
  const off2 = offsetEnFecha(zona, utc);
  if (off2 !== off) { off = off2; utc = pared - off * 60000; }
  // Si al volver a UTC la hora local no da la pedida, esa hora no existió.
  const comprobacion = offsetEnFecha(zona, utc);
  const inexistente = comprobacion !== off;
  return { utc: new Date(utc), offsetMin: off, inexistente };
}

export function etiquetaOffset(minutos) {
  const signo = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  return `GMT${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

// Cálculo de una carta natal a partir de lo que carga el visitante.
//
// Es lo único que se computa por pedido: el cielo del día se cachea y se
// comparte. Acá no se guarda nada — ver la carta es gratis y sin registro
// (regla del brief, bloque 02).
import { posiciones, casas, casaDe, faseLunar } from "./efemerides.js";
import { elementos, modalidades, tension } from "./cielo.js";
import { ciudadPorId, buscarCiudades, localAUtc, etiquetaOffset } from "./geo.js";
import { config } from "../config.js";

export class ErrorCarta extends Error {}

const ANIO_MIN = 1900;

function parsearFecha(txt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(txt || "").trim());
  if (!m) throw new ErrorCarta("Necesito la fecha de nacimiento.");
  const [, a, me, d] = m.map(Number);
  const anio = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  const prueba = new Date(anio, mes - 1, dia);
  if (prueba.getFullYear() !== anio || prueba.getMonth() !== mes - 1 || prueba.getDate() !== dia) {
    throw new ErrorCarta("Esa fecha no existe. Revisá el día y el mes.");
  }
  if (anio < ANIO_MIN) throw new ErrorCarta(`Por ahora calculo desde ${ANIO_MIN} en adelante.`);
  if (prueba > new Date()) throw new ErrorCarta("La fecha de nacimiento no puede ser futura.");
  return { anio, mes, dia };
}

function parsearHora(txt) {
  const t = String(txt || "").trim();
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new ErrorCarta("La hora va como 07:42.");
  const hora = Number(m[1]), minuto = Number(m[2]);
  if (hora > 23 || minuto > 59) throw new ErrorCarta("Esa hora no existe.");
  return { hora, minuto };
}

function resolverCiudad({ ciudadId, ciudad }) {
  if (ciudadId) {
    const c = ciudadPorId(ciudadId);
    if (c) return c;
  }
  // El id viaja en un campo oculto que se limpia si retocan el texto. Si no
  // vino, se resuelve por nombre: el visitante escribió algo válido y no
  // eligió de la lista, y hacerle repetir el formulario por eso es maltrato.
  const texto = String(ciudad || "").split(",")[0].trim();
  if (!texto) throw new ErrorCarta("Necesito la ciudad de nacimiento.");
  const [primera] = buscarCiudades(texto, 1);
  if (!primera) throw new ErrorCarta(`No encontré «${texto}». Probá con la ciudad grande más cercana.`);
  return primera;
}

/**
 * Calcula la carta. Sin hora se usa el mediodía local —la convención— y se
 * DEVUELVE MARCADO qué queda sin poder calcularse, para avisarlo en pantalla
 * en vez de inventarlo.
 */
export async function calcularCarta(entrada) {
  const { anio, mes, dia } = parsearFecha(entrada.fecha);
  const hm = parsearHora(entrada.hora);
  const ciudad = resolverCiudad(entrada);
  const sinHora = !hm;

  const { utc, offsetMin, inexistente } = localAUtc(
    ciudad.tz, anio, mes, dia, hm ? hm.hora : 12, hm ? hm.minuto : 0);

  const pos = await posiciones(utc);
  const cas = sinHora ? null : await casas(utc, ciudad.lat, ciudad.lon, config.sistemaCasas);
  if (cas) {
    for (const p of pos) p.casa = casaDe(p.longitud, cas.cuspides);
  }

  // Sin hora, la Luna es lo único que puede cambiar de signo dentro del día
  // (se mueve entre 12° y 15°). Si cambia, hay que decirlo: es la diferencia
  // entre "tu Luna está en Aries" y "no lo sé".
  let lunaDudosa = null;
  if (sinHora) {
    const arranque = localAUtc(ciudad.tz, anio, mes, dia, 0, 0).utc;
    const cierre = localAUtc(ciudad.tz, anio, mes, dia, 23, 59).utc;
    const [a, b] = await Promise.all([posiciones(arranque), posiciones(cierre)]);
    const l0 = a.find((p) => p.clave === "luna"), l1 = b.find((p) => p.clave === "luna");
    if (l0.signoIdx !== l1.signoIdx) lunaDudosa = { desde: l0.signo, hasta: l1.signo };
  }

  return {
    entrada: {
      fecha: `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`,
      hora: hm ? `${String(hm.hora).padStart(2, "0")}:${String(hm.minuto).padStart(2, "0")}` : null,
      ciudad: ciudad.etiqueta,
    },
    ciudad, momentoUtc: utc, offsetMin, offset: etiquetaOffset(offsetMin),
    horaInexistente: inexistente, sinHora, lunaDudosa,
    posiciones: pos,
    casas: cas,
    sistemaCasas: config.sistemaCasas,
    elementos: elementos(pos),
    modalidades: modalidades(pos),
    tension: tension(pos),
    luna: await faseLunar(utc),
  };
}

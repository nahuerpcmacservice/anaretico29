// El cielo del día, armado una vez y compartido por todos los visitantes.
//
// El brief lo pide explícito (sección 05): "el cielo del día es igual para
// todos los visitantes — se calcula una vez, se cachea y se recalcula cada
// hora. Sólo la carta natal se computa por pedido".
import { posiciones, faseLunar, hitos } from "./efemerides.js";
import {
  elementos, modalidades, tension, lecturaElemento, lecturaModalidad, lecturaTension,
} from "./cielo.js";
import { config } from "../config.js";

let cache = null;

/** Todo lo que necesita el panel «El cielo de hoy», en una sola llamada. */
export async function cieloDeHoy(ahora = new Date()) {
  const vencido = !cache || ahora - cache.calculadoEn > config.cacheCieloMin * 60000;
  if (!vencido) return cache.datos;

  const pos = await posiciones(ahora);
  const el = elementos(pos);
  const mo = modalidades(pos);
  const te = tension(pos);
  const luna = await faseLunar(ahora);
  const linea = await hitos(ahora, 30);

  const datos = {
    momento: ahora,
    posiciones: pos,
    retrogrados: pos.filter((p) => p.retro),
    elementos: el,
    modalidades: mo,
    tension: te,
    luna,
    hitos: linea,
    lecturas: {
      elemento: lecturaElemento(el),
      modalidad: lecturaModalidad(mo),
      tension: lecturaTension(te.porcentaje),
    },
    // Los tres lentos, que son los que marcan el ciclo de fondo.
    ciclo: pos.filter((p) => ["saturno", "jupiter", "pluton"].includes(p.clave)),
  };

  cache = { calculadoEn: ahora, datos };
  return datos;
}

/** Para el test y para el botón de recalcular del panel. */
export function limpiarCache() { cache = null; }

// Ventanas de la semana: los siete días con tres estados (sirve / media /
// esperá).
//
// OJO — LA REGLA NO ESTÁ DEFINIDA. El brief la marca como pendiente de
// Fernando (secciones 05 y 10) y pide dejarla "en un módulo aparte y
// parametrizado, porque va a cambiar". Esto es exactamente eso: una regla
// PROVISORIA, escrita en un solo lugar, para que el día que Fernando la defina
// se cambie acá y en ningún otro lado.
//
// Lo provisorio de hoy: se mira la tensión del cielo de cada día y la fase
// lunar. Cielo fluido y luna creciente sirve para abrir; cielo trabado o luna
// menguante avanzada, no.
import { posiciones, faseLunar } from "./efemerides.js";
import { tension } from "./cielo.js";

export const ESTADOS = {
  si:  { clave: "si",  texto: "Sí",     ayuda: "Sirve para firmar, lanzar y cerrar." },
  tal: { clave: "tal", texto: "Media",  ayuda: "Avanzá, pero no comprometas." },
  no:  { clave: "no",  texto: "Esperá", ayuda: "Resolvé pendientes y esperá." },
};

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// Los cortes son PARÁMETROS, no números sueltos en un if.
export const PARAMETROS = {
  tensionAlta: 55,   // de acá para arriba, el día no sirve para comprometerse
  tensionBaja: 35,   // de acá para abajo, el cielo está fluido
  menguanteAlta: 60, // menguante con más de esto iluminado: baja un escalón
  cercaDeLlena: 96,  // tan cerca de la llena que el día no sirve para abrir
};

export async function ventanasSemana(desde = new Date(), dias = 7) {
  const salida = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde.getTime() + i * 86400000);
    // Mediodía LOCAL: el proceso corre en hora de Buenos Aires (lo fija
    // config.js), así que el constructor con componentes ya da la hora de acá.
    // Tomar el mediodía y no la medianoche evita que el día quede definido por
    // un instante que en la otra punta del huso todavía es el día anterior.
    const mediodia = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    const pos = await posiciones(mediodia);
    const te = tension(pos).porcentaje;
    const luna = await faseLunar(mediodia);

    // BASE por tensión del cielo, MODIFICADOR por la luna. Separado así para
    // que se pueda cambiar una parte sin tocar la otra el día que Fernando
    // defina la regla de verdad.
    let nivel = te >= PARAMETROS.tensionAlta ? 0 : te <= PARAMETROS.tensionBaja ? 2 : 1;
    // Luna menguante y todavía muy iluminada: se cierra, no se abre.
    if (!luna.creciendo && luna.porcentaje > PARAMETROS.menguanteAlta) nivel--;
    // Alrededor de la llena no se abre nada.
    if (luna.porcentaje >= PARAMETROS.cercaDeLlena) nivel = Math.min(nivel, 0);
    const estado = ["no", "tal", "si"][Math.max(0, Math.min(2, nivel))];

    salida.push({
      fecha: mediodia,
      dia: DIAS[mediodia.getDay()],
      numero: mediodia.getDate(),
      estado, ...ESTADOS[estado],
      tension: te, luna: luna.porcentaje,
      hoy: i === 0,
    });
  }
  return salida;
}

// Rueda de carta dibujada en SVG a medida. Nunca un widget ajeno con marca de
// otro: cada carta que alguien calcula y comparte lleva la identidad del sitio
// encima (regla 09 del brief).
//
// Convención astrológica: el Ascendente va a la IZQUIERDA y los grados crecen
// en sentido antihorario. Sin carta (el cielo del día, que no tiene lugar) se
// pone 0° de Aries a la izquierda.
import { SIGNOS, ASPECTOS } from "./astro-config.js";

const C = 200;              // centro del lienzo 400×400
const R_EXT = 190;          // borde de afuera
const R_SIG = 158;          // borde interno de la banda de signos
const R_INT = 148;          // anillo interno
const R_ASP = 104;          // círculo donde se dibujan las líneas de aspecto
const R_PLA = 128;          // radio de los glifos de planeta
const SEP_MIN = 7.5;        // grados de separación mínima entre dos glifos

const rad = (g) => (g * Math.PI) / 180;

/**
 * Longitud eclíptica -> punto en pantalla. El Ascendente queda a la izquierda
 * y los grados crecen hacia abajo, que es como se lee una carta.
 */
function punto(r, longitud, asc) {
  const t = rad(longitud - asc);
  return [C - r * Math.cos(t), C + r * Math.sin(t)];
}

const xy = (p) => `${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}`;

/**
 * Separa los glifos que se pisan sin mover el punto real del planeta.
 *
 * Dos planetas a menos de un par de grados se dibujan uno encima del otro y no
 * se lee ninguno. Se los corre SÓLO para dibujar el glifo; la marquita sobre el
 * anillo sigue en el grado exacto, así que la carta no miente.
 */
function separar(longitudes) {
  const orden = longitudes.map((lon, i) => ({ i, lon })).sort((a, b) => a.lon - b.lon);
  const puestos = orden.map((x) => ({ ...x, dib: x.lon }));
  for (let vuelta = 0; vuelta < 24; vuelta++) {
    let movio = false;
    for (let k = 0; k < puestos.length; k++) {
      const a = puestos[k], b = puestos[(k + 1) % puestos.length];
      let hueco = b.dib - a.dib;
      if (k === puestos.length - 1) hueco += 360;   // el último cierra contra el primero
      if (hueco < SEP_MIN) {
        const empuje = (SEP_MIN - hueco) / 2;
        a.dib -= empuje; b.dib += empuje; movio = true;
      }
    }
    if (!movio) break;
  }
  const salida = new Array(longitudes.length);
  for (const p of puestos) salida[p.i] = ((p.dib % 360) + 360) % 360;
  return salida;
}

/**
 * Dibuja la rueda.
 * @param posiciones  los diez cuerpos del motor de efemérides
 * @param casas       {ascendente, cuspides} — sin esto no se dibujan las casas
 * @param girar       rotación lenta decorativa (sólo para el cielo del día)
 */
export function ruedaSvg({ posiciones = [], casas = null, girar = false, etiqueta = "Rueda de carta natal" } = {}) {
  const asc = casas ? casas.ascendente : 0;
  let s = "";

  // Banda de signos. Gira lento sólo cuando es decorativa: en una carta de
  // verdad, un signo que se mueve es un error de lectura.
  s += `<g class="${girar ? "rueda-gira" : ""}">`;
  for (const r of [R_EXT, R_SIG, R_INT]) {
    s += `<circle class="anillo" cx="${C}" cy="${C}" r="${r}"/>`;
  }
  for (let i = 0; i < 12; i++) {
    const g = i * 30;
    s += `<line class="div" x1="${xy(punto(R_INT, g, asc))}" x2="${punto(R_EXT, g, asc)[0].toFixed(1)}" y2="${punto(R_EXT, g, asc)[1].toFixed(1)}"/>`;
    const [gx, gy] = punto((R_EXT + R_SIG) / 2, g + 15, asc);
    s += `<text class="glifo" x="${gx.toFixed(1)}" y="${gy.toFixed(1)}">${SIGNOS[i].glifo}</text>`;
  }
  for (let g = 0; g < 360; g += 5) {
    const largo = g % 15 === 0 ? 7 : 4;
    s += `<line class="tick" x1="${xy(punto(R_SIG, g, asc))}" x2="${punto(R_SIG - largo, g, asc)[0].toFixed(1)}" y2="${punto(R_SIG - largo, g, asc)[1].toFixed(1)}"/>`;
  }
  s += "</g>";

  // Casas. Van sin girar: son del lugar, no del cielo.
  if (casas?.cuspides?.length === 12) {
    for (let i = 0; i < 12; i++) {
      const c = casas.cuspides[i];
      const eje = i === 0 || i === 3 || i === 6 || i === 9; // Asc, FC, Desc, MC
      s += `<line class="${eje ? "eje" : "casa"}" x1="${xy(punto(0, c, asc))}" x2="${punto(R_INT, c, asc)[0].toFixed(1)}" y2="${punto(R_INT, c, asc)[1].toFixed(1)}"/>`;
      const medio = c + (((casas.cuspides[(i + 1) % 12] - c) % 360 + 360) % 360) / 2;
      const [nx, ny] = punto(R_ASP - 16, medio, asc);
      s += `<text class="numcasa" x="${nx.toFixed(1)}" y="${ny.toFixed(1)}">${i + 1}</text>`;
    }
  }
  s += `<circle class="anillo" cx="${C}" cy="${C}" r="${R_ASP}"/>`;

  // Líneas de aspecto, con los orbes de astro-config.
  for (let i = 0; i < posiciones.length; i++) {
    for (let j = i + 1; j < posiciones.length; j++) {
      let d = Math.abs(posiciones[i].longitud - posiciones[j].longitud) % 360;
      if (d > 180) d = 360 - d;
      const asp = ASPECTOS.find((a) => Math.abs(d - a.angulo) <= a.orbe);
      if (!asp || asp.tipo === "neutro") continue;
      const p1 = punto(R_ASP, posiciones[i].longitud, asc);
      const p2 = punto(R_ASP, posiciones[j].longitud, asc);
      s += `<line class="${asp.tipo === "duro" ? "asp-duro" : "asp-blando"}" ` +
           `x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}"/>`;
    }
  }

  // Planetas: la marca va en el grado exacto, el glifo separado para que se lea.
  const dibujadas = separar(posiciones.map((p) => p.longitud));
  posiciones.forEach((p, i) => {
    const marca1 = punto(R_INT, p.longitud, asc), marca2 = punto(R_INT - 7, p.longitud, asc);
    s += `<line class="marca" x1="${marca1[0].toFixed(1)}" y1="${marca1[1].toFixed(1)}" x2="${marca2[0].toFixed(1)}" y2="${marca2[1].toFixed(1)}"/>`;
    const [x, y] = punto(R_PLA, dibujadas[i], asc);
    // El <title> va DENTRO de un <g> con su glifo. Suelto como hijo del <svg>,
    // el primero se convierte en el nombre accesible de la rueda entera y los
    // otros nueve quedan colgando: el lector de pantalla anuncia "Sol" en vez
    // de decir qué es el dibujo.
    s += `<g><title>${p.nombre}${p.retro ? " (retrógrado)" : ""} en ${p.signo}</title>` +
         `<text class="planeta${p.retro ? " retro" : ""}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${p.glifo}</text></g>`;
    if (p.retro) {
      const [rx, ry] = punto(R_PLA - 15, dibujadas[i], asc);
      s += `<text class="rmark" x="${rx.toFixed(1)}" y="${ry.toFixed(1)}">℞</text>`;
    }
  });

  return `<svg class="rueda" viewBox="0 0 400 400" role="img" aria-label="${etiqueta}">${s}</svg>`;
}

/** CSS de la rueda. Va aparte para que la use cualquier página que la dibuje. */
export const CSS_RUEDA = `
.rueda{width:100%;max-width:420px;display:block;margin:0 auto}
.rueda .anillo{fill:none;stroke:var(--line2)}
.rueda .div{stroke:var(--line);stroke-width:1}
.rueda .tick{stroke:var(--line)}
.rueda .marca{stroke:var(--tx2);stroke-width:1.2}
.rueda .casa{stroke:var(--line);stroke-width:.8;stroke-dasharray:2 3}
.rueda .eje{stroke:var(--line2);stroke-width:1.4}
.rueda .numcasa{fill:var(--tx3);font-family:var(--mono);font-size:9px;text-anchor:middle;dominant-baseline:central}
.rueda .glifo{fill:var(--tx2);font-family:var(--mono);font-size:13px;text-anchor:middle;dominant-baseline:central}
.rueda .planeta{fill:var(--ac);font-family:var(--mono);font-size:15px;text-anchor:middle;dominant-baseline:central}
.rueda .rmark{fill:var(--tx3);font-family:var(--mono);font-size:8px;text-anchor:middle;dominant-baseline:central}
.rueda .asp-blando{stroke:var(--ac);stroke-width:.9;opacity:.5;fill:none}
.rueda .asp-duro{stroke:var(--tx3);stroke-width:.7;opacity:.45;fill:none}
.rueda-gira{animation:girar 240s linear infinite;transform-origin:center}
@keyframes girar{to{transform:rotate(-360deg)}}
@media (prefers-reduced-motion:reduce){.rueda-gira{animation:none}}
`;

// La portada con el cielo real: rellena la plantilla que deja la importación
// (src/web/variantes/combinado.html y src/web/data.js, con marcas {{clave}})
// con lo que calcula cielo-portada.js.
//
// El marcado, las clases y los textos fijos son los del prototipo: acá solo se
// ponen los VALORES. Las filas que se repiten (la cinta, los balances, los
// retrógrados) se arman con el mismo marcado que trae el prototipo.
import fs from "node:fs";
import path from "node:path";
import { WEB_DIR } from "./web-nueva.js";
import { cieloPortada, derivado, partesBA, ahora, DIAS_AGENDA } from "./cielo-portada.js";
import { iniciarMotor } from "./efemerides.js";
import { CUERPOS, SIGNOS, ASPECTOS } from "./astro-config.js";
import { META_ELEMENTO, META_MODALIDAD } from "./cielo.js";
import { TZ_SITIO } from "../config.js";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ORDINAL = ["primera", "segunda", "tercera", "cuarta", "quinta", "sexta", "séptima", "octava", "novena", "décima", "undécima", "duodécima"];
// La modalidad en femenino, como la escribe el prototipo ("Fija")
const MODALIDAD = { cardinal: "Cardinal", fijo: "Fija", mutable: "Mutable" };
const GLIFO_ASPECTO = { conjuncion: "☌", sextil: "⚹", cuadratura: "□", trigono: "△", oposicion: "☍" };
const ARTICULO = { conjuncion: "una", sextil: "un", cuadratura: "una", trigono: "un", oposicion: "una" };
const CATEGORIA = { lunation: "Lunación", aspect: "Aspecto", ingress: "Ingreso", station: "Estación" };

const cuerpo = (clave) => CUERPOS.find((c) => c.clave === clave);
const indice = (clave) => CUERPOS.findIndex((c) => c.clave === clave);
const aspecto = (angulo) => ASPECTOS.find((a) => a.angulo === angulo);
const dos = (n) => String(n).padStart(2, "0");

// --- Formatos (todo en hora de Buenos Aires) ------------------------------------
const hhmm = (fecha) => { const p = partesBA(fecha); return `${dos(p.hora)}:${dos(p.minuto)}`; };
/** Al minuto más cercano: amanecer y ocaso ("Los horarios se muestran al minuto"). */
const hhmmRedondeo = (fecha) => hhmm(new Date(Math.round(fecha.getTime() / 60000) * 60000));
const ddmmaaaa = (fecha) => { const p = partesBA(fecha); return `${dos(p.dia)}/${dos(p.mes)}/${p.anio}`; };
const diaMesHora = (fecha) => { const p = partesBA(fecha); return `${p.dia} ${MES_CORTO[p.mes - 1]} · ${hhmm(fecha)}`; };
const fechaLarga = (fecha) => { const p = partesBA(fecha); return `${p.dia} de ${MESES[p.mes - 1]} de ${p.anio}`; };
const utcLargo = (fecha) => fecha.toISOString().replace("T", " ").replace("Z", " UTC");

/**
 * Grado y minuto dentro del signo, redondeado al minuto más cercano y con
 * tope en 29°59′ (doc 02 §4.7: el signo sale de la longitud real).
 */
export function grados(longitud) {
  const lon = ((longitud % 360) + 360) % 360, idx = Math.floor(lon / 30) % 12;
  const total = Math.min(1799, Math.floor((lon - idx * 30) * 60 + 0.5));
  return { signo: SIGNOS[idx].nombre, texto: `${dos(Math.floor(total / 60))}°${dos(total % 60)}′` };
}
const signoYGrados = (longitud) => { const g = grados(longitud); return `${g.signo} ${g.texto}`; };

// --- Las filas repetidas, con el marcado del prototipo --------------------------
const itemCinta = (p) => `<span class="ticker-item"><i>${p.glifo}</i> ${p.nombre} <strong>${signoYGrados(p.longitud)}</strong>${p.retro ? "<b>℞</b>" : ""}</span>`;
const filaBarra = (nombre, sub, pc) => `<div class="bar-row"><div><strong>${nombre}</strong><small>${sub}</small></div><div class="track" role="meter" aria-label="${nombre}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><span style="width:${pc}%"></span></div><span class="bar-number">${pc}%</span></div>`;
const filaPlaneta = (p, valor) => `<li><span><b>${p.glifo}</b> ${p.nombre}</span><strong>${valor}</strong></li>`;

/** Lo que muestra el radar: el aspecto con la Luna primero. */
function radarDe(c) {
  if (!c.radar) return null;
  const otro = cuerpo(c.radar.a === "luna" ? c.radar.b : c.radar.a);
  const asp = aspecto(c.radar.angulo);
  return { otro, asp, fecha: c.radar.fecha };
}

/** Los valores de las marcas {{clave}} de combinado.html. */
export function valoresPortada(c) {
  const ref = c.referencia, p = partesBA(ref), h = c.horas;
  const dia = cuerpo(h.regenteDia), hora = cuerpo(h.regenteHora);
  const lunaG = grados(c.lunaPos.longitud);
  const r = radarDe(c);
  const [elTop] = c.barometro.elementos, [moTop] = c.barometro.modalidades;
  const fin = new Date(c.agenda.fin.getTime() - 1), pi = partesBA(c.agenda.inicio), pf = partesBA(fin);
  const periodo = pi.anio === pf.anio
    ? `${pi.dia} ${MES_CORTO[pi.mes - 1].toUpperCase()} — ${pf.dia} ${MES_CORTO[pf.mes - 1].toUpperCase()} ${pf.anio}`
    : `${pi.dia} ${MES_CORTO[pi.mes - 1].toUpperCase()} ${pi.anio} — ${pf.dia} ${MES_CORTO[pf.mes - 1].toUpperCase()} ${pf.anio}`;
  const cinta = c.posiciones.map(itemCinta).join("");
  return {
    fecha: `${DIAS[p.diaSemana]}, ${p.dia} de ${MESES[p.mes - 1]}`,
    anio: String(p.anio),
    hora: hhmm(ref),
    segundos: `:${dos(p.segundo)}`,
    diaPlanetario: `${dia.glifo} ${dia.nombre}`,
    horaPlanetaria: `${hora.glifo} ${hora.nombre}`,
    horaNumero: `Hora ${h.numero} de 24`,
    horaRango: `${hhmm(h.inicio)} — ${hhmm(h.fin)}`,
    amanecer: hhmmRedondeo(h.salida),
    ocaso: hhmmRedondeo(h.puesta),
    iluminada: `${(c.iluminacion * 100).toFixed(1).replace(".", ",")}% iluminada`,
    fase: c.luna.nombre,
    lunaSigno: lunaG.signo,
    lunaGrado: lunaG.texto,
    ingresoSigno: c.ingreso ? c.ingreso.signo : "—",
    ingresoFecha: c.ingreso ? diaMesHora(c.ingreso.fecha) : "—",
    llenaSigno: c.llena ? c.llena.signo : "—",
    llenaFecha: c.llena ? diaMesHora(c.llena.fecha) : "—",
    curso: c.vacia ? "Luna vacía de curso" : "Luna no vacía de curso",
    radarHora: r ? hhmm(r.fecha) : "—",
    radarGlifo: r ? GLIFO_ASPECTO[r.asp.clave] : "",
    radarOtro: r ? r.otro.glifo : "",
    radarAspecto: r ? r.asp.nombre : "",
    radarPlaneta: r ? r.otro.nombre : "",
    // La frase vale solo si el aspecto llega antes del cambio de signo
    radarTexto: r && !c.vacia ? "<p>El próximo aspecto mayor de la Luna antes de su cambio de signo.</p>" : "",
    cinta,
    baroTension: String(c.barometro.tension.porcentaje),
    baroElemento: String(elTop.pc),
    baroElementoNombre: META_ELEMENTO[elTop.clave].nombre,
    baroModalidad: String(moTop.pc),
    baroModalidadNombre: MODALIDAD[moTop.clave],
    baroResumen: `Predominio de ${META_ELEMENTO[elTop.clave].nombre.toLowerCase()}; énfasis en ${META_MODALIDAD[moTop.clave].sub.toLowerCase()}.`,
    elementos: c.elementos.map((x) => filaBarra(META_ELEMENTO[x.clave].nombre, META_ELEMENTO[x.clave].sub, x.pc)).join(""),
    modalidades: c.modalidades.map((x) => filaBarra(MODALIDAD[x.clave], META_MODALIDAD[x.clave].sub, x.pc)).join(""),
    retroCuenta: `${c.retrogrados.length} ${c.retrogrados.length === 1 ? "ACTIVO" : "ACTIVOS"}`,
    retro: c.retrogrados.map((x) => filaPlaneta(x, signoYGrados(x.longitud))).join(""),
    ciclos: c.ciclo.map((x) => filaPlaneta(x, x.signo)).join(""),
    nota: `${ddmmaaaa(ref)}, ${hhmm(ref)}`,
    periodo: `${periodo}<br>BUENOS AIRES · ART`,
  };
}

// --- La línea de tiempo: los eventos con los campos de data.js -----------------
function evento(e, i) {
  const fecha = new Date(Math.round((e.jd - 2440587.5) * 86400000));
  const p = partesBA(fecha), A = cuerpo(e.body).nombre;
  const fechaClave = `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
  const signo = SIGNOS[e.kind === "ingress" ? e.signIndex : Math.floor(((e.longitude % 360) + 360) % 360 / 30)].nombre;
  let title, short;
  if (e.kind === "lunation") {
    const nombre = e.phase === "full" ? "Luna llena" : "Luna nueva";
    title = `${nombre} en ${signo}`; short = nombre;
  } else if (e.kind === "ingress") {
    title = e.retrograde ? `${A} vuelve a ${signo}` : `${A} ingresa en ${signo}`; short = `${A} a ${signo}`;
  } else if (e.kind === "station") {
    title = e.retrograde ? `${A} inicia retrogradación` : `${A} retoma movimiento directo`;
    short = `${A} ${e.retrograde ? "retrógrado" : "directo"}`;
  } else {
    const B = cuerpo(e.otherBody).nombre;
    title = `${A} en ${aspecto(e.angle).nombre} con ${B}`; short = `${A} · ${B}`;
  }
  const out = {
    id: [e.kind, indice(e.body), e.otherBody ? indice(e.otherBody) : null, e.angle ?? null, Math.round(e.jd * 1e5)].filter((x) => x !== null).join("-"),
    kind: e.kind, utc: fecha.toISOString(), jd: e.jd, body: indice(e.body),
  };
  if (e.otherBody) out.otherBody = indice(e.otherBody);
  if (e.angle !== undefined) out.angle = e.angle;
  if (e.phase) out.phase = e.phase;
  out.longitude = e.longitude;
  if (e.otherLongitude !== undefined) out.otherLongitude = e.otherLongitude;
  if (e.signIndex !== undefined) out.signIndex = e.signIndex;
  if (e.retrograde !== undefined) out.retrograde = e.retrograde;
  Object.assign(out, {
    local: `${fechaClave} ${dos(p.hora)}:${dos(p.minuto)}:${dos(p.segundo)}.${String(p.ms).padStart(3, "0")}`,
    offsetSeconds: Math.round(p.desfase / 1000),
    timezone: TZ_SITIO,
    title, short, category: CATEGORIA[e.kind], index: i,
    date: fechaClave, time: `${dos(p.hora)}:${dos(p.minuto)}`, displayDate: `${dos(p.dia)}/${dos(p.mes)}`,
  });
  return out;
}

// --- Los diálogos del bloque (compact.js y rich.js los leen de A29_DATA.cielo) ---
function dialogos(c) {
  const ref = c.referencia, r = radarDe(c), h = c.horas;
  const horaRef = hhmm(ref);
  const mismoDia = (f) => ddmmaaaa(f) === ddmmaaaa(ref);
  const criterio = (r && !c.vacia
    ? `<p>El ${ddmmaaaa(ref)} a las ${horaRef} de Buenos Aires, el próximo aspecto mayor exacto de la Luna es ${ARTICULO[r.asp.clave]} ${r.asp.nombre} con ${r.otro.nombre} a las ${hhmm(r.fecha)}${mismoDia(r.fecha) ? "" : ` del ${ddmmaaaa(r.fecha)}`}.</p>`
    : "") +
    "<p>Se consideran aspectos mayores exactos con el Sol y los planetas hasta Plutón, antes de abandonar el signo. Sin aspectos menores, nodos ni asteroides. Se considera vacía desde su último aspecto exacto hasta el ingreso siguiente.</p>" +
    "<p>El reloj es la hora de referencia del panel.</p>";
  const radar = r ? {
    titulo: `Luna en ${r.asp.nombre} con ${r.otro.nombre}`,
    cuerpo: `<div class="event-meta">${fechaLarga(r.fecha)} · ${hhmm(r.fecha)} Buenos Aires<br>${utcLargo(r.fecha)}</div>` +
      `<p>Es el próximo aspecto mayor exacto de la Luna.${!c.vacia && c.ingreso ? ` La Luna sigue formando aspectos antes de ingresar en ${c.ingreso.signo}.` : ""}</p>` +
      "<p>Este dato sitúa la secuencia del cielo. Su lectura simbólica requiere contexto y no determina una decisión empresarial o financiera.</p>",
  } : { titulo: "", cuerpo: "" };
  const enTramo = h.numero > 12 ? h.numero - 12 : h.numero;
  const solar = `<p>Para el ${fechaLarga(c.medianoche)}, en Buenos Aires, el motor calcula el amanecer a las ${hhmmRedondeo(h.salida)} y el ocaso a las ${hhmmRedondeo(h.puesta)}. Los horarios se muestran al minuto.</p>` +
    `<p>La franja diurna y la nocturna se dividen por separado en doce horas planetarias desiguales. A las ${horaRef} corresponde la ${ORDINAL[enTramo - 1]} hora ${h.deDia ? "del día" : "de la noche"}, de ${cuerpo(h.regenteHora).nombre}, entre las ${hhmm(h.inicio)} y las ${hhmm(h.fin)}.</p>` +
    "<p>Referencia astronómica: borde superior del Sol, horizonte plano y condiciones atmosféricas estándar. El relieve y la atmósfera pueden modificar la observación.</p>";
  return {
    criterio: { titulo: `${c.vacia ? "Luna vacía de curso" : "Luna no vacía de curso"}.`, cuerpo: criterio },
    radar,
    solar: { cuerpo: solar },
  };
}

/** window.A29_DATA: lo que leen app.js, compact.js, rich.js y la línea de tiempo. */
export function datosA29(c, version) {
  const p = partesBA(c.referencia);
  return {
    utc: c.referencia.toISOString(),
    local: `${p.anio}-${dos(p.mes)}-${dos(p.dia)} ${dos(p.hora)}:${dos(p.minuto)}:${dos(p.segundo)}.000`,
    timezone: TZ_SITIO,
    city: "Buenos Aires",
    engine: version,
    agenda: { inicio: c.agenda.inicio.toISOString(), fin: c.agenda.fin.toISOString(), dias: DIAS_AGENDA },
    cielo: dialogos(c),
    events: c.agenda.eventos.map(evento),
  };
}

// --- Plantillas --------------------------------------------------------------------
/** Pone los valores en las marcas {{clave}}: una marca sin valor es un error, no un hueco. */
export function rellenar(plantilla, valores, nombre) {
  const out = plantilla.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in valores)) throw new Error(`${nombre}: la marca {{${k}}} no tiene valor`);
    return valores[k];
  });
  return out;
}

const plantillas = {};
const plantilla = (rel) => (plantillas[rel] ??= fs.readFileSync(path.join(WEB_DIR, rel), "utf8"));

/** El HTML de la portada para el tramo de `instante`. */
export function paginaInicio(instante = ahora()) {
  return derivado("html", instante, (c) => rellenar(plantilla("variantes/combinado.html"), valoresPortada(c), "combinado.html"));
}

/** El data.js del tramo de `instante`: A29_DATA del motor y el resto del prototipo tal cual. */
export async function datosJs(instante = ahora()) {
  const { version } = await iniciarMotor();
  return derivado("datajs", instante, (c) =>
    rellenar(plantilla("data.js"), { A29_DATA: JSON.stringify(datosA29(c, version)) }, "data.js"));
}

export { cieloPortada };

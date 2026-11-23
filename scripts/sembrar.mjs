// Contenido de arranque, sacado del mockup del brief. NUNCA pisa lo que ya
// exista: es un botón explícito, no un seed automático. Fernando reemplaza
// estos textos desde el panel.
import { initDb, getDb } from "../src/db.js";

initDb();
const db = getDb();
const ahora = Date.now();
let creados = 0, saltados = 0;

function sembrar(tabla, clave, valor, fila) {
  const existe = db.prepare(`SELECT 1 FROM ${tabla} WHERE ${clave} = ?`).get(valor);
  if (existe) { saltados++; return; }
  const cols = Object.keys(fila);
  db.prepare(`INSERT INTO ${tabla} (${cols.join(", ")}) VALUES (${cols.map((c) => `@${c}`).join(", ")})`).run(fila);
  creados++;
}

const CASOS = [
  { etiqueta: "Caso 01 · Vocacional", quien: "Abogada, 41 años\nSocia en un estudio mediano",
    traia: "Ocho años en el mismo puesto. Le ofrecieron la dirección del área y no sabía si aceptar.",
    mostro_tit: "Qué mostró la carta",
    mostro: "Estructura de ejecución, no de representación. El cargo la sacaba de lo que hace bien.",
    decidio: "Negoció un rol técnico con más autonomía en vez del cargo.", orden: 1 },
  { etiqueta: "Caso 02 · Timing", quien: "Dueño de PyME, 52 años\nImportación y distribución",
    traia: "Quería abrir un segundo local y tenía la plata lista para firmar.",
    mostro_tit: "Qué mostró la carta",
    mostro: "Ventana de contracción por once meses, con apertura recién en el tramo siguiente.",
    decidio: "Postergó la apertura y usó el año para ordenar la operación.", orden: 2 },
  { etiqueta: "Caso 03 · Equipos", quien: "Estudio de diseño, 9 personas\nDos socios fundadores",
    traia: "El mismo conflicto entre las dos áreas cada vez que arrancaba un proyecto grande.",
    mostro_tit: "Qué mostró la sinastría",
    mostro: "Choque estructural entre los dos socios en la forma de decidir, no un problema de personas.",
    decidio: "Separaron la decisión técnica de la comercial por escrito.", orden: 3 },
];
for (const c of CASOS) sembrar("casos", "etiqueta", c.etiqueta, c);

const PREGUNTAS = [
  { pregunta: "¿Esto es adivinación?",
    respuesta: "No. No trabajo con predicciones ni con destino. Leo ciclos, patrones y tiempos, que es otra cosa: sirve para decidir mejor, no para saber qué va a pasar.", orden: 1 },
  { pregunta: "¿Sirve si no creo en astrología?",
    respuesta: "Sí. La mayoría de las personas que atiendo llegan escépticas. No hace falta creer en nada: hace falta que lo que salga de la sesión te sirva para tomar una decisión.", orden: 2 },
  { pregunta: "¿Necesito la hora exacta de nacimiento?",
    respuesta: "Es lo ideal y está en la partida de nacimiento. Sin hora igual se puede trabajar, con menos precisión en algunas cosas. Te digo antes de cobrarte si tu caso se puede o no.", orden: 3 },
  { pregunta: "¿Qué me llevo de una consulta?",
    respuesta: "La grabación, la carta dibujada y un resumen escrito con lo que hablamos y las fechas concretas que salieron. No dependés de tu memoria.", orden: 4 },
];
for (const p of PREGUNTAS) sembrar("preguntas", "pregunta", p.pregunta, p);

const dia = 86400000;
const FECHAS = [
  { titulo: "Mesa de decisiones", cuando: ahora + 6 * dia, tipo: "miembros",
    detalle: "Encuentro en vivo del mes. Traés tu situación y la miramos con la carta en pantalla." },
  { titulo: "Taller: leer tu carta para el trabajo", cuando: ahora + 20 * dia, tipo: "abierto",
    detalle: "Tres horas, en vivo, con grabación. Cupo limitado." },
  { titulo: "Sinastría de equipos", cuando: ahora + 27 * dia, tipo: "abierto", sin_cupo: 1,
    detalle: "Sesión para dos o más socios que trabajan juntos." },
  { titulo: "Mesa de decisiones", cuando: ahora + 41 * dia, tipo: "miembros",
    detalle: "Encuentro en vivo del mes." },
];
for (const f of FECHAS) sembrar("fechas", "titulo || cuando", f.titulo + f.cuando, f);

const NOTAS = [
  { handle: "el-techo-no-siempre-es-de-mercado", titulo: "El techo no siempre es de mercado",
    carril: "trabajo", minutos: 7,
    bajada: "Cuando el ingreso se planchó y el mercado sigue creciendo, el límite suele estar en la estructura de la decisión, no afuera.",
    cuerpo: "<p>Texto de arranque. Reemplazalo desde el panel.</p>" },
  { handle: "por-que-un-equipo-repite-el-mismo-conflicto", titulo: "Por qué un equipo repite siempre el mismo conflicto",
    carril: "grupos", minutos: 9,
    bajada: "El conflicto que vuelve cada vez que arranca un proyecto grande casi nunca es de personas.",
    cuerpo: "<p>Texto de arranque. Reemplazalo desde el panel.</p>" },
  { handle: "saturno-en-piscis-y-los-sectores-que-se-reordenan", titulo: "Saturno en Piscis y los sectores que se están reordenando",
    carril: "ciclos", minutos: 12,
    bajada: "Qué industrias entran en revisión cuando el ciclo largo cambia de signo.",
    cuerpo: "<p>Texto de arranque. Reemplazalo desde el panel.</p>" },
];
NOTAS.forEach((n, i) => sembrar("notas", "handle", n.handle, {
  ...n, publicada: 1, destacada: 0, publicada_at: ahora - (i + 1) * 6 * dia,
  created_at: ahora, updated_at: ahora, portada_url: null,
}));

const PAGINAS = [
  ["estoy-trabado", "Estoy trabado", "Hace años que hacés lo mismo y no sabés si el problema es el puesto, el rubro o vos."],
  ["quiero-emprender", "Quiero emprender", "Tenés la idea y la plata. La pregunta no es qué, es cuándo."],
  ["decido-solo", "Decido solo", "Sos el dueño y todas las decisiones pasan por vos. No tenés con quién pensarlas."],
  ["armo-equipo", "Armo equipo", "Sabés qué hay que hacer. No sabés a quién poner dónde."],
  ["recorrido", "Mi recorrido", "Mercados, docencia, empresa, formación y método."],
];
for (const [handle, titulo, bajada] of PAGINAS) {
  sembrar("paginas", "handle", handle, {
    handle, titulo, bajada, cuerpo: "<p>Texto de arranque. Reemplazalo desde el panel.</p>",
    publicada: 1, orden: 0, created_at: ahora, updated_at: ahora,
  });
}

console.log(`Sembrado: ${creados} filas nuevas, ${saltados} ya existían y no se tocaron.`);

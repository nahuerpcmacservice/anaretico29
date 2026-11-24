// Carta natal y carta del momento: window.A29Carta, la biblioteca de la pantalla carta.html (opción 2 «Observatorio»):
// carga de datos, textos, ayudas de datos y rueda en SVG. NO toca el DOM de la página.
// La carta la calcula el servidor (POST /api/carta, GET /api/carta/momento) y los textos salen de datos/significados.json (borrador).
// Ningún número de la carta se escribe a mano acá.
(function () {
 'use strict';
 var BASE = (document.currentScript && document.currentScript.src) || location.href;
 var VS = '\uFE0E'; // selector de variacion 15: fuerza presentacion como texto (nunca emoji)
 var SIGNOS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
 // Los signos salen de U+2648 a U+2653; el resto de la familia Noto (ver el <link> de carta.html).
 var GLIFO = { sun: '\u2609', moon: '\u263D', mercury: '\u263F', venus: '\u2640', mars: '\u2642', jupiter: '\u2643', saturn: '\u2644', uranus: '\u2645', neptune: '\u2646', pluto: '\u2647', node: '\u260A', chiron: '\u26B7' };
 var GLIFO_ASP = { conjunction: '\u260C', sextile: '\u26B9', square: '\u25A1', trine: '\u25B3', opposition: '\u260D' };
 var ETIQ_ANG = { asc: 'AC', mc: 'MC', dsc: 'DC', ic: 'FC' };
 var RETRO = '\u211E';
 var FUENTE_GLIFOS = "'Noto Sans Symbols','Noto Sans Symbols 2','Noto Sans','Segoe UI Symbol',serif";
 var FUENTE_TEXTO = "'Inter',Arial,sans-serif";
 var COLORES_ASPECTOS = { conjunction: '#33454a', sextile: '#2a6e66', square: '#a3361f', trine: '#2f6f8a', opposition: '#844a2b' };
 var TRAZOS_ASPECTOS = { conjunction: '', sextile: '2 3', square: '', trine: '', opposition: '10 4' };
 var ORDEN_ASPECTOS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

 function glifoSigno(id) { var i = SIGNOS.indexOf(id); return i < 0 ? '' : String.fromCharCode(0x2648 + i) + VS; }
 function glifoCuerpo(id) { return GLIFO[id] ? GLIFO[id] + VS : (ETIQ_ANG[id] || ''); }
 function glifoAspecto(t) { return (GLIFO_ASP[t] || '') + VS; }
 function pad2(n) { return (n < 10 ? '0' : '') + n; }
 function grados(p) { return p.degree + '°' + pad2(p.minute) + '′'; }
 function posTexto(p) { return p.sign_name + ' ' + grados(p); }
 function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
 function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
 function fechaAR(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; }
 function velTexto(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace('.', ',') + ' °/día'; }
 function coordTexto(lat, lon) {
  function una(v, pos, neg) { var a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return d + '°' + pad2(m) + '′ ' + (v >= 0 ? pos : neg); }
  return una(lat, 'N', 'S') + ', ' + una(lon, 'E', 'O');
 }
 function utcTexto(iso) { var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso || ''); return m ? m[2] + ' del ' + fechaAR(m[1]) : iso; }

 // ---------------------------------------------------------------- datos
 function modoDe(m) { if (m === undefined) m = new URLSearchParams(location.search).get('modo'); return m === 'momento' ? 'momento' : 'natal'; }
 function sinHora(carta) { return !!(carta && carta.meta && carta.meta.hora_conocida === false); }
 function pedir(nombre) {
  return fetch(new URL('datos/' + nombre, BASE).href, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(nombre + ': ' + r.status); return r.json(); });
 }
 // La carta la calcula el servidor (src/lib/carta.js). Si rechaza los datos (400), la promesa falla con { mensaje, campo } y no se dibuja nada.
 function api(url, opciones) {
  return fetch(url, opciones).then(function (r) {
   return r.json().catch(function () { return {}; }).then(function (j) {
    if (r.ok) return j;
    var e = new Error(j.mensaje || ('carta: ' + r.status)); e.mensaje = j.mensaje || ''; e.campo = j.campo || ''; e.estado = r.status; throw e;
   });
  });
 }
 // Los datos que dejó el formulario de la portada después del # (/carta#fecha=…&hora=…&lugar=…): el navegador no manda esa parte de la dirección.
 function entradaNatal() {
  var q = new URLSearchParams((location.hash || '').replace(/^#/, ''));
  return { fecha: q.get('fecha') || '', hora: q.get('hora') || '', lugar: (q.get('lugar') || '').slice(0, 120) };
 }
 // El límite de Fernando: 2 cartas natales cada 7 días por navegador, contadas acá (localStorage; el servidor no guarda nada ni ve IPs).
 // Se anota la huella de los datos (no los datos) y la hora de cada carta calculada con éxito. La ventana corre: cada carta deja de contar
 // a los 7 días justos de calculada. Volver a pedir los mismos datos no gasta otro lugar. Sin localStorage (bloqueado), no hay tope.
 var limite = {
  clave: 'a29-cartas-natales', max: 2, ventana: 7 * 864e5,
  huella: function (e) {
   var t = [e.fecha, e.hora, e.lugar].map(function (v) { return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9:-]+/g, ' ').trim(); }).join('|');
   var h = 0x811c9dc5;
   for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
   return ('0000000' + h.toString(16)).slice(-8);
  },
  vigentes: function (lista, ahora) {
   return (Array.isArray(lista) ? lista : []).filter(function (x) { return x && typeof x.h === 'string' && typeof x.t === 'number' && ahora - x.t < limite.ventana; });
  },
  puede: function (lista, h, ahora) { var v = limite.vigentes(lista, ahora); return v.some(function (x) { return x.h === h; }) || v.length < limite.max; },
  anotar: function (lista, h, ahora) { var v = limite.vigentes(lista, ahora); if (!v.some(function (x) { return x.h === h; })) v.push({ h: h, t: ahora }); return v; },
  leer: function () { try { return JSON.parse(localStorage.getItem(limite.clave) || '[]'); } catch (e) { return []; } },
  guardar: function (lista) { try { localStorage.setItem(limite.clave, JSON.stringify(lista)); } catch (e) { /* sin localStorage no hay tope */ } }
 };
 // La huella de los datos que hay ahora después del # ('' si no hay datos, como en el ancla #inicio): carta-op2.js recalcula cuando cambia.
 function claveNatal() { var e = entradaNatal(); return e.fecha || e.hora || e.lugar ? limite.huella(e) : ''; }
 function pedirNatal() {
  var e = entradaNatal(), h, x;
  if (!e.fecha && !e.hora && !e.lugar) { x = new Error('sin datos'); x.sinDatos = true; return Promise.reject(x); }
  h = limite.huella(e);
  if (!limite.puede(limite.leer(), h, Date.now())) { x = new Error('límite semanal'); x.limite = true; return Promise.reject(x); }
  return api('/api/carta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e), cache: 'no-store' })
   .then(function (c) { limite.guardar(limite.anotar(limite.leer(), h, Date.now())); return c; });
 }
 // cargar('natal' | 'momento') o cargar() para leer ?modo= de la URL. Devuelve una promesa con { modo, carta, significados, sinHora }.
 function cargar(modo) {
  modo = modoDe(modo);
  var carta = modo === 'momento' ? api('/api/carta/momento', {}) : pedirNatal();
  return Promise.all([carta, pedir('significados.json')])
   .then(function (r) { return { modo: modo, carta: r[0], significados: r[1], sinHora: sinHora(r[0]) }; });
 }
 function punto(carta, id) {
  var i, l = carta.bodies.concat(carta.angles || []);
  for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
  return null;
 }
 function nombre(carta, id) { var p = punto(carta, id); return p ? p.name : id; }

 // ---------------------------------------------------------------- textos (posibles significados)
 // Todas reciben modo ('natal' | 'momento'); si falta, sale de carta.meta.kind. En modo 'momento' no se usa NUNCA un texto propio de la carta natal
 // y todo habla del cielo de ese momento, sin dirigirse a nadie. Los textos armados con las piezas generales no repiten el rol del punto:
 // el rol se muestra una sola vez con textos.rol().
 function modoCarta(carta, modo) { return modo === 'momento' || modo === 'natal' ? modo : (carta && carta.meta && carta.meta.kind === 'momento' ? 'momento' : 'natal'); }
 function info(sig, id) { return sig.planetas[id] || sig.angulos[id] || {}; }
 function conArt(sig, id) { var i = info(sig, id); return (i.articulo ? i.articulo + ' ' : '') + (i.nombre || id); } // "el Sol", "Plutón"
 function conArtCap(sig, id) { return cap(conArt(sig, id)); }
 function temaDe(sig, id, modo) { var i = info(sig, id); return (modo === 'momento' && i.tema_momento) || i.tema; }
 function deArea(area) { return area.indexOf('el ') === 0 ? 'del ' + area.slice(3) : 'de ' + area; } // "del hogar", "de la vocación"
 function lista(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }

 function tRol(carta, id, sig, modo) {
  modo = modoCarta(carta, modo);
  var i = info(sig, id);
  return (modo === 'momento' && i.momento) || i.funcion || '';
 }
 function tPlanetaSigno(carta, id, sig, modo) {
  modo = modoCarta(carta, modo);
  var b = punto(carta, id), t = modo === 'natal' && sig.planeta_en_signo[id + '-' + b.sign];
  if (t) return { texto: t, propio: true };
  return { texto: conArtCap(sig, id) + ' en ' + b.sign_name + ' se expresa ' + sig.signos[b.sign].modo + '.', propio: false };
 }
 function tPlanetaCasa(carta, id, sig, modo) {
  modo = modoCarta(carta, modo);
  var b = punto(carta, id);
  if (!b || b.house == null) return { texto: '', propio: false };
  var t = modo === 'natal' && sig.planeta_en_casa[id + '-' + b.house];
  if (t) return { texto: t, propio: true };
  return { texto: conArtCap(sig, id) + ' en la casa ' + b.house + ' se ubica en el terreno ' + deArea((modo === 'momento' && sig.casas[b.house].area_momento) || sig.casas[b.house].area) + '.', propio: false };
 }
 function tAngulo(carta, id, sig, modo) {
  modo = modoCarta(carta, modo);
  var a = punto(carta, id), t = modo === 'natal' && sig.angulo_en_signo[id + '-' + a.sign];
  if (t) return { texto: t, propio: true };
  return { texto: conArtCap(sig, id) + ' en ' + a.sign_name + ' se expresa ' + sig.signos[a.sign].modo + '.', propio: false };
 }
 // Devuelve la oración completa. Es un objeto String que además lleva .texto y .propio (por si el que llama espera { texto, propio }).
 function tAspecto(carta, asp, sig, modo) {
  modo = modoCarta(carta, modo);
  var t = modo === 'natal' && sig.aspectos[asp.a + '-' + asp.b + '-' + asp.type], texto, propio = !!t;
  if (t) texto = t;
  else {
   var ty = sig.aspectos_tipos[asp.type], plural = info(sig, asp.a).plural !== false, enl = ty.enlace ? ty.enlace[plural ? 1 : 0] : 'se vincula con';
   texto = (conArtCap(sig, asp.a) + ' y ' + conArt(sig, asp.b) + ' ' + ty.frase + ': ' + temaDe(sig, asp.a, modo) + ' ' + enl + ' ' + temaDe(sig, asp.b, modo) + '.').replace(/ a el /g, ' al ');
  }
  var o = new String(texto); o.texto = texto; o.propio = propio;
  return o;
 }
 // grupo: 'elements' | 'modalities'. Devuelve { titulo, texto } del elemento (o la modalidad) predominante.
 function tBalance(carta, sig, grupo, modo) {
  modo = modoCarta(carta, modo);
  var b = carta.balance, el = grupo === 'elements', tabla = sig[el ? 'elementos' : 'modalidades'], dom = b['dominant_' + (el ? 'elements' : 'modalities')];
  var filas = b[grupo].filter(function (x) { return dom.indexOf(x.id) >= 0; });
  if (b['balanced_' + grupo]) return { titulo: 'Equilibrio.', texto: '' };
  return {
   titulo: (filas.length > 1 ? 'Predominan ' : 'Predomina ') + lista(filas.map(function (f) { return f.name + ' (' + f.count + ' de ' + b.total + ')'; })) + '.',
   texto: filas.map(function (f) { var t = tabla[f.id] || {}; return (modo === 'momento' && t.momento) || t.texto || ''; }).join(' ')
  };
 }
 function textoTipo(ty, modo) { return (modo === 'momento' && ty.momento) || ty.texto; }

 // ---------------------------------------------------------------- ayudas de datos (filas listas para mostrar)
 // Todas aceptan un último parámetro opcional modo; si falta, se toma de carta.meta.kind.
 function filasCuerpos(carta, sig, modo) {
  modo = modoCarta(carta, modo);
  return carta.bodies.map(function (b) {
   var s = tPlanetaSigno(carta, b.id, sig, modo), c = tPlanetaCasa(carta, b.id, sig, modo);
   return {
    id: b.id, glifo: glifoCuerpo(b.id), nombre: b.name, signoId: b.sign, glifoSigno: glifoSigno(b.sign), signo: b.sign_name,
    grados: grados(b), longitud: b.longitude, casa: b.house, casaNombre: b.house == null ? '' : (sig.casas[b.house] || {}).nombre || '',
    retrogrado: b.retrograde, movimiento: b.retrograde ? 'Retrógrado' : 'Directo', velocidad: velTexto(b.speed),
    rol: tRol(carta, b.id, sig, modo),
    textoSigno: s.texto, textoCasa: c.texto, propioSigno: s.propio, propioCasa: c.propio
   };
  });
 }
 function filasCasas(carta, sig) {
  return carta.houses.map(function (h) {
   return { casa: h.house, nombre: (sig.casas[h.house] || {}).nombre || '', area: (sig.casas[h.house] || {}).area || '', glifoSigno: glifoSigno(h.sign), signo: h.sign_name, grados: grados(h), cuspide: h.cusp };
  });
 }
 function filasAngulos(carta, sig, modo) {
  modo = modoCarta(carta, modo);
  return carta.angles.map(function (a) {
   var t = tAngulo(carta, a.id, sig, modo);
   return { id: a.id, etiqueta: ETIQ_ANG[a.id], nombre: a.name, glifoSigno: glifoSigno(a.sign), signo: a.sign_name, grados: grados(a), casa: a.house, rol: tRol(carta, a.id, sig, modo), texto: t.texto, propio: t.propio };
  });
 }
 // grupo: 'elements' | 'modalities'
 function filasBalance(carta, sig, grupo, modo) {
  modo = modoCarta(carta, modo);
  var b = carta.balance, tabla = sig[grupo === 'elements' ? 'elementos' : 'modalidades'], dom = b['dominant_' + (grupo === 'elements' ? 'elements' : 'modalities')];
  return b[grupo].map(function (x) {
   var t = tabla[x.id] || {};
   return {
    id: x.id, nombre: x.name, cantidad: x.count, total: b.total, porcentaje: Math.round(x.percent), palabra: t.palabra || '', texto: (modo === 'momento' && t.momento) || t.texto || '',
    dominante: dom.indexOf(x.id) >= 0 && !b['balanced_' + grupo],
    puntos: x.points.map(function (p) { return { id: p, glifo: glifoCuerpo(p), nombre: nombre(carta, p) }; })
   };
  });
 }
 function listaAspectos(carta, sig, modo) {
  modo = modoCarta(carta, modo);
  return carta.aspects.map(function (a, i) {
   var t = tAspecto(carta, a, sig, modo), ty = sig.aspectos_tipos[a.type];
   return {
    indice: i, a: a.a, b: a.b, nombreA: nombre(carta, a.a), nombreB: nombre(carta, a.b), glifoA: glifoCuerpo(a.a), glifoB: glifoCuerpo(a.b),
    tipo: a.type, tipoNombre: a.type_name, tipoGlifo: glifoAspecto(a.type), angulo: ty.angulo, orbe: a.orb_dm, orbeNumero: a.orb, fase: a.phase,
    texto: t.texto, propio: t.propio, textoTipo: textoTipo(ty, modo)
   };
  });
 }
 function descripcion(carta, modo) {
  var m = carta.meta, asc = punto(carta, 'asc'), mc = punto(carta, 'mc'), dsc = punto(carta, 'dsc'), ic = punto(carta, 'ic'), sin = sinHora(carta);
  var t = 'Rueda de la ' + (modoCarta(carta, modo) === 'momento' ? 'carta del momento' : 'carta natal') + ', zodíaco tropical' + (sin ? ', sin la hora de nacimiento: no hay Ascendente, ángulos, casas ni cúspides, y la rueda parte de Aries 0° a la izquierda. ' : ', casas ' + m.house_system + '. ');
  if (asc && mc) t += 'Ángulos: Ascendente en ' + posTexto(asc) + ', Medio Cielo en ' + posTexto(mc) + (dsc ? ', Descendente en ' + posTexto(dsc) : '') + (ic ? ', Fondo del Cielo en ' + posTexto(ic) : '') + '. ';
  if (carta.houses && carta.houses.length) t += 'Cúspides de las doce casas: ' + carta.houses.map(function (h) { return 'casa ' + h.house + ' en ' + posTexto(h); }).join('; ') + '. ';
  t += 'Posiciones: ' + carta.bodies.map(function (b) { return b.name + ' en ' + posTexto(b) + (b.house != null ? ', casa ' + b.house : '') + (b.retrograde ? ', retrógrado' : ''); }).join('; ') + '. ';
  t += carta.aspects.length + ' aspectos mayores; los más exactos: ' + carta.aspects.slice(0, 5).map(function (a) { return nombre(carta, a.a) + ' ' + a.type_name.toLowerCase() + ' ' + nombre(carta, a.b) + ' (orbe ' + a.orb_dm + ')'; }).join('; ') + '.';
  return t;
 }


 // ---------------------------------------------------------------- rueda en SVG
 // Rueda con las convenciones de los programas profesionales (Solar Fire, astro.com, Janus):
 //  - Banda del zodíaco (de R a 0,865·R): 12 sectores con un tinte suave por elemento, el glifo del signo grande y una escala de grados
 //    en el borde interior (marca cada 1°, más larga cada 5° y cada 10°).
 //  - Las 12 cúspides, como líneas completas desde el círculo de aspectos hasta la banda; cada una con su etiqueta (14°♍47′) horizontal,
 //    justo dentro de la banda. Los cuatro ángulos (AC, MC, DC, FC) van más gruesos, en cobre, atraviesan la banda y llevan flecha
 //    en AC y MC; su etiqueta, más grande y en negrita, queda fuera de la rueda.
 //  - Números de casa en un anillo fino, justo afuera del círculo de aspectos.
 //  - Planetas: cada uno es una unidad, el glifo y, hacia el centro, UNA etiqueta horizontal que siempre se lee igual (grado, signo, minutos: 17°♐58′),
 //    con ℞ al final si es retrógrado. La unidad se coloca lo más cerca posible de su grado exacto y del anillo del zodíaco; una marca en la escala y
 //    un hilo (recto, o por un riel bajo la escala si no hay otro camino) la unen con su grado. Entre unidades queda un espacio claro.
 //  - Círculo de aspectos al centro (≈ 0,42·R): líneas entre las posiciones exactas, más gruesas cuanto menor el orbe; sin líneas de conjunción.
 // Los tamaños salen de medir los textos en el propio <svg> y ningún texto se pisa con otro: si no entra todo, se baja de nivel
 // (ver NIVELES: primero se quitan los minutos de las cúspides, después el signo y los minutos de los planetas, después las etiquetas de las
 // cúspides). Las líneas de las cúspides nunca se ocultan. El círculo de aspectos queda lo más grande posible (de 0,38·R a 0,46·R). Sin la hora de nacimiento no hay cúspides, números de casa ni ángulos.
 function mezclar(base, extra) {
  var o = {}, k;
  for (k in base) o[k] = base[k];
  for (k in (extra || {})) o[k] = (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') ? mezclar(base[k], extra[k]) : extra[k];
  return o;
 }
 var DEF = {
  size: null,            // lado en px de la rueda; null = el ancho del <svg> en pantalla (se redibuja al cambiar)
  auto: true,            // redibujar solo cuando cambia el ancho
  grados: 'auto',        // etiqueta de cada planeta: 'auto' (la que entre sin pisarse) o false (solo el glifo)
  aspectos: true,        // dibujar las líneas de aspecto
  fuente: FUENTE_GLIFOS, fuenteTexto: FUENTE_TEXTO,
  colores: {
   fondo: 'none',        // relleno del círculo exterior
   anillo: '#33454a',    // círculos y marcas de grados
   casas: '#8a7f6c',     // líneas de cúspide de las casas (3:1 o más sobre el marfil)
   ejes: '#844a2b',      // eje Ascendente-Descendente y Medio Cielo-Fondo del Cielo
   signos: '#33454a',    // glifos de los signos
   planetas: '#213034',  // glifos de los planetas y su hilo
   grados: '#545e5d',    // grado, signo y minutos junto a los planetas
   numCasas: null,       // números de casa; null = el color de los grados
   angulos: '#844a2b',   // etiquetas AC, MC, DC y FC
   retro: '#844a2b',     // marca ℞
   puntos: '#33454a',    // puntos de los aspectos sobre el círculo interior
   cuspides: null,       // etiquetas de las cúspides; null = el color de los grados
   escala: null,         // marcas de grados; null = el color del anillo
   halo: null,           // color que recorta las líneas detrás de los textos; null = el color de fondo de la página
   tinte: 0.13,          // opacidad del tinte de cada elemento en la banda del zodíaco
   elementos: { fire: '#a3361f', earth: '#b97a52', air: '#2f6f8a', water: '#2a6e66' },
   aspectos: COLORES_ASPECTOS
  }
 };
 // Niveles de detalle, del más completo al más sobrio. pl: etiqueta de cada planeta (3 = 17°♐58′; 2 = 17°♐; 1 = 17°; 0 = solo el glifo).
 // cu: etiqueta de las cúspides ('full' = 14°♍47′, 'ds' = 14°♍, 'no' = ninguna). an: etiqueta de los ángulos ('full', 'ds', 'd' = solo grado, 'et' = solo AC/MC/DC/FC).
 var NIVELES = [
  { pl: 3, cu: 'full', an: 'full' },
  { pl: 3, cu: 'ds', an: 'full' },
  { pl: 2, cu: 'ds', an: 'ds' },
  { pl: 1, cu: 'ds', an: 'ds' },
  { pl: 1, cu: 'no', an: 'd' },
  { pl: 0, cu: 'no', an: 'et' }
 ];
 var RA_MIN = 0.38; // el círculo de aspectos mide de 0,38·R (si los planetas necesitan el lugar) a 0,46·R
 var NS_SVG = 'http://www.w3.org/2000/svg';
 var MEDIDAS = {};
 // Ángulo de pantalla (radianes, sentido antihorario desde la derecha) de una longitud. Con ascendente a la izquierda; sin hora, Aries 0° a la izquierda.
 function ang(lon, asc) { return Math.PI + (lon - asc) * Math.PI / 180; }
 function pol(cx, cy, r, a) { return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
 function n1(x) { return Math.round(x * 10) / 10; }
 function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
 // Mide un texto en el propio <svg> (misma letra, tamaño y grosor que al dibujarlo). Sirve la caja completa que ocupa el texto.
 function medidor(svg) {
  var estado = document.fonts && document.fonts.status;
  return function (txt, fam, fs, peso) {
   var k = fam + '|' + fs + '|' + (peso || 400) + '|' + txt + '|' + estado;
   if (MEDIDAS[k]) return MEDIDAS[k];
   var w = 0, h = 0, t = document.createElementNS(NS_SVG, 'text');
   t.setAttribute('font-family', fam); t.setAttribute('font-size', fs); if (peso) t.setAttribute('font-weight', peso);
   t.setAttribute('x', 0); t.setAttribute('y', 0); t.setAttribute('dominant-baseline', 'central'); t.setAttribute('visibility', 'hidden');
   t.textContent = txt; svg.appendChild(t);
   try { var b = t.getBBox(); w = b.width; h = b.height; } catch (e) { w = 0; }
   svg.removeChild(t);
   if (!w) { w = String(txt).length * fs * 0.62; h = fs * 1.25; }
   return (MEDIDAS[k] = { w: w, h: h });
  };
 }
 // Color de fondo de la página detrás del <svg> (el primer ancestro con fondo opaco), para recortar las líneas detrás de los textos.
 function fondoDe(el) {
  while (el && el.nodeType === 1) {
   var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor || '');
   if (m) { var p = m[1].split(',').map(parseFloat); if (p.length < 4 || p[3] > 0.9) return 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')'; }
   el = el.parentElement;
  }
  return null;
 }
 // Color 'rgb(r,g,b)' o '#rrggbb' a [r, g, b]; null si no se entiende
 function aRgb(c) {
  var m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c || ''), h = /^#([0-9a-f]{6})$/i.exec(c || '');
  return m ? [+m[1], +m[2], +m[3]] : h ? [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4), 16)] : null;
 }
 function mezclaRgb(bg, fg, a) { var b = aRgb(bg), f = aRgb(fg); return b && f ? 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(f[i] * a + b[i] * (1 - a)); }).join(',') + ')' : null; }
 function caja(x, y, w, h) { return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }; }
 function chocan(a, b, pad) { return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad; }
 // ¿El segmento p-q toca la caja b (agrandada en pad)?
 function segToca(p, q, b, pad) {
  var t0 = 0, t1 = 1, dx = q[0] - p[0], dy = q[1] - p[1], pp = [-dx, dx, -dy, dy], qq = [p[0] - (b.x0 - pad), (b.x1 + pad) - p[0], p[1] - (b.y0 - pad), (b.y1 + pad) - p[1]], i, r;
  for (i = 0; i < 4; i++) {
   if (pp[i] === 0) { if (qq[i] < 0) return false; }
   else { r = qq[i] / pp[i]; if (pp[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
 }
 var uid = 0;
 function dibujar(svg, carta, opciones, modo) {
  var o = mezclar(DEF, opciones), c = o.colores, sin = !carta.angles || !carta.angles.length, hayCasas = !!(carta.houses && carta.houses.length);
  var S = o.size || Math.max(260, Math.min(1000, Math.round(svg.getBoundingClientRect().width) || 560));
  var cx = S / 2, cy = S / 2, med = medidor(svg), cuerpos = carta.bodies, id = 'a29r' + (++uid), i;
  var ascEntry = sin ? null : carta.angles.filter(function (x) { return x.id === 'asc'; })[0];
  var asc = ascEntry ? ascEntry.longitude : 0;
  var halo = c.halo || (c.fondo && c.fondo !== 'none' ? c.fondo : fondoDe(svg));
  var haloAttr = halo ? ' stroke="' + halo + '" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"' : '';
  var W_T = 500, W_P = 600, W_A = 700;
  // tamaños de letra: crecen con la rueda y tienen un piso para que se lean en el celular (a 720 px: signos 24, planetas 22, textos 12)
  var chico = S < 360, fsSig = clamp(S * 0.034, chico ? 14 : 15, 36), fsPl = clamp(S * 0.031, chico ? 13.5 : 16, 34), fsT = clamp(S * 0.0168, chico ? 9.8 : 10.5, 17), fsAng = clamp(S * 0.0178, chico ? 11 : 11.5, 18), fsAngE = clamp(S * 0.0208, chico ? 12 : 12.5, 21);
  var sepCol = chico ? 0.2 : 1, sepUni = chico ? 3 : 5, fsNum = fsT * 0.96, ext = chico ? 5 : Math.max(6, Math.round(S * 0.01)), gapAng = chico ? 2 : 3;

  function pieza(t, fam, fs, peso, fill) { var m = med(t, fam, fs, peso); return { t: t, fam: fam, fs: fs, peso: peso, fill: fill, w: m.w, h: m.h }; }
  // una línea de texto hecha de piezas (grado, glifo del signo, minutos); la caja es la suma de las medidas
  function linea(piezas) {
   var w = 0, h = 0; piezas.forEach(function (p, k) { w += p.w + (k ? (p.dx != null ? p.dx : 1.2) : 0); h = Math.max(h, p.h); });
   return { piezas: piezas, w: w, h: h };
  }
  function lineaGrados(b, forma, fs, peso, fill) {
   var p = [pieza(b.degree + '°', o.fuenteTexto, fs, peso, fill)];
   if (forma !== 'd') p.push(pieza(glifoSigno(b.sign), o.fuente, fs * 1.12, 400, fill));
   if (forma === 'full') p.push(pieza(pad2(b.minute) + '′', o.fuenteTexto, fs, peso, fill));
   return linea(p);
  }
  function tspans(l) {
   return l.piezas.map(function (p, k) {
    return '<tspan' + (k ? ' dx="' + (p.dx != null ? p.dx : 1.2) + '"' : '') + ' font-family="' + p.fam + '" font-size="' + n1(p.fs) + '"' + ' font-weight="' + (p.peso || 400) + '"' + (p.fill ? ' fill="' + p.fill + '"' : '') + '>' + p.t + '</tspan>';
   }).join('');
  }

  // Intenta armar la rueda con un nivel de detalle. Devuelve el SVG o null si algo no entra sin pisarse (el último nivel siempre se dibuja).
  function armar(niv, ultimo) {
   var mar, R, Rs, Ra, Rh, rIn, tkP;
   // ---- ángulos: se miden primero porque fijan el margen exterior de la rueda
   var angLabels = [];
   if (!sin) {
    carta.angles.forEach(function (a) {
     var l1 = linea([pieza(ETIQ_ANG[a.id], o.fuenteTexto, fsAngE, W_A, c.angulos)]), l2 = niv.an === 'et' ? null : lineaGrados(a, niv.an === 'd' ? 'd' : niv.an === 'ds' ? 'ds' : 'full', fsAng, W_A, c.angulos);
     angLabels.push({ a: a, l1: l1, l2: l2, w: Math.max(l1.w, l2 ? l2.w : 0), h: l1.h + (l2 ? l2.h : 0) });
    });
   }
   // Cada etiqueta queda junto a la punta de su línea: afuera, sobre la línea, o al costado si la línea es casi vertical (así no gasta margen
   // arriba y abajo). El margen exterior es el justo para que ninguna se salga del cuadro.
   function colocarAng(al, Rr) {
    var th = ang(al.a.longitude, asc), cs2 = Math.cos(th), sn2 = Math.sin(th), hw = al.w / 2, hh = al.h / 2, x, y, g = 0;
    if (Math.abs(cs2) < 0.5) {
     x = cx + (Rr + ext) * cs2 + (cs2 < 0 ? -1 : 1) * (hw + gapAng); y = cy - (Rr + ext) * sn2;
     while (g++ < 120 && Math.hypot(clamp(cx, x - hw, x + hw) - cx, clamp(cy, y - hh, y + hh) - cy) < Rr + 3) y += sn2 >= 0 ? -0.5 : 0.5;
    } else {
     var r0 = Rr + ext + gapAng + hw * Math.abs(cs2) + hh * Math.abs(sn2); x = cx + r0 * cs2; y = cy - r0 * sn2;
    }
    return { al: al, x: x, y: y, hw: hw, hh: hh };
   }
   var angPos = [], it2, minMar = ext + gapAng + 2;
   mar = sin ? Math.max(8, Math.round(S * 0.022)) : Math.ceil(minMar + 20);
   for (it2 = 0; it2 < 8 && !sin; it2++) {
    angPos = angLabels.map(function (al) { return colocarAng(al, S / 2 - mar); });
    var ov = -1e9; angPos.forEach(function (q) { ov = Math.max(ov, 1.5 - (q.x - q.hw), (q.x + q.hw) - (S - 1.5), 1.5 - (q.y - q.hh), (q.y + q.hh) - (S - 1.5)); });
    if (Math.abs(ov) < 0.25 || (ov < 0 && mar <= minMar)) break;
    mar = Math.max(minMar, mar + ov);
   }
   if (!sin) { mar += 0.2; angPos = angLabels.map(function (al) { return colocarAng(al, S / 2 - mar); }); }
   R = S / 2 - mar; Rs = R * 0.865; Ra = R * RA_MIN;
   var anchoAnillo = hayCasas ? fsNum * (chico ? 1.2 : 1.32) : 0; Rh = Ra + anchoAnillo; rIn = (hayCasas ? Rh : Ra) + (chico ? 0.5 : 1.5);
   tkP = Math.max(3.5, S * 0.005);
   var P = function (r, lon) { return pol(cx, cy, r, ang(lon, asc)); };
   var rTk10 = R * 0.03, rTk5 = R * 0.02, rTk1 = R * 0.012;

   // ---- unidad de cada planeta: el glifo y, hacia el centro, UNA etiqueta horizontal que siempre se lee igual (grado, signo, minutos: 17°♐58′), con ℞ al final
   // si es retrógrado. Glifo y etiqueta se mueven juntos y entre unidades queda un espacio claro.
   var itemsP = cuerpos.map(function (b) {
    var menor = b.id === 'node' || b.id === 'chiron', gp = fsPl * (menor ? 0.9 : 1), tt = fsT * (menor ? 0.96 : 1), l = [], n = o.grados === false ? 0 : niv.pl, pcs = [];
    var item = function (cls, piezas) { var li = linea(piezas); return { cls: cls, l: li, w: li.w, h: li.h }; };
    l.push(item('a29-glifo', [pieza(glifoCuerpo(b.id), o.fuente, gp, 400, c.planetas)]));
    if (n >= 1) pcs.push(pieza(b.degree + '\u00B0', o.fuenteTexto, tt, W_P, c.planetas));
    if (n >= 2) pcs.push(pieza(glifoSigno(b.sign), o.fuente, tt * 1.12, 400, c.planetas));
    if (n >= 3) pcs.push(pieza(pad2(b.minute) + '\u2032', o.fuenteTexto, tt, W_P, c.planetas));
    if (b.retrograde && b.id !== 'node') { var rx = pieza(RETRO, o.fuente, tt * 1.1, 400, c.retro); rx.dx = 3; pcs.push(rx); }
    if (pcs.length) l.push(item(n ? 'a29-grado' : 'a29-retro', pcs));
    return l;
   });
   // posición de cada pieza de la columna de un planeta cuyo glifo está a la longitud lon y al radio rg; las piezas se apilan hacia el centro
   // con la separación mínima para que sus cajas no se pisen en esa dirección
   function colPos(kk, lon, rg) {
    var th = ang(lon, asc), cs = Math.cos(th), sn = Math.sin(th), ac = Math.max(Math.abs(cs), 1e-4), as = Math.max(Math.abs(sn), 1e-4), it = itemsP[kk], out = [], prev = null, q, p;
    var r = rg - (it[0].w / 2 * Math.abs(cs) + it[0].h / 2 * Math.abs(sn)); // rg es el radio del borde exterior de los glifos: así todos terminan en el mismo círculo
    for (p = 0; p < it.length; p++) {
     q = it[p];
     if (prev) r -= Math.min(((prev.w + q.w) / 2 + sepCol) / ac, ((prev.h + q.h) / 2 + sepCol) / as);
     out.push({ x: cx + r * cs, y: cy - r * sn, w: q.w, h: q.h, it: q, bx: caja(cx + r * cs, cy - r * sn, q.w, q.h) });
     prev = q;
    }
    var last = out[out.length - 1];
    return { b: out, th: th, rEnd: r - (last.w / 2 * Math.abs(cs) + last.h / 2 * Math.abs(sn)), rTop: rg };
   }
   function colChocan(A, B, pad) { var x, y; for (x = 0; x < A.b.length; x++) for (y = 0; y < B.b.length; y++) if (chocan(A.b[x].bx, B.b[y].bx, pad)) return true; return false; }
   // ---- cúspides: la etiqueta horizontal va junto a la línea, dentro de la banda, del lado donde haya lugar: se aparta de los hilos de los planetas
   // (que bajan desde su grado exacto), de las otras líneas y de las otras etiquetas. Después los planetas se apartan de las etiquetas.
   var cuspLineas = hayCasas ? carta.houses.map(function (h) { return [P(Ra, h.cusp), P(Rs, h.cusp)]; }) : [];
   var Rlim = Rs - Math.max(10.5, tkP + 6.5); // las etiquetas quedan un poco más abajo que el borde de los glifos: por ese canal pasan los hilos de los planetas corridos
   var etiquetas = [];
   if (hayCasas && niv.cu !== 'no') {
    carta.houses.forEach(function (h, kk) {
     if (kk % 3 === 0) return; // las cúspides 1, 4, 7 y 10 son los ángulos: su etiqueta va fuera de la rueda
     etiquetas.push({ h: h, kk: kk, l: lineaGrados(h, niv.cu, fsT, 400, c.cuspides || c.grados) });
    });
   }
   // La etiqueta se prefiere del lado donde no queda justo debajo de la marca de un planeta (por ahí bajaría el hilo de ese planeta)
   var marcas = cuerpos.map(function (b) { return [P(Rs - tkP, b.longitude), P(Rs - tkP - 26, b.longitude)]; });
   function colocarEtiquetas() {
    var placed = [], res = [], e, q, DESV = [0, 4, 8, 13, 19, 26];
    for (e = 0; e < etiquetas.length; e++) {
     var et = etiquetas[e], th = ang(et.h.cusp, asc), cs = Math.cos(th), sn = Math.sin(th), hw = et.l.w / 2 + 0.5, hh = et.l.h / 2;
     var hp = hw * Math.abs(sn) + hh * Math.abs(cs), ci, lado, dt, r, g, mx, mn, ccx, ccy, bx, ok, conf, pos = null, mejorConf = 1e9;
     for (ci = 0; ci < DESV.length; ci++) for (lado = 1; lado >= -1; lado -= 2) {
      dt = lado * (hp + 3.5 + DESV[ci]); r = Rlim;
      for (g = 0; g < 120; g++) {
       ccx = cx + r * cs + dt * -sn; ccy = cy - r * sn + dt * -cs;
       mx = Math.max(Math.hypot(ccx - hw - cx, ccy - hh - cy), Math.hypot(ccx + hw - cx, ccy - hh - cy), Math.hypot(ccx - hw - cx, ccy + hh - cy), Math.hypot(ccx + hw - cx, ccy + hh - cy));
       if (mx <= Rlim) break; r -= 0.75;
      }
      bx = caja(ccx, ccy, hw * 2, hh * 2);
      mn = Math.hypot(clamp(cx, bx.x0, bx.x1) - cx, clamp(cy, bx.y0, bx.y1) - cy); // punto de la caja más cercano al centro de la rueda
      ok = mn >= rIn + 2 && mx <= Rlim + 0.5;
      for (q = 0; ok && q < placed.length; q++) if (chocan(bx, placed[q], 3)) ok = false;
      for (q = 0; ok && q < cuspLineas.length; q++) if (q !== et.kk && segToca(cuspLineas[q][0], cuspLineas[q][1], bx, 1.5)) ok = false;
      if (!ok) continue;
      for (conf = 0, q = 0; q < marcas.length; q++) if (segToca(marcas[q][0], marcas[q][1], bx, 2)) conf++;
      if (conf < mejorConf) { mejorConf = conf; pos = { x: ccx, y: ccy, bx: bx, et: et, lon: asc + (Math.atan2(cy - ccy, ccx - cx) - Math.PI) * 180 / Math.PI }; }
     }
     if (!pos) return null;
     placed.push(pos.bx); res.push(pos);
    }
    return res;
   }

   // ---- planetas: cada unidad (glifo + etiqueta) se coloca lo más cerca posible de su grado exacto y del anillo del zodíaco. Si ahí no entra, se corre de
   // costado y, en un grupo apretado, hacia el centro (en escalones), hasta que no pise ninguna otra unidad, ninguna etiqueta de cúspide ni ningún hilo.
   function segCruzan(p1, p2, p3, p4) {
    function ori(a, b, c2) { return (b[0] - a[0]) * (c2[1] - a[1]) - (b[1] - a[1]) * (c2[0] - a[0]); }
    return ori(p3, p4, p1) * ori(p3, p4, p2) < 0 && ori(p1, p2, p3) * ori(p1, p2, p4) < 0;
   }
   // El hilo de cada planeta sale de la marca de su grado exacto (radio rr, justo bajo la escala) y llega al borde exterior de su glifo: o en línea recta
   // o, si en línea recta pisaría una etiqueta u otra unidad, por un riel que corre bajo la escala hasta el costado de la unidad y baja ahí.
   var rr = Rs - tkP - 0.5, rgTop = rr - 1.8, escalon = Math.max(5, S * 0.009);
   function colocarPlanetas(fijas, forzar) {
    var n = cuerpos.length, cand = [], da, dd, p, ord, gMax = -1, ini = 0, hecho = [], radPx = rgTop * Math.PI / 180;
    for (dd = 0; dd <= 7; dd++) for (da = -45; da <= 45; da += 0.75) {
     cand.push({ da: da, dd: dd * escalon, rail: false, c: Math.abs(da) * radPx + 1.7 * dd * escalon });
     if (Math.abs(da) >= 1.5) cand.push({ da: da, dd: dd * escalon, rail: true, c: Math.abs(da) * radPx + 1.7 * dd * escalon + 9 });
    }
    cand.sort(function (x, y) { return x.c - y.c; });
    ord = cuerpos.map(function (_, i2) { return i2; }).sort(function (x, y) { return cuerpos[x].longitude - cuerpos[y].longitude; });
    for (p = 0; p < n; p++) { var g = n > 1 ? (cuerpos[ord[(p + 1) % n]].longitude - cuerpos[ord[p]].longitude + 360) % 360 : 360; if (g > gMax) { gMax = g; ini = (p + 1) % n; } }
    ord = ord.slice(ini).concat(ord.slice(0, ini)); // se empieza justo después del mayor hueco, así ningún grupo queda partido
    function unidad(k, c0) {
     var L = cuerpos[k].longitude, lon = L + c0.da, col = colPos(k, lon, rgTop - c0.dd), pts = [P(rr, L)], top = pol(cx, cy, col.rTop, col.th), i3, pasos;
     if (c0.rail) {
      pasos = Math.max(1, Math.ceil(Math.abs(c0.da) / 5));
      for (i3 = 1; i3 <= pasos; i3++) pts.push(P(rr, L + c0.da * i3 / pasos));
      if (col.rTop < rr - 0.6) pts.push(top);
     } else pts.push(top);
     return { col: col, lon: lon, hilo: pts, riel: c0.rail ? [Math.min(L, lon), Math.max(L, lon)] : null, L: L };
    }
    // ¿algún tramo del hilo toca alguna de las cajas?
    function hiloToca(pts, cajas, pad) {
     var i4, x2;
     for (i4 = 0; i4 + 1 < pts.length; i4++) for (x2 = 0; x2 < cajas.length; x2++) if (segToca(pts[i4], pts[i4 + 1], cajas[x2], pad)) return true;
     return false;
    }
    function valida(k, u) {
     var q2, j, x, i5, i6, v, cajasU = u.col.b.map(function (bb) { return bb.bx; });
     if (u.col.rEnd < rIn) return false;
     for (j = 0; j < fijas.length; j++) {
      for (x = 0; x < cajasU.length; x++) if (chocan(cajasU[x], fijas[j].bx, 4)) return false;
      if (hiloToca(u.hilo, [fijas[j].bx], 0.6)) return false;
     }
     for (q2 = 0; q2 < n; q2++) {
      v = hecho[q2]; if (q2 === k || !v) continue;
      if (colChocan(u.col, v.col, sepUni)) return false;
      if (hiloToca(u.hilo, v.col.b.map(function (bb) { return bb.bx; }), 1.5)) return false;
      if (hiloToca(v.hilo, cajasU, 1.5)) return false;
      for (i5 = 0; i5 + 1 < u.hilo.length; i5++) for (i6 = 0; i6 + 1 < v.hilo.length; i6++) if (segCruzan(u.hilo[i5], u.hilo[i5 + 1], v.hilo[i6], v.hilo[i6 + 1])) return false;
      // un riel no puede pisar la marca de otro planeta ni correr sobre el riel de otro
      if (u.riel && v.L > u.riel[0] - 0.4 && v.L < u.riel[1] + 0.4) return false;
      if (v.riel && u.L > v.riel[0] - 0.4 && u.L < v.riel[1] + 0.4) return false;
      if (u.riel && v.riel && u.riel[0] < v.riel[1] + 0.4 && v.riel[0] < u.riel[1] + 0.4) return false;
     }
     return true;
    }
    function mejor(k) {
     var j, u;
     for (j = 0; j < cand.length; j++) { u = unidad(k, cand[j]); if (valida(k, u)) return u; }
     return null;
    }
    // una pasada hacia un lado y otra hacia el otro: se queda la primera en la que todas las unidades entran; las que no encuentran lugar se dejan en su grado
    // y las vueltas de mejora las vuelven a ubicar con las demás ya fijas
    function intento(orden) {
     var p2, pas2, k2, u2, viejo, malas;
     hecho = [];
     for (p2 = 0; p2 < n; p2++) { k2 = orden[p2]; u2 = mejor(k2) || unidad(k2, { da: 0, dd: 0, rail: false }); hecho[k2] = u2; }
     for (pas2 = 0; pas2 < 8; pas2++) {
      malas = 0;
      for (p2 = 0; p2 < n; p2++) { k2 = orden[(pas2 % 2 ? n - 1 - p2 : p2)]; viejo = hecho[k2]; hecho[k2] = null; u2 = mejor(k2); hecho[k2] = u2 || viejo; if (!u2) malas++; }
      if (!malas && pas2 >= 2) break;
     }
     for (p2 = 0; p2 < n; p2++) { k2 = orden[p2]; viejo = hecho[k2]; hecho[k2] = null; if (!valida(k2, viejo)) { hecho[k2] = viejo; return false; } hecho[k2] = viejo; }
     return true;
    }
    if (!intento(ord) && !intento(ord.slice().reverse()) && !forzar) return null;
    return { cols: hecho.map(function (u) { return u.col; }), conect: hecho.map(function (u) { return u.hilo; }), disp: hecho.map(function (u) { return u.lon; }) };
   }
   var etiq = colocarEtiquetas(), rp = etiq ? colocarPlanetas(etiq, false) : null;
   if (!rp) {
    if (!ultimo) return null;
    etiq = []; rp = colocarPlanetas([], true); // último recurso: se dibuja lo que se pueda, sin etiquetas de cúspide
   }

   // El círculo de aspectos queda lo más grande posible (de 0,42·R a 0,46·R) sin tocar el anillo de las casas ni los textos de los planetas
   var finMin = Math.min.apply(null, rp.cols.map(function (cc) { return cc.rEnd; }));
   Ra = clamp(finMin - 3 - anchoAnillo, R * RA_MIN, R * 0.46); Rh = Ra + anchoAnillo;

   // ================================================================= salida
   var s = [], escala = c.escala || c.anillo, desc = descripcion(carta, modo);
   s.push('<title id="' + id + '-t">' + esc(o.titulo || (modo === 'momento' ? 'Rueda de la carta del momento' : 'Rueda de la carta natal')) + '</title><desc id="' + id + '-d">' + esc(desc) + '</desc>');
   s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n1(R) + '" fill="' + c.fondo + '"/>');
   // sectores de los signos con el tinte de su elemento (fuego, tierra, aire, agua)
   var tinte = c.tinte, ELEM = ['fire', 'earth', 'air', 'water'];
   for (i = 0; i < 12; i++) {
    var a0 = ang(i * 30, asc), a1 = ang(i * 30 + 30, asc), p0 = pol(cx, cy, R, a0), p1 = pol(cx, cy, R, a1), q1 = pol(cx, cy, Rs, a1), q0 = pol(cx, cy, Rs, a0);
    s.push('<path class="a29-sector" data-signo="' + SIGNOS[i] + '" d="M' + n1(p0[0]) + ' ' + n1(p0[1]) + 'A' + n1(R) + ' ' + n1(R) + ' 0 0 0 ' + n1(p1[0]) + ' ' + n1(p1[1]) + 'L' + n1(q1[0]) + ' ' + n1(q1[1]) + 'A' + n1(Rs) + ' ' + n1(Rs) + ' 0 0 1 ' + n1(q0[0]) + ' ' + n1(q0[1]) + 'Z" fill="' + c.elementos[ELEM[i % 4]] + '" fill-opacity="' + tinte + '" stroke="none"/>');
   }
   s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n1(R) + '" fill="none" stroke="' + c.anillo + '" stroke-width="1.4"/>');
   s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n1(Rs) + '" fill="none" stroke="' + c.anillo + '" stroke-width="1.1"/>');
   s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + n1(Ra) + '" fill="none" stroke="' + c.anillo + '" stroke-width="1.1"/>');
   if (hayCasas) s.push('<circle class="a29-anillo-casas" cx="' + cx + '" cy="' + cy + '" r="' + n1(Rh) + '" fill="none" stroke="' + c.casas + '" stroke-width=".8"/>');
   // límites de los signos
   s.push('<g stroke="' + c.anillo + '" stroke-width="1">');
   for (i = 0; i < 12; i++) { var pa = P(Rs, i * 30), pb = P(R, i * 30); s.push('<line x1="' + n1(pa[0]) + '" y1="' + n1(pa[1]) + '" x2="' + n1(pb[0]) + '" y2="' + n1(pb[1]) + '"/>'); }
   s.push('</g>');
   // escala de grados en el borde interior de la banda: cada 1°, más larga cada 5° y cada 10°
   var d1 = '', d5 = '', d10 = '', paso1 = 2 * Math.PI * Rs / 360 >= 2.4, t;
   for (i = 0; i < 360; i++) {
    if (i % 5 && !paso1) continue;
    var len = i % 10 === 0 ? rTk10 : i % 5 === 0 ? rTk5 : rTk1, qa = P(Rs, i), qb = P(Rs + len, i);
    t = 'M' + n1(qa[0]) + ' ' + n1(qa[1]) + 'L' + n1(qb[0]) + ' ' + n1(qb[1]);
    if (i % 10 === 0) d10 += t; else if (i % 5 === 0) d5 += t; else d1 += t;
   }
   s.push('<g class="a29-escala" fill="none" stroke="' + escala + '"><path d="' + d1 + '" stroke-width=".6"/><path d="' + d5 + '" stroke-width=".9"/><path d="' + d10 + '" stroke-width="1.2"/></g>');
   // cúspides: línea completa desde el círculo de aspectos hasta la banda (las de los ángulos, en cobre, siguen hasta pasar el borde exterior)
   if (hayCasas) {
    s.push('<g class="a29-cuspides" stroke-linecap="butt">');
    carta.houses.forEach(function (h, kk) {
     if (kk % 3 === 0) return;
     var pa2 = P(Ra, h.cusp), pb2 = P(Rs, h.cusp);
     s.push('<line class="a29-cuspide-l" data-casa="' + h.house + '" x1="' + n1(pa2[0]) + '" y1="' + n1(pa2[1]) + '" x2="' + n1(pb2[0]) + '" y2="' + n1(pb2[1]) + '" stroke="' + c.casas + '" stroke-width="1.1"/>');
    });
    s.push('</g>');
   }
   // aspectos: líneas entre las posiciones exactas sobre el círculo central; la conjunción no se dibuja como línea
   if (o.aspectos) {
    s.push('<g class="a29-aspectos" fill="none" stroke-linecap="round">');
    carta.aspects.forEach(function (a, kk) {
     if (a.type === 'conjunction') return;
     var A1 = punto(carta, a.a), B1 = punto(carta, a.b); if (!A1 || !B1) return;
     var pa3 = P(Ra, A1.longitude), pb3 = P(Ra, B1.longitude), tight = 1 - Math.min(1, a.orb / a.max_orb), w = (0.9 + 1.3 * tight).toFixed(2), op = (0.78 + 0.22 * tight).toFixed(2);
     s.push('<line class="a29-asp" data-i="' + kk + '" data-op="' + op + '" data-w="' + w + '" x1="' + n1(pa3[0]) + '" y1="' + n1(pa3[1]) + '" x2="' + n1(pb3[0]) + '" y2="' + n1(pb3[1]) + '" stroke="' + (c.aspectos[a.type] || '#33454a') + '" stroke-width="' + w + '" stroke-opacity="' + op + '"' + (TRAZOS_ASPECTOS[a.type] ? ' stroke-dasharray="' + TRAZOS_ASPECTOS[a.type] + '"' : '') + '><title>' + esc(nombre(carta, a.a) + ' ' + a.type_name.toLowerCase() + ' ' + nombre(carta, a.b) + ', orbe ' + a.orb_dm) + '</title></line>');
    });
    s.push('</g>');
    s.push('<g class="a29-puntos" fill="' + c.puntos + '">');
    cuerpos.concat(sin ? [] : carta.angles.filter(function (x) { return x.id === 'asc' || x.id === 'mc'; })).forEach(function (b) { var pp = P(Ra, b.longitude); s.push('<circle cx="' + n1(pp[0]) + '" cy="' + n1(pp[1]) + '" r="' + n1(Math.max(2.2, S * 0.0036)) + '"/>'); });
    s.push('</g>');
   }
   // ángulos: líneas gruesas de cobre hasta pasar el borde exterior, con flecha en AC y MC (pasan por detrás de un glifo de signo, que las recorta con su halo)
   var rGlifoSig = (Rs + rTk10 + R) / 2;
   if (!sin) {
    s.push('<g class="a29-ejes" stroke="' + c.ejes + '" stroke-linecap="butt" fill="' + c.ejes + '">');
    carta.angles.forEach(function (a) {
     var th = ang(a.longitude, asc), pa4 = P(Ra, a.longitude), pb4 = P(R + ext, a.longitude);
     s.push('<line class="a29-eje" data-ang="' + a.id + '" x1="' + n1(pa4[0]) + '" y1="' + n1(pa4[1]) + '" x2="' + n1(pb4[0]) + '" y2="' + n1(pb4[1]) + '" stroke-width="2.4"/>');
     if (a.id === 'asc' || a.id === 'mc') {
      var largo = Math.max(9, S * 0.016), ancho = largo * 0.36, tip = pol(cx, cy, R + ext + 1.5, th), base = pol(cx, cy, R + ext - largo, th), nx2 = -Math.sin(th), ny2 = -Math.cos(th);
      s.push('<path class="a29-flecha" stroke="none" d="M' + n1(tip[0]) + ' ' + n1(tip[1]) + 'L' + n1(base[0] + nx2 * ancho) + ' ' + n1(base[1] + ny2 * ancho) + 'L' + n1(base[0] - nx2 * ancho) + ' ' + n1(base[1] - ny2 * ancho) + 'Z"/>');
     }
    });
    s.push('</g>');
   }
   // glifos de los signos
   s.push('<g fill="' + c.signos + '" font-family="' + o.fuente + '" font-size="' + n1(fsSig) + '" text-anchor="middle" dominant-baseline="central">');
   for (i = 0; i < 12; i++) {
    var q = P(rGlifoSig, i * 30 + 15), hs = halo && mezclaRgb(halo, c.elementos[ELEM[i % 4]], tinte);
    s.push('<text class="a29-signo" x="' + n1(q[0]) + '" y="' + n1(q[1]) + '"' + (hs ? ' stroke="' + hs + '" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"' : '') + '>' + glifoSigno(SIGNOS[i]) + '</text>');
   }
   s.push('</g>');
   // números de casa: en el medio de cada casa, en un anillo fino afuera del círculo de aspectos
   if (hayCasas) {
    s.push('<g class="a29-numcasa" fill="' + (c.numCasas || c.grados) + '" font-family="' + o.fuenteTexto + '" font-weight="' + W_T + '" font-size="' + n1(fsNum) + '" text-anchor="middle" dominant-baseline="central">');
    carta.houses.forEach(function (h, kk) {
     var f = carta.houses[(kk + 1) % 12].cusp, w2 = ((f - h.cusp) % 360 + 360) % 360, p = P((Ra + Rh) / 2, h.cusp + w2 / 2);
     s.push('<text class="a29-numc" data-casa="' + h.house + '" x="' + n1(p[0]) + '" y="' + n1(p[1]) + '">' + h.house + '</text>');
    });
    s.push('</g>');
   }
   // etiquetas de las cúspides
   if (etiq.length) {
    s.push('<g class="a29-cuspides-t" font-family="' + o.fuenteTexto + '" font-weight="400" text-anchor="middle" dominant-baseline="central"' + haloAttr + '>');
    etiq.forEach(function (e) {
     s.push('<text class="a29-cuspide" data-casa="' + e.et.h.house + '" x="' + n1(e.x) + '" y="' + n1(e.y) + '" fill="' + (c.cuspides || c.grados) + '" font-size="' + n1(fsT) + '">' + tspans(e.et.l) + '</text>');
    });
    s.push('</g>');
   }
   // planetas: marca en el grado exacto de la escala, hilo hasta el glifo y, hacia el centro, grado / signo / minutos
   cuerpos.forEach(function (b, kk) {
    var col = rp.cols[kk], pT = P(Rs, b.longitude), hilo = rp.conect[kk], pT2 = hilo[0];
    s.push('<g class="a29-planeta" data-id="' + b.id + '"><title>' + esc(b.name + ' en ' + posTexto(b) + (b.house != null ? ', casa ' + b.house : '') + (b.retrograde ? ', retrógrado' : '')) + '</title>');
    s.push('<line class="a29-marca" x1="' + n1(pT[0]) + '" y1="' + n1(pT[1]) + '" x2="' + n1(pT2[0]) + '" y2="' + n1(pT2[1]) + '" stroke="' + c.planetas + '" stroke-width="1.5"/>');
    s.push('<polyline class="a29-hilo" fill="none" stroke="' + c.planetas + '" stroke-width=".9" stroke-linejoin="round" points="' + hilo.map(function (pt) { return n1(pt[0]) + ',' + n1(pt[1]); }).join(' ') + '"/>');
    col.b.forEach(function (q) {
     s.push('<text class="' + q.it.cls + '" x="' + n1(q.x) + '" y="' + n1(q.y) + '" fill="' + q.it.l.piezas[0].fill + '" text-anchor="middle" dominant-baseline="central"' + haloAttr + '>' + tspans(q.it.l) + '</text>');
    });
    s.push('</g>');
   });
   // etiquetas de los ángulos, fuera de la rueda, junto a la punta de cada línea
   angPos.forEach(function (q) {
    var al = q.al, x = q.x, y = q.y;
    var y1 = y - al.h / 2 + al.l1.h / 2, y2 = y + al.h / 2 - (al.l2 ? al.l2.h : 0) / 2;
    s.push('<text class="a29-angulo" data-ang="' + al.a.id + '" text-anchor="middle" dominant-baseline="central" fill="' + c.angulos + '"><tspan x="' + n1(x) + '" y="' + n1(al.l2 ? y1 : y) + '" font-family="' + o.fuenteTexto + '" font-weight="' + W_A + '" font-size="' + n1(fsAngE) + '">' + ETIQ_ANG[al.a.id] + '</tspan>' +
     (al.l2 ? '<tspan x="' + n1(x) + '" y="' + n1(y2) + '">' + tspans(al.l2) + '</tspan>' : '') + '</text>');
   });
   return { html: s.join(''), nivel: niv };
  }

  var res = null;
  for (i = 0; i < NIVELES.length && !res; i++) res = armar(NIVELES[i], i === NIVELES.length - 1);
  svg.setAttribute('viewBox', '0 0 ' + S + ' ' + S);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', id + '-t ' + id + '-d');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-nivel', String(NIVELES.indexOf(res.nivel)));
  svg.innerHTML = res.html;
 }

 // dibujarRueda(svg, carta, opciones, modo): dibuja y, salvo que opciones.auto sea false o haya opciones.size, redibuja cuando cambia el ancho
 // (y cuando terminan de cargar las letras, porque el ancho de los grados depende de ellas).
 // Devuelve { redibujar(), destruir() }. El <svg> debe tener CSS width:100%; height:auto; display:block.
 function dibujarRueda(svg, carta, opciones, modo) {
  var o = opciones || {}, ro = null, ultimo = 0, quitar = null, vivo = true;
  function pintar() { ultimo = Math.round(svg.getBoundingClientRect().width); dibujar(svg, carta, o, modo); }
  pintar();
  if (o.auto !== false && !o.size) {
   if ('ResizeObserver' in window) {
    ro = new ResizeObserver(function () { var w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - ultimo) >= 2) pintar(); });
    ro.observe(svg);
   } else { var f = function () { var w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - ultimo) >= 2) pintar(); }; window.addEventListener('resize', f); quitar = f; }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (vivo) pintar(); });
  return { redibujar: pintar, destruir: function () { vivo = false; if (ro) ro.disconnect(); if (quitar) window.removeEventListener('resize', quitar); } };
 }
 // Resalta la línea de un aspecto (por su índice en carta.aspects) y atenúa las demás; resaltar(svg, null) lo deshace.
 function resaltar(svg, indice) {
  Array.prototype.forEach.call(svg.querySelectorAll('.a29-asp'), function (l) {
   var es = indice !== null && indice !== undefined && +l.getAttribute('data-i') === indice, base = l.getAttribute('data-op');
   l.setAttribute('stroke-opacity', indice === null || indice === undefined ? base : es ? '1' : '.1');
   l.setAttribute('stroke-width', es ? Math.max(2.8, +l.getAttribute('data-w') + 1.2).toFixed(1) : l.getAttribute('data-w'));
  });
 }

 window.A29Carta = {
  cargar: cargar, dibujarRueda: dibujarRueda, resaltar: resaltar, descripcion: descripcion,
  filasCuerpos: filasCuerpos, filasCasas: filasCasas, filasAngulos: filasAngulos, filasBalance: filasBalance, listaAspectos: listaAspectos,
  textos: { rol: tRol, planetaSigno: tPlanetaSigno, planetaCasa: tPlanetaCasa, angulo: tAngulo, aspecto: tAspecto, balance: tBalance },
  sinHora: sinHora,
  glifo: { cuerpo: glifoCuerpo, signo: glifoSigno, aspecto: glifoAspecto, retrogrado: RETRO + VS },
  formato: { grados: grados, posicion: posTexto, fecha: fechaAR, coordenadas: coordTexto, utc: utcTexto, velocidad: velTexto },
  colores: { aspectos: COLORES_ASPECTOS, trazos: TRAZOS_ASPECTOS, orden: ORDEN_ASPECTOS, base: DEF.colores },
  fuentes: { glifos: FUENTE_GLIFOS, texto: FUENTE_TEXTO },
  nombre: nombre, punto: punto, modoDe: modoDe,
  limite: limite, claveNatal: claveNatal
 };
})();


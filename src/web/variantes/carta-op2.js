// Carta natal y carta del momento · Diseño 2 "Observatorio" (oscuro, como el Observatorio de la portada y el estilo Terminal de Servicios).
// Idea: un tablero de cotizaciones. Las posiciones son una fila compacta por cuerpo (glifo, signo, grado, casa, ℞ y velocidad), los aspectos son una
// matriz planeta por planeta, y el significado de lo que se elige se lee en un panel lateral que se actualiza (en pantallas angostas, debajo de la fila o de la matriz).
// Usa window.A29Carta de carta.js como biblioteca (datos, textos, ayudas y rueda en SVG); acá solo se arma la pantalla.
// Ningún número de la carta se escribe a mano: todo sale del JSON que calcula el servidor (POST /api/carta, GET /api/carta/momento).
(function () {
 'use strict';
 var raiz = document.querySelector('[data-carta-observatorio]');
 if (!raiz || !window.A29Carta) return;
 var A = window.A29Carta;
 var $ = function (s) { return raiz.querySelector(s); };
 var MARCA = { aplicativo: '▲︎', separativo: '▼︎' }; // ▲ ▼ como texto, nunca emoji
 var TIPOS = { conjunction: 'Conjunción', sextile: 'Sextil', square: 'Cuadratura', trine: 'Trígono', opposition: 'Oposición' };
 var ANGS = { conjunction: '0°', sextile: '60°', square: '90°', trine: '120°', opposition: '180°' };
 var PAGINA = location.pathname.split('/').pop() || 'carta.html';
 var NOTA_SIN_HORA = 'Sin la hora de nacimiento no se calculan el Ascendente ni las casas';
 // Rueda en tonos claros sobre pizarra: todos los textos con 4,5:1 o más sobre el fondo de la rueda (#2b3d41) y las líneas con 3:1 o más.
 // Las llaves cuspides, escala, halo, tinte y elementos son las de la rueda nueva de carta.js (cúspides con su etiqueta, escala de grados, tinte por elemento).
 var COLORES = {
  fondo: '#2b3d41', anillo: '#9db0b4', casas: '#9db0b4', ejes: '#e2b48f', signos: '#f0e8dc', planetas: '#f4f0ea', grados: '#d3dadb',
  numCasas: '#c4cdce', cuspides: '#d3dadb', escala: '#9db0b4', halo: '#2b3d41', tinte: 0.16,
  elementos: { fire: '#f2937c', earth: '#e2b48f', air: '#80bde0', water: '#7fd0c2' },
  angulos: '#e2b48f', retro: '#f0cdb0', puntos: '#e2b48f',
  aspectos: { conjunction: '#d9d3c7', sextile: '#7fd0c2', square: '#f2937c', trine: '#80bde0', opposition: '#e2b48f' }
 };
 function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }
 function glifo(ch, cls) { var e = el('span', 'ob-g' + (cls ? ' ' + cls : ''), ch); e.setAttribute('aria-hidden', 'true'); return e; }
 function glifoAsp(ch, cls) { // AC y MC son letras, no símbolos: van en Inter
  if (/^[A-Z]{2}$/.test(ch)) { var e = el('span', 'ob-ang-t', ch); e.setAttribute('aria-hidden', 'true'); return e; }
  return glifo(ch, cls);
 }
 function tx(v) { return v && typeof v === 'object' ? v.texto : v; } // las funciones de textos devuelven {texto, propio} o la oración
 function sr(t) { return el('span', 'ob-sr', t); }
 function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
 var uniq = 0;

 // El modo se fija antes de cargar: así el momento nunca muestra textos de la carta natal ni el aviso del mail, aunque falle la carga.
 var MODO = A.modoDe();
 var SIN_HORA_URL = false; // la hora de nacimiento es obligatoria (S10): no hay carta sin hora

 // Datos tipeados en el formulario: solo se muestran en la pantalla, nunca se guardan. (El nombre no se lee.)
 function ingresados() {
  var q = new URLSearchParams((location.hash || '').replace(/^#/, '')), f = q.get('fecha') || '', h = q.get('hora') || '', l = (q.get('lugar') || '').slice(0, 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) f = '';
  if (!/^\d{2}:\d{2}$/.test(h)) h = '';
  return { fecha: f, hora: h, lugar: l.trim() };
 }

 // Textos y enlaces que dependen del modo (y de si falta la hora). Se llama antes y después de cargar.
 function encabezado(modo, sin, carta) {
  var m = modo === 'momento', i = carta && carta.meta.input, dur = i ? A.formato.fecha(i.date) + ', ' + (A.sinHora(carta) ? 'sin hora' : i.time) : '';
  raiz.setAttribute('data-modo', modo);
  if (sin) raiz.setAttribute('data-sinhora', ''); else raiz.removeAttribute('data-sinhora');
  $('[data-kicker]').textContent = m ? 'Carta del momento' : 'Carta natal';
  $('[data-titulo]').textContent = m ? 'La carta del momento' : 'Tu carta natal';
  document.title = 'Anaretico 29 · ' + (m ? 'La carta del momento' : 'Tu carta natal');
  if (m) {
   $('[data-bajada]').textContent = i
    ? 'El cielo de ahora: ' + A.formato.fecha(i.date) + ', ' + i.time + ' de Buenos Aires (' + carta.meta.utc_instant.slice(11, 16) + ' UTC). Las posiciones, casas, balance de elementos y aspectos, con sus posibles significados.'
    : 'Las posiciones, casas, balance de elementos y aspectos del cielo de ahora, para Buenos Aires.';
   $('[data-sello]').textContent = 'Cielo de ahora';
  } else {
   $('[data-bajada]').textContent = 'Tus posiciones, casas, balance de elementos y aspectos, con sus posibles significados.';
   $('[data-sello]').textContent = 'Con tus datos';
  }
  var otro = $('[data-otro]');
  otro.hidden = m; otro.textContent = 'Ver la carta del momento'; otro.href = '/carta?modo=momento';
  $('[data-leer-t]').textContent = m ? 'Cómo leer esta carta' : 'Cómo leer tu carta';
  var nota = $('[data-sinhora-nota]');
  nota.hidden = !sin;
  if (sin) {
   var resto = carta && carta.meta.time_note ? carta.meta.time_note.replace(/^No se conoce la hora de nacimiento:\s*/, '') : '';
   nota.textContent = NOTA_SIN_HORA + '.' + (resto ? ' ' + cap(resto) : '');
  }
  var cie = $('[data-cierre-t]');
  if (cie) cie.textContent = m ? 'En una consulta leemos el cielo de un momento con tus preguntas, sin atajos.' : 'En una consulta miramos la carta completa con tu historia y tus preguntas, sin atajos.';
 }

 function campo(dl, k, v, ancho) { var d = el('div', 'ob-dr' + (ancho ? ' ob-dr-ancho' : '')); d.appendChild(el('dt', '', k)); d.appendChild(el('dd', '', v)); dl.appendChild(d); }

 // Boleto de datos: fecha, hora, lugar, coordenadas, huso y motor
 function datos(modo, sin, carta) {
  var m = carta.meta, i = m.input, dl = $('[data-datos]'), ing = ingresados();
  dl.textContent = '';
  if (modo === 'natal') {
   campo(dl, 'Fecha de nacimiento', A.formato.fecha(i.date));
   if (sin) { campo(dl, 'Hora de nacimiento', 'No informada'); campo(dl, 'Hora usada para el cálculo', i.time + ' (hora local)'); }
   else campo(dl, 'Hora local', i.time);
  } else {
   campo(dl, 'Fecha', A.formato.fecha(i.date));
   campo(dl, 'Hora', i.time + ' (hora de Buenos Aires)');
  }
  campo(dl, 'Lugar', i.place);
  campo(dl, 'Coordenadas', A.formato.coordenadas(i.latitude, i.longitude));
  campo(dl, 'Huso horario usado', i.timezone.replace(/_/g, ' ').replace(/\//g, '/\u200b') + ' · UTC' + m.utc_offset.replace('-', '−'));
  campo(dl, 'Hora universal (UTC)', A.formato.utc(m.utc_instant));
  campo(dl, 'Zodíaco y casas', sin ? 'Tropical · sin casas' : 'Tropical · ' + m.house_system);
  campo(dl, 'Motor de cálculo', m.engine, true);
  var p = $('[data-ingresado]');
  if (modo === 'natal' && (ing.fecha || ing.hora || ing.lugar)) {
   var partes = [ing.fecha && A.formato.fecha(ing.fecha), ing.hora, ing.lugar].filter(Boolean).join(' · ');
   p.textContent = '';
   p.appendChild(el('strong', '', 'Lo que ingresaste: '));
   p.appendChild(document.createTextNode(partes + '.'));
   p.hidden = false;
  } else p.hidden = true;
 }

 // Cinta de posiciones, como un ticker (estática: sin movimiento). Repite lo que dice el tablero, por eso va oculta a lectores de pantalla.
 function cinta(carta, sig, modo) {
  var ul = $('[data-cinta]'); ul.textContent = '';
  var angs = A.filasAngulos(carta, sig, modo).filter(function (a) { return a.id === 'asc' || a.id === 'mc'; }).map(function (a) { return { g: a.etiqueta, n: a.nombre, gs: a.glifoSigno, p: a.grados, r: false }; });
  var filas = angs.concat(A.filasCuerpos(carta, sig, modo).map(function (f) { return { g: f.glifo, n: f.nombre, gs: f.glifoSigno, p: f.grados, r: f.retrogrado }; }));
  filas.forEach(function (f) {
   var li = el('li', 'ob-tk'); li.title = f.n;
   li.appendChild(glifoAsp(f.g, 'ob-gp'));
   li.appendChild(glifo(f.gs, 'ob-gs'));
   li.appendChild(el('span', 'ob-tk-v', f.p));
   if (f.r) li.appendChild(el('span', 'ob-tk-r', A.glifo.retrogrado));
   ul.appendChild(li);
  });
 }

 function leyenda(ul) {
  ul.textContent = '';
  A.colores.orden.forEach(function (t) {
   var li = el('li'), s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
   s.setAttribute('viewBox', '0 0 34 8'); s.setAttribute('width', '34'); s.setAttribute('height', '8'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
   var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
   l.setAttribute('x1', '1'); l.setAttribute('x2', '33'); l.setAttribute('y1', '4'); l.setAttribute('y2', '4'); l.setAttribute('stroke', COLORES.aspectos[t]); l.setAttribute('stroke-width', t === 'conjunction' ? '2.2' : '1.6'); l.setAttribute('stroke-linecap', 'round');
   if (A.colores.trazos[t]) l.setAttribute('stroke-dasharray', A.colores.trazos[t]);
   if (t !== 'conjunction') { s.appendChild(l); li.appendChild(s); }
   var g = glifo(A.glifo.aspecto(t)); g.style.color = COLORES.aspectos[t]; li.appendChild(g);
   li.appendChild(document.createTextNode(TIPOS[t] + ' ' + ANGS[t] + (t === 'conjunction' ? ' · sin línea' : '')));
   ul.appendChild(li);
  });
 }

 // ---------------------------------------------------------------- selección: un solo lugar de lectura (panel lateral o debajo de la fila)
 var ctx = null;          // { carta, sig, modo, svg, cuerpos, angulos, lista, mapa }
 var reg = {};            // clave -> { btn, slot }
 var sel = null;          // clave elegida
 var ANCHO = window.matchMedia('(min-width:1100px)');

 function bloque(etq, texto) { var d = el('div', 'ob-lec-b'); d.appendChild(el('p', 'ob-lec-l', etq)); d.appendChild(el('p', 'ob-lec-t', texto)); return d; }
 function leerContenido(s) {
  var c = ctx, d = el('div', 'ob-lec'), modo = c.modo, tt = el('h3', 'ob-lec-h'), pos = el('p', 'ob-lec-p');
  d.appendChild(el('p', 'ob-kick', 'Posible significado · borrador'));
  if (s.t === 'aspecto') {
   var a = c.lista[s.i], raw = c.carta.aspects[s.i];
   var g = el('span', 'ob-lec-g'); g.appendChild(glifoAsp(a.glifoA, 'ob-gp')); var gt = glifo(a.tipoGlifo, 'ob-gt'); gt.style.color = COLORES.aspectos[a.tipo]; g.appendChild(gt); g.appendChild(glifoAsp(a.glifoB, 'ob-gp'));
   tt.appendChild(g); tt.appendChild(el('span', '', a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB));
   d.appendChild(tt);
   pos.textContent = a.tipoNombre + ' (' + a.angulo + ') · orbe ' + a.orbe + ' · ' + a.fase;
   d.appendChild(pos);
   d.appendChild(el('p', 'ob-lec-t', tx(A.textos.aspecto(c.carta, raw, c.sig, modo))));
   var gen = el('p', 'ob-peq'); gen.appendChild(el('strong', '', a.tipoNombre + ' (' + a.angulo + '): ')); gen.appendChild(document.createTextNode(a.textoTipo)); d.appendChild(gen);
   return d;
  }
  var f = s.t === 'cuerpo' ? c.cuerpos[s.id] : c.angulos[s.id];
  var gl = s.t === 'cuerpo' ? f.glifo : f.etiqueta;
  tt.appendChild(glifoAsp(gl, 'ob-gp')); tt.appendChild(el('span', '', f.nombre)); d.appendChild(tt);
  var partes = [f.signo + ' ' + f.grados];
  if (s.t === 'cuerpo' && f.casa != null) partes.push('casa ' + f.casa);
  pos.textContent = partes.join(' · '); d.appendChild(pos);
  var rol = A.textos.rol(c.carta, s.id, c.sig, modo);
  if (rol) d.appendChild(el('p', 'ob-lec-t ob-lec-rol', tx(rol)));
  var b = c.bruto[s.id];
  if (s.t === 'cuerpo') {
   d.appendChild(bloque('En ' + f.signo, tx(A.textos.planetaSigno(c.carta, s.id, c.sig, modo))));
   if (b.house != null) d.appendChild(bloque('En la casa ' + f.casa + (f.casaNombre ? ' · ' + f.casaNombre.toLowerCase() : ''), tx(A.textos.planetaCasa(c.carta, s.id, c.sig, modo))));
   d.appendChild(el('p', 'ob-peq', 'Movimiento diario: ' + f.velocidad + (f.retrogrado ? ' (retrógrado)' : '') + '.'));
  } else if (s.id === 'asc' || s.id === 'mc') {
   d.appendChild(bloque('En ' + f.signo, tx(A.textos.angulo(c.carta, s.id, c.sig, modo))));
  }
  return d;
 }

 function vaciar(n) { while (n.firstChild) n.removeChild(n.firstChild); }
 function seleccionar(s) {
  var k = s ? s.t + ':' + (s.t === 'aspecto' ? s.i : s.id) : null;
  if (k === sel) { s = null; k = null; }
  sel = k;
  var mx = $('[data-mx-inline]'), panel = $('[data-panel]');
  Object.keys(reg).forEach(function (c) {
   var r = reg[c], on = c === k;
   r.btn.setAttribute('aria-expanded', String(on));
   r.btn.classList.toggle('is-sel', on);
   if (r.fila) r.fila.classList.toggle('is-sel', on);
   if (r.slot !== mx) { var cont = r.slot.firstChild.firstChild; vaciar(cont); r.slot.hidden = !on; if (on) cont.appendChild(leerContenido(s)); }
  });
  vaciar(mx); mx.hidden = true;
  vaciar(panel);
  if (!s) { panel.appendChild(el('p', 'ob-vacio', 'Elegí un cuerpo del tablero' + (ctx.matriz ? ' o una celda de la matriz' : '') + ' para leer su posible significado.')); }
  else {
   panel.appendChild(leerContenido(s));
   if (s.t === 'aspecto') { mx.appendChild(leerContenido(s)); mx.hidden = false; }
  }
  A.resaltar(ctx.svg, s && s.t === 'aspecto' ? s.i : null);
 }
 function enlazar(btn, s, slot) {
  var k = s.t + ':' + (s.t === 'aspecto' ? s.i : s.id);
  reg[k] = { btn: btn, slot: slot, fila: btn.closest('tr.ob-fila') };
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', ANCHO.matches ? 'ob-panel' : slot.id);
  btn.addEventListener('click', function () { seleccionar(s); });
 }
 ANCHO.addEventListener && ANCHO.addEventListener('change', function () {
  Object.keys(reg).forEach(function (c) { var r = reg[c]; r.btn.setAttribute('aria-controls', ANCHO.matches ? 'ob-panel' : r.slot.id); });
 });
 function flechas(btns) { // ↑ ↓ entre las filas del tablero
  btns.forEach(function (b, i) {
   b.addEventListener('keydown', function (e) {
    var j = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -1;
    if (j < 0 || j >= btns.length) return;
    e.preventDefault(); btns[j].focus();
   });
  });
 }
 function boton(glifoTxt, nombre) {
  var b = el('button', 'ob-sel'); b.type = 'button';
  b.appendChild(glifoAsp(glifoTxt, 'ob-gp')); b.appendChild(el('span', '', nombre));
  return b;
 }
 function filaSlot(tr, cols) { // fila de lectura debajo de la fila elegida (solo se ve en pantallas angostas)
  var id = 'ob-m-' + (++uniq), tm = el('tr', 'ob-mean'); tm.id = id; tm.hidden = true;
  var td = el('td'); td.colSpan = cols; td.appendChild(el('div', 'ob-mean-c')); tm.appendChild(td);
  tr.parentNode.insertBefore(tm, tr.nextSibling);
  return tm;
 }

 // ---------------------------------------------------------------- Posiciones: tablero de cotizaciones
 function tablero(carta, sig, modo, sin) {
  var tb = $('[data-tabla] tbody'), btns = []; tb.textContent = '';
  $('[data-col-casa]').hidden = sin;
  A.filasCuerpos(carta, sig, modo).forEach(function (f) {
   var tr = el('tr', 'ob-fila'); tb.appendChild(tr);
   var c1 = el('th', 'ob-c-cuerpo'); c1.scope = 'row'; var b = boton(f.glifo, f.nombre); c1.appendChild(b); tr.appendChild(c1); btns.push(b);
   var c2 = el('td', 'ob-c-signo'); c2.appendChild(glifo(f.glifoSigno, 'ob-gs')); c2.appendChild(el('span', '', f.signo)); tr.appendChild(c2);
   tr.appendChild(el('td', 'ob-r ob-num ob-c-grado', f.grados));
   if (!sin) tr.appendChild(el('td', 'ob-r ob-num ob-c-casa', f.casa == null ? '' : f.casa));
   var c5 = el('td', 'ob-r ob-num ob-c-vel' + (f.retrogrado ? ' is-rx' : ''));
   if (f.retrogrado) { c5.appendChild(glifo(A.glifo.retrogrado, 'ob-rx')); c5.appendChild(sr('Retrógrado, ')); } else c5.appendChild(sr('Directo, '));
   c5.appendChild(el('span', '', f.velocidad)); tr.appendChild(c5);
   var slot = filaSlot(tr, sin ? 4 : 5);
   enlazar(b, { t: 'cuerpo', id: f.id }, slot);
   tr.addEventListener('click', function (e) { if (!e.target.closest('button')) seleccionar({ t: 'cuerpo', id: f.id }); });
  });
  flechas(btns);
 }

 // ---------------------------------------------------------------- Casas y ángulos
 function casasYAngulos(carta, sig, modo, sin) {
  var tc = $('[data-casas] tbody'), ta = $('[data-angulos] tbody'), btns = []; tc.textContent = ''; ta.textContent = '';
  $('[data-con-casas]').hidden = sin;
  var ns = $('[data-sinhora-casas]'); ns.hidden = !sin; ns.textContent = sin ? NOTA_SIN_HORA + ': no hay casas ni ángulos para mostrar. Los planetas, el balance y los aspectos entre planetas sí se calculan.' : '';
  $('[data-nota-casas]').hidden = sin;
  if (sin) return;
  A.filasCasas(carta, sig, modo).forEach(function (h) {
   var tr = el('tr');
   var a = el('th', 'ob-r ob-num', h.casa); a.scope = 'row'; tr.appendChild(a);
   tr.appendChild(el('td', '', h.nombre));
   var c = el('td', 'ob-num'); c.appendChild(glifo(h.glifoSigno, 'ob-gs')); c.appendChild(el('span', '', h.signo + ' ' + h.grados)); tr.appendChild(c);
   tc.appendChild(tr);
  });
  A.filasAngulos(carta, sig, modo).forEach(function (a) {
   var tr = el('tr', 'ob-fila'); ta.appendChild(tr);
   var c0 = el('th', 'ob-c-cuerpo'); c0.scope = 'row'; var b = boton(a.etiqueta, a.nombre); c0.appendChild(b); tr.appendChild(c0); btns.push(b);
   var c1 = el('td', 'ob-num'); c1.appendChild(glifo(a.glifoSigno, 'ob-gs')); c1.appendChild(el('span', '', a.signo + ' ' + a.grados)); tr.appendChild(c1);
   enlazar(b, { t: 'angulo', id: a.id }, filaSlot(tr, 2));
   tr.addEventListener('click', function (e) { if (!e.target.closest('button')) seleccionar({ t: 'angulo', id: a.id }); });
  });
  flechas(btns);
 }

 // ---------------------------------------------------------------- Matriz de aspectos (triángulo planeta por planeta)
 function matriz(carta, lista) {
  var puntos = carta.aspect_rules.points.filter(function (id) { return A.punto(carta, id); });
  var mapa = {};
  lista.forEach(function (a) { mapa[a.a + '|' + a.b] = a; mapa[a.b + '|' + a.a] = a; });
  var th = $('[data-matriz] thead'), tb = $('[data-matriz] tbody'), n = puntos.length, grilla = [], mx = $('[data-mx-inline]');
  th.textContent = ''; tb.textContent = '';
  // las referencias ocupan la mitad vacía del triángulo (arriba a la derecha): ancho = la mitad de las columnas de celdas
  $('.ob-mx-w').style.setProperty('--mx-ancho', (Math.floor((n - 1) / 2) / n * 100).toFixed(2) + '%');
  var h0 = el('tr'), corner = el('td', 'ob-mx-h'); corner.appendChild(sr('Planeta o punto')); h0.appendChild(corner);
  function cab(id, fila) { var c = el('th', 'ob-mx-h'); c.scope = fila ? 'row' : 'col'; c.title = A.nombre(carta, id); c.appendChild(glifoAsp(A.glifo.cuerpo(id), 'ob-gp')); c.appendChild(sr(A.nombre(carta, id))); return c; }
  for (var c = 0; c < n - 1; c++) h0.appendChild(cab(puntos[c], false));
  th.appendChild(h0);
  for (var r = 1; r < n; r++) {
   var tr = el('tr'); tr.appendChild(cab(puntos[r], true)); grilla[r] = [];
   for (var k = 0; k < r; k++) {
    var td = el('td', 'ob-mx-c'), a = mapa[puntos[r] + '|' + puntos[k]];
    if (a) {
     var b = el('button', 'ob-mx-b'); b.type = 'button';
     b.setAttribute('aria-label', a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB + ', orbe ' + a.orbe + ', ' + a.fase);
     var g = glifo(a.tipoGlifo, 'ob-mx-g'); g.style.color = COLORES.aspectos[a.tipo]; b.appendChild(g);
     var o = el('span', 'ob-mx-o'); o.setAttribute('aria-hidden', 'true'); o.appendChild(el('span', 'ob-mx-f', MARCA[a.fase] || '')); o.appendChild(document.createTextNode(a.orbe)); b.appendChild(o);
     td.appendChild(b); grilla[r][k] = b;
     enlazar(b, { t: 'aspecto', i: a.indice }, mx);
    }
    tr.appendChild(td);
   }
   tb.appendChild(tr);
  }
  // flechas entre celdas: salta las vacías en la dirección elegida
  grilla.forEach(function (fila, r) {
   if (!fila) return;
   fila.forEach(function (b, k) {
    if (!b) return;
    b.addEventListener('keydown', function (e) {
     var dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0, dk = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
     if (!dr && !dk) return;
     e.preventDefault();
     var rr = r + dr, kk = k + dk;
     while (rr >= 1 && rr < n && kk >= 0 && kk < n - 1) { if (grilla[rr] && grilla[rr][kk]) { grilla[rr][kk].focus(); return; } rr += dr; kk += dk; }
    });
   });
  });
  return n > 1;
 }

 // ---------------------------------------------------------------- Lista de aspectos (para lectores de pantalla y celulares)
 function aspectos(carta, sig, svg, lista, modo) {
  var cont = $('[data-aspectos]'), cab = cont.querySelector('.ob-asp-cab');
  cont.textContent = ''; if (cab) cont.appendChild(cab);
  lista.forEach(function (a) {
   var d = el('details', 'ob-asp'), s = el('summary');
   var g = el('span', 'ob-asp-g'); g.appendChild(glifoAsp(a.glifoA, 'ob-gp')); var gt = glifo(a.tipoGlifo, 'ob-gt'); gt.style.color = COLORES.aspectos[a.tipo]; g.appendChild(gt); g.appendChild(glifoAsp(a.glifoB, 'ob-gp')); s.appendChild(g);
   s.appendChild(el('span', 'ob-asp-n', a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB));
   var o = el('span', 'ob-asp-o'); o.appendChild(el('span', 'ob-l', 'orbe ')); o.appendChild(document.createTextNode(a.orbe)); s.appendChild(o);
   var f = el('span', 'ob-asp-f ' + (a.fase === 'aplicativo' ? 'is-ap' : 'is-sp'));
   var mk = el('b', 'ob-mk', MARCA[a.fase] || ''); mk.setAttribute('aria-hidden', 'true'); f.appendChild(mk);
   f.appendChild(el('span', '', cap(a.fase))); s.appendChild(f);
   s.appendChild(el('span', 'ob-ver-m')); s.lastChild.setAttribute('aria-hidden', 'true');
   d.appendChild(s);
   var c = el('div', 'ob-asp-c');
   c.appendChild(el('p', 'ob-kick', 'Posible significado · borrador'));
   c.appendChild(el('p', '', tx(A.textos.aspecto(carta, carta.aspects[a.indice], sig, modo))));
   var gen = el('p', 'ob-peq'); gen.appendChild(el('strong', '', a.tipoNombre + ' (' + a.angulo + '): ')); gen.appendChild(document.createTextNode(a.textoTipo)); c.appendChild(gen);
   d.appendChild(c);
   var quita = function () { A.resaltar(svg, d.open ? a.indice : (sel && /^aspecto:/.test(sel) ? +sel.slice(8) : null)); };
   s.addEventListener('mouseenter', function () { A.resaltar(svg, a.indice); });
   s.addEventListener('focus', function () { A.resaltar(svg, a.indice); });
   s.addEventListener('mouseleave', quita); s.addEventListener('blur', quita);
   d.addEventListener('toggle', quita);
   cont.appendChild(d);
  });
  var det = $('[data-lista]');
  if (window.matchMedia('(max-width:720px)').matches) det.open = true; // en el celular no hay matriz: la lista es la vista de los aspectos
 }

 // ---------------------------------------------------------------- Balance: barras horizontales, como la profundidad de un mercado
 function barras(cont, filas, dest, grupo, carta, sig, modo) {
  cont.textContent = '';
  filas.forEach(function (f) {
   var r = el('div', 'ob-b' + (f.dominante ? ' is-dom' : ''));
   var n = el('div', 'ob-b-n'); n.appendChild(el('strong', '', f.nombre)); n.appendChild(el('small', '', f.palabra));
   if (f.dominante) n.appendChild(el('em', 'ob-b-dom', 'Predomina'));
   r.appendChild(n);
   var t = el('div', 'ob-b-t'); t.style.setProperty('--n', f.total); t.setAttribute('role', 'img'); t.setAttribute('aria-label', f.nombre + ': ' + f.cantidad + ' de ' + f.total + ' puntos, ' + f.porcentaje + '%');
   for (var k = 0; k < f.total; k++) t.appendChild(el('i', k < f.cantidad ? 'on' : ''));
   r.appendChild(t);
   var c = el('div', 'ob-b-c'); c.appendChild(el('b', '', f.cantidad + ' / ' + f.total)); c.appendChild(el('span', '', f.porcentaje + ' %')); r.appendChild(c);
   var g = el('div', 'ob-b-p');
   if (!f.puntos.length) g.textContent = 'Ningún punto';
   f.puntos.forEach(function (p) { var s = el('span', 'ob-b-pt'); s.title = p.nombre; if (/^[A-Z]{2}$/.test(p.glifo)) s.appendChild(el('span', 'ob-ang-t', p.glifo)); else s.appendChild(glifo(p.glifo)); s.appendChild(sr(p.nombre + ' ')); g.appendChild(s); });
   r.appendChild(g);
   cont.appendChild(r);
  });
  var t = A.textos.balance(carta, sig, grupo, modo);
  dest.textContent = '';
  dest.appendChild(el('strong', '', t.titulo + ' '));
  dest.appendChild(document.createTextNode(t.texto));
 }

 // Cómo leer: los pasos dependen de la pantalla (tablero y matriz) y de si hay hora
 function comoLeer(modo, sin) {
  var ol = $('[data-leer]'); ol.textContent = '';
  var pasos = [
   ['La rueda. ', sin
    ? 'Sin la hora de nacimiento no hay Ascendente ni casas: la rueda muestra los signos y los planetas en su posición. Los signos avanzan en sentido contrario a las agujas del reloj.'
    : 'El Ascendente (AC) queda a la izquierda y los signos avanzan en sentido contrario a las agujas del reloj. Las doce casas se numeran desde el Ascendente.'],
   ['El tablero de posiciones. ', 'Cada fila es un cuerpo: el planeta es una función (pensar, sentir, actuar); el signo, el modo en que se expresa' + (sin ? '.' : '; la casa, el área de la vida donde se nota.')],
   ['Aspectos y orbe. ', 'Las líneas de la rueda y las celdas de la matriz unen planetas que forman, con cierto margen (orbe), un ángulo de 0°, 60°, 90°, 120° o 180°. El orbe es cuánto se aparta de ese ángulo exacto: cuanto menor, más fuerte.'],
   ['Retrógrado (℞︎). ', 'Visto desde la Tierra, el planeta parece ir hacia atrás. En la lectura suele señalar un tema que se revisa o se vive más hacia adentro.'],
   ['Posibles significados. ', 'Son lecturas orientativas, no sentencias: una carta describe tendencias y recursos, y no decide lo que va a pasar.']
  ];
  pasos.forEach(function (p) { var li = el('li'); li.appendChild(el('strong', '', p[0])); li.appendChild(document.createTextNode(p[1])); ol.appendChild(li); });
 }

 function pintar(r) {
  var modo = r.modo, carta = r.carta, sig = r.significados, sin = modo === 'natal' && A.sinHora(carta);
  encabezado(modo, sin, carta);
  datos(modo, sin, carta); cinta(carta, sig, modo); leyenda($('[data-leyenda]')); leyenda($('[data-leyenda-mx]'));
  var svg = $('[data-rueda]');
  A.dibujarRueda(svg, carta, { colores: COLORES }, modo);
  var lista = A.listaAspectos(carta, sig, modo), cuerpos = {}, angulos = {}, bruto = {};
  A.filasCuerpos(carta, sig, modo).forEach(function (f) { cuerpos[f.id] = f; });
  A.filasAngulos(carta, sig, modo).forEach(function (f) { angulos[f.id] = f; });
  carta.bodies.concat(carta.angles).forEach(function (b) { bruto[b.id] = b; });
  reg = {}; sel = null;
  ctx = { carta: carta, sig: sig, modo: modo, svg: svg, cuerpos: cuerpos, angulos: angulos, bruto: bruto, lista: lista, matriz: true };
  tablero(carta, sig, modo, sin); casasYAngulos(carta, sig, modo, sin);
  ctx.matriz = matriz(carta, lista);
  $('[data-regla]').textContent = carta.balance.rule;
  $('[data-difiere]').hidden = true; // el mismo criterio que la portada (Fernando, 24/11/2026)
  barras($('[data-elementos]'), A.filasBalance(carta, sig, 'elements', modo), $('[data-dom-elementos]'), 'elements', carta, sig, modo);
  barras($('[data-modalidades]'), A.filasBalance(carta, sig, 'modalities', modo), $('[data-dom-modalidades]'), 'modalities', carta, sig, modo);
  $('[data-regla-aspectos]').textContent = carta.aspect_rules.rule;
  $('[data-n-aspectos]').textContent = carta.aspects.length + ' aspectos, del más exacto al menos exacto.';
  aspectos(carta, sig, svg, lista, modo);
  comoLeer(modo, sin);
  raiz.classList.add('is-listo');
  var pdf = $('[data-pdf]'); if (pdf) pdf.hidden = modo !== 'natal';
  var cargando = $('[data-cargando]'); if (cargando) cargando.hidden = true;
  seleccionar(null);
  if (ANCHO.matches) seleccionar({ t: 'cuerpo', id: 'sun' }); // en pantalla ancha el panel arranca con el Sol
 }

 // S14: el PDF es la impresión del navegador («Guardar como PDF») con la hoja @media print de carta-op2.css: nada sale a otro servicio.
 function paraImprimir() { var d = $('[data-lista]'); if (d) d.open = true; }
 window.addEventListener('beforeprint', paraImprimir);
 var bpdf = $('[data-pdf-btn]');
 if (bpdf) bpdf.addEventListener('click', function () { paraImprimir(); window.print(); });

 // Sin carta (datos rechazados, el límite de la semana o un error): solo el aviso y el cierre, nada a medias.
 var LIMITE_TXT = 'Ya calculaste tus 2 cartas de esta semana. Si querés una lectura completa, agendá una consulta';
 var WHATSAPP = 'https://wa.me/5491153144378';
 function sinCarta(err) {
  raiz.querySelector('.ob-top').classList.add('ob-top-sola'); // sin la rueda, la cabecera en una columna (carta-op2.css)
  Array.prototype.forEach.call(raiz.querySelectorAll('.ob-lado, .ob-ficha, .ob-cinta, .ob-mesa-w, #balance, #como-leer'), function (n) { n.style.display = 'none'; });
  var c = $('[data-cargando]'), p, a;
  if (!c) return;
  c.hidden = false; c.textContent = '';
  p = el('p', 'ob-enlaces');
  if (err && err.limite) {
   c.textContent = LIMITE_TXT;
   a = el('a', 'ob-btn', 'Agendá una consulta'); a.href = WHATSAPP; a.target = '_blank'; a.rel = 'noopener';
  } else {
   c.classList.add('is-error');
   c.textContent = (err && err.mensaje) || 'No pudimos cargar la carta. Recargá la página para intentarlo de nuevo.';
   if (err && err.campo) { a = el('a', 'ob-link', 'Volver al formulario'); a.href = '/#herramientas'; }
  }
  if (a) { p.appendChild(a); c.parentNode.insertBefore(p, c.nextSibling); }
 }

 // Si cambian los datos después del # con la página abierta, se calcula de nuevo como al abrirla (con el mismo límite): la carta anterior
 // no queda en pantalla ni se imprime. Los mismos datos (misma huella) o un ancla de la página (#inicio) no recalculan.
 var CLAVE = A.claveNatal();
 window.addEventListener('hashchange', function () { var k = A.claveNatal(); if (MODO === 'natal' && k && k !== CLAVE) location.reload(); });

 encabezado(MODO, SIN_HORA_URL, null); // antes de pedir los datos
 A.cargar().then(pintar).catch(function (err) {
  if (err && err.sinDatos) { location.replace('/#herramientas'); return; } // /carta sin datos: al formulario de la portada
  if (window.console && !(err && (err.limite || err.mensaje))) console.error('carta-op2.js:', err);
  sinCarta(err);
 });
})();

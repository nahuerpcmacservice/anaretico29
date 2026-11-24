// Carta natal y carta del momento · Diseño 2 "Observatorio" (oscuro, como el Observatorio de la portada y el estilo Terminal de Servicios).
// Idea: un tablero de cotizaciones. Las posiciones son una fila compacta por cuerpo (glifo, signo, grado, casa, ℞ y velocidad), los aspectos son una
// matriz planeta por planeta. La carta se muestra sola, sin textos de interpretación (S15).
// Usa window.A29Carta de carta.js como biblioteca (datos, ayudas y rueda en SVG); acá solo se arma la pantalla.
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
 function sr(t) { return el('span', 'ob-sr', t); }
 function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
    ? 'El cielo de ahora: ' + A.formato.fecha(i.date) + ', ' + i.time + ' de Buenos Aires (' + carta.meta.utc_instant.slice(11, 16) + ' UTC). Las posiciones, casas, balance de elementos y aspectos.'
    : 'Las posiciones, casas, balance de elementos y aspectos del cielo de ahora, para Buenos Aires.';
   $('[data-sello]').textContent = 'Cielo de ahora';
  } else {
   $('[data-bajada]').textContent = 'Tus posiciones, casas, balance de elementos y aspectos.';
   $('[data-sello]').textContent = 'Con tus datos';
  }
  var otro = $('[data-otro]');
  otro.hidden = m; otro.textContent = 'Ver la carta del momento'; otro.href = '/carta?modo=momento';
  var nota = $('[data-sinhora-nota]');
  nota.hidden = !sin;
  if (sin) {
   var resto = carta && carta.meta.time_note ? carta.meta.time_note.replace(/^No se conoce la hora de nacimiento:\s*/, '') : '';
   nota.textContent = NOTA_SIN_HORA + '.' + (resto ? ' ' + cap(resto) : '');
  }
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
 function cinta(carta) {
  var ul = $('[data-cinta]'); ul.textContent = '';
  var angs = A.filasAngulos(carta).filter(function (a) { return a.id === 'asc' || a.id === 'mc'; }).map(function (a) { return { g: a.etiqueta, n: a.nombre, gs: a.glifoSigno, p: a.grados, r: false }; });
  var filas = angs.concat(A.filasCuerpos(carta).map(function (f) { return { g: f.glifo, n: f.nombre, gs: f.glifoSigno, p: f.grados, r: f.retrogrado }; }));
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

 // ---------------------------------------------------------------- S15: la carta se muestra sola (Fernando, 24/11/2026)
 // El dibujo, las posiciones, las casas, el balance y los aspectos, sin textos de interpretación: nada se elige para leer.
 // Pasar el puntero por una celda de la matriz o por un aspecto de la lista resalta su línea en la rueda.
 function nombrePunto(glifoTxt, nombre) { // el glifo y el nombre, con la misma caja que tenían los botones del tablero
  var s = el('span', 'ob-sel ob-sel-dato');
  s.appendChild(glifoAsp(glifoTxt, 'ob-gp')); s.appendChild(el('span', '', nombre));
  return s;
 }
 function resaltarAl(n, svg, i) {
  n.addEventListener('mouseenter', function () { A.resaltar(svg, i); });
  n.addEventListener('mouseleave', function () { A.resaltar(svg, null); });
 }

 // ---------------------------------------------------------------- Posiciones: tablero de cotizaciones
 function tablero(carta) {
  var tb = $('[data-tabla] tbody'); tb.textContent = '';
  $('[data-col-casa]').hidden = false;
  A.filasCuerpos(carta).forEach(function (f) {
   var tr = el('tr', 'ob-fila'); tb.appendChild(tr);
   var c1 = el('th', 'ob-c-cuerpo'); c1.scope = 'row'; c1.appendChild(nombrePunto(f.glifo, f.nombre)); tr.appendChild(c1);
   var c2 = el('td', 'ob-c-signo'); c2.appendChild(glifo(f.glifoSigno, 'ob-gs')); c2.appendChild(el('span', '', f.signo)); tr.appendChild(c2);
   tr.appendChild(el('td', 'ob-r ob-num ob-c-grado', f.grados));
   tr.appendChild(el('td', 'ob-r ob-num ob-c-casa', f.casa));
   var c5 = el('td', 'ob-r ob-num ob-c-vel' + (f.retrogrado ? ' is-rx' : ''));
   if (f.retrogrado) { c5.appendChild(glifo(A.glifo.retrogrado, 'ob-rx')); c5.appendChild(sr('Retrógrado, ')); } else c5.appendChild(sr('Directo, '));
   c5.appendChild(el('span', '', f.velocidad)); tr.appendChild(c5);
  });
 }

 // ---------------------------------------------------------------- Casas y ángulos
 function casasYAngulos(carta) {
  var tc = $('[data-casas] tbody'), ta = $('[data-angulos] tbody'); tc.textContent = ''; ta.textContent = '';
  $('[data-con-casas]').hidden = false; $('[data-sinhora-casas]').hidden = true; $('[data-nota-casas]').hidden = false;
  A.filasCasas(carta).forEach(function (h) {
   var tr = el('tr');
   var a = el('th', 'ob-r ob-num', h.casa); a.scope = 'row'; tr.appendChild(a);
   var c = el('td', 'ob-num'); c.appendChild(glifo(h.glifoSigno, 'ob-gs')); c.appendChild(el('span', '', h.signo + ' ' + h.grados)); tr.appendChild(c);
   tc.appendChild(tr);
  });
  A.filasAngulos(carta).forEach(function (a) {
   var tr = el('tr', 'ob-fila'); ta.appendChild(tr);
   var c0 = el('th', 'ob-c-cuerpo'); c0.scope = 'row'; c0.appendChild(nombrePunto(a.etiqueta, a.nombre)); tr.appendChild(c0);
   var c1 = el('td', 'ob-num'); c1.appendChild(glifo(a.glifoSigno, 'ob-gs')); c1.appendChild(el('span', '', a.signo + ' ' + a.grados)); tr.appendChild(c1);
  });
 }

 // ---------------------------------------------------------------- Matriz de aspectos (triángulo planeta por planeta)
 function matriz(carta, lista, svg) {
  var puntos = carta.aspect_rules.points.filter(function (id) { return A.punto(carta, id); });
  var mapa = {};
  lista.forEach(function (a) { mapa[a.a + '|' + a.b] = a; mapa[a.b + '|' + a.a] = a; });
  var th = $('[data-matriz] thead'), tb = $('[data-matriz] tbody'), n = puntos.length;
  th.textContent = ''; tb.textContent = '';
  // las referencias ocupan la mitad vacía del triángulo (arriba a la derecha): ancho = la mitad de las columnas de celdas
  $('.ob-mx-w').style.setProperty('--mx-ancho', (Math.floor((n - 1) / 2) / n * 100).toFixed(2) + '%');
  var h0 = el('tr'), corner = el('td', 'ob-mx-h'); corner.appendChild(sr('Planeta o punto')); h0.appendChild(corner);
  function cab(id, fila) { var c = el('th', 'ob-mx-h'); c.scope = fila ? 'row' : 'col'; c.title = A.nombre(carta, id); c.appendChild(glifoAsp(A.glifo.cuerpo(id), 'ob-gp')); c.appendChild(sr(A.nombre(carta, id))); return c; }
  for (var c = 0; c < n - 1; c++) h0.appendChild(cab(puntos[c], false));
  th.appendChild(h0);
  for (var r = 1; r < n; r++) {
   var tr = el('tr'); tr.appendChild(cab(puntos[r], true));
   for (var k = 0; k < r; k++) {
    var td = el('td', 'ob-mx-c'), a = mapa[puntos[r] + '|' + puntos[k]];
    if (a) {
     var b = el('span', 'ob-mx-b');
     b.appendChild(sr(a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB + ', orbe ' + a.orbe + ', ' + a.fase));
     var g = glifo(a.tipoGlifo, 'ob-mx-g'); g.style.color = COLORES.aspectos[a.tipo]; b.appendChild(g);
     var o = el('span', 'ob-mx-o'); o.setAttribute('aria-hidden', 'true'); o.appendChild(el('span', 'ob-mx-f', MARCA[a.fase] || '')); o.appendChild(document.createTextNode(a.orbe)); b.appendChild(o);
     td.appendChild(b); resaltarAl(b, svg, a.indice);
    }
    tr.appendChild(td);
   }
   tb.appendChild(tr);
  }
 }

 // ---------------------------------------------------------------- Lista de aspectos (para lectores de pantalla y celulares)
 function aspectos(carta, svg, lista) {
  var cont = $('[data-aspectos]'), cab = cont.querySelector('.ob-asp-cab');
  cont.textContent = ''; if (cab) cont.appendChild(cab);
  lista.forEach(function (a) {
   var d = el('div', 'ob-asp'), s = el('div', 'ob-asp-r');
   var g = el('span', 'ob-asp-g'); g.appendChild(glifoAsp(a.glifoA, 'ob-gp')); var gt = glifo(a.tipoGlifo, 'ob-gt'); gt.style.color = COLORES.aspectos[a.tipo]; g.appendChild(gt); g.appendChild(glifoAsp(a.glifoB, 'ob-gp')); s.appendChild(g);
   s.appendChild(el('span', 'ob-asp-n', a.nombreA + ' ' + a.tipoNombre.toLowerCase() + ' ' + a.nombreB));
   var o = el('span', 'ob-asp-o'); o.appendChild(el('span', 'ob-l', 'orbe ')); o.appendChild(document.createTextNode(a.orbe)); s.appendChild(o);
   var f = el('span', 'ob-asp-f ' + (a.fase === 'aplicativo' ? 'is-ap' : 'is-sp'));
   var mk = el('b', 'ob-mk', MARCA[a.fase] || ''); mk.setAttribute('aria-hidden', 'true'); f.appendChild(mk);
   f.appendChild(el('span', '', cap(a.fase))); s.appendChild(f);
   d.appendChild(s); resaltarAl(d, svg, a.indice);
   cont.appendChild(d);
  });
  var det = $('[data-lista]');
  if (window.matchMedia('(max-width:720px)').matches) det.open = true; // en el celular no hay matriz: la lista es la vista de los aspectos
 }

 // ---------------------------------------------------------------- Balance: barras horizontales, como la profundidad de un mercado
 function barras(cont, filas, dest, carta, grupo) {
  cont.textContent = '';
  filas.forEach(function (f) {
   var r = el('div', 'ob-b' + (f.dominante ? ' is-dom' : ''));
   var n = el('div', 'ob-b-n'); n.appendChild(el('strong', '', f.nombre));
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
  dest.textContent = '';
  dest.appendChild(el('strong', '', A.dominante(carta, grupo)));
 }

 // S18: «si la carta no se puede calcular completa, no se muestra». Con alguna parte que falte (o que no sea un número) no se dibuja nada:
 // ni la rueda ni tablas a medias; queda el aviso de sinCarta().
 function finito(x) { return typeof x === 'number' && isFinite(x); }
 function completa(c) {
  return !!(c && c.meta && c.meta.input && c.meta.hora_conocida !== false
   && Array.isArray(c.bodies) && c.bodies.length === 12 && c.bodies.every(function (b) { return finito(b.longitude) && finito(b.speed) && finito(b.house); })
   && Array.isArray(c.angles) && c.angles.length === 4 && c.angles.every(function (a) { return finito(a.longitude); })
   && Array.isArray(c.houses) && c.houses.length === 12 && c.houses.every(function (h) { return finito(h.cusp); })
   && Array.isArray(c.aspects) && c.aspect_rules && Array.isArray(c.aspect_rules.points)
   && c.balance && finito(c.balance.total) && Array.isArray(c.balance.elements) && Array.isArray(c.balance.modalities));
 }

 function pintar(r) {
  var modo = r.modo, carta = r.carta;
  if (!completa(carta)) { var x = new Error('carta incompleta'); x.incompleta = true; throw x; }
  encabezado(modo, false, carta);
  datos(modo, false, carta); cinta(carta); leyenda($('[data-leyenda]')); leyenda($('[data-leyenda-mx]'));
  var svg = $('[data-rueda]');
  A.dibujarRueda(svg, carta, { colores: COLORES }, modo);
  var lista = A.listaAspectos(carta);
  tablero(carta); casasYAngulos(carta);
  matriz(carta, lista, svg);
  $('[data-regla]').textContent = carta.balance.rule;
  $('[data-difiere]').hidden = true; // el mismo criterio que la portada (Fernando, 24/11/2026)
  barras($('[data-elementos]'), A.filasBalance(carta, 'elements'), $('[data-dom-elementos]'), carta, 'elements');
  barras($('[data-modalidades]'), A.filasBalance(carta, 'modalities'), $('[data-dom-modalidades]'), carta, 'modalities');
  $('[data-regla-aspectos]').textContent = carta.aspect_rules.rule;
  $('[data-n-aspectos]').textContent = carta.aspects.length + ' aspectos, del más exacto al menos exacto.';
  aspectos(carta, svg, lista);
  raiz.classList.add('is-listo');
  var pdf = $('[data-pdf]'); if (pdf) pdf.hidden = modo !== 'natal';
  var cargando = $('[data-cargando]'); if (cargando) cargando.hidden = true;
 }

 // S16 (Fernando: «Carta del momento: sin botón de PDF. Se muestra la carta y nada más.»): el botón y su nota salen de la página.
 if (MODO !== 'natal') { var sinPdf = $('[data-pdf]'); if (sinPdf) sinPdf.remove(); }
 // S14: el PDF es la impresión del navegador («Guardar como PDF») con la hoja @media print de carta-op2.css: nada sale a otro servicio.
 function paraImprimir() { var d = $('[data-lista]'); if (d) d.open = true; }
 window.addEventListener('beforeprint', paraImprimir);
 var bpdf = $('[data-pdf-btn]');
 if (bpdf) bpdf.addEventListener('click', function () { paraImprimir(); window.print(); });

 // Sin carta (datos rechazados, el límite de la semana, una carta incompleta o un error): solo el aviso, nada a medias.
 var LIMITE_TXT = 'Ya calculaste tus 2 cartas de esta semana. Si querés una lectura completa, agendá una consulta';
 var WHATSAPP = 'https://wa.me/5491153144378';
 function sinCarta(err) {
  raiz.querySelector('.ob-top').classList.add('ob-top-sola'); // sin la rueda, la cabecera en una columna (carta-op2.css)
  Array.prototype.forEach.call(raiz.querySelectorAll('.ob-lado, .ob-ficha, .ob-cinta, .ob-mesa-w, #balance'), function (n) { n.style.display = 'none'; });
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

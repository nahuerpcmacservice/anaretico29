// Opciones de la línea de tiempo (08/11/2026): tres variantes del diseño actual "Horizonte de ciclos" para que Fernando elija.
// Mismas tarjetas, línea, panel, filtros y leyenda que la portada, mejoradas tras la revisión de los duendes.
// data-lt-option: "mes" (el mes completo a la vista), "semana" (semana por semana), "hoy" (hoy y lo que viene).
(() => {
 const host = document.querySelector('[data-lt-option]');
 if (!host || !window.A29_DATA) return;
 const OPTION = host.dataset.ltOption;
 const EV = window.A29_DATA.events.slice().sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc));
 const GL = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];
 const SG = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
 const SIGNS = ['Aries', 'Tauro', 'Géminis', 'Cáncer', 'Leo', 'Virgo', 'Libra', 'Escorpio', 'Sagitario', 'Capricornio', 'Acuario', 'Piscis'];
 const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
 const MONTH = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
 const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
 const WDL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
 const NAME = Object.fromEntries(window.A29_DATA.events.map(e => [e.index, e.short]));
 const START = Date.parse(window.A29_DATA.agenda.inicio), DAY = 864e5, DAYS = window.A29_DATA.agenda.dias, END = START + DAYS * DAY;
 const phone = matchMedia('(max-width: 600px)'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
 const panel = document.querySelector('.astro-inspector'), countEl = document.querySelector('.astro-count');
 const stepLabel = document.querySelector('.astro-controls > span'), hint = document.querySelector('.astro-instruction');
 // "Hoy": el día real si cae dentro de la ventana; si no, el instante de los datos del servidor
 const NOW = Date.now() >= START && Date.now() < END ? Date.now() : Date.parse(window.A29_DATA.utc);
 const TODAY = new Date(NOW - 3 * 3600e3).toISOString().slice(0, 10);
 const keyIdx = k => Math.round((Date.parse(k + 'T03:00:00Z') - START) / DAY);
 const TI = keyIdx(TODAY);
 let filter = 'all', sel = EV.findIndex(e => e.index === 4), week = 0, lastW = 0, more = false;

 // ---------- datos ----------
 const dIdx = e => keyIdx(e.date);
 const dowOf = i => new Date(START + i * DAY).getUTCDay();
 const dateOf = i => new Date(START + i * DAY);
 const ddmm = i => { const d = dateOf(i); return d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
 const wdDate = e => WD[dowOf(dIdx(e))] + ' ' + e.displayDate;
 const past = e => Date.parse(e.utc) < NOW;
 const daysTo = e => dIdx(e) - TI;
 const rel = e => { const d = daysTo(e); return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d > 1 ? 'En ' + d + ' días' : d === -1 ? 'Ayer' : 'Hace ' + (-d) + ' días'; };
 const dShort = e => WD[dowOf(dIdx(e))] + ' ' + ddmm(dIdx(e));
 // Símbolos: astro y signo. El signo de lunaciones y estaciones sale de su longitud. U+FE0E: siempre texto, nunca emoji
 const signOf = e => Math.floor(((e.longitude + 360) % 360) / 30);
 // Cada símbolo en su propia caja: la Luna y el Sol se dibujan chicos en las letras de símbolos y se agrandan para igualar al signo
 const GCLS = { '☽': ' g-moon', '☉': ' g-sun', 'D': ' g-d', '→': ' g-arrow' };
 const symbols = e => (e.kind === 'lunation' ? [GL[e.body], SG[signOf(e)]] : e.kind === 'aspect' ? [GL[e.body], e.angle === 90 ? '□' : '☍', GL[e.otherBody]] : e.kind === 'station' ? [GL[e.body], e.retrograde ? '℞' : 'D', SG[signOf(e)]] : [GL[e.body], '→', SG[e.signIndex]])
  .map(g => '<span class="g' + (GCLS[g] || '') + '">' + g + (g === 'D' ? '' : '\ufe0e') + '</span>').join('');
 const position = e => {
  if (e.kind === 'ingress') return 'Entra en ' + SIGNS[e.signIndex] + (e.retrograde ? ' (retrógrado)' : '');
  if (e.kind === 'aspect') return (e.angle === 90 ? 'Cuadratura' : 'Oposición') + ' exacta';
  const lon = (e.longitude + 360) % 360, deg = lon % 30, m = Math.floor((deg - Math.floor(deg)) * 60);
  return Math.floor(deg) + '°' + String(m).padStart(2, '0') + '′ ' + SIGNS[Math.floor(lon / 30)];
 };
 const meta = e => e.kind === 'aspect' ? (e.angle === 90 ? 'Cuadratura' : 'Oposición') : e.kind === 'ingress' ? (e.retrograde ? 'Ingreso retrógrado' : 'Ingreso directo') : position(e);
 const shown = () => EV.filter(e => filter === 'all' || e.kind === filter);
 const byDay = list => { const g = []; list.forEach(e => { const last = g[g.length - 1]; if (last && last.date === e.date) last.items.push(e); else g.push({ date: e.date, items: [e] }); }); return g; };
 const WEEKS = [];
 for (let i = 0; i < DAYS; i++) { if (i === 0 || dowOf(i) === 1) WEEKS.push({ d0: i, d1: i + 1 }); else WEEKS[WEEKS.length - 1].d1 = i + 1; }
 WEEKS.forEach(w => { const a = dateOf(w.d0), b = dateOf(w.d1 - 1); w.mon = w.d0 - ((dowOf(w.d0) + 6) % 7); w.short = a.getUTCDate() + '–' + b.getUTCDate(); w.month = a.getUTCMonth() === b.getUTCMonth() ? MON[a.getUTCMonth()] : MON[a.getUTCMonth()] + '/' + MON[b.getUTCMonth()]; w.label = a.getUTCDate() + ' ' + MON[a.getUTCMonth()] + ' – ' + b.getUTCDate() + ' ' + MON[b.getUTCMonth()]; });
 const weekOfIdx = i => Math.max(0, WEEKS.findIndex(w => i >= w.d0 && i < w.d1));
 const TW = weekOfIdx(TI);
 const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

 // ---------- tarjetas ----------
 const tab = e => (EV.indexOf(e) === sel ? 0 : -1);
 const aria = e => esc(wdDate(e) + ', ' + e.title + ', ' + e.time + ' Buenos Aires');
 function card(e, o = {}) {
  const i = EV.indexOf(e), chip = o.chip ? '<span class="lt-chip">' + rel(e) + '</span>' : '';
  // Celular de la opción 1: una línea por tránsito (símbolos, nombre y hora); el detalle va en el panel
  if (o.line) return '<button class="astro-event lt-card lt-line kind-' + e.kind + (i === sel ? ' is-selected' : '') + '" type="button" data-lt-i="' + i + '" aria-pressed="' + (i === sel) + '" tabindex="' + tab(e) + '" aria-label="' + aria(e) + '"><span class="lt-sym" aria-hidden="true">' + symbols(e) + '</span><span class="lt-name">' + NAME[e.index] + '</span><span class="lt-time">' + e.time + '</span></button>';
  return '<button class="astro-event lt-card kind-' + e.kind + (i === sel ? ' is-selected' : '') + (o.fade && past(e) ? ' lt-past' : '') + (o.abs ? ' lt-abs' : '') + '" type="button" data-lt-i="' + i + '" aria-pressed="' + (i === sel) + '" tabindex="' + tab(e) + '" aria-label="' + aria(e) + '">' +
   '<span class="lt-top"><span class="event-date">' + (o.short ? dShort(e) : wdDate(e)) + ' · ' + e.time + '</span>' + (chip || '<span class="lt-sym" aria-hidden="true">' + symbols(e) + '</span>') + '</span>' +
   '<strong>' + NAME[e.index] + (chip ? ' <span class="lt-sym-in" aria-hidden="true">' + symbols(e) + '</span>' : '') + '</strong>' + (o.noMeta ? '' : '<span class="event-meta-small">' + meta(e) + '</span>') + '</button>';
 }
 // Mismo día: una sola tarjeta con una fila por tránsito
 function group(g, o = {}) {
  if (g.items.length === 1) return card(g.items[0], o);
  const e0 = g.items[0], allPast = g.items.every(past), anySel = g.items.some(e => EV.indexOf(e) === sel);
  return '<div class="astro-event lt-card lt-group' + (anySel ? ' has-selected' : '') + (o.fade && allPast ? ' lt-past' : '') + (o.abs ? ' lt-abs' : '') + '" role="group" aria-label="' + esc('Mismo día, ' + wdDate(e0)) + '">' +
   '<span class="lt-top"><span class="event-date">' + (o.short ? dShort(e0) : wdDate(e0)) + '</span>' + (o.chip ? '<span class="lt-chip">' + rel(e0) + '</span>' : '<span class="lt-same">Mismo día</span>') + '</span>' +
   g.items.map(e => { const i = EV.indexOf(e); return '<button class="lt-row kind-' + e.kind + (i === sel ? ' is-selected' : '') + '" type="button" data-lt-i="' + i + '" aria-pressed="' + (i === sel) + '" tabindex="' + tab(e) + '" aria-label="' + aria(e) + '"><span class="lt-time">' + e.time + '</span><span class="lt-sym" aria-hidden="true">' + symbols(e) + '</span><span class="lt-name">' + NAME[e.index] + '</span></button>'; }).join('') + '</div>';
 }

 // ---------- dibujo de la línea ----------
 function node(e, x, y, on) {
  const ring = on ? '<circle class="lt-ring" cx="' + x + '" cy="' + y + '" r="10"/>' : '';
  if (e.kind === 'station') return ring + '<path class="axis-node kind-station" d="M ' + x + ' ' + (y - 6) + ' L ' + (x + 6) + ' ' + y + ' L ' + x + ' ' + (y + 6) + ' L ' + (x - 6) + ' ' + y + ' Z"/>';
  return ring + '<circle class="axis-node kind-' + e.kind + (e.kind === 'ingress' ? ' is-hollow' : '') + '" cx="' + x + '" cy="' + y + '" r="5"/>';
 }
 // Fecha del eje. Opción 1 (straight): si un hilo la cruzaría, se corre unos px; si no alcanza, va arriba del eje; si tampoco, se omite
 function dateLabel(o, x, t) {
  const txt = y => '<text class="axis-date" x="' + x + '" y="' + y + '" text-anchor="middle">' + t + '</text>';
  if (!o.straight) return txt(o.y + 18);
  const hw = t.length * 3.3 + 3, side = up => o.places.filter(p => (p.top < o.y) === up).flatMap(p => p.items.map(e => o.xOf(e.utc)));
  const below = side(false), above = side(true).concat(o.today === undefined ? [] : [o.today]);
  const free = (xc, obs) => obs.every(v => Math.abs(v - xc) > hw);
  const at = (d, y) => txt(y).replace('x="' + x + '"', 'x="' + (x + d) + '"'), D = [0, 2, -2, 4, -4, 6, -6, 8, -8, 10, -10];
  let d = D.find(v => Math.abs(v) <= 8 && free(x + v, below));
  if (d !== undefined) return at(d, o.y + 18);
  d = D.find(v => free(x + v, above));
  return d === undefined ? '' : at(d, o.y - 9);
 }
 // o: { W, H, y, d0, d1, xDay, xOf, labelEvery, band, bandH, today, end, places, straight, elbow }
 function axis(o) {
  let s = '<svg class="astro-axis" width="' + o.W + '" height="' + o.H + '" viewBox="0 0 ' + o.W + ' ' + o.H + '" aria-hidden="true">';
  const bh = o.bandH || 22, eb = o.elbow || 8;
  if (o.band) {
   // Cartel de meses arriba: OCTUBRE | NOVIEMBRE
   let a = o.d0;
   for (let i = o.d0; i <= o.d1; i++) {
    if (i === o.d1 || (i > a && dateOf(i).getUTCDate() === 1)) {
     const x1 = o.xDay(a), x2 = o.xDay(i), m = dateOf(a).getUTCMonth();
     // Si el cartel de Hoy taparía el nombre del mes, el nombre va al final de su franja
     const tw = MONTH[m].length * 8, hits = o.straight && o.today !== undefined && o.today + 52 > x1 + 10 && o.today - 52 < x1 + 10 + tw;
     s += '<rect class="lt-band" x="' + x1 + '" y="0" width="' + (x2 - x1) + '" height="' + bh + '"/><text class="lt-band-txt" x="' + (hits ? x2 - 10 : x1 + 10) + '" y="' + (bh - 7) + '"' + (hits ? ' text-anchor="end"' : '') + '>' + MONTH[m].toUpperCase() + '</text>';
     // Cambio de mes: la raya va solo en el cartel y como marca corta en la línea, para no cruzar tarjetas
     if (i < o.d1) s += '<line class="lt-band-div" x1="' + x2 + '" x2="' + x2 + '" y1="0" y2="22"/><line class="axis-tick is-month" x1="' + x2 + '" x2="' + x2 + '" y1="' + (o.y - 9) + '" y2="' + (o.y + 9) + '"/>';
     a = i;
    }
   }
  }
  s += '<line class="axis-rule" x1="' + (o.xDay(o.d0) - 8) + '" y1="' + o.y + '" x2="' + (o.xDay(o.d1) + 8) + '" y2="' + o.y + '"/>';
  for (let i = o.d0; i <= o.d1; i++) {
   const x = o.xDay(i), big = (i - o.d0) % o.labelEvery === 0;
   s += '<line class="axis-tick" x1="' + x + '" x2="' + x + '" y1="' + (o.y - (big ? 7 : 3)) + '" y2="' + (o.y + (big ? 7 : 3)) + '"/>';
   if (big && i < o.d1) s += dateLabel(o, x, ddmm(i));
  }
  if (o.today !== undefined && !o.straight) s += '<line class="lt-today" x1="' + o.today + '" x2="' + o.today + '" y1="' + (o.band ? bh : 0) + '" y2="' + (o.y + 12) + '"/>';
  if (o.today !== undefined && o.straight) {
   // Opción 1: la línea de Hoy termina en el eje y se corta 4 px antes de cualquier tarjeta que tocaría
   const y2 = Math.min(o.y, ...o.places.filter(p => p.top < o.y && o.today > p.left - 2 && o.today < p.left + p.w + 2).map(p => p.top - 4));
   if (y2 > bh + 2) s += '<line class="lt-today" x1="' + o.today + '" x2="' + o.today + '" y1="' + bh + '" y2="' + y2 + '"/>';
  }
  if (o.end !== undefined) s += '<line class="lt-end" x1="' + o.end + '" x2="' + o.end + '" y1="' + (o.y - 26) + '" y2="' + (o.y + 26) + '"/><text class="lt-end-txt" x="' + (o.end - 8) + '" y="' + (o.y + 40) + '" text-anchor="end">Fin del corte · 18/11</text>';
  o.places.forEach(p => {
   const cx = p.left + p.w / 2, below = p.top > o.y, edge = below ? p.top : p.top + p.h, elbow = below ? p.top - eb : p.top + p.h + eb;
   p.items.forEach(e => {
    // straight: el hilo baja derecho si la tarjeta está sobre su fecha; si la tarjeta se corrió, entra por el borde más cercano
    // a menos de 16 px del borde, el hilo entra derecho por la esquina (sin ganchos)
    const x = o.xOf(e.utc), on = EV.indexOf(e) === sel, lo = p.left + 4, hi = p.left + p.w - 4;
    const tx = !o.straight ? cx : x >= lo && x <= hi ? x : x < lo ? (lo - x <= 16 ? lo : p.left + 14) : (x - hi <= 16 ? hi : p.left + p.w - 14);
    s += '<path class="event-wire kind-' + e.kind + (on ? ' is-on' : '') + '" d="M ' + x + ' ' + o.y + ' V ' + elbow + ' H ' + tx + ' V ' + edge + '"/>' + node(e, x, o.y, on);
   });
  });
  return s + '</svg>';
 }
 // Reparte tarjetas en filas arriba (A0 cerca, A1 lejos) y abajo (B0 cerca, B1 lejos) sin que se toquen
 function lanes(groups, xOf, wOf, W, order) {
  const right = {};
  return groups.map(g => {
   const x = g.items.reduce((s, e) => s + xOf(e.utc), 0) / g.items.length, w = wOf(g);
   const left = Math.max(4, Math.min(W - w - 4, x - w / 2));
   const cands = g.items.some(e => e.kind === 'lunation') ? ['A0', 'A1'].filter(r => order.includes(r)).concat(order) : order;
   const row = cands.find(r => left > (right[r] ?? -1e9) + 6) || cands[cands.length - 1];
   right[row] = left + w;
   return { g, items: g.items, x, left, w, row };
  });
 }
 function layout(canvas, places, o) {
  canvas.innerHTML = places.map(p => group(p.g, Object.assign({ abs: true }, o.card))).join('');
  const els = [...canvas.children];
  places.forEach((p, i) => { els[i].style.left = p.left + 'px'; els[i].style.width = p.w + 'px'; p.h = els[i].offsetHeight; });
  const H = r => Math.max(0, ...places.filter(p => p.row === r).map(p => p.h)), gap = o.gap || 8, top0 = o.top0 || 0;
  const a1 = H('A1'), a0 = H('A0');
  const y = top0 + a1 + (a1 ? gap : 0) + a0 + (a0 ? o.above || 26 : 16);
  const t = { A1: top0, A0: top0 + a1 + (a1 ? gap : 0), B0: y + (o.below || 30) };
  t.B1 = t.B0 + H('B0') + gap; t.B2 = t.B1 + H('B1') + gap;
  places.forEach((p, i) => { p.top = t[p.row]; els[i].style.top = p.top + 'px'; });
  return { y, H: Math.max(y + (o.tail || 46), ...places.map(p => p.top + p.h)) + (o.foot || 6) };
 }

 // ---------- opción 1: el mes completo a la vista ----------
 function mes(W, list, mob) {
  if (mob) return rail(list);
  // Alto del mes entero en este ancho (si se filtró antes de conocerlo, se arma una vez con todo)
  if (filter !== 'all' && !(W in fullH)) { const f = filter; filter = 'all'; mes(W, shown(), false); filter = f; fullH[W] = fullH[W] || 0; }
  // Compacta (08/11/2026): tarjetas de dos líneas, a lo sumo dos filas arriba y dos abajo; si no entran, se corren un poco
  const pad = 44, ppd = (W - pad * 2) / DAYS, xDay = i => pad + i * ppd, xOf = t => pad + (Date.parse(t) - START) / DAY * ppd;
  const groups = byDay(list), cardO = { noMeta: true, fade: true, short: true };
  host.innerHTML = '<div class="panorama-scroll lt-fit"><div class="panorama-canvas"></div></div>';
  const canvas = host.querySelector('.panorama-canvas');
  // Ancho justo de cada tarjeta (los símbolos cambian de ancho según la letra del sistema): nada se corta ni se sale
  canvas.innerHTML = groups.map(g => group(g, Object.assign({ abs: true }, cardO))).join('');
  const els = [...canvas.children], nat = els.map(el => Math.ceil(el.getBoundingClientRect().width) + 2);
  const gs = groups.map((g, i) => { const w = Math.max(g.items.length > 1 ? 196 : 164, nat[i]); els[i].style.width = w + 'px'; const xs = g.items.map(e => xOf(e.utc)); return { g, items: g.items, xs, x: xs.reduce((a, b) => a + b, 0) / xs.length, w, lun: g.items.some(e => e.kind === 'lunation') }; });
  gs.forEach((g, i) => { g.h = els[i].offsetHeight; });
  const todayX = xOf(new Date(NOW).toISOString()), key = filter + '|' + W + '|' + gs.map(g => g.w + 'x' + g.h).join(',');
  if (!(key in solved)) solved[key] = solve(gs, W, todayX);
  const sol = solved[key];
  // Si en este ancho no entran sin cruzarse, se usa el riel de fechas del celular
  if (!sol) { host.classList.add('lt-is-rail'); return rail(list); }
  host.classList.remove('lt-is-rail');
  const places = gs.map((g, i) => ({ g: g.g, items: g.items, x: g.x, w: g.w, left: sol.lefts[i], row: sol.rows[i] }));
  const r = layout(canvas, places, { top0: 27, gap: 6, above: 18, below: 27, tail: 30, foot: 4, card: cardO });
  // Con un filtro, la línea conserva el alto del mes entero: la página no salta al filtrar
  if (filter === 'all') fullH[W] = r.H;
  const H = Math.max(r.H, filter === 'all' ? 0 : fullH[W] || 0);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  canvas.insertAdjacentHTML('afterbegin', axis({ W, H, y: r.y, d0: 0, d1: DAYS, xDay, xOf, labelEvery: 5, band: true, bandH: 20, elbow: 3, straight: true, today: todayX, places }) + todayPill(todayX, 0));
 }
 // Opción 1: elige la fila de cada tarjeta (A0/B0 junto a la línea, A1/B1 más lejos) probando todas las combinaciones.
 // Reglas fijas: ningún hilo pasa por detrás de una tarjeta, nada se superpone ni se sale del ancho.
 // Entre las que cumplen: lo más bajo posible, cada tarjeta cerca de su fecha, lunaciones arriba y la línea de Hoy libre
 const solved = {}, fullH = {};
 function solve(gs, W, todayX) {
  const n = gs.length, ROWS = ['A0', 'B0', 'A1', 'B1'], M = 6, asg = new Array(n), lefts = new Array(n);
  if (n > 9) return null;
  // Lugar de una tarjeta en su fila: lo más cerca de su fecha, sin tapar los hilos (F) de la fila lejana del mismo lado
  const place = (g, lo, F) => {
   const max = W - g.w - 4, ideal = Math.max(4, Math.min(max, g.x - g.w / 2)), hit = L => F.find(f => f > L - M && f < L + g.w + M);
   let a = Math.max(ideal, lo), b = ideal, f;
   // el medio px extra evita que el redondeo deje la tarjeta otra vez sobre el mismo hilo
   while ((f = hit(a)) !== undefined) a = f + M + 0.5;
   while (b >= lo && (f = hit(b)) !== undefined) b = f - M - g.w - 0.5;
   let out = null;
   for (const L of [a, b]) {
    if (L < lo || L < 4 || L > max) continue;
    const c = Math.abs(L - ideal) + 150 * g.xs.filter(x => x < L + 14 || x > L + g.w - 14).length;
    if (!out || c < out.c) out = { L, c };
   }
   return out;
  };
  let best = null, bestCost = 1e9;
  for (let code = 0; code < 4 ** n; code++) {
   for (let i = 0, k = code; i < n; i++, k >>= 2) asg[i] = k & 3;
   const F = [[], []], right = [-1e9, -1e9, -1e9, -1e9], hgt = [0, 0, 0, 0];
   for (let i = 0; i < n; i++) if (asg[i] > 1) F[asg[i] - 2].push(...gs[i].xs);
   let cost = 0;
   for (let i = 0; i < n && cost < bestCost; i++) {
    const r = asg[i], g = gs[i], pl = place(g, right[r] + M, r < 2 ? F[r] : []);
    if (!pl) { cost = 1e9; break; }
    lefts[i] = pl.L; right[r] = pl.L + g.w; hgt[r] = Math.max(hgt[r], g.h);
    cost += pl.c + (g.lun && r % 2 ? 40 : 0) + (r % 2 === 0 && todayX > pl.L - 4 && todayX < pl.L + g.w + 4 ? 60 : 0);
   }
   cost += 3 * hgt.reduce((t, h) => t + (h ? h + 6 : 0), 0);
   if (cost < bestCost) { bestCost = cost; best = { rows: asg.map(r => ROWS[r]), lefts: lefts.slice() }; }
  }
  return best;
 }
 const todayPill = (x, top) => '<span class="lt-pill" style="left:' + x + 'px;top:' + top + 'px">Hoy · ' + WD[dowOf(TI)] + ' ' + ddmm(TI) + '</span>';
 // Celular de la opción 1: riel de fechas vertical, una línea por tránsito.
 // Compacta: arranca con el último que pasó y los próximos (RAIL tránsitos); un botón muestra el corte entero
 const RAIL = 5;
 const railRows = list => { if (list.length <= RAIL) return list; const up = list.findIndex(e => !past(e)), s = Math.max(0, Math.min((up < 0 ? list.length : up) - 1, list.length - RAIL)); return list.slice(s, s + RAIL); };
 function rail(list) {
  let rows = list;
  if (!more) {
   rows = railRows(list);
   if (!rows.includes(EV[sel])) { more = true; rows = list; }
  }
  const toggle = rows.length < list.length ? '<button type="button" class="lt-more" data-lt-more="1">Ver los ' + list.length + ' tránsitos</button>'
   : more && list.length > RAIL ? '<button type="button" class="lt-more" data-lt-more="0">Ver solo los próximos</button>' : '';
  let h = toggle + '<ol class="lt-rail">', month = -1, todayDone = false;
  const mark = i => { const m = dateOf(i).getUTCMonth(); if (m === month) return ''; month = m; return '<li class="lt-rail-month">' + MONTH[m] + '</li>'; };
  const today = () => { todayDone = true; return mark(TI) + '<li class="lt-rail-today"><span>Hoy · ' + WD[dowOf(TI)] + ' ' + ddmm(TI) + '</span></li>'; };
  byDay(rows).forEach(g => {
   const i = keyIdx(g.date), d = dateOf(i);
   if (!todayDone && i >= TI) h += today();
   h += mark(i) + '<li class="lt-rail-day' + (g.items.every(past) && !g.items.some(e => EV.indexOf(e) === sel) ? ' lt-past' : '') + '"><span class="lt-rail-date"><b>' + d.getUTCDate() + '</b>' + WD[d.getUTCDay()] + '</span><div class="lt-rail-cards">' +
    g.items.map(e => card(e, { line: true })).join('') + '</div></li>';
  });
  if (!todayDone) h += today();
  host.innerHTML = h + '</ol>' + (list.length ? '' : '<p class="lt-empty">No hay tránsitos de este tipo en estos días. Probá con «Todo».</p>');
 }

 // ---------- opción 2: semana por semana ----------
 function chips(list, mob) {
  return '<div class="lt-weeks" role="group" aria-label="Semanas del corte">' + WEEKS.map((w, i) => {
   const n = list.filter(e => weekOfIdx(dIdx(e)) === i);
   return '<button type="button" class="lt-week' + (i === TW ? ' is-now' : '') + '" data-lt-week="' + i + '" aria-pressed="' + (i === week) + '" aria-label="' + esc('Semana del ' + w.label + ', ' + n.length + ' tránsitos' + (i === TW ? ', esta semana' : '')) + '">' +
    '<span class="lt-wk-top"><b>' + (mob ? w.short : w.label) + '</b>' + (mob ? '' : '<em>' + n.length + (n.length === 1 ? ' tránsito' : ' tránsitos') + '</em>') + '</span>' +
    (mob ? '<span class="lt-wk-month">' + w.month + '</span>' : '') + (i === TW ? '<span class="lt-wk-now">Esta semana</span>' : '') +
    '<i aria-hidden="true">' + n.map(e => '<s class="kind-' + e.kind + '" style="left:' + ((dIdx(e) - w.d0 + 0.5) / (w.d1 - w.d0) * 100) + '%"></s>').join('') + '</i></button>';
  }).join('') + '</div>';
 }
 function quiet(list) {
  const next = list.find(e => dIdx(e) >= WEEKS[week].d1);
  return '<div class="lt-quiet"><b>Semana tranquila</b><span>No hay tránsitos exactos ' + (filter === 'all' ? '' : 'de este tipo ') + 'en estos días.' + (next ? ' El próximo es ' + rel(next).toLowerCase() + ': ' + NAME[next.index] + ', ' + wdDate(next) + '.' : '') + '</span>' + (next ? '<button type="button" class="text-link" data-lt-week="' + weekOfIdx(dIdx(next)) + '">Ver esa semana →</button>' : '') + '</div>';
 }
 function semana(W, list, mob) {
  const w = WEEKS[week], inWeek = list.filter(e => weekOfIdx(dIdx(e)) === week);
  if (mob) {
   let h = chips(list, true) + miniWeek(list);
   for (let i = Math.max(w.mon, 0); i < w.mon + 7; i++) {
    if (i < 0 || i >= DAYS) continue;
    const day = inWeek.filter(e => dIdx(e) === i), d = dateOf(i);
    h += day.length ? '<section class="lt-day' + (i === TI ? ' is-today' : '') + '"><h4>' + WDL[d.getUTCDay()] + ' ' + d.getUTCDate() + (i === TI ? ' <span>Hoy</span>' : '') + '</h4>' + day.map(e => card(e, {})).join('') + '</section>'
     : '<p class="lt-day-empty' + (i === TI ? ' is-today' : '') + '">' + WD[d.getUTCDay()] + ' ' + d.getUTCDate() + (i === TI ? ' · hoy' : '') + ' · sin tránsitos</p>';
   }
   host.innerHTML = h + (inWeek.length ? '' : quiet(list));
   return;
  }
  const pad = 14, colW = (W - pad * 2) / 7, xDay = i => pad + (i - w.mon) * colW, xOf = t => pad + ((Date.parse(t) - START) / DAY - w.mon) * colW;
  let cols = '', svg = '';
  for (let k = 0; k < 7; k++) {
   const i = w.mon + k, out = i < 0 || i >= DAYS, d = dateOf(i), dow = d.getUTCDay();
   cols += '<div class="lt-col' + (out ? ' is-out' : '') + (i === TI ? ' is-today' : '') + (dow === 0 || dow === 6 ? ' is-weekend' : '') + (dow === 1 ? ' is-mon' : '') + '" style="left:' + (pad + k * colW) + 'px;width:' + colW + 'px"><span class="lt-col-head">' + (i === TI ? '<b>Hoy</b>' : '') + WD[dow] + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + '</span>' +
    (out ? '<span class="lt-col-out">fuera del corte</span>' : '') + '</div>';
  }
  const y = 58;
  let maxBottom = y + 60;
  const cards = [];
  for (let k = 0; k < 7; k++) {
   const i = w.mon + k, day = inWeek.filter(e => dIdx(e) === i);
   day.forEach(e => cards.push({ e, left: pad + k * colW + 6, w: colW - 12 }));
  }
  host.innerHTML = chips(list, false) + '<div class="panorama-scroll lt-fit"><div class="panorama-canvas lt-weekcanvas">' + cols + '<div class="lt-cards"></div></div></div>';
  const canvas = host.querySelector('.panorama-canvas'), holder = canvas.querySelector('.lt-cards');
  holder.innerHTML = cards.map(c => card(c.e, { abs: true, fade: false })).join('');
  const els = [...holder.children], colTop = {};
  cards.forEach((c, n) => { const k = c.left; c.top = colTop[k] ?? (y + 26); els[n].style.left = c.left + 'px'; els[n].style.width = c.w + 'px'; els[n].style.top = c.top + 'px'; c.h = els[n].offsetHeight; colTop[k] = c.top + c.h + 8; maxBottom = Math.max(maxBottom, c.top + c.h); });
  const H = Math.max(maxBottom + 14, inWeek.length ? 0 : 230);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  svg = '<svg class="astro-axis" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><line class="axis-rule" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + y + '" y2="' + y + '"/>';
  for (let k = 0; k <= 7; k++) svg += '<line class="axis-tick" x1="' + (pad + k * colW) + '" x2="' + (pad + k * colW) + '" y1="' + (y - 6) + '" y2="' + (y + 6) + '"/>';
  cards.forEach(c => { const x = xOf(c.e.utc), cx = c.left + c.w / 2, on = EV.indexOf(c.e) === sel; svg += '<path class="event-wire kind-' + c.e.kind + (on ? ' is-on' : '') + '" d="M ' + x + ' ' + y + ' V ' + (y + 14) + ' H ' + cx + ' V ' + c.top + '"/>' + node(c.e, x, y, on); });
  canvas.insertAdjacentHTML('afterbegin', svg + '</svg>');
  if (!inWeek.length) canvas.insertAdjacentHTML('beforeend', quiet(list));
 }
 function miniWeek(list) {
  const w = WEEKS[week];
  return '<div class="lt-miniweek" aria-hidden="true">' + Array.from({ length: 7 }, (_, k) => { const i = w.mon + k, n = list.filter(e => dIdx(e) === i); return '<span class="' + (i === TI ? 'is-today' : '') + (i < 0 || i >= DAYS ? ' is-out' : '') + '"><em>' + WD[dowOf(i)].charAt(0).toUpperCase() + '</em>' + n.map(e => '<s class="kind-' + e.kind + '"></s>').join('') + '</span>'; }).join('') + '</div>';
 }

 // ---------- opción 3: hoy y lo que viene ----------
 function hoy(W, list, mob) {
  const up = list.filter(e => !past(e)), gone = list.filter(past);
  if (mob) {
   const pos = Math.max(0, up.indexOf(EV[sel]));
   host.innerHTML = miniAhead(up) + '<div class="lt-snap" tabindex="-1">' + (up.length ? up.map(e => card(e, { chip: true })).join('') : '<p class="lt-empty">No quedan tránsitos de este tipo en el corte.</p>') + '</div>' +
    (gone.length ? '<p class="lt-gone">Ya pasaron ' + gone.length + ' tránsitos de este corte.</p>' : '');
   const snap = host.querySelector('.lt-snap'), c = snap.querySelector('[data-lt-i="' + sel + '"]');
   if (c) snap.scrollLeft = c.offsetLeft - 16;
   return;
  }
  const side = 168, x0 = side + 26, pad = 30, n = DAYS - TI, ppd = (W - x0 - pad) / n;
  const xDay = i => x0 + (i - TI) * ppd, xOf = t => x0 + ((Date.parse(t) - NOW) / DAY + (NOW - (START + TI * DAY)) / DAY) * ppd;
  const places = lanes(byDay(up), xOf, () => 182, W, ['B0', 'A0', 'B1', 'A1', 'B2']);
  host.innerHTML = '<div class="panorama-scroll lt-fit"><div class="panorama-canvas"></div></div>';
  const canvas = host.querySelector('.panorama-canvas'), r = layout(canvas, places, { top0: 8, card: { chip: true } });
  const H = Math.max(r.H, 210);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const lastGone = gone.slice(-2);
  const goneHtml = '<div class="lt-gonecol" style="width:' + side + 'px"><span class="lt-gone-h">Ya pasaron</span>' + lastGone.map(e => '<button type="button" class="lt-gone-row' + (EV.indexOf(e) === sel ? ' is-selected' : '') + '" data-lt-i="' + EV.indexOf(e) + '" tabindex="' + tab(e) + '" aria-label="' + aria(e) + '"><span>' + wdDate(e) + '</span>' + NAME[e.index] + '</button>').join('') + (gone.length > 2 ? '<span class="lt-gone-more">y ' + (gone.length - 2) + ' más en el corte</span>' : '') + '</div>';
  canvas.insertAdjacentHTML('afterbegin', axis({ W, H, y: r.y, d0: TI, d1: DAYS, xDay, xOf, labelEvery: 2, band: false, today: x0, end: xDay(DAYS) - 2, places }) + '<span class="lt-pill is-start" style="left:' + (x0 + 6) + 'px;top:' + (r.y + 26) + 'px">Hoy · ' + WD[dowOf(TI)] + ' ' + ddmm(TI) + '</span>' + goneHtml);
 }
 function miniAhead(up) {
  const n = DAYS - TI;
  return '<div class="lt-ahead" aria-hidden="true"><span class="lt-ahead-hoy">Hoy</span><i>' + up.map(e => '<s class="kind-' + e.kind + (EV.indexOf(e) === sel ? ' is-on' : '') + '" style="left:' + ((dIdx(e) - TI + 0.5) / n * 100) + '%"></s>').join('') + '</i><span class="lt-ahead-end">18/11</span></div>';
 }

 // ---------- panel ----------
 function inspect() {
  const e = EV[sel];
  if (!panel || !e) return;
  const same = EV.filter(x => x.date === e.date && x !== e && (filter === 'all' || x.kind === filter));
  const isNext = !past(e) && EV.filter(x => !past(x) && (filter === 'all' || x.kind === filter))[0] === e;
  const lead = OPTION === 'hoy' && !past(e) ? '<p class="lt-lead"><span>' + (isNext ? 'Próximo tránsito' : 'Por venir') + '</span><b>' + rel(e) + '</b></p>' : '';
  panel.classList.add('lt-panel');
  panel.innerHTML = lead +
   '<div class="lt-p-head"><span class="lt-p-glyph" aria-hidden="true">' + symbols(e) + '</span><span class="kicker">' + esc(e.category) + ' · <span class="nw">' + wdDate(e) + '</span></span></div>' +
   '<h3>' + esc(e.title) + '</h3>' +
   '<dl class="lt-facts"><dt>' + (e.kind === 'aspect' ? 'Aspecto' : e.kind === 'ingress' ? 'Signo' : 'Posición') + '</dt><dd>' + esc(position(e)) + '</dd><dt>Hora</dt><dd>' + e.time + (OPTION === 'mes' ? ' h' : ' · Buenos Aires') + '</dd><dt>' + (past(e) ? 'Fue' : 'Falta') + '</dt><dd>' + rel(e) + '</dd></dl>' +
   (same.length ? '<div class="lt-sameday"><span>Mismo día</span>' + same.map(x => '<button type="button" class="lt-same-row" data-lt-i="' + EV.indexOf(x) + '">' + x.time + ' · ' + NAME[x.index] + '</button>').join('') + '</div>' : '') +
   '<button class="text-link" data-event="' + e.index + '">Ver el evento completo ↗</button>' +
   // Opción 1: el aviso del corte va en la línea de abajo, para que el panel no estire la sección
   (OPTION === 'mes' ? '' : '<p class="lt-cut">Corte de referencia · 20 oct – 18 nov 2026 · hora de Buenos Aires</p>');
 }
 function controls() {
  const list = shown(), pos = list.indexOf(EV[sel]), up = list.filter(e => !past(e));
  let text, back, fwd;
  if (OPTION === 'semana') { text = 'Semana ' + (week + 1) + ' de ' + WEEKS.length + ' · ' + WEEKS[week].label; back = week <= 0; fwd = week >= WEEKS.length - 1; }
  else if (OPTION === 'hoy' && !past(EV[sel])) { const p = up.indexOf(EV[sel]); text = 'Próximo ' + (p + 1) + ' de ' + up.length; back = p <= 0; fwd = p >= up.length - 1; }
  else { text = 'Tránsito ' + (pos + 1) + ' de ' + list.length; back = pos <= 0; fwd = pos >= list.length - 1; }
  if (stepLabel) stepLabel.textContent = text;
  document.querySelectorAll('[data-pan]').forEach(b => {
   const isBack = b.dataset.pan === '-1';
   b.setAttribute('aria-label', OPTION === 'semana' ? (isBack ? 'Semana anterior' : 'Semana siguiente') : (isBack ? 'Tránsito anterior' : 'Tránsito siguiente'));
   b.setAttribute('aria-disabled', String(isBack ? back : fwd));
  });
  if (countEl) countEl.textContent = OPTION === 'mes' ? list.length + ' tránsitos · horarios de Buenos Aires' : OPTION === 'hoy' ? 'Quedan ' + up.length + ' de ' + list.length + ' tránsitos en este corte · horarios de Buenos Aires' : list.length + ' tránsitos · horarios de Buenos Aires';
  if (hint) hint.textContent = phone.matches ? 'Tocá un tránsito para ver el detalle.' : 'Elegí un tránsito para ver el detalle.';
  document.querySelectorAll('[data-astro-filter]').forEach(b => { const on = b.dataset.astroFilter === filter; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
 }

 function render() {
  const W = Math.max(280, Math.round(host.clientWidth) - 28), list = shown(), mob = phone.matches;
  lastW = Math.round(host.clientWidth);
  host.classList.toggle('lt-is-phone', mob);
  if (OPTION === 'mes') mes(W, list, mob); else if (OPTION === 'semana') semana(W, list, mob); else hoy(W, list, mob);
  inspect(); controls();
 }
 function choose(i, focus) {
  sel = i;
  if (OPTION === 'semana') week = weekOfIdx(dIdx(EV[sel]));
  render();
  const c = host.querySelector('[data-lt-i="' + i + '"]');
  if (c && OPTION === 'hoy' && phone.matches) c.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  // Celular de la opción 1: al tocar un tránsito, el panel con el detalle queda a la vista
  if (OPTION === 'mes' && phone.matches && !focus && panel) panel.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'nearest' });
  if (focus && c) c.focus({ preventScroll: true });
 }
 function stepEvent(d, focus) {
  let list = shown();
  if (OPTION === 'hoy' && !past(EV[sel])) list = list.filter(e => !past(e));
  const pos = list.indexOf(EV[sel]), n = Math.max(0, Math.min(list.length - 1, (pos < 0 ? 0 : pos) + d));
  if (list[n]) choose(EV.indexOf(list[n]), focus);
 }
 function goWeek(i) {
  week = Math.max(0, Math.min(WEEKS.length - 1, i));
  const first = shown().find(e => weekOfIdx(dIdx(e)) === week);
  if (first) sel = EV.indexOf(first);
  render();
 }
 document.addEventListener('click', ev => {
  const f = ev.target.closest('[data-astro-filter]');
  if (f) { filter = f.dataset.astroFilter; const l = shown(); if (!l.includes(EV[sel]) && l.length) { sel = EV.indexOf(OPTION === 'hoy' ? (l.find(e => !past(e)) || l[0]) : l[0]); } if (OPTION === 'semana') week = l.length ? weekOfIdx(dIdx(EV[sel])) : week; render(); return; }
  const p = ev.target.closest('[data-pan]');
  if (p) { if (p.getAttribute('aria-disabled') !== 'true') { if (OPTION === 'semana') goWeek(week + Number(p.dataset.pan)); else stepEvent(Number(p.dataset.pan), false); } return; }
  const w = ev.target.closest('[data-lt-week]');
  if (w) { goWeek(Number(w.dataset.ltWeek)); return; }
  const m = ev.target.closest('[data-lt-more]');
  if (m) {
   more = m.dataset.ltMore === '1';
   // Al volver a la vista corta, si el elegido queda oculto, el panel pasa al próximo tránsito
   const rows = railRows(shown());
   if (!more && !rows.includes(EV[sel])) sel = EV.indexOf(rows.find(e => !past(e)) || rows[rows.length - 1]);
   render(); const b = host.querySelector('[data-lt-more]'); if (b) b.focus({ preventScroll: true }); return; }
  const c = ev.target.closest('[data-lt-i]');
  if (c) choose(Number(c.dataset.ltI), false);
 });
 host.addEventListener('keydown', ev => {
  if (!ev.target.closest('[data-lt-i]')) return;
  const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); const l = shown(); choose(EV.indexOf(ev.key === 'Home' ? l[0] : l[l.length - 1]), true); return; }
  if (!(ev.key in map)) return;
  ev.preventDefault(); stepEvent(map[ev.key], true);
 });
 // Arranque: opción 2 en la semana de hoy; el panel de las tres opciones arranca en el próximo tránsito
 { const n = EV.findIndex(e => !past(e)); if (n >= 0) sel = n; }
 week = OPTION === 'semana' ? TW : weekOfIdx(dIdx(EV[sel]));
 new ResizeObserver(() => { if (Math.round(host.clientWidth) !== lastW) render(); }).observe(host);
 phone.addEventListener('change', render);
 render();
 if (document.fonts) document.fonts.ready.then(render);
})();

// Portada "Cada foto es una plaza" (08/11/2026): pestañas, fundido entre fotos, deslizar con el dedo,
// flechas del teclado y la plaza de cada foto marcada en el mapa y los relojes (portada.js los arma).
(() => {
 const root = document.querySelector('.plaza'), SL = window.A29_SLIDES;
 if (!root || !SL || !SL.length) return;
 const base = new URL('../assets/', document.currentScript.src).href;
 // La foto se dibuja con object-fit:cover y queda más ancha que su caja en celular (16:10) y en tablet (400 px de alto)
 const SIZES = '(max-width: 600px) 130vw, max(min(91vw, 1320px), 930px)';
 const stage = root.querySelector('.pz-stage'), media = root.querySelector('.pz-media'), scrim = root.querySelector('.pz-scrim');
 const tabs = [...root.querySelectorAll('.pz-tab')], status = root.querySelector('.pz-sr');
 const $ = id => document.getElementById(id);
 const pics = [media.querySelector('.pz-photo')];
 let want = 0;

 // Con "widths" usa los archivos de assets/portada/ en WebP y JPG; sin ellos, la foto de siempre
 const build = s => {
  const pic = document.createElement('picture'), img = new Image();
  pic.className = 'pz-photo'; pic.setAttribute('aria-hidden', 'true');
  if (s.widths) {
   const set = ext => s.widths.map(w => `${base}portada/${s.id}-${w}.${ext} ${w}w`).join(', ');
   const so = document.createElement('source');
   so.type = 'image/webp'; so.srcset = set('webp'); so.sizes = SIZES; pic.append(so);
   img.srcset = set('jpg'); img.sizes = SIZES;
   img.src = `${base}portada/${s.id}-${s.widths[s.widths.length - 1]}.jpg`;
  } else img.src = base + s.image + '.jpg';
  img.alt = s.alt || ''; img.decoding = 'async';
  img.style.setProperty('--pos', s.position || '50% 50%');
  if (s.mposition) img.style.setProperty('--mpos', s.mposition);
  pic.append(img);
  return pic;
 };
 const ensure = i => pics[i] || (pics[i] = media.insertBefore(build(SL[i]), scrim));

 // Mapa y relojes: punto, nombre y hora de la plaza en cobre, y arco desde Buenos Aires
 const setPlaza = code => {
  const clocks = root.querySelector('[data-tbclocks]');
  if (clocks) {
   clocks.dataset.active = code;
   clocks.querySelectorAll('li').forEach(li => li.classList.toggle('is-active', li.dataset.plaza === code));
  }
  const map = root.querySelector('[data-tbmap]'), svg = map && map.querySelector('svg');
  if (!svg) return;
  map.classList.add('has-active');
  let home, target;
  svg.querySelectorAll('.w-city').forEach(c => {
   const yes = c.querySelector('text')?.textContent.trim() === code;
   c.classList.toggle('is-active', yes);
   if (c.classList.contains('home')) home = c;
   if (yes) target = c;
  });
  svg.querySelector('.pz-route')?.remove();
  if (!home || !target || home === target) return;
  const xy = c => { const n = c.querySelector('.w-node'); return [+n.getAttribute('cx'), +n.getAttribute('cy')]; };
  const [x1, y1] = xy(home), [x2, y2] = xy(target);
  const cy = Math.max(8, Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * .28);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'pz-route');
  path.setAttribute('d', `M${x1},${y1} Q${(x1 + x2) / 2},${cy} ${x2},${y2}`);
  path.setAttribute('pathLength', '100');
  const cities = svg.querySelector('.w-cities');
  cities ? cities.parentNode.insertBefore(path, cities) : svg.append(path);
 };

 const show = async (n, announce) => {
  n = (n + SL.length) % SL.length;
  if (n === want) return;
  want = n;
  const s = SL[n];
  tabs.forEach((t, i) => { const yes = i === n; t.setAttribute('aria-selected', String(yes)); t.tabIndex = yes ? 0 : -1; });
  stage.setAttribute('aria-labelledby', tabs[n].id);
  setPlaza(s.plaza);
  const next = ensure(n), img = next.querySelector('img');
  // Espera a que la foto esté lista para que el fundido no muestre un hueco
  try { await img.decode(); } catch (e) {}
  if (want !== n) return;
  pics.forEach(p => { if (p) { const on = p === next; p.classList.toggle('is-on', on); p.setAttribute('aria-hidden', String(!on)); } });
  $('pz-tag').textContent = s.tag;
  $('pz-title').textContent = s.title;
  $('pz-copy').textContent = s.copy;
  $('pz-credit').textContent = s.credit;
  if (announce && status) status.textContent = `Perspectiva ${n + 1} de ${SL.length}: ${s.tab}, ${s.plazaName}.`;
 };

 root.addEventListener('click', e => {
  const tab = e.target.closest('.pz-tab'); if (tab) show(tabs.indexOf(tab), false);
  const step = e.target.closest('[data-pz-step]'); if (step) show(want + (+step.dataset.pzStep), true);
 });
 // Pestañas: ←/→ e Inicio/Fin mueven el foco y cambian la foto
 root.querySelector('.pz-tabs').addEventListener('keydown', e => {
  const i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  const n = (to + tabs.length) % tabs.length;
  tabs[n].focus(); show(n, false);
 });
 // La foto también recibe el foco y responde a ←/→
 stage.addEventListener('keydown', e => {
  if (e.target !== stage) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(want + (e.key === 'ArrowRight' ? 1 : -1), true); }
 });
 // Deslizar con el dedo sobre toda la foto, también sobre el texto (no sobre botones ni enlaces)
 let sx = null, sy = 0;
 stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && !e.target.closest('a, button')) { sx = e.clientX; sy = e.clientY; } });
 stage.addEventListener('pointercancel', () => { sx = null; });
 stage.addEventListener('pointerup', e => {
  if (sx === null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) show(want + (dx < 0 ? 1 : -1), true);
 });

 // El mapa y los relojes pueden llegar antes o después de este script
 setPlaza(SL[0].plaza);
 document.addEventListener('a29:plazas', () => setPlaza(SL[want].plaza));
 // Precarga de las otras fotos cuando la página ya cargó, para no competir con la primera
 const preload = () => SL.forEach((_, i) => ensure(i));
 const later = () => ('requestIdleCallback' in window ? requestIdleCallback(preload, { timeout: 2500 }) : setTimeout(preload, 1200));
 document.readyState === 'complete' ? later() : addEventListener('load', later, { once: true });
 // Sin JS las pestañas quedan fuera del orden de tabulación; con JS entra la activa
 tabs[0].tabIndex = 0;
 root.classList.add('is-ready');
})();

// Portada: carga el mapa de plazas en la franja Terminal y muestra la hora local de cada plaza.
(async () => {
 const map = document.querySelector('[data-tbmap]'), clocks = document.querySelector('[data-tbclocks]');
 if (map) { try { map.innerHTML = await (await fetch('datos/mapa-mundial.svg')).text(); map.querySelector('svg')?.setAttribute('aria-hidden', 'true'); } catch (e) {} }
 if (clocks) {
  const plazas = [['BUE', 'America/Argentina/Buenos_Aires'], ['SAO', 'America/Sao_Paulo'], ['NYC', 'America/New_York'], ['LON', 'Europe/London'], ['FRA', 'Europe/Berlin'], ['SHA', 'Asia/Shanghai'], ['TYO', 'Asia/Tokyo']];
  // data-active lo marca la portada "Cada foto es una plaza" (portada-plaza.js) y se conserva en cada actualización
  const tick = () => { const act = clocks.dataset.active; clocks.innerHTML = plazas.map(([c, z]) => { const cls = [c === 'BUE' ? 'home' : '', c === act ? 'is-active' : ''].join(' ').trim(); return `<li data-plaza="${c}"${cls ? ` class="${cls}"` : ''}>${c}<b>${new Intl.DateTimeFormat('es-AR', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}</b></li>`; }).join(''); };
  tick(); setInterval(tick, 30000);
 }
 // Aviso para la portada: el mapa y los relojes ya están armados
 document.dispatchEvent(new CustomEvent('a29:plazas'));
})();

// Suscripción al cielo del mes: valida el mail y la casilla, y la anota en el servidor (POST /suscripcion).
// Sin JS el formulario hace el mismo POST y el servidor vuelve a #canales con el aviso.
(() => {
 const f = document.querySelector('.boletin');
 if (!f) return;
 const i = f.elements.email, casilla = f.elements.consentimiento, err = f.querySelector('#bo-err');
 let enviando = false;
 f.addEventListener('submit', async e => {
  e.preventDefault();
  if (enviando) return;
  const v = i.value.trim();
  const m = !v ? "Escribí tu mail." : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : "Revisá el mail: parece incompleto.";
  err.textContent = m; i.setAttribute('aria-invalid', String(!!m));
  if (m) { i.focus(); return; }
  if (!casilla.checked) { err.textContent = "Para anotarte, marcá la casilla de consentimiento."; casilla.focus(); return; }
  enviando = true;
  let r = null;
  try {
   const res = await fetch(f.action, { method: 'POST', headers: { accept: 'application/json' }, body: new URLSearchParams(new FormData(f)) });
   r = await res.json();
  } catch (x) { r = null; }
  enviando = false;
  if (!r || !r.ok) {
   err.textContent = (r && r.mensaje) || "No pudimos anotarte. Probá de nuevo en un rato.";
   if (r && r.campo === 'email') { i.setAttribute('aria-invalid', 'true'); i.focus(); }
   else if (r && r.campo === 'consentimiento') casilla.focus();
   return;
  }
  err.textContent = '';
  const mail = v.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  openDialog('SUSCRIPCIÓN / EL CIELO DEL MES', 'Gracias por sumarte', '<p>Anotamos <strong>' + mail + '</strong> para recibir el cielo del mes.</p>');
  f.reset(); i.removeAttribute('aria-invalid');
 });
})();

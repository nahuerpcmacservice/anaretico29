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

// La suscripción al cielo del mes está apagada (Próximamente): la web no guarda datos de los visitantes.

// Sobre mí: marca en el índice lateral el punto que se está leyendo. Sin JS el índice funciona igual (solo no se resalta).
(() => {
 const links = [...document.querySelectorAll('.sm .ix a[href^="#p"]')];
 if (!links.length || !('IntersectionObserver' in window)) return;
 const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
 const marcar = id => links.forEach(a => {
  if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
 });
 // Se activa el punto que cruza una franja bajo el encabezado fijo (96 px) hasta un tercio de la pantalla
 const io = new IntersectionObserver(es => {
  const vis = es.filter(e => e.isIntersecting);
  if (vis.length) marcar(vis[vis.length - 1].target.id);
 }, { rootMargin: '-100px 0px -62% 0px' });
 secs.forEach(s => io.observe(s));
})();

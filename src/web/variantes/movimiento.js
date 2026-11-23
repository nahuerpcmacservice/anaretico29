// Encabezado que se achica al bajar y aparición suave de tarjetas y títulos (31/10/2026).
(() => {
 const header = document.querySelector('body > header');
 if (header) {
  // Dos umbrales para que no titile cerca del borde
  // El padding que pierde al achicarse vuelve como margen inferior, así el contenido no salta
  const angosto = matchMedia('(max-width:1080px)');
  let on = false;
  const set = v => {
   if (v === on) return; on = v;
   if (v) { const cs = getComputedStyle(header); header.style.marginBottom = (parseFloat(cs.marginBottom) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) - (angosto.matches ? 14 : 16)) + 'px'; }
   else header.style.marginBottom = '';
   header.classList.toggle('is-scrolled', v);
  };
  const check = () => { const y = window.scrollY; if (!on && y > 80) set(true); else if (on && y < 20) set(false); };
  window.addEventListener('scroll', check, { passive: true }); check();
 }
 if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
 const SEL = 'main h2, .door, .sh-card, .ac-school, .rv-card, .i-card, .of .card, .mb .tile, .metric';
 const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('mv-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
 const vistos = new WeakSet();
 const marcar = () => document.querySelectorAll(SEL).forEach(el => {
  if (vistos.has(el)) return; vistos.add(el);
  if (el.closest('header, dialog, [hidden]')) return;
  // Lo que ya está a la vista al cargar no se anima
  if (el.getBoundingClientRect().top < innerHeight) return;
  el.classList.add('mv'); io.observe(el);
 });
 document.documentElement.classList.add('mv-on');
 marcar();
 // Las tarjetas que arman shop.js, academia.js o revista.js llegan después
 let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(marcar, 100); }).observe(document.body, { childList: true, subtree: true });
})();

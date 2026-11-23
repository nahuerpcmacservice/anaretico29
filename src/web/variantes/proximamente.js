// Pantalla "Próximamente" y reglas de lo apagado (maqueta, 21/11/2026). Lee datos/visibilidad.json (las reglas están en su "_ayuda").
// En proximamente.html completa el aviso (?p=<id>) y redirige si lo pedido está visible. En cualquier página que lo cargue:
// marca con "Pronto" los ítems apagados del menú, oculta los botones principales de Membresía y apunta a esta pantalla
// los enlaces a páginas (o partes) apagadas. Sin dependencias, sin guardar nada.
(() => {
 const id = new URLSearchParams(location.search).get('p') || '';
 const nombreEl = document.querySelector('[data-pr-nombre]'), fraseEl = document.querySelector('[data-pr-frase]');
 const servEl = document.querySelector('[data-pr-servicios]');
 const esPantalla = !!nombreEl;
 const SALUDO = 'Estamos preparando este contenido. Cuando esté listo, lo vas a encontrar ';

 // Una página bloqueada (Inicio, Servicios) siempre se ve; una página apagada apaga todas sus partes
 const pagVisible = p => p.bloqueada === true || p.visible !== false;
 const parteVisible = (p, x) => pagVisible(p) && x.visible !== false;

 // Un id puede ser de una página o de una parte; ?p= busca primero entre las páginas
 const buscar = (D, clave) => {
  if (!D || !clave) return null;
  const pag = (D.paginas || []).find(p => p.id === clave);
  if (pag) return { nombre: pag.nombre, visible: pagVisible(pag), pagina: pag };
  for (const p of D.paginas || []) {
   const parte = (p.partes || []).find(x => x.id === clave);
   if (parte) return { nombre: parte.etiqueta, visible: parteVisible(p, parte), pagina: p, parte };
  }
  return null;
 };

 const ocultar = el => { el.hidden = true; el.style.setProperty('display', 'none', 'important'); };
 const pronto = () => { const s = document.createElement('span'); s.className = 'pronto'; s.textContent = 'Pronto'; return s; };
 const aPantalla = clave => '/proximamente?p=' + encodeURIComponent(clave);
 const archivoDe = href => { // nombre del archivo al que apunta un enlace del mismo sitio; null si es externo
  try { const u = new URL(href, location.href); return u.origin === location.origin ? u.pathname.split('/').pop() : null; } catch (e) { return null; }
 };

 // Texto de la pantalla (regla 6): con lugar en el menú, "el mismo lugar del menú"; sin él, "en <página>"
 const frase = it => {
  if (!it) return 'Estamos preparando este contenido. Volvé pronto.';
  const p = it.pagina, enMenu = it.parte ? it.parte.menu === true : p.menu === true;
  return SALUDO + (enMenu ? 'en el mismo lugar del menú.' : 'en ' + (it.parte ? p.nombre : (p.donde || 'Anaretico 29')) + '.');
 };

 const pantalla = D => {
  const it = buscar(D, id);
  // Visible: va a la página real (a su ancla si la parte tiene un id)
  if (it && it.visible && it.pagina.archivo) {
   const sel = it.parte && /^#[\w-]+$/.test(it.parte.selector || '') ? it.parte.selector : '';
   location.replace((it.pagina.ruta || it.pagina.archivo) + sel);
   return;
  }
  nombreEl.textContent = !it ? 'Esta sección' : it.parte && !it.parte.menu ? it.pagina.nombre + ' · ' + it.nombre : it.nombre;
  if (fraseEl) fraseEl.textContent = frase(it);
  if (it) document.querySelectorAll('header nav a[href="' + aPantalla(it.parte ? it.parte.id : it.pagina.id) + '"]').forEach(a => a.setAttribute('aria-current', 'page'));
  // Si lo apagado es la propia página de Servicios, "Ver servicios" no tiene a dónde llevar
  if (servEl && it && !it.parte && it.pagina.id === 'servicios') ocultar(servEl);
 };

 const reglas = D => {
  const paginas = D.paginas || [];
  // Regla 4: los botones principales de una página apagada se ocultan (no se redirigen)
  paginas.filter(p => !pagVisible(p)).forEach(p => (p.ocultar_si_apagada || []).forEach(r =>
   document.querySelectorAll(r.selector).forEach(ocultar)));
  // Menú: lo apagado conserva su lugar con "Pronto" y lleva a esta pantalla; "El enfoque ↗" es un botón y pasa a enlace
  document.querySelectorAll('header nav a[href], header nav [data-method]').forEach(el => {
   let it = null;
   if (el.tagName === 'A') {
    const f = archivoDe(el.getAttribute('href')), h = (el.getAttribute('href').split('#')[1] || '');
    const p = paginas.find(x => x.tipo !== 'cuadro' && x.archivo === f);
    it = p ? (h && p.partes.find(x => x.id === h && x.menu) ? buscar(D, h) : (h ? null : buscar(D, p.id))) : null;
   } else it = buscar(D, el.dataset.id || 'enfoque');
   if (!it || it.visible) return;
   const clave = it.parte ? it.parte.id : it.pagina.id;
   let a = el;
   if (el.tagName !== 'A') { a = document.createElement('a'); a.textContent = el.textContent; a.dataset.id = clave; el.replaceWith(a); }
   a.href = aPantalla(clave);
   a.appendChild(pronto());
   if (clave === id) a.setAttribute('aria-current', 'page');
  });
  // Regla 5: cualquier otro enlace a una página apagada (o a una de sus subpáginas, o a una parte apagada) va a esta pantalla
  const apagado = {};
  paginas.filter(p => p.tipo !== 'cuadro' && !pagVisible(p)).forEach(p => [p.archivo].concat(p.subpaginas || []).forEach(f => { apagado[f] = p.id; }));
  document.querySelectorAll('a[href]').forEach(a => {
   const href = a.getAttribute('href');
   if (a.hidden || a.closest('[hidden]') || a.closest('header nav') || href.charAt(0) === '#' || /(^|\/)proximamente(\.html)?([?#]|$)/.test(href)) return;
   const f = archivoDe(href);
   if (!f) return;
   if (apagado[f]) { a.href = aPantalla(apagado[f]); return; }
   const h = href.split('#')[1], p = paginas.find(x => x.archivo === f && x.tipo !== 'cuadro');
   const x = p && h ? p.partes.find(y => y.id === h) : null;
   if (x && !parteVisible(p, x)) a.href = aPantalla(x.id);
  });
 };

 const aplicar = D => {
  if (D) reglas(D);
  if (esPantalla) pantalla(D);
  document.documentElement.classList.remove('pr-espera');
 };

 fetch('datos/visibilidad.json', { cache: 'no-store' }).then(r => r.json()).then(aplicar).catch(() => aplicar(null));
})();

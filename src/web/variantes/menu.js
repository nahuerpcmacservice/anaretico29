// Menú: agrega el botón "Sumarme" al encabezado y, en celular, un botón "Menú" que abre y cierra la navegación.
(() => {
 const header = document.querySelector('header'), nav = header && header.querySelector('nav');
 if (!header || !nav) return;
 nav.id = nav.id || 'menu-principal';
 const cta = document.createElement('a');
 cta.className = 'h-cta'; cta.href = '/proximamente?p=membresia'; cta.textContent = 'Sumarme';
 const btn = document.createElement('button');
 btn.type = 'button'; btn.className = 'h-menu'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', nav.id);
 btn.innerHTML = '<i aria-hidden="true"></i><span>Menú</span>';
 header.appendChild(btn); // «Sumarme» no va: Membresía está apagada (regla 4)
 const set = open => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.querySelector('span').textContent = open ? 'Cerrar' : 'Menú'; };
 btn.addEventListener('click', () => set(!nav.classList.contains('open')));
 nav.addEventListener('click', e => { if (e.target.closest('a,button')) set(false); });
 document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
})();

// Servicios, Membresía y bloque de portada: todo se arma desde datos/servicios.json.
// Prototipo de diseño: no cobra, no agenda y no envía formularios. Los botones muestran qué pasará.
(async () => {
 const root = document.querySelector('[data-oferta]');
 if (!root) return;
 const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
 let D;
 try { D = await (await fetch('datos/servicios.json', { cache: 'no-store' })).json(); }
 catch (e) { root.insertAdjacentHTML('beforeend', '<p class="wrap legal">No se pudieron cargar los servicios. Abrí la página desde el servidor local.</p>'); return; }

 // Moneda: según el país del visitante, con selector manual que se recuerda en este navegador.
 const read = k => { try { return localStorage.getItem(k) } catch (e) { return null } };
 const store = (k, v) => { try { localStorage.setItem(k, v) } catch (e) {} };
 const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
 const auto = (tz.startsWith('America/Argentina') || tz === 'America/Buenos_Aires' || /-AR$/i.test(navigator.language || '')) ? 'ars' : 'usd';
 let cur = read('a29-moneda') || auto;
 const fmt = (v, c) => v == null ? 'A definir' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: c.toUpperCase(), maximumFractionDigits: 0 }).format(v);
 const priceHTML = o => `<span class="price" data-ars="${esc(fmt(o.precio_ars, 'ars'))}" data-usd="${esc(fmt(o.precio_usd, 'usd'))}"><small>${cur.toUpperCase()}</small><span class="amt">${esc(fmt(cur === 'ars' ? o.precio_ars : o.precio_usd, cur))}</span></span>`;
 const refreshPrices = () => {
  document.querySelectorAll('.of .price[data-ars]').forEach(p => { p.querySelector('small').textContent = cur.toUpperCase(); p.querySelector('.amt').textContent = p.dataset[cur]; });
  document.querySelectorAll('.of [data-cur]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cur === cur)));
  document.querySelectorAll('.of [data-cur-note]').forEach(n => n.textContent = cur === 'ars' ? 'Pago en pesos con una pasarela local.' : 'Pago en dólares con una pasarela internacional.');
 };
 const currencyHTML = `<div class="currency"><span id="cur-lbl">Precios en</span><div class="seg" role="group" aria-labelledby="cur-lbl"><button type="button" data-cur="ars" aria-pressed="false">ARS</button><button type="button" data-cur="usd" aria-pressed="false">USD</button></div><span>${auto === 'ars' ? 'Detectamos Argentina' : 'Fuera de Argentina'} · podés cambiarlo</span></div>`;

 const areas = D.areas, svcs = D.servicios.filter(s => s.activo);
 document.querySelectorAll('[data-mapa]').forEach(async m => { try { m.innerHTML = await (await fetch('datos/mapa-mundial.svg')).text(); } catch (e) {} });
 const areaOf = id => areas.find(a => a.id === id);

 // /servicios
 const sv = root.querySelector('[data-servicios]');
 if (sv) {
  sv.querySelector('[data-index]').innerHTML = areas.map(a => `<a href="#${a.id}"><b>${esc(a.numero)}</b><strong>${esc(a.titulo)}</strong><i aria-hidden="true">↓</i><small>${esc(a.bajada)}</small></a>`).join('');
  sv.querySelector('[data-currency]').innerHTML = currencyHTML;
  const clocks = sv.querySelector('[data-clocks]');
  if (clocks && document.documentElement.dataset.d === 'terminal') {
   const plazas = [['BUE', 'America/Argentina/Buenos_Aires'], ['SAO', 'America/Sao_Paulo'], ['NYC', 'America/New_York'], ['LON', 'Europe/London'], ['FRA', 'Europe/Berlin'], ['SHA', 'Asia/Shanghai'], ['TYO', 'Asia/Tokyo']];
   const tick = () => { clocks.innerHTML = plazas.map(([c, z]) => `<div class="${c === 'BUE' ? 'home' : ''}">${c}<b>${new Intl.DateTimeFormat('es-AR', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}</b></div>`).join(''); };
   tick(); setInterval(tick, 30000);
  }
  sv.querySelector('[data-areas]').innerHTML = areas.map(a => {
   const lista = document.documentElement.dataset.d === 'lista';
   if (lista) {
    const rows = svcs.filter(s => s.area === a.id).map(s => `<article class="row"><div><h3>${esc(s.nombre)}</h3><p class="desc">${esc(s.descripcion)}</p></div><ul aria-label="Qué recibís">${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul><p class="fmt"><b>${esc(s.formato)}</b>${esc(s.entrega)}</p>${priceHTML(s)}<button type="button" class="btn" data-cta="${esc(s.tipo_cta)}" data-id="${esc(s.id)}">${esc(s.texto_cta)}</button></article>`).join('');
    return `<section class="area" id="${a.id}" aria-labelledby="t-${a.id}"><div class="wrap"><div class="area-head"><span class="num">${esc(a.numero)}</span><h2 id="t-${a.id}">${esc(a.titulo)}</h2><p>${esc(a.bajada)}</p></div><div class="rows-head" aria-hidden="true"><span>Servicio</span><span>Qué recibís</span><span>Formato y entrega</span><span>Precio</span><span></span></div><div class="rows">${rows}</div>${a.nota_legal ? `<p class="legal">${esc(D.nota_legal)}</p>` : ''}</div></section>`;
   }
   const cards = svcs.filter(s => s.area === a.id).map((s, k) => `<article class="card"><p class="lbl" data-code="${esc(a.numero)}.${k + 1}">${esc(a.titulo)}</p><h3>${esc(s.nombre)}</h3><p class="desc">${esc(s.descripcion)}</p><div class="rec"><p class="lbl" style="color:var(--muted)">Qué recibís</p><ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div><dl><div><dt>Formato</dt><dd>${esc(s.formato)}</dd></div><div><dt>Entrega</dt><dd>${esc(s.entrega)}</dd></div></dl><div class="buy">${priceHTML(s)}<button type="button" class="btn" data-cta="${esc(s.tipo_cta)}" data-id="${esc(s.id)}">${esc(s.texto_cta)}</button></div></article>`).join('');
   return `<section class="area" id="${a.id}" aria-labelledby="t-${a.id}"><div class="wrap"><div class="area-head"><span class="num">${esc(a.numero)}</span><h2 id="t-${a.id}">${esc(a.titulo)}</h2><p>${esc(a.bajada)}</p></div><div class="cards">${cards}</div>${a.nota_legal ? `<p class="legal">${esc(D.nota_legal)}</p>` : ''}</div></section>`;
  }).join('');
  // Las áreas se arman después de cargar la página: si se llegó con #area, bajar hasta ella.
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target && target.classList.contains('area')) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
 }

 // /membresia
 const mb = root.querySelector('[data-membresia]');
 if (mb && D.membresia.activo) {
  const M = D.membresia; let per = 'mensual';
  mb.querySelector('[data-incl]').innerHTML = M.incluye.map(i => `<li>${esc(i)}</li>`).join('');
  const planBox = mb.querySelector('[data-plan]');
  const drawPlan = () => {
   planBox.innerHTML = `<div><p class="lbl">Un solo plan</p><h2>${esc(M.nombre)}</h2></div><div class="seg" role="group" aria-label="Período de pago"><button type="button" data-per="mensual" aria-pressed="${per === 'mensual'}">Mensual</button><button type="button" data-per="anual" aria-pressed="${per === 'anual'}">Anual</button></div>${priceHTML(M.precios[per])}${currencyHTML}<button type="button" class="btn" data-cta="membresia" data-id="${per}">${esc(M.texto_cta)}</button><p class="note"><span data-cur-note></span> El pago se hace siempre en la pasarela: nunca manejamos datos de tarjetas.</p>`;
   refreshPrices();
  };
  drawPlan();
  planBox.addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (b) { per = b.dataset.per; drawPlan(); planBox.querySelector(`[data-per="${per}"]`).focus(); } });
  mb.querySelector('[data-faq]').innerHTML = M.preguntas.map(q => `<details><summary>${esc(q.pregunta)}</summary><p>${esc(q.respuesta)}</p></details>`).join('');
 }

 // Bloque de portada
 const dr = root.querySelector('[data-puertas]');
 if (dr) {
  dr.innerHTML = areas.map(a => `<a class="door" href="/proximamente?p=servicios">${a.imagen ? `<img class="d-img" src="${esc(a.imagen)}" alt="" loading="lazy" width="960" height="644">` : ''}<b>${esc(a.numero)}</b><strong>${esc(a.titulo)}</strong><span>${esc(a.bajada)}</span><em>Ver servicios →</em></a>`).join('');
 }

 document.addEventListener('click', e => { const b = e.target.closest('.of [data-cur]'); if (b) { cur = b.dataset.cur; store('a29-moneda', cur); refreshPrices(); } });
 refreshPrices();

 // Acciones de cada botón según tipo_cta
 const svc = id => svcs.find(s => s.id === id);
 const field = (n, l, t = 'text', extra = '') => `<label>${l}<input name="${n}" type="${t}" ${extra} aria-describedby="e-${n}"><span class="err" id="e-${n}" role="alert"></span></label>`;
 const forms = {
  solicitar: s => ['SOLICITAR / ' + s.nombre.toUpperCase(), 'Contame qué necesitás', `<form class="of-form" novalidate data-kind="solicitar">${field('nombre', 'Nombre', 'text', 'autocomplete="name" required')}${field('email', 'Email', 'email', 'autocomplete="email" required')}${field('empresa', 'Empresa (opcional)', 'text', 'autocomplete="organization"')}<label>Qué necesitás<textarea name="necesidad" required aria-describedby="e-necesidad"></textarea><span class="err" id="e-necesidad" role="alert"></span></label><button type="submit">Enviar</button><small>Te respondo por email. Prototipo: este formulario todavía no envía nada.</small></form>`],
  suscribir: s => ['SUSCRIPCIÓN / ' + s.nombre.toUpperCase(), 'Recibí el informe cada mes', `<form class="of-form" novalidate data-kind="suscribir">${field('email', 'Email', 'email', 'autocomplete="email" required')}<label class="check"><input type="checkbox" name="consent" required aria-describedby="e-consent"><span>Acepto recibir el informe y la política de privacidad. <span class="err" id="e-consent" role="alert"></span></span></label><button type="submit">Suscribirme</button><small>Te enviaremos un mail para verificar la dirección. ${esc(D.nota_legal)} Prototipo: todavía no envía nada.</small></form>`],
  agendar: s => ['AGENDA / ' + s.nombre.toUpperCase(), 'Elegí día y horario', `<p>Este botón abrirá la agenda externa, donde se elige el horario y se paga la consulta o una seña.</p><p><strong>Pendiente:</strong> definir la agenda y el monto de la seña.</p>`],
  comprar: s => ['COMPRA / ' + s.nombre.toUpperCase(), 'Ir al pago', `<p>Este botón abrirá la pasarela de pago externa: ${cur === 'ars' ? 'local, en pesos' : 'internacional, en dólares'}. Nunca manejamos datos de tarjetas en este sitio.</p><p><strong>Pendiente:</strong> elegir las pasarelas y cargar el precio.</p>`],
  membresia: per => ['MEMBRESÍA / ' + per.toUpperCase(), 'Sumarme a la membresía', `<p>Este botón abrirá el alta y el pago en la pasarela externa (${cur === 'ars' ? 'pesos' : 'dólares'}), en el plan ${per}.</p><p><strong>Pendiente:</strong> precio, pasarelas y condiciones de cancelación.</p>`]
 };
 document.addEventListener('click', e => {
  const b = e.target.closest('.of [data-cta]'); if (!b) return;
  const t = b.dataset.cta;
  const args = t === 'membresia' ? forms.membresia(b.dataset.id) : forms[t](svc(b.dataset.id));
  openDialog(...args);
  document.querySelector('#detail input, #detail textarea')?.focus();
 });
 document.addEventListener('submit', e => {
  const f = e.target.closest('.of-form'); if (!f) return; e.preventDefault();
  let first = null;
  f.querySelectorAll('[required]').forEach(i => {
   const ok = i.type === 'checkbox' ? i.checked : i.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim()) : i.value.trim() !== '';
   const msg = ok ? '' : i.type === 'checkbox' ? 'Necesitamos tu consentimiento.' : i.type === 'email' ? 'Revisá el email.' : 'Completá este campo.';
   const err = f.querySelector('#e-' + i.name); if (err) err.textContent = msg; i.setAttribute('aria-invalid', String(!ok));
   if (!ok && !first) first = i;
  });
  if (first) { first.focus(); return; }
  f.outerHTML = `<p><strong>Listo (prototipo).</strong> En la versión final ${f.dataset.kind === 'suscribir' ? 'te llegaría un mail para verificar la dirección.' : 'te respondería por email.'} No se envió nada.</p>`;
 });
})();

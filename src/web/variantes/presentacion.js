// Sección "Quién está atrás": el video se cargaría recién al tocarlo; en el prototipo solo se muestra el aviso.
// Video y foto de Fernando: salen de datos/presentacion.json (video, poster, duracion, foto, foto_alt).
// Con video o foto en null queda la portada y las iniciales de siempre.
let PRES={};
const presRoot=document.querySelector('#presentacion .pres-opt[data-opt="5"]');
const segundos=t=>{const m=/^(\d+):(\d\d)$/.exec(t||'');return m?[+m[1],+m[2]]:null};
function playVideo(btn){
 const vid=document.createElement('video');
 vid.className='p-player';vid.controls=true;vid.preload='none';vid.playsInline=true;
 if(PRES.poster)vid.poster=PRES.poster;
 vid.setAttribute('aria-label','Video de presentación de Fernando Javier Pérez');
 vid.src=PRES.video;
 vid.addEventListener('error',()=>{
  vid.replaceWith(btn);btn.classList.remove('is-loading');
  const n=btn.querySelector('.v-note');if(n)n.textContent='No se pudo cargar el video.';
 },{once:true});
 btn.replaceWith(vid);
 vid.play().catch(()=>{});
}
function aplicarDatos(d){
 PRES=d||{};
 const btn=presRoot&&presRoot.querySelector('.p-video');
 if(btn){
  if(PRES.poster){const img=btn.querySelector('.v-poster');if(img)img.setAttribute('src',PRES.poster)}
  const t=segundos(PRES.duracion);
  if(t){
   const vt=btn.querySelector('.v-time');if(vt)vt.textContent=PRES.duracion;
   btn.setAttribute('aria-label','Reproducir el video de presentación, '+t[0]+(t[0]===1?' minuto ':' minutos ')+t[1]+(t[1]===1?' segundo':' segundos'));
  }
 }
 document.querySelectorAll('#presentacion .pres-opt[data-opt="5"] .p-photo,[data-fjp-foto]').forEach(box=>{
  if(!PRES.foto)return;
  const ini=box.querySelector('.p-ini'),rol=box.getAttribute('role'),lab=box.getAttribute('aria-label');
  const img=document.createElement('img');
  img.className='p-img';img.src=PRES.foto;img.alt=PRES.foto_alt||'Fernando Javier Pérez';img.decoding='async';
  img.addEventListener('error',()=>{img.remove();if(ini)ini.hidden=false;if(rol)box.setAttribute('role',rol);if(lab)box.setAttribute('aria-label',lab)},{once:true});
  if(ini)ini.hidden=true;
  box.removeAttribute('role');box.removeAttribute('aria-label');
  box.appendChild(img);
 });
}
fetch('datos/presentacion.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).catch(()=>null).then(aplicarDatos);
document.querySelectorAll('.pres .p-video').forEach(v=>v.addEventListener('click',()=>{
 if(PRES.video){playVideo(v);return}
 if(!v.querySelector('.v-note'))return; // la opción 5 no trae el aviso: sin video cargado no hay nada que mostrar
 v.classList.add('is-loading');
 v.querySelector('.v-note').textContent='En la versión final acá se carga el video de YouTube (modo sin cookies), recién en este momento.';
}));
document.querySelectorAll('.pres .p-chapter').forEach(c=>c.addEventListener('click',()=>{
 const v=c.closest('.pres-opt').querySelector('.p-video');if(!v)return;
 v.hidden=false;v.classList.add('is-loading');
 v.querySelector('.v-note').textContent='El video arrancaría en '+c.querySelector('b').textContent+': '+c.textContent.replace(c.querySelector('b').textContent,'').trim()+'.';
 v.scrollIntoView({block:'nearest',behavior:'smooth'});
}));
document.querySelectorAll('.pres .o3-watch').forEach(b=>b.addEventListener('click',()=>{
 const v=b.closest('.pres-opt').querySelector('.p-video');v.hidden=false;b.setAttribute('aria-expanded','true');v.focus();
}));
document.querySelectorAll('.pres [data-recorrido]').forEach(a=>a.addEventListener('click',e=>{
 e.preventDefault();
 openDialog('ANARETICO 29 / TRAYECTORIA','Conocé mi recorrido','<p>Este botón llevaría a una página con tu formación, tu trayectoria y tus trabajos. Esa página todavía no existe: la armamos cuando tengas el contenido.</p>');
}));

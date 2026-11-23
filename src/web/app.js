const DATA=window.A29_DATA;
const SLIDES=window.A29_SLIDES;
let slide=0;
const dialog=document.getElementById('detail');
const TYPES={lunation:'Lunaciones',aspect:'Aspectos',ingress:'Ingresos',station:'Estaciones'};
function showSlide(n){
 // Las páginas con el carrusel anterior tienen 3 puntos: recorren solo esas fotos aunque data.js tenga más
 const count=document.querySelectorAll('[data-slide]').length||SLIDES.length;
 slide=(n+count)%count;
 const s=SLIDES[slide],image=document.getElementById('hero-image');
 image.src=new URL('assets/'+s.image+'.jpg',document.querySelector('script[src*="app.js"]').src).href;image.alt=s.credit;image.style.objectPosition=s.position;
 document.getElementById('hero-tag').textContent=s.tag;
 document.getElementById('hero-title').textContent=s.title;
 document.getElementById('hero-copy').textContent=s.copy;
 document.getElementById('hero-credit').textContent=s.credit;
 document.getElementById('slide-index').textContent=String(slide+1).padStart(2,'0');
 document.querySelectorAll('[data-slide]').forEach(b=>{const yes=+b.dataset.slide===slide;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',yes)});
}
function openDialog(tag,title,body){
 document.getElementById('dialog-tag').textContent=tag;
 document.getElementById('dialog-title').textContent=title;
 document.getElementById('dialog-body').innerHTML=body;
 dialog.showModal();
}
function eventBody(e){return '<div class="event-meta">'+e.displayDate+'/'+e.date.slice(0,4)+' · '+e.time+' Buenos Aires<br>'+e.utc.replace('T',' ').replace('Z',' UTC')+'</div><p>Instante astronómico calculado con Swiss Ephemeris '+DATA.engine+', mediante el motor de Anaretico 29. Posiciones tropicales geocéntricas.</p><p>Esta agenda distingue el cálculo astronómico de su interpretación simbólica. El evento abre una referencia de lectura y requiere contexto para analizar un mercado, un país o una empresa.</p>'}
function openEvent(i){const e=DATA.events[i];openDialog(e.category+' / AGENDA DEL CIELO',e.title,eventBody(e))}
function setDay(date){
 const es=DATA.events.filter(e=>e.date===date),[y,m,d]=date.split('-');
 document.querySelectorAll('[data-day]').forEach(b=>{const yes=b.dataset.day===date;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',yes)});
 document.getElementById('day-label').textContent=d+'/'+m+'/'+y+' / BUENOS AIRES';
 document.getElementById('day-title').textContent=es.length?es.map(e=>e.title).join(' · '):'Un día sin eventos exactos en esta selección.';
 document.getElementById('day-text').textContent=es.length?es.map(e=>e.time+' · '+e.category).join(' / '):'La agenda muestra lunaciones, cuadraturas, oposiciones, ingresos y estaciones.';
 const b=document.getElementById('day-open');b.hidden=!es.length;if(es.length)b.dataset.event=es[0].index;
}
function timeline(filter='all',all=false){
 const es=DATA.events.filter(e=>filter==='all'||e.kind===filter),shown=all||filter!=='all'?es:es.slice(0,7);
 const track=document.querySelector('.timeline-track');
 track.replaceChildren(...shown.map(e=>{const b=document.createElement('button');b.className='timeline-node';b.dataset.event=e.index;b.dataset.kind=e.kind;b.innerHTML='<span class="timeline-date">'+e.displayDate+' <small>'+e.time+'</small></span><span class="timeline-point '+e.kind+'"></span><span class="timeline-category">'+e.category+'</span><strong>'+e.title+'</strong><span class="timeline-more">Ver detalle ↗</span>';return b}));
 document.querySelectorAll('[data-filter]').forEach(b=>{const yes=b.dataset.filter===filter;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',yes)});
 document.getElementById('agenda-count').textContent=shown.length+(shown.length===es.length?' eventos de esta selección':' de '+es.length+' eventos del período')+' · deslizá para recorrer';
 document.querySelector('.timeline-scroll').scrollLeft=0;
}
document.addEventListener('click',e=>{
 const anchor=e.target.closest('a[href^="#"]');if(anchor){const t=document.querySelector(anchor.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'})}}
 const step=e.target.closest('[data-step]');if(step)showSlide(slide+(+step.dataset.step));
 const dot=e.target.closest('[data-slide]');if(dot)showSlide(+dot.dataset.slide);
 const day=e.target.closest('[data-day]');if(day)setDay(day.dataset.day);
 const ev=e.target.closest('[data-event]');if(ev)openEvent(+ev.dataset.event);
 const filter=e.target.closest('[data-filter]');if(filter)timeline(filter.dataset.filter);
 if(e.target.closest('#all-events'))openDialog('AGENDA / CORTE DE DISEÑO','Del 20 de octubre al 18 de noviembre',DATA.events.map(e=>'<article class="all-event"><span>'+e.displayDate+' · '+e.time+' Buenos Aires / '+e.category+'</span><h3>'+e.title+'</h3></article>').join(''));
 if(e.target.closest('[data-method]'))openDialog('ANARETICO 29 / MÉTODO','Una lectura con contexto.','<p><strong>Elementos y modalidades:</strong> balance ponderado de 50 puntos, con Ascendente y Medio Cielo del momento para Buenos Aires. Incluye los pesos del método documentado en la aplicación. Son convenciones de síntesis astrológica.</p><p><strong>Tensión:</strong> 100 × (cuadraturas + oposiciones) ÷ (cuadraturas + oposiciones + trígonos + sextiles). Cada aspecto cuenta una vez. Conjunciones aparte. Es una proporción descriptiva del panel.</p><p><strong>Agenda:</strong> lunaciones, cuadraturas, oposiciones, ingresos sin Luna y estaciones. Los horarios se muestran en Buenos Aires; se conserva UTC para cada evento. Las fotografías son archivo ilustrativo y los textos editoriales son ejemplos de presentación.</p><p>Imágenes del carrusel de la portada: generadas con Runway (Gen-4) para Anaretico 29 en noviembre de 2026. Son ilustraciones: no muestran un lugar ni un hecho real tal como ocurrió.</p><p>Las variantes anteriores de la portada usan fotos de archivo: <a href="https://unsplash.com/photos/aerial-photography-of-port-M3yYOCob6kE" target="_blank" rel="noopener">CHUTTERSNAP, puerto (2017)</a>; <a href="https://unsplash.com/photos/city-skyline-during-day-time-eVCCZDqH1Ek" target="_blank" rel="noopener">Matthew Wu, Nueva York (2020)</a>; <a href="https://unsplash.com/photos/aerial-view-of-intermodal-containers-xewrfLD8emE" target="_blank" rel="noopener">CHUTTERSNAP, contenedores (2017)</a>, bajo <a href="https://unsplash.com/license" target="_blank" rel="noopener">licencia Unsplash</a>, con reencuadre e imagen desaturada.</p><p>Fotografía de la Bolsa de Comercio: Antonio García, 05/01/2007, archivo y reencuadre. <a href="https://commons.wikimedia.org/wiki/File:Buenos_Aires_-_Bolsa_de_Comercio.jpg" target="_blank" rel="noopener">Original en Wikimedia Commons</a> · <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener">CC BY 2.0</a>.</p><p>Investigación y lectura simbólica cumplen funciones distintas. Cada análisis de actualidad necesita fuentes, contexto y preguntas propias.</p>');
 const reading=e.target.closest('[data-reading]');if(reading){const texts=[['FINANZAS','El capital y sus tiempos.','Riesgo, expectativas, deuda y confianza. La perspectiva financiera propone investigar qué está valorando un mercado y explorar simbólicamente los ciclos que enmarcan sus preguntas.'],['MUNDIAL','Las dependencias detrás de un acuerdo.','¿Quién controla un recurso? ¿Quién financia una operación? ¿Qué relación necesita revisión? La mirada mundial reúne estas preguntas con la observación de procesos colectivos.'],['EMPRESAS','Un mapa para revisar decisiones.','La historia de una organización reúne acuerdos, vínculos y recursos. Una lectura empresarial puede explorar sus etapas y preguntas a partir de fechas documentadas y contexto propio.']];const r=texts[+reading.dataset.reading];openDialog(r[0]+' / PERSPECTIVA',r[1],'<p>'+r[2]+'</p><p>Texto editorial de muestra para evaluar esta propuesta de diseño.</p>')}
 if(e.target.closest('[data-consult]'))openDialog('EMPRESAS / ANARETICO 29','Tu organización frente al cielo.','<p>Una posible sección para presentar las consultas de astrología empresarial: historia de la organización, fechas documentadas, acuerdos, dependencias y preguntas de trabajo.</p><p>En esta etapa estamos evaluando el diseño. La propuesta de servicios y el canal de contacto se definirán con Fernando.</p>');
});
document.querySelector('.close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
document.querySelector('.hero-carousel')?.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();showSlide(slide+1)}if(e.key==='ArrowLeft'){e.preventDefault();showSlide(slide-1)}});

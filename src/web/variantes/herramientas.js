// Herramientas. Carta natal: fecha, lugar y mail son obligatorios; con datos válidos el formulario lleva a carta.html (pantalla de resultado con una carta de ejemplo).
// Sin hora de nacimiento el enlace lleva sinhora=1 (la pantalla muestra la carta sin Ascendente ni casas).
// "Ver la carta de ahora" lleva a carta.html?modo=momento. Los datos tipeados viajan en la URL solo para mostrarse en el encabezado: nada se guarda y el mail no viaja.
// Los botones data-tool="natal" de las variantes de herramientas.html siguen mostrando el aviso "en preparación".
const toolMsg={
 natal:['HERRAMIENTA / CARTA NATAL','Calculá tu carta natal','<p>Este botón llevará a la calculadora de carta natal. Todavía no está conectada: la armamos en un paso siguiente.</p>'],
 momento:['HERRAMIENTA / CARTA DEL MOMENTO','La carta de este momento','<p>Este botón llevará a la carta del cielo actual. Todavía no está conectada: la armamos en un paso siguiente.</p>']
};
document.querySelectorAll('.tools [data-tool]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.dataset.tool==='momento'){e.stopPropagation();location.assign('/proximamente?p=carta');return}openDialog(...toolMsg[a.dataset.tool])}));
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const checks={
 fecha:v=>v?'':'Ingresá tu fecha de nacimiento.',
 lugar:v=>v.trim()?'':'Ingresá el lugar de nacimiento.',
 email:v=>!v.trim()?'Ingresá tu mail: ahí te enviamos una copia de la carta.':(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())?'':'Revisá el mail: parece incompleto.')
};
document.querySelectorAll('.tools form').forEach(f=>{
 const setErr=(name,msg)=>{const i=f.elements[name],e=f.querySelector('#err-'+name);if(!i||!e)return;e.textContent=msg;i.setAttribute('aria-invalid',msg?'true':'false')};
 Object.keys(checks).forEach(n=>{const i=f.elements[n];if(i)i.addEventListener('input',()=>{if(i.getAttribute('aria-invalid')==='true')setErr(n,checks[n](i.value))})});
 f.addEventListener('submit',e=>{
  e.preventDefault();
  let first=null;
  Object.keys(checks).forEach(n=>{const i=f.elements[n];if(!i)return;const m=checks[n](i.value);setErr(n,m);if(m&&!first)first=i});
  if(first){first.focus();return}
  const q=new URLSearchParams({fecha:f.elements.fecha.value,lugar:f.elements.lugar.value.trim()});
  if(f.elements.hora&&f.elements.hora.value)q.set('hora',f.elements.hora.value);else q.set('sinhora','1');
  f.reset();Object.keys(checks).forEach(n=>setErr(n,''));
  location.assign('/proximamente?p=carta');
 });
});

// Herramientas. Carta natal: fecha, hora y lugar son obligatorios; con datos válidos el formulario lleva a /carta con los datos después del #
// (el navegador no manda esa parte de la dirección: la carta se pide por POST y no queda en ningún registro).
// "Ver la carta de ahora" lleva a /carta?modo=momento. Nada se guarda.
// Los botones data-tool="natal" de las variantes de herramientas.html siguen mostrando el aviso "en preparación".
const toolMsg={
 natal:['HERRAMIENTA / CARTA NATAL','Calculá tu carta natal','<p>Este botón llevará a la calculadora de carta natal. Todavía no está conectada: la armamos en un paso siguiente.</p>'],
 momento:['HERRAMIENTA / CARTA DEL MOMENTO','La carta de este momento','<p>Este botón llevará a la carta del cielo actual. Todavía no está conectada: la armamos en un paso siguiente.</p>']
};
document.querySelectorAll('.tools [data-tool]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.dataset.tool==='momento'){e.stopPropagation();location.assign('/carta?modo=momento');return}openDialog(...toolMsg[a.dataset.tool])}));
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const checks={
 fecha:v=>v?'':'Ingresá tu fecha de nacimiento.',
 hora:v=>v?'':'Ingresá tu hora de nacimiento.',
 lugar:v=>v.trim()?'':'Ingresá el lugar de nacimiento.'
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
  q.set('hora',f.elements.hora.value);
  f.reset();Object.keys(checks).forEach(n=>setErr(n,''));
  location.assign('/carta#'+q.toString());
 });
});

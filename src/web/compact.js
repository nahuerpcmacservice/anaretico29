document.querySelector('.ticker-pause').addEventListener('click',e=>{
 const ticker=e.currentTarget.closest('.planet-ticker'),paused=ticker.classList.toggle('is-paused');
 e.currentTarget.textContent=paused?'▶':'Ⅱ';e.currentTarget.setAttribute('aria-pressed',paused);e.currentTarget.setAttribute('aria-label',paused?'Reanudar cinta planetaria':'Pausar cinta planetaria');
});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-barometer]'))openDialog('BARÓMETRO / TRES LECTURAS','Tres porcentajes independientes.','<p>El barómetro reúne <strong>tensión de aspectos, elemento predominante y modalidad predominante</strong>. No se suman ni se promedian.</p><p>Se conserva el método vigente de Anaretico 29: diez astros y referencia diaria a las 12:00 de Buenos Aires, sin los ángulos locales. Por eso sus porcentajes de predominio pueden diferir de los balances de la carta del momento, que incluyen Ascendente y Medio Cielo.</p><p>La tensión que antes aparecía en una tarjeta separada queda integrada en la lectura de aspectos del barómetro.</p>');
 if(e.target.closest('[data-course]'))openDialog('ESTADO LUNAR / CRITERIO',window.A29_DATA.cielo.criterio.titulo,window.A29_DATA.cielo.criterio.cuerpo);
});

document.addEventListener('click',e=>{
 if(e.target.closest('[data-lunar-event]'))openDialog('EN EL RADAR / ASPECTO LUNAR',window.A29_DATA.cielo.radar.titulo,window.A29_DATA.cielo.radar.cuerpo);
 if(e.target.closest('[data-solar]'))openDialog('BUENOS AIRES / HORARIOS SOLARES','Amanecer y ocaso de referencia',window.A29_DATA.cielo.solar.cuerpo);
});

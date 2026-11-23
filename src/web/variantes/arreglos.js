// Cinta planetaria: desde el primer uso del botón, la pausa depende solo del botón (ver arreglos.css).
document.querySelector('.ticker-pause').addEventListener('click',e=>e.currentTarget.closest('.planet-ticker').classList.add('is-manual'));

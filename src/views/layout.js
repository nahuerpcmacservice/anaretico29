// Shell HTML y sistema visual. TODO el color del sitio sale de los once tokens
// de la sección 06 del brief: no se escribe un hexadecimal suelto en ningún
// componente. Cambiar la paleta entera tiene que ser cambiar :root y nada más.
import { config } from "../config.js";
import { sesionActual, enDesarrollo } from "../lib/portero.js";

export function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const FMT_FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric",
});
const FMT_FECHA_LARGA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long", year: "numeric",
});
const FMT_HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false,
});

export const fmtFecha = (d) => (d ? FMT_FECHA.format(new Date(d)) : "—");
export const fmtFechaLarga = (d) => (d ? FMT_FECHA_LARGA.format(new Date(d)) : "—");
export const fmtHora = (d) => (d ? FMT_HORA.format(new Date(d)) : "—");
export const fmtDiaMes = (d) => {
  const f = new Date(d);
  const p = Object.fromEntries(FMT_FECHA.formatToParts(f).map((x) => [x.type, x.value]));
  return `${p.day} · ${p.month}`;
};

/** Grados a la forma que usa una efeméride: 07°21'. */
export function gradoMinuto(grados) {
  const g = Math.floor(grados);
  const m = Math.round((grados - g) * 60);
  // 59,7' redondea a 60 y quedaría "07°60'". El minuto de más es un grado más.
  if (m === 60) return `${String(g + 1).padStart(2, "0")}°00'`;
  return `${String(g).padStart(2, "0")}°${String(m).padStart(2, "0")}'`;
}

const CSS = `
:root{
  /* ---- Paleta "Cielo y bosque": única fuente de color del sitio ---- */
  --bg:#F5F3ED; --surf:#EAE7DE; --surf2:#DCD8CC;
  --line:rgba(18,37,30,.15); --line2:rgba(18,37,30,.31);
  --tx:#12251E; --tx2:#47524C; --tx3:#7A837C;
  --ac:#17538F;   /* azul de decisión: precio, botón, dato. Nada más. */
  --ac2:#2C5A48;  /* verde de marca: acento secundario */
  --onac:#F5F3ED; /* texto sobre --ac; nunca --tx sobre el azul */

  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;
  --disp-w:120%; --disp-ls:-.025em; --disp-wt:600;
  --body:"Newsreader",Georgia,serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;

  --r:2px;        /* nada redondeado en todo el sitio */
  --max:1180px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--tx);
  font-family:var(--body);font-size:16.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto}
p{margin:0}
h1,h2,h3,h4{margin:0;font-family:var(--disp);font-weight:var(--disp-wt);
  font-stretch:var(--disp-w);letter-spacing:var(--disp-ls);line-height:1.08;text-wrap:balance}
h1{font-size:clamp(2.2rem,5.5vw,4rem)}
h2{font-size:clamp(1.7rem,3.6vw,2.6rem)}
h3{font-size:1.15rem;letter-spacing:0}
a{color:var(--ac2);text-decoration:none}
a:hover{text-decoration:underline}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
:focus-visible{outline:2px solid var(--ac);outline-offset:2px}

.wrap{max-width:var(--max);margin:0 auto;padding:0 26px}
.lab{font-family:var(--mono);font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--tx3)}
.lab-ac{color:var(--ac)}
.prosa{color:var(--tx2);max-width:66ch}
.prosa b{color:var(--tx);font-weight:600}
.sec{padding:64px 0;border-bottom:1px solid var(--line)}
.sec-h{display:flex;flex-direction:column;gap:11px;margin-bottom:30px}
.solo-lectores{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.btn{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.8rem;
  padding:10px 18px;border-radius:var(--r);letter-spacing:.01em;display:inline-block;
  text-decoration:none;border:1px solid transparent;cursor:pointer}
.btn:hover{text-decoration:none}
.btn-p{background:var(--ac);color:var(--onac)}
.btn-p:hover{background:#12447a}
.btn-g{border-color:var(--line2);color:var(--tx)}
.btn-g:hover{border-color:var(--tx3)}

/* ---- Barra de navegación ---- */
.cab{border-bottom:1px solid var(--line);background:var(--bg);position:sticky;top:0;z-index:60}
.cab-in{display:flex;align-items:center;justify-content:space-between;gap:18px;
  padding:14px 26px;max-width:var(--max);margin:0 auto;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:9px;color:var(--tx)}
.logo:hover{text-decoration:none}
.logo img{height:26px;width:auto;display:block}
.logo b{font-family:var(--disp);font-stretch:120%;font-weight:700;letter-spacing:.14em;font-size:.82rem}
.menu{display:flex;gap:22px;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.menu a{font-family:var(--disp);font-stretch:104%;font-size:.83rem;color:var(--tx2)}
.menu a:hover,.menu a[aria-current]{color:var(--tx);text-decoration:none}
.cab-acc{display:flex;gap:9px;align-items:center}
.buscar{display:flex;align-items:center;gap:8px;border:1px solid var(--line);
  padding:7px 13px;border-radius:20px;color:var(--tx3);font-family:var(--mono);font-size:.72rem}
.menu-btn{display:none;border:1px solid var(--line2);padding:7px 12px;border-radius:var(--r);
  font-family:var(--mono);font-size:.72rem}

/* ---- Pie ---- */
.pie{background:var(--surf);border-top:1px solid var(--line);padding:44px 0 34px;margin-top:0}
.pie-in{max-width:var(--max);margin:0 auto;padding:0 26px;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:30px}
.pie h4{font-family:var(--mono);font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--tx3);font-weight:400;margin-bottom:11px}
.pie ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.pie a{font-size:.9rem;color:var(--tx2)}
.pie a:hover{color:var(--tx)}
.canales{display:flex;gap:9px;flex-wrap:wrap}
.canal{border:1px solid var(--line);padding:6px 13px;font-family:var(--mono);font-size:.68rem;
  letter-spacing:.08em;color:var(--tx2)}
.canal.yt{border-color:var(--ac);color:var(--ac)}
.pie-legal{max-width:var(--max);margin:34px auto 0;padding:20px 26px 0;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
.pie-legal p,.pie-legal a{font-family:var(--mono);font-size:.66rem;letter-spacing:.06em;color:var(--tx3)}

/* ---- Aviso de obra ---- */
.obra{background:var(--ac);color:var(--onac);padding:9px 26px;text-align:center;
  font-family:var(--mono);font-size:.7rem;letter-spacing:.08em}
.admin-barra{background:var(--tx);color:var(--onac);padding:8px 26px;display:flex;gap:8px 18px;
  align-items:center;justify-content:center;flex-wrap:wrap;
  font-family:var(--mono);font-size:.66rem;letter-spacing:.06em}
.admin-barra b{font-weight:500}
.admin-barra.abierto{background:var(--ac2)}
.admin-barra a{color:var(--onac);text-decoration:underline}

@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;
    transition-duration:.001ms!important}
}
@media (max-width:900px){
  .menu{display:none}
  .menu-btn{display:inline-block}
  .cab-in{padding:12px 20px}
  .wrap{padding:0 20px}
  .buscar{display:none}
  .menu.abierto{display:flex;flex-direction:column;width:100%;gap:12px;padding-top:10px;
    border-top:1px solid var(--line);margin-top:4px}
}
`;

const NAV = [
  ["/empezar", "Empezar acá"],
  ["/herramientas", "Herramientas"],
  ["/revista", "Revista"],
  ["/cursos", "Cursos"],
  ["/consultas", "Consultas"],
  ["/membresia", "Membresía"],
];

const PIE = [
  ["Empezar acá", [["/estoy-trabado", "Estoy trabado"], ["/quiero-emprender", "Quiero emprender"],
    ["/decido-solo", "Decido solo"], ["/armo-equipo", "Armo equipo"], ["/recorrido", "Mi recorrido"]]],
  ["Herramientas", [["/carta-natal", "Carta natal"], ["/luna", "Fases de la luna"],
    ["/calendario", "Calendario del año"], ["/cielo", "El cielo de hoy"]]],
  ["Revista", [["/revista/trabajo", "Trabajo y vocación"], ["/revista/grupos", "Grupos y equipos"],
    ["/revista/ciclos", "Ciclos grandes"], ["/revista", "Todas las notas"]]],
  ["Consultas", [["/consultas", "Qué hay y para quién"], ["/casos", "Consultas resueltas"],
    ["/preguntas", "Preguntas frecuentes"], ["/agenda", "Agendar"]]],
];

function logoHtml() {
  // El logo definitivo es el PNG original con fondo transparente. Este dibujo
  // es un MARCADOR DE POSICIÓN y no se vectoriza a mano (regla 09 del brief):
  // en cuanto esté el archivo, se reemplaza por una <img>.
  return `<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1"/>
    <path d="M20 12.2 L22.3 18.4 L28.8 18.4 L23.6 22.3 L25.6 28.6 L20 24.8 L14.4 28.6 L16.4 22.3 L11.2 18.4 L17.7 18.4 Z" fill="currentColor"/>
  </svg>`;
}

/**
 * La franja de arriba de todo. Con sesión abierta muestra la barra de
 * ADMINISTRADOR, que sale en todas las páginas del sitio a propósito: sin ella
 * no hay forma de saber si lo que se está viendo lo ve también el público, y
 * ése es el error caro mientras el sitio está en desarrollo.
 */
function barraDeArriba() {
  if (!sesionActual()) {
    return config.mostrarBanner
      ? `<div class="obra">Sitio nuevo, en construcción. Si algo no anda, escribime.</div>` : "";
  }
  const cerrado = enDesarrollo();
  return `<div class="admin-barra${cerrado ? "" : " abierto"}">
    <span>Estás viendo el sitio como <b>administrador</b>.</span>
    <span>${cerrado ? "El público ve «En desarrollo»." : "El sitio está abierto al público."}</span>
    <a href="/panel">Ir al panel →</a>
  </div>`;
}

export function pagina({ titulo, descripcion = "", contenido, activo = "", ancho = true, extraCss = "", extraJs = "" }) {
  const tituloCompleto = titulo ? `${titulo} · Anaretico 29` : "Anaretico 29";
  const desc = descripcion || "Ciclos, tiempos y estructura aplicados al trabajo, la vocación y la dinámica de los grupos.";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(tituloCompleto)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:title" content="${escapeHtml(tituloCompleto)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Anaretico 29">
<link rel="stylesheet" href="/estatico/fuentes/fuentes.css">
<style>${CSS}${extraCss}</style>
</head>
<body>
${barraDeArriba()}
<header class="cab">
  <div class="cab-in">
    <a class="logo" href="/">${logoHtml()}<b>ANARETICO29</b></a>
    <ul class="menu" id="menu">
      ${NAV.map(([href, txt]) =>
        `<li><a href="${href}"${activo === href ? ' aria-current="page"' : ""}>${escapeHtml(txt)}</a></li>`).join("")}
    </ul>
    <div class="cab-acc">
      <a class="buscar" href="/revista">⌕&nbsp;&nbsp;Buscar</a>
      <button class="menu-btn" id="menuBtn" aria-expanded="false" aria-controls="menu">Menú</button>
      <a class="btn btn-p" href="/agenda">Agendar</a>
    </div>
  </div>
</header>
<main${ancho ? "" : ' class="wrap"'}>${contenido}</main>
<footer class="pie">
  <div class="pie-in">
    ${PIE.map(([tit, links]) => `<div><h4>${escapeHtml(tit)}</h4><ul>${
      links.map(([h, t]) => `<li><a href="${h}">${escapeHtml(t)}</a></li>`).join("")}</ul></div>`).join("")}
    <div>
      <h4>Seguime en</h4>
      <div class="canales">
        <span class="canal yt">YouTube</span><span class="canal">LinkedIn</span>
        <span class="canal">Instagram</span><span class="canal">Spotify</span>
      </div>
    </div>
  </div>
  <div class="pie-legal">
    <p>Anaretico 29 · Fernando Javier Pérez</p>
    <p><a href="/p/terminos">Términos</a> · <a href="/p/privacidad">Privacidad</a></p>
  </div>
</footer>
<script>
(function(){
  var b=document.getElementById('menuBtn'), m=document.getElementById('menu');
  if(!b||!m) return;
  b.addEventListener('click',function(){
    var abierto=m.classList.toggle('abierto');
    b.setAttribute('aria-expanded', abierto?'true':'false');
  });
})();
${extraJs}
</script>
</body>
</html>`;
}

export function paginaError(codigo, mensaje) {
  return pagina({
    titulo: codigo === 404 ? "Página no encontrada" : "Algo salió mal",
    ancho: false,
    contenido: `<div class="sec" style="border-bottom:0">
      <span class="lab lab-ac">Error ${codigo}</span>
      <h1 style="margin:14px 0 18px">${codigo === 404 ? "Esta página no existe." : "Algo salió mal."}</h1>
      <p class="prosa">${escapeHtml(mensaje || "")}</p>
      <p style="margin-top:24px"><a class="btn btn-p" href="/">Volver al inicio</a></p>
    </div>`,
  });
}

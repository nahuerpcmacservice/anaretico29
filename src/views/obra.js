// La cara pública del sitio mientras está cerrado.
//
// NO usa pagina() a propósito: no tiene que arrastrar el menú, el pie ni las
// secciones del sitio, que es justamente lo que todavía no se muestra. Es una
// página suelta, sin dependencias, para que no pueda romperse por algo que se
// esté tocando adentro.
import { config } from "../config.js";

const CSS = `
:root{--bg:#F5F3ED;--tx:#12251E;--tx2:#47524C;--tx3:#7A837C;
  --line:rgba(18,37,30,.15);--ac:#17538F;
  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Newsreader",Georgia,serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:var(--bg);color:var(--tx);font-family:var(--body);font-size:17px;line-height:1.6;
  -webkit-font-smoothing:antialiased;padding:40px 26px}
.caja{max-width:520px}
.marca{display:flex;align-items:center;gap:10px;margin-bottom:44px}
.marca b{font-family:var(--disp);font-stretch:120%;font-weight:700;letter-spacing:.16em;font-size:.82rem}
.lab{font-family:var(--mono);font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--ac)}
h1{margin:14px 0 22px;font-family:var(--disp);font-weight:600;font-stretch:120%;
  letter-spacing:-.025em;line-height:1.06;font-size:clamp(2.1rem,6vw,3.2rem);text-wrap:balance}
p{margin:0 0 16px;color:var(--tx2);max-width:46ch}
.pie{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);
  font-family:var(--mono);font-size:.66rem;letter-spacing:.1em;color:var(--tx3)}
`;

// El mismo dibujo que usa el sitio: marcador de posición hasta que esté el
// logo definitivo (regla 09 del brief).
const LOGO = `<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="1"/>
  <path d="M20 12.2 L22.3 18.4 L28.8 18.4 L23.6 22.3 L25.6 28.6 L20 24.8 L14.4 28.6 L16.4 22.3 L11.2 18.4 L17.7 18.4 Z" fill="currentColor"/>
</svg>`;

export function obraHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Anaretico 29 · En desarrollo</title>
<meta name="description" content="El sitio de Anaretico 29 está en desarrollo.">
<link rel="stylesheet" href="/estatico/fuentes/fuentes.css">
<style>${CSS}</style></head><body>
<main class="caja">
  <div class="marca">${LOGO}<b>ANARETICO29</b></div>
  <span class="lab">En desarrollo</span>
  <h1>Estoy armando el sitio nuevo.</h1>
  <p>Astrología aplicada al trabajo, la vocación y la dinámica de los grupos.
    La carta natal, el cielo del día y la revista vuelven en cuanto esté terminado.</p>
  <p>Gracias por pasar.</p>
  <div class="pie">${escapeMinimo(dominio())}</div>
</main></body></html>`;
}

/** El dominio pelado, sin protocolo: es la firma del pie. */
const dominio = () => String(config.sitioUrl || "").split("://").pop().replace(/\/+$/, "");

// Escape mínimo propio: esta página no importa nada del resto del sitio.
function escapeMinimo(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

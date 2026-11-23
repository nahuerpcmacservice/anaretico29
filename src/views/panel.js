// Panel de Fernando. Es deliberadamente feo y directo: formularios de HTML
// planos, sin editor de texto enriquecido ni framework. Lo que tiene que hacer
// es cargar una nota y publicarla, no parecerse a un producto.
import { escapeHtml, fmtFecha } from "./layout.js";

const CSS = `
:root{--bg:#F5F3ED;--surf:#EAE7DE;--surf2:#DCD8CC;--line:rgba(18,37,30,.15);
  --line2:rgba(18,37,30,.31);--tx:#12251E;--tx2:#47524C;--tx3:#7A837C;
  --ac:#17538F;--ac2:#2C5A48;--onac:#F5F3ED;
  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;--body:"Newsreader",Georgia,serif;
  --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;--r:2px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font-family:var(--body);font-size:16px;line-height:1.55}
a{color:var(--ac2)}
h1,h2,h3{margin:0;font-family:var(--disp);font-stretch:120%;font-weight:600;letter-spacing:-.02em;line-height:1.1}
h1{font-size:1.7rem}h2{font-size:1.25rem}h3{font-size:1rem;letter-spacing:0}
.barra{background:var(--tx);color:var(--onac);padding:12px 22px;display:flex;
  justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap}
.barra a{color:var(--onac);font-family:var(--mono);font-size:.72rem;letter-spacing:.06em;
  text-decoration:none;opacity:.8}
.barra a:hover,.barra a[aria-current]{opacity:1;text-decoration:underline}
.barra nav{display:flex;gap:16px;flex-wrap:wrap}
.barra .marca{font-family:var(--disp);font-stretch:120%;font-weight:700;letter-spacing:.14em;font-size:.78rem}
.env{max-width:960px;margin:0 auto;padding:28px 22px 70px}
.tit{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:20px}
table{width:100%;border-collapse:collapse;background:var(--bg);border:1px solid var(--line)}
th{font-family:var(--mono);font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tx3);
  font-weight:400;text-align:left;padding:9px 11px;border-bottom:1px solid var(--line2);background:var(--surf)}
td{padding:9px 11px;border-bottom:1px solid var(--line);font-size:.88rem;color:var(--tx2);vertical-align:top}
tr:last-child td{border-bottom:0}
td a{font-weight:600}
form.ficha{display:flex;flex-direction:column;gap:16px;background:var(--bg);border:1px solid var(--line);padding:22px}
.campo{display:flex;flex-direction:column;gap:5px}
.campo label{font-family:var(--mono);font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tx3)}
.campo .ayuda{font-family:var(--mono);font-size:.63rem;color:var(--tx3);line-height:1.5;text-transform:none;letter-spacing:0}
input[type=text],input[type=email],input[type=password],input[type=number],input[type=date],
input[type=datetime-local],select,textarea{
  border:1px solid var(--line2);background:var(--bg);padding:10px 11px;font-family:var(--mono);
  font-size:.84rem;color:var(--tx);border-radius:var(--r);width:100%;font-feature-settings:normal}
textarea{min-height:220px;font-family:var(--mono);font-size:.8rem;line-height:1.6;resize:vertical}
textarea.chico{min-height:80px}
.fila{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.check{display:flex;align-items:center;gap:9px;font-size:.9rem}
.check input{width:auto}
.acciones{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--line)}
.btn{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.82rem;padding:10px 18px;
  border-radius:var(--r);border:1px solid transparent;cursor:pointer;text-decoration:none;display:inline-block}
.btn-p{background:var(--ac);color:var(--onac)}
.btn-g{border-color:var(--line2);color:var(--tx)}
.btn-r{border-color:var(--line2);color:var(--tx3);margin-left:auto}
.flash{border:1px solid var(--ac2);border-left-width:3px;background:var(--surf);padding:12px 16px;
  margin-bottom:20px;font-size:.92rem}
.flash.mal{border-color:var(--ac)}
.tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:26px}
.tarjeta{background:var(--bg);border:1px solid var(--line);padding:16px 18px;display:flex;
  flex-direction:column;gap:4px;text-decoration:none;color:var(--tx)}
.tarjeta:hover{border-color:var(--ac)}
.tarjeta .n{font-family:var(--disp);font-stretch:110%;font-weight:600;font-size:1.9rem;line-height:1;color:var(--ac)}
.tarjeta .q{font-family:var(--mono);font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--tx3)}
.pill{font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;
  padding:2px 7px;border:1px solid var(--line2);color:var(--tx3);border-radius:20px;white-space:nowrap}
.pill.si{border-color:var(--ac2);color:var(--ac2)}
.estado{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;
  border:1px solid var(--line2);border-left-width:3px;background:var(--surf);padding:16px 18px;margin-bottom:26px}
.estado.cerrado{border-left-color:var(--ac)}
.estado.abierto{border-left-color:var(--ac2)}
.estado .lab{font-family:var(--mono);font-size:.62rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tx3)}
.estado.cerrado .lab{color:var(--ac)}
.estado.abierto .lab{color:var(--ac2)}
.estado p{margin:6px 0 0;font-size:.88rem;color:var(--tx2);max-width:62ch}
.entrar{max-width:380px;margin:14vh auto;padding:0 22px}
@media(max-width:640px){.fila{grid-template-columns:1fr}}
`;

const SECCIONES = [
  ["/panel", "Resumen"], ["/panel/notas", "Revista"], ["/panel/paginas", "Páginas"],
  ["/panel/casos", "Casos"], ["/panel/fechas", "Fechas"], ["/panel/preguntas", "Preguntas"],
  ["/panel/suscriptores", "Newsletter"],
];

export function panel({ titulo, contenido, activo = "", flash = null }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(titulo)} · Panel</title>
<link rel="stylesheet" href="/estatico/fuentes/fuentes.css"><style>${CSS}</style></head><body>
<div class="barra">
  <span class="marca">ANARETICO29 · PANEL</span>
  <nav>${SECCIONES.map(([h, t]) =>
    `<a href="${h}"${activo === h ? ' aria-current="page"' : ""}>${escapeHtml(t)}</a>`).join("")}</nav>
  <nav><a href="/" target="_blank" rel="noopener">Ver el sitio ↗</a>
    <form method="POST" action="/panel/salir" style="display:inline">
      <button class="btn" style="padding:0;font:inherit;color:var(--onac);opacity:.8">Salir</button></form></nav>
</div>
<div class="env">
  ${flash ? `<div class="flash${flash.tipo === "mal" ? " mal" : ""}">${escapeHtml(flash.texto)}</div>` : ""}
  ${contenido}
</div></body></html>`;
}

export function entrarHtml(error, volver = "/panel") {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Entrar · Panel</title>
<link rel="stylesheet" href="/estatico/fuentes/fuentes.css"><style>${CSS}</style></head><body>
<div class="entrar">
  <h1 style="margin-bottom:18px">Panel</h1>
  ${error ? `<div class="flash mal">${escapeHtml(error)}</div>` : ""}
  <form class="ficha" method="POST" action="/panel/entrar">
    <input type="hidden" name="volver" value="${escapeHtml(volver)}">
    <div class="campo"><label for="clave">Clave</label>
      <input type="password" id="clave" name="clave" required autofocus autocomplete="current-password"></div>
    <div class="acciones"><button class="btn btn-p" type="submit">Entrar</button></div>
  </form>
</div></body></html>`;
}

export const campo = (nombre, etiqueta, valor = "", { tipo = "text", ayuda = "", req = false } = {}) => `
  <div class="campo"><label for="${nombre}">${escapeHtml(etiqueta)}</label>
    <input type="${tipo}" id="${nombre}" name="${nombre}" value="${escapeHtml(valor ?? "")}"${req ? " required" : ""}>
    ${ayuda ? `<span class="ayuda">${ayuda}</span>` : ""}</div>`;

export const area = (nombre, etiqueta, valor = "", { ayuda = "", chico = false } = {}) => `
  <div class="campo"><label for="${nombre}">${escapeHtml(etiqueta)}</label>
    <textarea id="${nombre}" name="${nombre}"${chico ? ' class="chico"' : ""}>${escapeHtml(valor ?? "")}</textarea>
    ${ayuda ? `<span class="ayuda">${ayuda}</span>` : ""}</div>`;

export const eleccion = (nombre, etiqueta, valor, opciones) => `
  <div class="campo"><label for="${nombre}">${escapeHtml(etiqueta)}</label>
    <select id="${nombre}" name="${nombre}">${opciones.map(([v, t]) =>
      `<option value="${escapeHtml(v)}"${String(valor) === String(v) ? " selected" : ""}>${escapeHtml(t)}</option>`).join("")}
    </select></div>`;

export const casilla = (nombre, etiqueta, marcado) => `
  <label class="check"><input type="checkbox" name="${nombre}" value="1"${marcado ? " checked" : ""}>
    ${escapeHtml(etiqueta)}</label>`;

export const fmtFechaPanel = fmtFecha;

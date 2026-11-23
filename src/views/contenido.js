// Vistas de las páginas de contenido: revista, notas, páginas de perfil,
// casos, preguntas, agenda y newsletter.
import { escapeHtml, fmtDiaMes, fmtFecha } from "./layout.js";

export const CARRILES = {
  trabajo: { nombre: "Trabajo y vocación", corto: "Trabajo", bajada: "El eje principal: para qué servís y cómo se traduce en un trabajo." },
  grupos:  { nombre: "Grupos y equipos",  corto: "Grupos",  bajada: "Dinámica colectiva, sinastría y por qué un equipo repite el mismo conflicto." },
  ciclos:  { nombre: "Ciclos grandes",    corto: "Ciclo",   bajada: "Mercado, geopolítica y los ciclos largos que reordenan cada sector." },
};

export function cabecera(titulo, bajada, etiqueta = "") {
  return `<section class="cab-pag"><div class="wrap">
    ${etiqueta ? `<span class="lab lab-ac">${escapeHtml(etiqueta)}</span>` : ""}
    <h1>${escapeHtml(titulo)}</h1>
    ${bajada ? `<p class="prosa lead">${escapeHtml(bajada)}</p>` : ""}
  </div></section>`;
}

export const notaCard = (n) => `
  <a class="nota" href="/revista/${escapeHtml(n.handle)}">
    <div class="img">${n.portada_url ? `<img src="${escapeHtml(n.portada_url)}" alt="" loading="lazy">` : ""}</div>
    <span class="et">${escapeHtml(CARRILES[n.carril]?.corto || n.carril)}</span>
    <h3>${escapeHtml(n.titulo)}</h3>
    ${n.bajada ? `<p class="baj">${escapeHtml(n.bajada)}</p>` : ""}
    <p>${n.minutos ? `${n.minutos} min · ` : ""}${escapeHtml(fmtDiaMes(n.publicada_at || n.created_at))}</p>
  </a>`;

export function revistaHtml({ notas, carril = null }) {
  const c = carril ? CARRILES[carril] : null;
  return cabecera(c ? c.nombre : "Revista", c ? c.bajada :
    "Trabajo y vocación, grupos y equipos, ciclos grandes. Tres carriles y nada de horóscopo por signo.", "Revista") + `
<div class="wrap" style="padding:30px 26px 60px">
  <nav class="carriles">
    <a href="/revista"${!carril ? ' aria-current="page"' : ""}>Todas</a>
    ${Object.entries(CARRILES).map(([k, v]) =>
      `<a href="/revista/carril/${k}"${carril === k ? ' aria-current="page"' : ""}>${escapeHtml(v.nombre)}</a>`).join("")}
  </nav>
  ${notas.length
    ? `<div class="notas grande">${notas.map(notaCard).join("")}</div>`
    : `<p class="prosa">Todavía no hay notas publicadas acá.</p>`}
</div>`;
}

export function notaHtml(n, relacionadas) {
  return `
<article class="nota-larga">
  <div class="wrap">
    <span class="lab lab-ac">${escapeHtml(CARRILES[n.carril]?.nombre || n.carril)}</span>
    <h1>${escapeHtml(n.titulo)}</h1>
    ${n.bajada ? `<p class="lead prosa">${escapeHtml(n.bajada)}</p>` : ""}
    <p class="meta">${n.minutos ? `${n.minutos} min de lectura · ` : ""}${escapeHtml(fmtFecha(n.publicada_at || n.created_at))}</p>
  </div>
  ${n.portada_url ? `<div class="wrap"><img class="portada" src="${escapeHtml(n.portada_url)}" alt=""></div>` : ""}
  <div class="wrap cuerpo">${n.cuerpo || ""}</div>
</article>
${relacionadas.length ? `<div class="wrap" style="padding:0 26px 60px">
  <h2 style="font-size:1.4rem;margin-bottom:18px">Seguí por acá</h2>
  <div class="notas">${relacionadas.map(notaCard).join("")}</div>
</div>` : ""}`;
}

export function paginaHtml(p, extra = "") {
  return cabecera(p.titulo, p.bajada) +
    `<div class="wrap cuerpo" style="padding:30px 26px 60px">${p.cuerpo || ""}${extra}</div>`;
}

export function casosHtml(lista) {
  return cabecera("Consultas resueltas",
    "Casos reales, con permiso y con los nombres cambiados. Qué traía, qué mostró la carta y qué decidió.",
    "Prueba") + `
<div class="wrap" style="padding:30px 26px 60px">
  <div class="casos grande">${lista.map((c) => `
    <article class="caso">
      <span class="id">${escapeHtml(c.etiqueta)}</span>
      <span class="quien">${escapeHtml(c.quien).replace(/\n/g, "<br>")}</span>
      <div class="paso"><span class="k">Traía</span><span class="v">${escapeHtml(c.traia)}</span></div>
      <div class="paso"><span class="k">${escapeHtml(c.mostro_tit)}</span><span class="v">${escapeHtml(c.mostro)}</span></div>
      <div class="paso cierre"><span class="k">Qué decidió</span><span class="v">${escapeHtml(c.decidio)}</span></div>
    </article>`).join("")}</div>
</div>`;
}

export function preguntasHtml(lista) {
  return cabecera("Preguntas frecuentes",
    "Las objeciones reales, no las cómodas.", "Antes de escribirme") + `
<div class="wrap" style="padding:30px 26px 60px">
  <div class="faq grande">${lista.map((p) => `
    <div><span class="q">${escapeHtml(p.pregunta)}</span><span class="a">${escapeHtml(p.respuesta)}</span></div>`).join("")}</div>
</div>`;
}

export function agendaHtml(fechas, aviso = null) {
  return cabecera("Agendar una consulta",
    "Una sesión para mirar una decisión concreta con la carta en pantalla.", "Consultas") + `
<div class="wrap" style="padding:30px 26px 60px">
  <div class="aviso"><span class="t">La agenda todavía no está conectada</span>
    <p>Estoy terminando de enganchar el sistema de reservas. Mientras tanto, dejame tu mail
    y te escribo con la disponibilidad.</p></div>
  ${formNewsletter("agenda", "Dejame tu mail y te escribo", aviso)}
  ${fechas.length ? `<h2 style="font-size:1.4rem;margin:44px 0 18px">Próximas fechas</h2>
  <div class="fechas">${fechas.map((f) => `
    <div class="fecha${f.sin_cupo ? " lleno" : ""}">
      <span class="cuando">${escapeHtml(fmtDiaMes(f.cuando))}</span>
      <span class="que">${escapeHtml(f.titulo)}${f.detalle ? `<small>${escapeHtml(f.detalle)}</small>` : ""}</span>
      <span class="tipo">${f.tipo === "miembros" ? "Miembros" : "Abierto"}</span>
      <span class="acc">${f.sin_cupo ? "Sin cupo" : ""}</span>
    </div>`).join("")}</div>` : ""}
</div>`;
}

/**
 * Alta al newsletter. El ORIGEN se guarda siempre: es lo que después permite
 * segmentar quién llegó por la calculadora, quién por la revista y quién por
 * un video (brief, sección 08). Sin eso la lista no sirve para nada.
 */
export function formNewsletter(origen, titulo = "Recibí el cielo del mes", aviso = null) {
  return `<form class="news" action="/newsletter" method="POST">
    <input type="hidden" name="origen" value="${escapeHtml(origen)}">
    <label for="email_${escapeHtml(origen)}">${escapeHtml(titulo)}</label>
    <div class="news-fila">
      <input type="email" id="email_${escapeHtml(origen)}" name="email" required
             placeholder="tu@correo.com" autocomplete="email">
      <button class="btn btn-p" type="submit">Anotarme</button>
    </div>
    ${aviso ? `<p class="news-aviso ${aviso.tipo}">${escapeHtml(aviso.texto)}</p>` : ""}
    <p class="news-pie">Una vez por mes. Te podés dar de baja con un click.</p>
  </form>`;
}

export const CSS_CONTENIDO = `
.cab-pag{border-bottom:1px solid var(--line);background:var(--surf);padding:44px 0 34px}
.cab-pag h1{margin:12px 0 12px}
.cab-pag .lead{font-size:1.1rem}
.carriles{display:flex;gap:20px;flex-wrap:wrap;padding-bottom:18px;margin-bottom:26px;
  border-bottom:1px solid var(--line)}
.carriles a{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.88rem;color:var(--tx2)}
.carriles a[aria-current]{color:var(--ac)}
.notas{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.notas.grande{gap:30px 22px}
.nota{display:flex;flex-direction:column;gap:9px;color:var(--tx)}
.nota:hover{text-decoration:none}
.nota:hover h3{color:var(--ac)}
.nota .img{aspect-ratio:16/10;border:1px solid var(--line);background:var(--surf);overflow:hidden}
.nota .img img{width:100%;height:100%;object-fit:cover;display:block}
.nota .et{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)}
.nota h3{font-family:var(--body);font-weight:500;font-size:1.14rem;line-height:1.25;letter-spacing:0;font-stretch:normal}
.nota .baj{font-size:.92rem;color:var(--tx2)}
.nota p{font-size:.86rem;color:var(--tx3);font-family:var(--mono)}
.nota-larga{padding:44px 0 40px}
.nota-larga h1{margin:12px 0 14px;font-size:clamp(1.9rem,4.4vw,3rem)}
.nota-larga .lead{font-size:1.15rem;margin-bottom:14px}
.nota-larga .meta{font-family:var(--mono);font-size:.7rem;letter-spacing:.08em;color:var(--tx3)}
.nota-larga .portada{width:100%;border:1px solid var(--line);margin:26px 0}
.cuerpo{max-width:70ch;color:var(--tx2)}
.cuerpo p{margin:0 0 1.1em}
.cuerpo h2{font-size:1.5rem;margin:1.6em 0 .5em;color:var(--tx)}
.cuerpo h3{font-size:1.15rem;margin:1.4em 0 .4em;color:var(--tx)}
.cuerpo ul,.cuerpo ol{margin:0 0 1.1em;padding-left:1.3em}
.cuerpo li{margin-bottom:.4em}
.cuerpo blockquote{border-left:2px solid var(--ac);margin:1.4em 0;padding-left:18px;color:var(--tx)}
.casos.grande{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.faq.grande{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}
.news{border:1px solid var(--line2);background:var(--surf);padding:20px 22px;display:flex;
  flex-direction:column;gap:9px;max-width:520px}
.news label{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.98rem}
.news-fila{display:flex;gap:8px}
.news input{flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);padding:10px 12px;
  font-family:var(--mono);font-size:.82rem;color:var(--tx);border-radius:var(--r)}
.news-pie{font-family:var(--mono);font-size:.62rem;color:var(--tx3)}
.news-aviso{font-size:.9rem;font-weight:600}
.news-aviso.ok{color:var(--ac2)}
.news-aviso.error{color:var(--ac)}
@media (max-width:900px){
  .notas{grid-template-columns:1fr 1fr}
  .casos.grande,.faq.grande{grid-template-columns:1fr}
}
@media (max-width:640px){ .notas{grid-template-columns:1fr} .news-fila{flex-direction:column} }
`;

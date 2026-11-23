// La carta natal calculada. Ver es gratis y sin registro; lo que pide cuenta
// es guardarla (fase 2 del brief).
import { escapeHtml, gradoMinuto } from "./layout.js";
import { ruedaSvg, CSS_RUEDA } from "../lib/rueda.js";
import { META_ELEMENTO, META_MODALIDAD, comparar } from "../lib/cielo.js";
import { SIGNOS } from "../lib/astro-config.js";

const SIGNO_DE = (lon) => SIGNOS[Math.floor((((lon % 360) + 360) % 360) / 30) % 12].nombre;

const NOMBRE_CASAS = { P: "Placidus", K: "Koch", W: "Signos enteros", R: "Regiomontano", C: "Campanus" };

function barras(datos, meta) {
  const max = datos[0]?.pc || 1;
  return `<div class="barras">${datos.map((d, i) => {
    const m = meta[d.clave] || { nombre: d.clave, sub: "" };
    return `<div class="bar">
      <span class="nm">${escapeHtml(m.nombre)}${m.sub ? `<small>${escapeHtml(m.sub)}</small>` : ""}</span>
      <span class="pista"><i style="width:${((d.pc / max) * 100).toFixed(1)}%;opacity:${(1 - i * 0.17).toFixed(2)}"></i></span>
      <span class="pc">${d.pc}%</span></div>`;
  }).join("")}</div>`;
}

function avisos(c) {
  const out = [];
  if (c.sinHora) {
    out.push(`<div class="aviso"><span class="t">Falta la hora de nacimiento</span>
      <p>Calculé con el mediodía. Las posiciones de los planetas están bien, pero
      <b>no se pueden calcular las casas, el Ascendente ni el Medio Cielo</b>, que son
      justamente lo que ubica cada cosa en un área de tu vida.
      ${c.lunaDudosa ? `Y ese día la Luna pasó de <b>${escapeHtml(c.lunaDudosa.desde)}</b> a
      <b>${escapeHtml(c.lunaDudosa.hasta)}</b>: sin la hora no se puede saber en cuál de los dos está.` : ""}
      La hora está en tu partida de nacimiento.</p></div>`);
  }
  if (c.horaInexistente) {
    out.push(`<div class="aviso"><span class="t">Esa hora no existió</span>
      <p>Ese día el reloj se adelantó por el horario de verano y esa hora se salteó.
      Usé la más cercana que sí existió. Revisá el dato en la partida.</p></div>`);
  }
  if (c.casas?.sustituido) {
    out.push(`<div class="aviso"><span class="t">Sistema de casas cambiado</span>
      <p>${escapeHtml(NOMBRE_CASAS[c.sistemaCasas] || c.sistemaCasas)} no está definido tan cerca del polo,
      así que se usó otro sistema.${c.casas.aviso ? ` ${escapeHtml(c.casas.aviso)}` : ""}</p></div>`);
  }
  return out.join("");
}

function tabla(c) {
  return `<table class="posiciones">
    <thead><tr><th></th><th>Cuerpo</th><th>Signo</th><th class="num">Grado</th>
      ${c.casas ? "<th class='num'>Casa</th>" : ""}<th class="num">Velocidad</th></tr></thead>
    <tbody>${c.posiciones.map((p) => `<tr${p.retro ? ' class="retro"' : ""}>
      <td class="gl">${p.glifo}</td>
      <td class="nom">${escapeHtml(p.nombre)}${p.retro ? ' <span class="r">℞</span>' : ""}</td>
      <td>${p.signoGlifo} ${escapeHtml(p.signo)}</td>
      <td class="num">${gradoMinuto(p.grado)}</td>
      ${c.casas ? `<td class="num">${p.casa}</td>` : ""}
      <td class="num">${p.velocidad >= 0 ? "+" : ""}${p.velocidad.toFixed(3)}°</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

function angulos(c) {
  if (!c.casas) return "";
  const gr = (l) => `${gradoMinuto(l % 30)} ${escapeHtml(SIGNO_DE(l))}`;
  return `<div class="mini">
    <div><span>Ascendente</span><b>${gr(c.casas.ascendente)}</b></div>
    <div><span>Medio Cielo</span><b>${gr(c.casas.medioCielo)}</b></div>
    <div><span>Sistema de casas</span><b>${escapeHtml(NOMBRE_CASAS[c.sistemaCasas] || c.sistemaCasas)}</b></div>
  </div>`;
}

function aspectosHtml(c) {
  // Se listan TODOS, conjunciones incluidas. En el cálculo de tensión la
  // conjunción no cuenta por neutra, pero en una carta es de las cosas que más
  // se miran: esconderla acá sería raro.
  const lista = c.tension.aspectos;
  if (!lista.length) return `<p class="lectura">No hay aspectos dentro de los orbes.</p>`;
  return `<ul class="aspectos">${lista.map((a) => `
    <li><span class="par">${a.a.glifo} ${escapeHtml(a.a.nombre)} <i class="asp ${a.aspecto.tipo}">${escapeHtml(a.aspecto.nombre)}</i> ${a.b.glifo} ${escapeHtml(a.b.nombre)}</span>
      <span class="orbe">orbe ${a.orbe.toFixed(1)}°</span></li>`).join("")}</ul>`;
}

export function cartaHtml(c, cieloHoy) {
  const cmp = comparar(c.elementos, cieloHoy.elementos);
  return `
<section class="carta-cab">
  <div class="wrap">
    <span class="lab lab-ac">Tu carta natal</span>
    <h1>${escapeHtml(c.entrada.fecha)}${c.entrada.hora ? ` · ${escapeHtml(c.entrada.hora)}` : ""}</h1>
    <p class="prosa">${escapeHtml(c.entrada.ciudad)} · ${escapeHtml(c.offset)}${
      c.entrada.hora ? "" : " · sin hora"}</p>
  </div>
</section>

<div class="wrap carta-cuerpo">
  ${avisos(c)}
  <div class="carta-grid">
    <div class="carta-rueda">
      ${ruedaSvg({ posiciones: c.posiciones, casas: c.casas, etiqueta: "Tu carta natal" })}
      ${angulos(c)}
    </div>
    <div class="carta-tabla">
      <h2>Posiciones</h2>
      ${tabla(c)}
      <p class="nota-pie">Las posiciones salen de Swiss Ephemeris con los archivos DE441.
        La velocidad negativa es lo que marca que un cuerpo está retrógrado.</p>
    </div>
  </div>

  <div class="carta-cols">
    <section class="caja">
      <h3>Balance de elementos</h3>
      ${barras(c.elementos, META_ELEMENTO)}
    </section>
    <section class="caja">
      <h3>Modalidades</h3>
      ${barras(c.modalidades, META_MODALIDAD)}
    </section>
    <section class="caja">
      <h3>Tensión de tu carta</h3>
      <div class="tension">
        <span class="cifra">${c.tension.porcentaje}%</span>
        <div class="split"><i style="flex:${c.tension.duros || 0.001}"></i><i style="flex:${c.tension.blandos || 0.001}"></i></div>
        <div class="refs"><span>${c.tension.duros} duros</span><span>${c.tension.blandos} blandos</span></div>
      </div>
    </section>
  </div>

  <section class="caja comparar">
    <h3>Tu carta contra el cielo de hoy</h3>
    <div class="comp">${cmp.map((x) => `
      <div><span class="l">${escapeHtml(META_ELEMENTO[x.clave]?.nombre || x.clave)}</span>
        <span class="p vos"><i style="width:${x.propio}%"></i></span>
        <span class="p hoy"><i style="width:${x.hoy}%"></i></span>
        <span class="v">${x.propio}% / ${x.hoy}%</span></div>`).join("")}</div>
    <div class="leyenda">
      <span><i style="background:var(--ac2)"></i>Tu carta</span>
      <span><i style="background:var(--ac)"></i>El cielo de hoy</span>
    </div>
  </section>

  <section class="caja">
    <h3>Aspectos</h3>
    ${aspectosHtml(c)}
  </section>

  <section class="cierre">
    <h2>Esto es el mapa. Falta leerlo.</h2>
    <p class="prosa">La carta dice qué estructura tenés. Qué hacer con eso —en tu trabajo,
      con tu equipo, en el momento en que estás— es lo que miramos en una consulta.</p>
    <p style="margin-top:18px"><a class="btn btn-p" href="/agenda">Agendar una consulta</a>
      &nbsp;<a class="btn btn-g" href="/carta-natal">Calcular otra carta</a></p>
  </section>
</div>`;
}

export const CSS_CARTA = CSS_RUEDA + `
.carta-cab{border-bottom:1px solid var(--line);background:var(--surf);padding:38px 0 30px}
.carta-cab h1{margin:12px 0 10px;font-size:clamp(1.9rem,4.5vw,3rem)}
.carta-cuerpo{padding:34px 26px 60px}
.aviso{border:1px solid var(--ac);border-left-width:3px;background:var(--surf);
  padding:18px 22px;display:flex;flex-direction:column;gap:7px;margin-bottom:24px}
.aviso .t{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:1rem}
.aviso p{font-size:.94rem;color:var(--tx2);max-width:78ch}
.aviso b{color:var(--tx);font-weight:600}
.carta-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:1px;background:var(--line);
  border:1px solid var(--line);margin-bottom:26px}
.carta-rueda,.carta-tabla{background:var(--bg);padding:24px}
.carta-rueda{display:flex;flex-direction:column;gap:18px;justify-content:center}
.carta-tabla h2{font-size:1.2rem;margin-bottom:14px}
.posiciones{width:100%;border-collapse:collapse}
.posiciones th{font-family:var(--mono);font-size:.58rem;letter-spacing:.13em;text-transform:uppercase;
  color:var(--tx3);font-weight:400;text-align:left;padding:8px 6px;border-bottom:1px solid var(--line2)}
.posiciones th.num,.posiciones td.num{text-align:right}
.posiciones td{padding:8px 6px;border-bottom:1px solid var(--line);font-family:var(--mono);
  font-size:.78rem;color:var(--tx2);font-variant-numeric:tabular-nums}
.posiciones tr:last-child td{border-bottom:0}
.posiciones td.gl{font-size:1rem;color:var(--ac);width:26px}
.posiciones td.nom{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.84rem;
  color:var(--tx);letter-spacing:0}
.posiciones td.nom .r{color:var(--tx3);font-family:var(--mono);font-size:.7rem}
.nota-pie{font-family:var(--mono);font-size:.66rem;color:var(--tx3);line-height:1.6;margin-top:12px}
.carta-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);
  border:1px solid var(--line);margin-bottom:26px}
.caja{background:var(--bg);padding:22px 24px;display:flex;flex-direction:column;gap:14px}
.caja h3{font-size:.98rem}
.barras{display:flex;flex-direction:column;gap:9px}
.bar{display:grid;grid-template-columns:88px 1fr 46px;gap:12px;align-items:center}
.bar .nm{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.8rem;letter-spacing:0}
.bar .nm small{display:block;font-family:var(--mono);font-size:.58rem;font-weight:400;
  letter-spacing:.1em;text-transform:uppercase;color:var(--tx3);margin-top:1px}
.bar .pista{height:9px;background:var(--surf2);position:relative}
.bar .pista i{position:absolute;inset:0 auto 0 0;background:var(--ac);display:block}
.bar .pc{font-family:var(--mono);font-size:.8rem;text-align:right;color:var(--tx);font-variant-numeric:tabular-nums}
.mini{display:flex;flex-direction:column;gap:7px}
.mini div{display:flex;justify-content:space-between;gap:12px;font-family:var(--mono);font-size:.72rem;
  color:var(--tx2);padding-bottom:7px;border-bottom:1px solid var(--line)}
.mini div:last-child{border-bottom:0;padding-bottom:0}
.mini b{color:var(--ac);font-weight:500}
.tension{display:flex;flex-direction:column;gap:9px}
.tension .cifra{font-family:var(--disp);font-stretch:110%;font-weight:600;font-size:2.5rem;line-height:1}
.tension .split{display:flex;height:9px;gap:2px}
.tension .split i{display:block}
.tension .split i:first-child{background:var(--ac)}
.tension .split i:last-child{background:var(--surf2)}
.tension .refs{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.64rem;color:var(--tx3)}
.comparar{border:1px solid var(--line);margin-bottom:26px}
.comp{display:flex;flex-direction:column;gap:8px}
.comp div{display:grid;grid-template-columns:70px 1fr 1fr 84px;gap:10px;align-items:center}
.comp .l{font-family:var(--mono);font-size:.64rem;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3)}
.comp .p{height:8px;background:var(--surf2);position:relative}
.comp .p i{position:absolute;inset:0 auto 0 0;display:block}
.comp .p.vos i{background:var(--ac2)}
.comp .p.hoy i{background:var(--ac)}
.comp .v{font-family:var(--mono);font-size:.7rem;color:var(--tx2);text-align:right;font-variant-numeric:tabular-nums}
.leyenda{display:flex;gap:16px;font-family:var(--mono);font-size:.62rem;color:var(--tx3)}
.leyenda span{display:flex;align-items:center;gap:6px}
.leyenda i{width:9px;height:9px;display:block}
.aspectos{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);gap:0 22px}
.aspectos li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;
  border-bottom:1px solid var(--line);font-size:.86rem;color:var(--tx2)}
.aspectos .asp{font-style:normal;font-family:var(--mono);font-size:.68rem;letter-spacing:.06em;
  text-transform:uppercase;padding:0 6px}
.aspectos .asp.duro{color:var(--tx3)}
.aspectos .asp.blando{color:var(--ac)}
.aspectos .asp.neutro{color:var(--ac2)}
.aspectos .orbe{font-family:var(--mono);font-size:.68rem;color:var(--tx3);white-space:nowrap}
.cierre{border-top:1px solid var(--line2);padding-top:34px;margin-top:34px}
.cierre h2{font-size:1.6rem;margin-bottom:12px}
@media (max-width:900px){
  .carta-grid,.carta-cols{grid-template-columns:1fr}
  .aspectos{grid-template-columns:1fr}
  .comp div{grid-template-columns:64px 1fr 1fr;grid-template-areas:none}
  .comp .v{grid-column:1/-1;text-align:left}
}
`;

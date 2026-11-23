// La portada. Los trece bloques en el orden exacto de la sección 04 del brief.
import { escapeHtml, gradoMinuto, fmtDiaMes, fmtFechaLarga } from "./layout.js";
import { ruedaSvg, CSS_RUEDA } from "../lib/rueda.js";
import { META_ELEMENTO, META_MODALIDAD } from "../lib/cielo.js";

const PUERTAS = [
  ["01", "Hace cinco años que hago lo mismo.", "Estoy trabado", "/estoy-trabado"],
  ["02", "No sé si es el momento de largarme.", "Quiero emprender", "/quiero-emprender"],
  ["03", "Todas las decisiones pasan por mí.", "Decido solo", "/decido-solo"],
  ["04", "No sé a quién poner dónde.", "Armo equipo", "/armo-equipo"],
];

const CARRILES = { trabajo: "Trabajo", grupos: "Grupos", ciclos: "Ciclo" };

// --- Bloques ---------------------------------------------------------------

function hero(cielo) {
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  return `
<section class="hero">
  <div class="hero-izq">
    <span class="lab lab-ac">Carta natal · gratis · sin registro</span>
    <h1>Tu carta es un mapa de para qué servís.</h1>
    <p class="hero-sub">Ciclos, tiempos y estructura aplicados al trabajo, la vocación y la dinámica de los grupos.</p>
    <form class="calc" action="/carta-natal" method="GET" id="calc">
      <div class="campo">
        <label for="fecha">Fecha de nacimiento</label>
        <input type="date" id="fecha" name="fecha" required max="${iso}" min="1900-01-01">
      </div>
      <div class="campo">
        <label for="hora">Hora <span class="opc">si la sabés</span></label>
        <input type="time" id="hora" name="hora" placeholder="07:42">
      </div>
      <div class="campo ancho">
        <label for="ciudad">Ciudad de nacimiento</label>
        <input type="text" id="ciudad" name="ciudad" autocomplete="off" required
               placeholder="Empezá a escribir…" role="combobox" aria-expanded="false"
               aria-autocomplete="list" aria-controls="sugerencias">
        <input type="hidden" name="ciudad_id" id="ciudad_id">
        <ul class="sug" id="sugerencias" role="listbox" hidden></ul>
      </div>
      <button class="go" type="submit">Calcular mi carta</button>
      <p class="calc-pie">Sin la hora se calcula igual, con menos precisión: no salen las casas ni el Ascendente.</p>
    </form>
  </div>
  <div class="hero-der">
    ${ruedaSvg({ posiciones: cielo.posiciones, girar: true, etiqueta: "El cielo de hoy, en rueda" })}
  </div>
</section>`;
}

function cinta(cielo) {
  const datos = cielo.posiciones.map((p) =>
    [`${p.glifo} ${p.nombre}`, `${p.signo} ${gradoMinuto(p.grado)}${p.retro ? " ℞" : ""}`]);
  datos.push(["Luna", `${cielo.luna.porcentaje}% ${cielo.luna.nombre.toLowerCase()}`]);
  if (cielo.luna.proxima) {
    datos.push([cielo.luna.proxima.tipo === "nueva" ? "Nueva" : "Llena",
      `${fmtDiaMes(cielo.luna.proxima.fecha)} · ${cielo.luna.proxima.signo}`]);
  }
  // El contenido va DUPLICADO para que el bucle no corte a mitad de camino.
  const uno = datos.map(([a, b]) => `<span>${escapeHtml(a)} <b>${escapeHtml(b)}</b></span>`).join("");
  return `<div class="cinta" aria-label="Posiciones de hoy"><div class="cinta-in">${uno}${uno}</div></div>`;
}

function barras(datos, meta) {
  const max = datos[0]?.pc || 1;
  // Una sola tonalidad escalonada por magnitud: la identidad la lleva la
  // ETIQUETA, nunca el color (regla 09, "nunca información sólo por color").
  return `<div class="barras">${datos.map((d, i) => {
    const m = meta[d.clave] || { nombre: d.clave, sub: "" };
    return `<div class="bar">
      <span class="nm">${escapeHtml(m.nombre)}${m.sub ? `<small>${escapeHtml(m.sub)}</small>` : ""}</span>
      <span class="pista"><i style="width:${((d.pc / max) * 100).toFixed(1)}%;opacity:${(1 - i * 0.17).toFixed(2)}"></i></span>
      <span class="pc">${d.pc}%</span></div>`;
  }).join("")}</div>`;
}

function discoLuna(fraccion) {
  const R = 34, C = 38;
  const k = (fraccion - 0.5) * 2;
  return `<svg width="70" height="70" viewBox="0 0 76 76" aria-hidden="true">
    <circle cx="${C}" cy="${C}" r="${R}" fill="var(--surf2)" stroke="var(--line2)"/>
    <path d="M ${C} ${C - R} A ${R} ${R} 0 0 1 ${C} ${C + R} A ${(R * Math.abs(k)).toFixed(1)} ${R} 0 0 ${k >= 0 ? 1 : 0} ${C} ${C - R} Z" fill="var(--ac)"/>
    <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--line2)"/>
  </svg>`;
}

function panelCielo(cielo, ventanas) {
  const t = cielo.tension;
  const proxima = cielo.luna.proxima;
  return `
<section class="panel" id="cielo">
  <div class="panel-cab">
    <h2>El cielo de hoy</h2>
    <span class="sello">${escapeHtml(fmtFechaLarga(cielo.momento))}</span>
  </div>
  <div class="panel-grid">

    <article class="mod w2">
      <div class="mod-cab"><h3>Balance de elementos</h3><span class="et">Ponderado</span></div>
      ${barras(cielo.elementos, META_ELEMENTO)}
      <p class="lectura">${cielo.lecturas.elemento}</p>
    </article>

    <article class="mod">
      <div class="mod-cab"><h3>Fase lunar</h3><span class="et">${cielo.luna.porcentaje}%</span></div>
      <div class="luna-fila">
        ${discoLuna(cielo.luna.iluminacion)}
        <div class="luna-dato">
          <span class="g">${cielo.luna.porcentaje}%</span>
          <span class="p">${escapeHtml(cielo.luna.nombre)}</span>
        </div>
      </div>
      ${proxima ? `<p class="lectura">${proxima.tipo === "nueva" ? "Nueva" : "Llena"} en <b>${proxima.dias === 0 ? "horas" : `${proxima.dias} día${proxima.dias === 1 ? "" : "s"}`}</b> en ${escapeHtml(proxima.signo)}.</p>` : ""}
    </article>

    <article class="mod">
      <div class="mod-cab"><h3>Retrógrados</h3><span class="et">${cielo.retrogrados.length} activo${cielo.retrogrados.length === 1 ? "" : "s"}</span></div>
      ${cielo.retrogrados.length ? `<div class="mini">${cielo.retrogrados.map((p) =>
        `<div><span>${p.glifo} ${escapeHtml(p.nombre)}</span><b>${escapeHtml(p.signo)} ${gradoMinuto(p.grado)}</b></div>`).join("")}</div>`
        : `<p class="lectura" style="border:0;margin-top:0">Ninguno. Todos los cuerpos van directos.</p>`}
    </article>

    <article class="mod w2">
      <div class="mod-cab"><h3>Modalidades</h3><span class="et">Qué pide el día</span></div>
      ${barras(cielo.modalidades, META_MODALIDAD)}
      <p class="lectura">${cielo.lecturas.modalidad}</p>
    </article>

    <article class="mod">
      <div class="mod-cab"><h3>Tensión del cielo</h3><span class="et">Aspectos</span></div>
      <div class="tension">
        <span class="cifra">${t.porcentaje}%</span>
        <div class="split"><i style="flex:${t.duros || 0.001}"></i><i style="flex:${t.blandos || 0.001}"></i></div>
        <div class="refs"><span>${t.duros} duros</span><span>${t.blandos} blandos</span></div>
      </div>
      <p class="lectura">${cielo.lecturas.tension}</p>
    </article>

    <article class="mod">
      <div class="mod-cab"><h3>Ciclo de fondo</h3><span class="et">Largo plazo</span></div>
      <div class="mini">${cielo.ciclo.map((p) =>
        `<div><span>${p.glifo} ${escapeHtml(p.nombre)}</span><b>${escapeHtml(p.signo)}</b></div>`).join("")}</div>
    </article>

    <article class="mod bloq w2">
      <div class="mod-cab"><h3>Tu carta contra el cielo de hoy</h3><span class="et">Con tu cuenta</span></div>
      <p class="lectura" style="border:0;margin:0;padding:0">Calculá tu carta y mirá dónde vas a favor de la corriente
        y qué días te cuestan. Los porcentajes de tu carta, al lado de los de hoy.</p>
      <a class="cta" href="#calc">Calcular mi carta y comparar</a>
    </article>

    <article class="mod w2">
      <div class="mod-cab"><h3>Ventanas de la semana</h3><span class="et">Para decidir</span></div>
      <div class="semana">${ventanas.map((d) => `
        <div class="dia${d.hoy ? " hoy" : ""}">
          <span class="d">${escapeHtml(d.dia)}</span>
          <span class="n">${String(d.numero).padStart(2, "0")}</span>
          <span class="caja ${d.estado}" title="${escapeHtml(d.ayuda)}">${escapeHtml(d.texto)}</span>
        </div>`).join("")}</div>
      <p class="lectura">Lleno: sirve para firmar, lanzar y cerrar. Sombreado: avanzá pero no comprometas.
        Vacío: resolvé pendientes y esperá.</p>
    </article>

    <article class="mod w4">
      <div class="mod-cab"><h3>Los próximos 30 días</h3><span class="et">Lunaciones, ingresos y estaciones</span></div>
      ${lineaTiempo(cielo)}
    </article>
  </div>
</section>`;
}

function lineaTiempo(cielo) {
  const desde = cielo.momento.getTime();
  const hitos = cielo.hitos.slice(0, 8);
  if (!hitos.length) return `<p class="lectura">Treinta días sin lunaciones ni cambios de signo.</p>`;
  return `<div class="linea"><div class="eje"></div>${hitos.map((h) => {
    const dias = (h.fecha - desde) / 86400000;
    const x = 4 + (dias / 31) * 92;
    return `<div class="hito${h.principal ? "" : " menor"}" style="left:${x.toFixed(1)}%">
      <span class="f">${escapeHtml(fmtDiaMes(h.fecha))}</span>
      <span class="tallo"></span><span class="nodo"></span>
      <span class="tx">${escapeHtml(h.titulo)}<br>${escapeHtml(h.detalle)}</span>
    </div>`;
  }).join("")}</div>`;
}

const puertas = () => `
<section class="puertas">${PUERTAS.map(([n, frase, texto, href]) => `
  <a class="puerta" href="${href}">
    <span class="num">${n}</span>
    <p class="fr">«${escapeHtml(frase)}»</p>
    <p class="pie-p">${escapeHtml(texto)} →</p>
  </a>`).join("")}</section>`;

const video = () => `
<section class="video">
  <div class="video-izq">
    <div class="repro" role="img" aria-label="Video de presentación, todavía sin cargar">
      <span class="marca">Anaretico 29 · Presentación</span>
      <span class="capa"><span class="play">
        <svg width="24" height="26" viewBox="0 0 24 26" aria-hidden="true"><path d="M2 2 L22 13 L2 24 Z" fill="var(--onac)"/></svg>
      </span></span>
      <span class="dur">2:40</span>
    </div>
    <p class="pie-vid">Acá va el video de presentación · no arranca solo, se carga al tocarlo</p>
    <div class="capitulos">
      <div><span class="t">0:00</span><span class="c">Qué hago exactamente</span></div>
      <div><span class="t">0:45</span><span class="c">Por qué ciclos y no predicciones</span></div>
      <div><span class="t">1:30</span><span class="c">Cómo es una consulta, paso a paso</span></div>
      <div><span class="t">2:10</span><span class="c">Para quién esto no es</span></div>
    </div>
  </div>
  <div class="video-der">
    <div class="retrato"><span class="sello-foto">Foto · retrato 4:5</span></div>
    <div class="video-txt">
      <span class="lab lab-ac">Quién está atrás</span>
      <h2>Fernando Javier Pérez</h2>
      <p class="prosa">Dos minutos y medio contando qué hago, por qué la astrología aplicada al trabajo
        y cómo es una consulta.</p>
      <a class="btn btn-p" href="/recorrido">Conocé mi recorrido &nbsp;→</a>
    </div>
  </div>
</section>`;

const casos = (lista) => !lista.length ? "" : `
<section class="bloque">
  <div class="bloque-cab"><h2>Consultas resueltas</h2><span class="lab">Con permiso · nombres cambiados</span></div>
  <div class="casos">${lista.map((c) => `
    <article class="caso">
      <span class="id">${escapeHtml(c.etiqueta)}</span>
      <span class="quien">${escapeHtml(c.quien).replace(/\n/g, "<br>")}</span>
      <div class="paso"><span class="k">Traía</span><span class="v">${escapeHtml(c.traia)}</span></div>
      <div class="paso"><span class="k">${escapeHtml(c.mostro_tit)}</span><span class="v">${escapeHtml(c.mostro)}</span></div>
      <div class="paso cierre"><span class="k">Qué decidió</span><span class="v">${escapeHtml(c.decidio)}</span></div>
    </article>`).join("")}</div>
  <p style="margin-top:20px"><a href="/casos">Ver todas las consultas resueltas →</a></p>
</section>`;

const fechas = (lista) => !lista.length ? "" : `
<section class="bloque">
  <div class="bloque-cab"><h2>Próximas fechas</h2><span class="lab">Agenda de encuentros</span></div>
  <div class="fechas">${lista.map((f) => `
    <div class="fecha${f.sin_cupo ? " lleno" : ""}">
      <span class="cuando">${escapeHtml(fmtDiaMes(f.cuando))}</span>
      <span class="que">${escapeHtml(f.titulo)}${f.detalle ? `<small>${escapeHtml(f.detalle)}</small>` : ""}</span>
      <span class="tipo">${f.tipo === "miembros" ? "Miembros" : "Abierto"}</span>
      <span class="acc">${f.sin_cupo ? "Sin cupo" : `<a href="${escapeHtml(f.url || "/agenda")}">Anotarme →</a>`}</span>
    </div>`).join("")}</div>
</section>`;

const revista = (notas) => !notas.length ? "" : `
<section class="bloque">
  <div class="bloque-cab"><h2>Revista</h2><a class="lab" href="/revista">Ver todas las notas →</a></div>
  <div class="notas">${notas.map((n) => `
    <a class="nota" href="/revista/${escapeHtml(n.handle)}">
      <div class="img">${n.portada_url ? `<img src="${escapeHtml(n.portada_url)}" alt="">` : ""}</div>
      <span class="et">${escapeHtml(CARRILES[n.carril] || n.carril)}</span>
      <h3>${escapeHtml(n.titulo)}</h3>
      <p>${n.minutos ? `${n.minutos} min · ` : ""}${escapeHtml(fmtDiaMes(n.publicada_at || n.created_at))}</p>
    </a>`).join("")}</div>
</section>`;

const membresia = () => `
<section class="mem">
  <div class="mem-a">
    <span class="lab lab-ac">Membresía</span>
    <h2>El cielo del mes, leído para tu trabajo.</h2>
    <ul>
      <li>Lectura mensual aplicada a decisiones, no horóscopo por signo</li>
      <li>Encuentro en vivo una vez por mes, con preguntas abiertas</li>
      <li>Archivo completo de la revista y de las lecturas anteriores</li>
      <li>Tu carta guardada, con avisos cuando entra un tránsito importante</li>
    </ul>
  </div>
  <div class="mem-b">
    <div class="precio"><span class="m">$—</span><span class="u">/ MES</span></div>
    <p style="color:var(--tx2);font-size:.92rem">Un solo nivel. Se cancela cuando quieras.</p>
    <a class="btn btn-p" style="align-self:flex-start;margin-top:6px" href="/membresia">Quiero entrar</a>
    <p class="lab" style="margin-top:8px">También en dólares para fuera de la Argentina</p>
  </div>
</section>`;

const preguntas = (lista) => !lista.length ? "" : `
<section class="bloque">
  <div class="bloque-cab"><h2>Lo que siempre me preguntan</h2><a class="lab" href="/preguntas">Ver todas →</a></div>
  <div class="faq">${lista.map((p) => `
    <div><span class="q">${escapeHtml(p.pregunta)}</span><span class="a">${escapeHtml(p.respuesta)}</span></div>`).join("")}</div>
</section>`;

const informe = () => `
<section class="informe">
  <div class="inf-a">
    <span class="lab lab-ac">Producto anual</span>
    <h2>Las fechas del año</h2>
    <p class="prosa">Un informe con las mejores ventanas del año para lanzar, firmar, invertir y decidir.
      Se publica en diciembre y sirve los doce meses.</p>
    <ul>
      <li>Ventanas mes por mes, con la fecha y la hora concreta</li>
      <li>Los períodos a evitar y por qué</li>
      <li>Lunaciones, eclipses y retrogradaciones aplicados a decisiones de negocio</li>
      <li>Los ciclos largos que reordenan cada sector</li>
    </ul>
  </div>
  <div class="inf-b">
    <div class="tapa">
      <span class="tt">Anaretico 29</span>
      <span class="tb">Las fechas<br>del año<small>Informe · PDF</small></span>
    </div>
    <a class="btn btn-p" style="margin-top:4px" href="/las-fechas">Reservar mi copia</a>
    <span class="lab">Se envía en diciembre · PDF</span>
  </div>
</section>`;

// --- Página ----------------------------------------------------------------

/** El panel del cielo como página propia, con su encabezado. */
export function cieloSueltoHtml(cielo, ventanas) {
  return `<section class="cab-pag"><div class="wrap">
      <span class="lab lab-ac">Se recalcula cada hora</span>
      <h1>El cielo de hoy</h1>
      <p class="prosa lead">Dónde está cada cuerpo, qué pide el día y qué viene en los próximos treinta días.
        Es el mismo cielo para todos: no depende de tu carta.</p>
    </div></section>
    ${cinta(cielo)}
    ${panelCielo(cielo, ventanas)}
    <div class="wrap" style="padding:36px 26px 60px">
      <h2 style="font-size:1.5rem;margin-bottom:12px">¿Y en tu carta?</h2>
      <p class="prosa">Esto es el clima general. Cómo te pega a vos depende de dónde caiga en tu carta.</p>
      <p style="margin-top:18px"><a class="btn btn-p" href="/carta-natal">Calcular mi carta</a></p>
    </div>`;
}

export function homeHtml({ cielo, ventanas, casos: cs, fechas: fs, notas, preguntas: ps }) {
  return [
    hero(cielo), cinta(cielo), panelCielo(cielo, ventanas), puertas(), video(),
    casos(cs), informe(), fechas(fs), revista(notas), membresia(), preguntas(ps),
  ].join("\n");
}

export const CSS_HOME = CSS_RUEDA + `
.cab-pag{border-bottom:1px solid var(--line);background:var(--surf);padding:44px 0 34px}
.cab-pag h1{margin:12px 0 12px}
.cab-pag .lead{font-size:1.1rem}
.hero{display:grid;grid-template-columns:1.05fr .95fr;border-bottom:1px solid var(--line)}
.hero-izq{padding:56px 26px 50px;display:flex;flex-direction:column;gap:18px;justify-content:center;
  max-width:640px;margin-left:auto;width:100%}
.hero-sub{color:var(--tx2);font-size:1.05rem;max-width:40ch}
.hero-der{border-left:1px solid var(--line);background:var(--surf);display:flex;align-items:center;
  justify-content:center;padding:26px;min-height:420px}
.calc{border:1px solid var(--line2);background:var(--surf);padding:16px;display:grid;
  grid-template-columns:1fr 1fr;gap:11px;margin-top:6px}
.calc .campo{display:flex;flex-direction:column;gap:5px;position:relative;min-width:0}
.calc .campo.ancho{grid-column:1/-1}
.calc label{font-family:var(--mono);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--tx3)}
.calc label .opc{text-transform:none;letter-spacing:.04em}
.calc input{border:1px solid var(--line);background:var(--bg);padding:10px 11px;
  font-family:var(--mono);font-size:.82rem;color:var(--tx);border-radius:var(--r);width:100%}
.calc input:focus{outline:2px solid var(--ac);outline-offset:1px}
.calc .go{grid-column:1/-1;background:var(--ac);color:var(--onac);text-align:center;padding:12px;
  font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.85rem;border-radius:var(--r)}
.calc .go:hover{background:#12447a}
.calc-pie{grid-column:1/-1;font-family:var(--mono);font-size:.63rem;color:var(--tx3);line-height:1.5}
.sug{position:absolute;top:100%;left:0;right:0;z-index:30;list-style:none;margin:2px 0 0;padding:0;
  background:var(--bg);border:1px solid var(--line2);max-height:240px;overflow-y:auto}
.sug li{padding:9px 11px;font-family:var(--mono);font-size:.76rem;color:var(--tx2);cursor:pointer}
.sug li:hover,.sug li[aria-selected="true"]{background:var(--surf);color:var(--tx)}

.cinta{border-bottom:1px solid var(--line);background:var(--surf2);overflow:hidden;padding:9px 0}
.cinta-in{display:flex;gap:44px;white-space:nowrap;animation:desliz 60s linear infinite;width:max-content}
.cinta span{font-family:var(--mono);font-size:.7rem;letter-spacing:.1em;color:var(--tx2)}
.cinta b{color:var(--ac);font-weight:500}
@keyframes desliz{to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.cinta-in{animation:none}}

.panel{border-bottom:1px solid var(--line)}
.panel-cab{display:flex;justify-content:space-between;align-items:baseline;gap:16px;
  padding:22px 26px 16px;flex-wrap:wrap;max-width:var(--max);margin:0 auto}
.panel-cab h2{font-size:1.55rem}
.panel-cab .sello{font-family:var(--mono);font-size:.62rem;letter-spacing:.11em;text-transform:uppercase;
  color:var(--tx3);border:1px solid var(--line);padding:4px 10px;border-radius:20px}
.panel-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);
  border-top:1px solid var(--line)}
.mod{background:var(--bg);padding:20px 22px;display:flex;flex-direction:column;gap:13px;min-height:180px}
.mod.w2{grid-column:span 2}
.mod.w4{grid-column:span 4}
.mod-cab{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.mod-cab h3{font-size:.98rem}
.mod-cab .et{font-family:var(--mono);font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tx3)}
.lectura{font-size:.88rem;color:var(--tx2);margin-top:auto;padding-top:11px;border-top:1px solid var(--line)}
.lectura b{color:var(--tx);font-weight:600}
.barras{display:flex;flex-direction:column;gap:9px}
.bar{display:grid;grid-template-columns:88px 1fr 46px;gap:12px;align-items:center}
.bar .nm{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.8rem;letter-spacing:0}
.bar .nm small{display:block;font-family:var(--mono);font-size:.58rem;font-weight:400;
  letter-spacing:.1em;text-transform:uppercase;color:var(--tx3);margin-top:1px}
.bar .pista{height:9px;background:var(--surf2);border-radius:0 2px 2px 0;position:relative}
.bar .pista i{position:absolute;inset:0 auto 0 0;background:var(--ac);border-radius:0 2px 2px 0;display:block}
.bar .pc{font-family:var(--mono);font-size:.8rem;font-variant-numeric:tabular-nums;text-align:right;color:var(--tx)}
.luna-fila{display:flex;align-items:center;gap:20px}
.luna-dato{display:flex;flex-direction:column;gap:2px}
.luna-dato .g{font-family:var(--disp);font-stretch:110%;font-weight:600;font-size:1.9rem;line-height:1}
.luna-dato .p{font-family:var(--mono);font-size:.62rem;letter-spacing:.11em;text-transform:uppercase;color:var(--tx3)}
.mini{display:flex;flex-direction:column;gap:7px}
.mini div{display:flex;justify-content:space-between;gap:12px;font-family:var(--mono);font-size:.7rem;
  color:var(--tx2);padding-bottom:6px;border-bottom:1px solid var(--line)}
.mini div:last-child{border-bottom:0;padding-bottom:0}
.mini b{color:var(--ac);font-weight:500}
.tension{display:flex;flex-direction:column;gap:9px}
.tension .cifra{font-family:var(--disp);font-stretch:110%;font-weight:600;font-size:2.5rem;line-height:1}
.tension .split{display:flex;height:9px;gap:2px}
.tension .split i{display:block;border-radius:2px}
.tension .split i:first-child{background:var(--ac)}
.tension .split i:last-child{background:var(--surf2)}
.tension .refs{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.64rem;color:var(--tx3)}
.mod.bloq{background:var(--surf)}
.mod.bloq .cta{align-self:flex-start;margin-top:auto;background:var(--ac);color:var(--onac);
  font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.78rem;padding:9px 17px;border-radius:var(--r)}
.mod.bloq .cta:hover{text-decoration:none;background:#12447a}
.semana{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.dia{display:flex;flex-direction:column;align-items:center;gap:7px}
.dia .d{font-family:var(--mono);font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3)}
.dia .n{font-family:var(--mono);font-size:.72rem;color:var(--tx2);font-variant-numeric:tabular-nums}
.dia .caja{width:100%;height:38px;border-radius:2px;display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:.66rem;font-weight:500}
.dia .caja.si{background:var(--ac2);color:var(--bg)}
.dia .caja.tal{background:var(--surf2);color:var(--tx2);box-shadow:inset 0 0 0 1px var(--line2)}
.dia .caja.no{background:transparent;box-shadow:inset 0 0 0 1px var(--line);color:var(--tx3)}
.dia.hoy .d{color:var(--ac)}
.dia.hoy .caja{box-shadow:0 0 0 2px var(--ac)}
.linea{position:relative;height:120px;margin-top:6px}
.linea .eje{position:absolute;left:0;right:0;top:46px;height:1px;background:var(--line2)}
.linea .hito{position:absolute;top:0;transform:translateX(-50%);display:flex;flex-direction:column;
  align-items:center;width:120px}
.linea .hito .f{font-family:var(--mono);font-size:.64rem;letter-spacing:.06em;color:var(--ac);height:20px}
.linea .hito .tallo{width:1px;flex:0 0 22px;background:var(--line2)}
.linea .hito .nodo{width:11px;height:11px;border-radius:50%;background:var(--bg);border:2px solid var(--ac);margin:-1px 0}
.linea .hito.menor .nodo{border-color:var(--tx3)}
.linea .hito.menor .f{color:var(--tx3)}
.linea .hito .tx{font-family:var(--mono);font-size:.62rem;line-height:1.45;color:var(--tx2);
  text-align:center;padding-top:9px;text-wrap:balance}

.puertas{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);
  border-bottom:1px solid var(--line)}
.puerta{background:var(--bg);padding:26px 22px;display:flex;flex-direction:column;gap:9px;min-height:190px;color:var(--tx)}
.puerta:hover{background:var(--surf);text-decoration:none}
.puerta .num{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;color:var(--ac)}
.puerta .fr{font-family:var(--body);font-style:italic;font-size:1.02rem;line-height:1.35;color:var(--tx)}
.puerta .pie-p{font-size:.85rem;color:var(--tx3);margin-top:auto}

.video{display:grid;grid-template-columns:1.25fr 1fr;border-bottom:1px solid var(--line)}
.video-izq{padding:34px 26px;display:flex;flex-direction:column;justify-content:center;
  max-width:720px;margin-left:auto;width:100%}
.video-der{padding:34px 26px;border-left:1px solid var(--line);background:var(--surf);
  display:flex;flex-direction:column;gap:18px;justify-content:center}
.repro{position:relative;aspect-ratio:16/9;border:1px solid var(--line2);background:var(--surf2);
  overflow:hidden;display:block;width:100%}
.repro .capa{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.repro .play{width:74px;height:74px;border-radius:50%;background:var(--ac);display:flex;
  align-items:center;justify-content:center}
.repro .play svg{margin-left:4px}
.repro .dur{position:absolute;right:12px;bottom:12px;font-family:var(--mono);font-size:.68rem;
  background:var(--tx);color:var(--bg);padding:4px 9px;border-radius:2px}
.repro .marca{position:absolute;left:14px;top:13px;font-family:var(--mono);font-size:.62rem;
  letter-spacing:.16em;text-transform:uppercase;color:var(--tx2)}
.pie-vid{padding-top:11px;font-family:var(--mono);font-size:.68rem;color:var(--tx3)}
.capitulos{display:flex;flex-direction:column;border-top:1px solid var(--line);margin-top:14px}
.capitulos div{display:grid;grid-template-columns:46px 1fr;gap:12px;align-items:baseline;padding:9px 0;
  border-bottom:1px solid var(--line)}
.capitulos div:last-child{border-bottom:0}
.capitulos .t{font-family:var(--mono);font-size:.7rem;color:var(--ac);font-variant-numeric:tabular-nums}
.capitulos .c{font-size:.92rem;color:var(--tx2)}
.retrato{position:relative;aspect-ratio:4/5;width:100%;max-width:230px;border:1px solid var(--line2);
  background:var(--surf2);display:flex;align-items:flex-end}
.sello-foto{width:100%;padding:9px 11px;font-family:var(--mono);font-size:.6rem;letter-spacing:.13em;
  text-transform:uppercase;color:var(--tx3);background:var(--surf);border-top:1px solid var(--line)}
.video-txt{display:flex;flex-direction:column;gap:12px;align-items:flex-start}

.bloque{max-width:var(--max);margin:0 auto;padding:42px 26px;border-bottom:1px solid var(--line)}
.bloque-cab{display:flex;justify-content:space-between;align-items:baseline;gap:16px;
  flex-wrap:wrap;margin-bottom:22px}
.bloque-cab h2{font-size:1.7rem}
.casos{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line)}
.caso{background:var(--bg);padding:22px 24px;display:flex;flex-direction:column;gap:11px}
.caso .id{font-family:var(--mono);font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)}
.caso .quien{font-family:var(--mono);font-size:.74rem;color:var(--tx3);line-height:1.5}
.caso .paso{display:flex;flex-direction:column;gap:2px}
.caso .paso .k{font-family:var(--mono);font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tx3)}
.caso .paso .v{font-size:.93rem;color:var(--tx2)}
.caso .paso.cierre .v{color:var(--tx);font-weight:600;font-family:var(--disp);font-stretch:104%;
  font-size:.92rem;letter-spacing:0}
.fechas{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.fecha{display:grid;grid-template-columns:78px 1fr 128px 110px;gap:18px;align-items:center;
  padding:14px 0;border-bottom:1px solid var(--line)}
.fecha .cuando{font-family:var(--mono);font-size:.78rem;color:var(--ac);font-variant-numeric:tabular-nums}
.fecha .que{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.95rem;letter-spacing:0}
.fecha .que small{display:block;font-family:var(--body);font-weight:400;font-size:.89rem;color:var(--tx2);margin-top:2px}
.fecha .tipo{font-family:var(--mono);font-size:.65rem;letter-spacing:.11em;text-transform:uppercase;color:var(--tx3)}
.fecha .acc{font-family:var(--mono);font-size:.72rem;text-align:right;color:var(--tx3)}
.notas{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
.nota{display:flex;flex-direction:column;gap:10px;color:var(--tx)}
.nota:hover{text-decoration:none}
.nota:hover h3{color:var(--ac)}
.nota .img{aspect-ratio:16/10;border:1px solid var(--line);background:var(--surf);overflow:hidden}
.nota .img img{width:100%;height:100%;object-fit:cover;display:block}
.nota .et{font-family:var(--mono);font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ac)}
.nota h3{font-family:var(--body);font-weight:500;font-size:1.14rem;line-height:1.25;letter-spacing:0;font-stretch:normal}
.nota p{font-size:.86rem;color:var(--tx3);font-family:var(--mono)}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}
.faq div{background:var(--bg);padding:20px 22px;display:flex;flex-direction:column;gap:6px}
.faq .q{font-family:var(--disp);font-stretch:104%;font-weight:600;font-size:.95rem;letter-spacing:0}
.faq .a{font-size:.93rem;color:var(--tx2)}

.informe,.mem{display:grid;grid-template-columns:1.15fr 1fr;border-bottom:1px solid var(--line);background:var(--surf)}
.inf-a,.mem-a{padding:38px 26px;display:flex;flex-direction:column;gap:15px;justify-content:center;
  max-width:680px;margin-left:auto;width:100%}
.inf-b,.mem-b{padding:38px 26px;border-left:1px solid var(--line);display:flex;flex-direction:column;
  gap:14px;justify-content:center;align-items:flex-start}
.mem{background:var(--bg)}
.mem-b{background:var(--surf)}
.informe ul,.mem ul{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.informe li,.mem li{font-size:.94rem;color:var(--tx2);padding-left:20px;position:relative}
.informe li::before,.mem li::before{content:"";position:absolute;left:0;top:.63em;width:10px;height:1px;background:var(--ac)}
.tapa{width:100%;max-width:230px;aspect-ratio:3/4;border:1px solid var(--line2);background:var(--bg);
  display:flex;flex-direction:column;justify-content:space-between;padding:20px}
.tapa .tt{font-family:var(--mono);font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ac)}
.tapa .tb{font-family:var(--disp);font-stretch:110%;font-weight:600;font-size:1.5rem;line-height:1.05}
.tapa .tb small{display:block;font-family:var(--mono);font-size:.62rem;font-weight:400;
  letter-spacing:.12em;color:var(--tx3);margin-top:7px;text-transform:uppercase}
.precio{display:flex;align-items:baseline;gap:8px}
.precio .m{font-family:var(--disp);font-stretch:112%;font-weight:700;font-size:3.1rem;line-height:1}
.precio .u{font-family:var(--mono);font-size:.72rem;color:var(--tx3);letter-spacing:.1em}

@media (max-width:980px){
  .hero,.video,.informe,.mem{grid-template-columns:1fr}
  .hero-der{border-left:0;border-top:1px solid var(--line);min-height:340px}
  .video-der,.inf-b,.mem-b{border-left:0;border-top:1px solid var(--line)}
  .panel-grid{grid-template-columns:repeat(2,1fr)}
  .mod.w4{grid-column:span 2}
  .puertas,.notas{grid-template-columns:1fr 1fr}
  .casos{grid-template-columns:1fr}
  .fecha{grid-template-columns:70px 1fr}
  .fecha .tipo,.fecha .acc{grid-column:2;text-align:left}
}
@media (max-width:680px){
  .panel-grid,.puertas,.notas,.faq{grid-template-columns:1fr}
  .mod.w2,.mod.w4{grid-column:span 1}
  .calc{grid-template-columns:1fr}
  .linea{height:auto;display:flex;flex-direction:column;gap:12px}
  .linea .eje{display:none}
  .linea .hito{position:static!important;transform:none;width:100%;flex-direction:row;
    align-items:baseline;gap:12px;text-align:left;border-bottom:1px solid var(--line);padding-bottom:9px}
  .linea .hito .tallo,.linea .hito .nodo{display:none}
  .linea .hito .tx{text-align:left;padding-top:0}
}
`;

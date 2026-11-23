// /privacidad — lugar provisorio hasta que Fernando entregue la política (S5).
//
// No es una página del prototipo: se arma sobre "Sobre mí" (src/web, generado
// por la importación) cambiándole el título, la descripción y el <main>. Así
// lleva el mismo encabezado, el mismo pie (con el texto legal intacto), las
// mismas hojas en el mismo orden y el noindex de la web nueva.
//
// Los lugares entre corchetes los completa Fernando: responsable de la base,
// domicilio y contacto (ley 25.326, art. 6). Cuando llegue el texto definitivo,
// se reemplaza CUERPO entero.
import fs from "node:fs";
import path from "node:path";
import { WEB_DIR } from "./web-nueva.js";

export const TITULO = "Anaretico 29 · Política de privacidad";
export const DESCRIPCION = "Política de privacidad de Anaretico 29 (en preparación).";

export const CUERPO = `<main id="inicio" class="sm">
<div class="sm-w sm-hero"><div><p class="k">Privacidad</p><h1>Política de privacidad</h1><p class="s">En preparación</p></div></div>
<div class="sm-w sm-cu"><div></div><div>
<p class="sm-intro">Estamos preparando la política de privacidad de Anaretico 29. Mientras tanto, esto es lo que hace hoy el sitio con tus datos.</p>
<p>Si te suscribís al mail mensual, guardamos tu dirección de mail, la fecha en que diste tu consentimiento y la página desde la que te anotaste. Lo usamos solo para enviarte el cielo del mes. Podés pedir el acceso, la rectificación o la supresión de tus datos (ley 25.326).</p>
<p class="k">Responsable de la base de datos</p><p>[RESPONSABLE: A COMPLETAR]</p>
<p class="k">Domicilio</p><p>[DOMICILIO: A COMPLETAR]</p>
<p class="k">Contacto</p><p>[CONTACTO: A COMPLETAR]</p>
</div></div>
</main>`;

/** Reemplazo que tiene que encontrar exactamente una vez lo que espera. */
function una(html, re, poner, nombre) {
  const n = (html.match(new RegExp(re.source, "g")) || []).length;
  if (n !== 1) throw new Error(`privacidad: esperaba 1 × ${nombre} en sobre-mi.html, encontré ${n}`);
  return html.replace(re, () => poner);
}

/** La página, a partir del HTML de "Sobre mí" ya importado. */
export function privacidadHtml(sobreMi) {
  if (!sobreMi.includes('<meta name="robots" content="noindex,nofollow">')) throw new Error("privacidad: sobre-mi.html perdió el noindex");
  let t = sobreMi;
  t = una(t, /<title>[^<]*<\/title>/, `<title>${TITULO}</title>`, "<title>");
  t = una(t, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${TITULO}">`, "og:title");
  t = una(t, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${DESCRIPCION}">`, "og:description");
  t = una(t, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${DESCRIPCION}">`, "description");
  t = una(t, /<main id="inicio" class="sm">[\s\S]*?<\/main>/, CUERPO, "<main>");
  return t;
}

let cache = null;
/** Se arma una vez por proceso: "Sobre mí" solo cambia con una importación (y un deploy). */
export const paginaPrivacidad = () =>
  (cache ??= privacidadHtml(fs.readFileSync(path.join(WEB_DIR, "variantes", "sobre-mi.html"), "utf8")));

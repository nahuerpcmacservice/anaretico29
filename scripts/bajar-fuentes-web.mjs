// Baja UNA VEZ las fuentes que la web nueva pedía a Google Fonts y las deja en
// src/web/assets/fuentes/, servidas por nosotros (S11: "Las fuentes alojalas en
// nuestro servidor"). Así el navegador del visitante no le pide nada a Google.
//
//   node scripts/bajar-fuentes-web.mjs      (necesita internet; después ya no)
//
// Lo que pedía el prototipo y lo que queda acá, con la misma cobertura:
//   - styles.css: @import de Fraunces (ital, opsz 9..144, wght 300..600 / itálica
//     300..500) e Inter (400, 500, 600, 700) → texto.css, con TODOS los
//     subconjuntos que manda Google (latin, latin-ext, cirílico, griego,
//     vietnamita…): cada uno lleva su unicode-range, así que el navegador baja
//     solo los que la página usa, igual que antes.
//   - <link> de combinado.html y sobre-mi.html: Noto Sans Symbols, Noto Sans
//     Symbols 2 y Noto Sans recortadas a los glifos del sitio (&text=) →
//     simbolos.css. Una sola hoja para las dos páginas, con la unión de los
//     glifos de las dos más ☌ ⚹ △ (los aspectos que muestra la portada).
//   - La licencia de cada familia (SIL Open Font License 1.1), del repositorio
//     oficial de Google Fonts: OFL-<familia>.txt, al lado de los archivos.
//
// Después de bajarlas: node scripts/importar-web.mjs <web/ de la entrega>, que
// las publica y cambia las referencias a Google por estas hojas. No borra nada:
// si Google cambia los archivos, lo que sobre de una bajada anterior se borra a
// mano (la importación avisa de lo que quedó sin publicar).
import fs from "node:fs";
import path from "node:path";
import { WEB_DIR } from "../src/lib/web-nueva.js";

const DIR_FUENTES = path.join(WEB_DIR, "assets", "fuentes");
// El User-Agent decide qué formato devuelve Google: con uno moderno, woff2.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Los glifos de los dos <link> del prototipo, más los tres aspectos que faltaban. */
const GLIFOS = "☉☽☿♀♂♃♄♅♆♇♈♉♊♋♌♍♎♏♐♑♒♓□☍→℞☌⚹△";

const HOJAS = [
  {
    archivo: "texto.css",
    url: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&family=Inter:wght@400;500;600;700&display=swap",
  },
  {
    archivo: "simbolos.css",
    url: `https://fonts.googleapis.com/css2?family=Noto+Sans+Symbols&family=Noto+Sans+Symbols+2&family=Noto+Sans&text=${encodeURIComponent(GLIFOS)}&display=block`,
  },
];
const LICENCIAS = {
  "Fraunces": "fraunces", "Inter": "inter", "Noto Sans": "notosans",
  "Noto Sans Symbols": "notosanssymbols", "Noto Sans Symbols 2": "notosanssymbols2",
};

const traer = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r;
};
const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");

fs.mkdirSync(DIR_FUENTES, { recursive: true });
const bajados = new Map(); // URL de Google → nombre local (Inter usa el mismo archivo variable para los cuatro pesos)
let bytes = 0;

for (const hoja of HOJAS) {
  const css = await (await traer(hoja.url)).text();
  let out = `/* Generado por scripts/bajar-fuentes-web.mjs — no editar a mano.\n   Fuentes bajo SIL Open Font License 1.1: ver OFL-*.txt en esta carpeta. */\n`;
  // Google manda un @font-face por subconjunto, precedido por /* subconjunto */
  // (salvo con &text=, que no lo lleva).
  for (const m of css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
    const [, subconjunto = "simbolos", cuerpo] = m;
    const familia = /font-family:\s*'([^']+)'/.exec(cuerpo)[1];
    const estilo = /font-style:\s*(\w+)/.exec(cuerpo)?.[1] || "normal";
    const peso = (/font-weight:\s*([\d ]+)/.exec(cuerpo)?.[1] || "400").trim().replace(/\s+/g, "-");
    const url = /src:\s*url\(([^)]+)\)/.exec(cuerpo)[1];
    if (!LICENCIAS[familia]) throw new Error(`familia sin licencia registrada: ${familia}`);
    let nombre = bajados.get(url);
    if (!nombre) {
      nombre = `${slug(familia)}-${estilo}-${peso}-${subconjunto}.woff2`;
      const bin = Buffer.from(await (await traer(url)).arrayBuffer());
      if (bin.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${url}: no es woff2`);
      fs.writeFileSync(path.join(DIR_FUENTES, nombre), bin);
      bajados.set(url, nombre);
      bytes += bin.length;
      console.log(`  ${nombre.padEnd(52)} ${(bin.length / 1024).toFixed(1)} KB`);
    }
    out += `@font-face {${cuerpo.replace(/src:\s*url\([^)]+\)/, `src: url(${nombre})`)}}\n`;
  }
  fs.writeFileSync(path.join(DIR_FUENTES, hoja.archivo), out);
  console.log(`✓ ${hoja.archivo}`);
}

for (const [familia, dir] of Object.entries(LICENCIAS)) {
  const txt = await (await traer(`https://raw.githubusercontent.com/google/fonts/main/ofl/${dir}/OFL.txt`)).text();
  if (!txt.includes("SIL OPEN FONT LICENSE")) throw new Error(`${familia}: la licencia no es la OFL`);
  fs.writeFileSync(path.join(DIR_FUENTES, `OFL-${slug(familia)}.txt`), txt);
}
console.log(`\n${bajados.size} archivos woff2 (${(bytes / 1024).toFixed(0)} KB) y ${Object.keys(LICENCIAS).length} licencias en ${DIR_FUENTES}`);

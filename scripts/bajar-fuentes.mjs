// Baja las tres familias de Google Fonts y las deja servidas por nosotros.
//
// El brief lo pide explícito (sección 06): "Se sirven autoalojadas, con
// subconjunto latino y font-display:swap: no se llama a Google desde el
// cliente". No es sólo rendimiento — cada visita al sitio le avisaría a Google
// quién entró, y acá se cargan datos de nacimiento.
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../src/config.js";

const DESTINO = path.join(RAIZ, "src", "estatico", "fuentes");
// El User-Agent decide qué formato devuelve Google: con uno viejo manda TTF.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const FAMILIAS = [
  { nombre: "Archivo",      consulta: "Archivo:wdth,wght@62..125,300..800" },
  { nombre: "Newsreader",   consulta: "Newsreader:ital,opsz,wght@0,6..72,200..600;1,6..72,200..500" },
  { nombre: "IBM Plex Mono", consulta: "IBM+Plex+Mono:wght@300;400;500" },
];

fs.rmSync(DESTINO, { recursive: true, force: true }); // se regenera entera, si no quedan archivos huérfanos
fs.mkdirSync(DESTINO, { recursive: true });

let css = `/* Fuentes autoalojadas. Generado por scripts/bajar-fuentes.mjs — no editar a mano.
   Se sirven desde /estatico/fuentes para no llamar a Google desde el navegador
   del visitante (regla de la sección 06 del brief). */\n`;
let bajadas = 0;

for (const fam of FAMILIAS) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.consulta}&display=swap`;
  const hoja = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

  // Google manda un bloque @font-face por subconjunto, precedido por un
  // comentario con su nombre. Nos quedamos con el latino: el cirílico y el
  // griego son peso muerto en un sitio en castellano.
  const bloques = hoja.split("/*").map((b) => "/*" + b);
  for (const bloque of bloques) {
    const subconjunto = bloque.match(/^\/\*\s*([a-z0-9-]+)\s*\*\//)?.[1];
    if (!subconjunto || !subconjunto.startsWith("latin")) continue;
    const urlFuente = bloque.match(/src:\s*url\(([^)]+)\)/)?.[1];
    if (!urlFuente) continue;

    // El nombre lleva estilo y peso, no sólo familia y subconjunto: si no, la
    // itálica de Newsreader pisa a la redonda y los tres pesos de IBM Plex Mono
    // terminan siendo un solo archivo, con la hoja apuntando los tres al mismo.
    const estilo = bloque.match(/font-style:\s*([a-z]+)/)?.[1] || "normal";
    const peso = (bloque.match(/font-weight:\s*([\d\s]+)/)?.[1] || "400").trim().replace(/\s+/g, "-");
    const archivo = `${fam.nombre.replace(/\s+/g, "-").toLowerCase()}-${estilo}-${peso}-${subconjunto}.woff2`;
    const bin = Buffer.from(await (await fetch(urlFuente, { headers: { "User-Agent": UA } })).arrayBuffer());
    fs.writeFileSync(path.join(DESTINO, archivo), bin);
    bajadas++;
    console.log(`  ${archivo.padEnd(34)} ${(bin.length / 1024).toFixed(0)} KB`);

    css += bloque
      .replace(/^\/\*[^*]*\*\/\s*/, "")
      .replace(/src:\s*url\([^)]+\)/, `src: url(/estatico/fuentes/${archivo})`)
      .trimEnd() + "\n";
  }
}

fs.writeFileSync(path.join(DESTINO, "fuentes.css"), css);
console.log(`\n${bajadas} archivos en ${DESTINO}`);
console.log(`Hoja: ${path.join(DESTINO, "fuentes.css")} (${(css.length / 1024).toFixed(1)} KB)`);

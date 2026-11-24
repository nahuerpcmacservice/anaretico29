// Qué caracteres trae un archivo woff2 (su tabla cmap). Lo usa el test de la
// web nueva para comprobar que las fuentes autoalojadas cubren los glifos del
// sitio (S11) sin depender de un navegador ni de una biblioteca de fuentes.
//
// WOFF2 (W3C): cabecera de 48 bytes, directorio de tablas y UN flujo Brotli con
// todas las tablas una detrás de otra. La cmap nunca viene transformada.
import zlib from "node:zlib";

const ETIQUETAS = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill"];

function base128(buf, o) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[o.i++];
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error("UIntBase128 inválido");
}

/** El conjunto de códigos Unicode que la fuente mapea a un glifo. */
export function caracteres(woff2) {
  const b = Buffer.from(woff2);
  if (b.toString("latin1", 0, 4) !== "wOF2") throw new Error("no es woff2");
  const n = b.readUInt16BE(12);
  const o = { i: 48 };
  const tablas = [];
  for (let t = 0; t < n; t++) {
    const flags = b[o.i++];
    const tag = (flags & 63) === 63 ? b.toString("latin1", o.i, (o.i += 4)) : ETIQUETAS[flags & 63];
    const largo = base128(b, o);
    const version = flags >> 6;
    const transformada = (tag === "glyf" || tag === "loca") ? version === 0 : version !== 0;
    const enFlujo = transformada ? base128(b, o) : largo;
    tablas.push({ tag, enFlujo });
  }
  const datos = zlib.brotliDecompressSync(b.subarray(o.i));
  let pos = 0, cmap = null;
  for (const t of tablas) {
    if (t.tag === "cmap") cmap = datos.subarray(pos, pos + t.enFlujo);
    pos += t.enFlujo;
  }
  if (!cmap) throw new Error("sin tabla cmap");
  const out = new Set();
  const subtablas = cmap.readUInt16BE(2);
  for (let s = 0; s < subtablas; s++) {
    const off = cmap.readUInt32BE(4 + s * 8 + 4);
    const formato = cmap.readUInt16BE(off);
    if (formato === 4) {
      const segs = cmap.readUInt16BE(off + 6) / 2;
      const fin = off + 14, ini = fin + segs * 2 + 2, delta = ini + segs * 2, rango = delta + segs * 2;
      for (let k = 0; k < segs; k++) {
        const a = cmap.readUInt16BE(ini + k * 2), z = cmap.readUInt16BE(fin + k * 2);
        const d = cmap.readInt16BE(delta + k * 2), r = cmap.readUInt16BE(rango + k * 2);
        for (let c = a; c <= z && c !== 0xffff; c++) {
          let g;
          if (r === 0) g = (c + d) & 0xffff;
          else {
            g = cmap.readUInt16BE(rango + k * 2 + r + (c - a) * 2);
            if (g) g = (g + d) & 0xffff;
          }
          if (g) out.add(c);
        }
      }
    } else if (formato === 12) {
      const grupos = cmap.readUInt32BE(off + 12);
      for (let k = 0; k < grupos; k++) {
        const a = cmap.readUInt32BE(off + 16 + k * 12), z = cmap.readUInt32BE(off + 20 + k * 12);
        const g = cmap.readUInt32BE(off + 24 + k * 12);
        for (let c = a; c <= z; c++) if (g + (c - a)) out.add(c);
      }
    }
  }
  return out;
}

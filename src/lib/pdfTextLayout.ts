/** JasperReports / iText 2.x PDF — zlib stream + Tm/Tj satır birleştirme (Gemini gerekmez). */

import { inflateRawSync, inflateSync } from 'node:zlib';

function inflatePdfStream(body: Buffer): Buffer | null {
  try {
    return inflateSync(body);
  } catch {
    /* raw flate */
  }
  try {
    return inflateRawSync(body);
  } catch {
    return null;
  }
}

function unescapePdfLiteral(latin1: string): string {
  const unescaped = latin1
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\([()\\])/g, '$1');
  try {
    return new TextDecoder('windows-1254').decode(Buffer.from(unescaped, 'latin1'));
  } catch {
    return unescaped;
  }
}

/**
 * Content stream (latin1) → satırlar, aynı Y’de X’e göre. Sütun aralığı çift boşluk.
 */
export function layoutTextFromContentStream(latin1: string): string {
  const src = String(latin1 || '');
  type Item = { x: number; y: number; t: string };
  const items: Item[] = [];
  const re =
    /1 0 0 1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm[\s\S]{0,220}?\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const t = unescapePdfLiteral(m[3] || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    items.push({ x: Number(m[1]), y: Number(m[2]), t });
  }
  if (items.length === 0) return '';

  const buckets = new Map<number, Item[]>();
  for (const it of items) {
    const yKey = Math.round(it.y / 2) * 2;
    const list = buckets.get(yKey) || [];
    list.push(it);
    buckets.set(yKey, list);
  }

  const lines: string[] = [];
  for (const yKey of [...buckets.keys()].sort((a, b) => b - a)) {
    const row = (buckets.get(yKey) || []).sort((a, b) => a.x - b.x);
    let line = '';
    let prevX = -Infinity;
    for (const it of row) {
      if (!line) {
        line = it.t;
      } else if (it.x - prevX > 12) {
        line += `    ${it.t}`;
      } else {
        line += ` ${it.t}`;
      }
      prevX = it.x;
    }
    if (line.trim()) lines.push(line);
  }
  return lines.join('\n');
}

export function extractPdfTextLayout(bytes: Uint8Array): string {
  const latin1 = Buffer.from(bytes).toString('latin1');
  const chunks: string[] = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin1))) {
    let body = Buffer.from(m[1], 'latin1');
    if (body.length >= 2 && body[0] === 0x0d && body[1] === 0x0a) body = body.subarray(2);
    else if (body[0] === 0x0a || body[0] === 0x0d) body = body.subarray(1);
    if (body.length > 2_000_000) continue;
    const dec = inflatePdfStream(body);
    if (!dec) continue;
    const streamLatin1 = dec.toString('latin1');
    if (!/\(.*\)\s*Tj/.test(streamLatin1)) continue;
    const laid = layoutTextFromContentStream(streamLatin1);
    if (laid.trim()) chunks.push(laid);
  }
  return chunks.join('\n');
}

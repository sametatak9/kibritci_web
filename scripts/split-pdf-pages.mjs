#!/usr/bin/env node
/** PDF'i tek sayfalik dosyalara ayirir (manuel veya toplu aktarim icin). */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { PDFDocument } from 'pdf-lib';

const pdfPath = resolve(process.argv[2] || '');
const outDir = resolve(process.argv[3] || 'scripts/evrak-import-output/pages');

if (!pdfPath || !existsSync(pdfPath)) {
  console.error('Kullanim: node scripts/split-pdf-pages.mjs "<pdf-yolu>" [cikti-klasoru]');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const buf = readFileSync(pdfPath);
const src = await PDFDocument.load(buf, { ignoreEncryption: true });
const base = basename(pdfPath).replace(/\.pdf$/i, '');

for (let i = 0; i < src.getPageCount(); i++) {
  const doc = await PDFDocument.create();
  const [page] = await doc.copyPages(src, [i]);
  doc.addPage(page);
  const bytes = await doc.save();
  const name = `${base}_sayfa-${String(i + 1).padStart(2, '0')}.pdf`;
  writeFileSync(resolve(outDir, name), bytes);
  console.log(`Yazildi: ${name}`);
}

console.log(`Toplam ${src.getPageCount()} sayfa → ${outDir}`);

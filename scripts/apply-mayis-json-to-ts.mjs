/** JSON → mayis2026Yoklama.ts personeller dizisi yazar */
import { readFileSync, writeFileSync } from 'fs';

const fixed = JSON.parse(readFileSync('scripts/mayis-fixed.json', 'utf8'));

function fmtMesai(m) {
  if (!m || !Object.keys(m).length) return undefined;
  const entries = Object.entries(m).sort((a, b) => Number(a[0]) - Number(b[0]));
  return `{ ${entries.map(([d, h]) => `${d}: ${h}`).join(', ')} }`;
}

function fmtArr(a) {
  if (!a?.length) return '[]';
  return `[${a.join(', ')}]`;
}

const rows = fixed.map(p => {
  const parts = [
    `excelId: ${p.excelId}`,
    `ad: '${p.ad}'`,
    `soyad: '${p.soyad}'`,
    `gorev: '${p.gorev}'`,
    `maas: ${p.maas}`,
  ];
  if (p.iseGirisTarihi) parts.push(`iseGirisTarihi: '${p.iseGirisTarihi}'`);
  if (p.istenCikisTarihi) parts.push(`istenCikisTarihi: '${p.istenCikisTarihi}'`);
  parts.push(`calismaGunleri: ${fmtArr(p.calismaGunleri)}`);
  if (p.izinliGunleri?.length) parts.push(`izinliGunleri: ${fmtArr(p.izinliGunleri)}`);
  const mesai = fmtMesai(p.mesaiGunleri);
  if (mesai) parts.push(`mesaiGunleri: ${mesai}`);
  return `    { ${parts.join(', ')} }`;
});

const header = `import { LegacyExcelMonthData } from './legacyExcelYoklama';

const ALL = Array.from({ length: 31 }, (_, i) => i + 1);

/** Mayıs 2026 — 70 personel, Excel özet tablosu ile doğrulandı (verify-mayis-yoklama.mjs) */
export const MAYIS_2026_YOKLAMA: LegacyExcelMonthData = {
  year: 2026,
  month: 5,
  personeller: [
`;

const footer = `  ],
};
`;

writeFileSync('src/data/mayis2026Yoklama.ts', header + rows.join(',\n') + footer);
console.log('Wrote src/data/mayis2026Yoklama.ts (70 records)');

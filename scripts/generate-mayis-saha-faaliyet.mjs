/**
 * Aylik_Faaliyet_Raporu_05_2026.pdf → SahaFaaliyeti kayıtları
 * Çalıştır: node scripts/generate-mayis-saha-faaliyet.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfTextPath = path.join(__dirname, '../../Aylik_Faaliyet_Raporu_05_2026.pdf');

function normalizeParsel(raw) {
  let s = raw.trim().toUpperCase();
  if (/^160\s*PARSEL$/i.test(s) || s.includes('160/2') || s.includes('160 PARSEL')) {
    return 'Parsel Bölge 160/2';
  }
  const m = s.match(/157\s*\/\s*46|157\/46/);
  if (m) return 'Parsel Bölge 157/46';
  const m2 = s.match(/157\s*\/\s*51|157\/51|157\/151/);
  if (m2) return 'Parsel Bölge 157/51';
  if (s.includes('160/2')) return 'Parsel Bölge 160/2';
  return s.replace(/^PARSEL\s+BÖLGE\s+/i, 'Parsel Bölge ').replace(/\s+/g, ' ');
}

function parsePersonelCounts(isText) {
  let ustaSayisi = 0;
  let isciSayisi = 0;
  const ustaM = isText.match(/(\d+)\s*USTA/i);
  const yardimciM = isText.match(/(\d+)\s*YARDIMCI/i);
  const duzM = isText.match(/(\d+)\s*DÜZ\s*İŞÇİ/i) || isText.match(/(\d+)\s*DÜZİŞÇİ/i);
  const personelM = isText.match(/(\d+)\s*PERSONEL/i);
  const kisiM = isText.match(/(\d+)\s*KİŞİ/i);
  if (ustaM) ustaSayisi += Number(ustaM[1]);
  if (yardimciM) ustaSayisi += Number(yardimciM[1]);
  if (duzM) isciSayisi += Number(duzM[1]);
  if (personelM) isciSayisi += Number(personelM[1]);
  if (kisiM && !duzM) isciSayisi += Number(kisiM[1]);
  return { ustaSayisi: ustaSayisi || undefined, isciSayisi: isciSayisi || undefined };
}

function splitLocation(raw) {
  const loc = raw.trim();
  // "PARSEL BÖLGE 157/46 - F1, F2" or "160 PARSEL" or "PARSEL BÖLGE 160/2 - A2A"
  const dashIdx = loc.indexOf(' - ');
  if (dashIdx === -1) {
    return { parsel: normalizeParsel(loc), blok: 'GENEL SAHA' };
  }
  const left = loc.slice(0, dashIdx).trim();
  const blok = loc.slice(dashIdx + 3).trim() || 'GENEL SAHA';
  return { parsel: normalizeParsel(left), blok };
}

function parsePdfText(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('--') && !/^KİBRİTÇİ|^DÖNEM:/.test(l));

  const records = [];
  let currentDate = null;
  let pendingEntry = null;

  const flushPending = () => {
    if (!pendingEntry || !currentDate) return;
    const isText = pendingEntry.isText.trim();
    if (isText && isText !== 's') {
      const { parsel, blok } = splitLocation(pendingEntry.location);
      const counts = parsePersonelCounts(isText);
      records.push({
        tarih: currentDate,
        parsel,
        blok,
        isNiteligi: isText.length > 120 ? isText.slice(0, 120) + '…' : isText,
        aciklama: `${pendingEntry.location} — ${isText}`,
        ...counts,
      });
    }
    pendingEntry = null;
  };

  for (const line of lines) {
    const dateM = line.match(/^TARİH:\s*(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateM) {
      flushPending();
      currentDate = `${dateM[3]}-${dateM[2]}-${dateM[1]}`;
      continue;
    }

    const entryM = line.match(/^(\d+)\.\s*(.+?)\s*\|\s*İş:\s*(.*)$/i);
    if (entryM) {
      flushPending();
      pendingEntry = { num: entryM[1], location: entryM[2].trim(), isText: entryM[3].trim() };
      continue;
    }

    if (pendingEntry && !/^\d+\./.test(line)) {
      pendingEntry.isText += ' ' + line;
    }
  }
  flushPending();
  return records;
}

const pdfPaths = [
  path.join(__dirname, 'mayis2026-faaliyet-source.txt'),
  'c:/Users/DELL/Desktop/Aylik_Faaliyet_Raporu_05_2026.pdf',
  path.join(__dirname, '../Aylik_Faaliyet_Raporu_05_2026.pdf'),
];

let text = '';
for (const p of pdfPaths) {
  try {
    text = fs.readFileSync(p, 'utf8');
    console.log('PDF okundu:', p);
    break;
  } catch { /* try next */ }
}
if (!text) throw new Error('PDF bulunamadı');

const records = parsePdfText(text);

const withIds = records.map((r, i) => ({
  id: `SF-MAY26-${r.tarih.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
  personelId: 'LEGACY-SAHA-IMPORT',
  tarih: r.tarih,
  isNiteligi: r.isNiteligi,
  parsel: r.parsel,
  blok: r.blok,
  aciklama: r.aciklama,
  ...(r.ustaSayisi ? { ustaSayisi: r.ustaSayisi } : {}),
  ...(r.isciSayisi ? { isciSayisi: r.isciSayisi } : {}),
}));

const outPath = path.join(__dirname, '../src/data/mayis2026SahaFaaliyetleri.ts');
const properTs = `import { SahaFaaliyeti } from '../types/erp';

/** Mayıs 2026 aylık faaliyet raporu — Aylik_Faaliyet_Raporu_05_2026.pdf (${withIds.length} kayıt) */
export const MAYIS_2026_SAHA_FAALIYETLERI: SahaFaaliyeti[] = ${JSON.stringify(withIds, null, 2)};

export const MAYIS_2026_SAHA_FAALIYET_COUNT = ${withIds.length};
`;

fs.writeFileSync(outPath, properTs, 'utf8');
console.log(`Generated ${withIds.length} saha faaliyet records → ${outPath}`);
const byDate = {};
withIds.forEach(r => { byDate[r.tarih] = (byDate[r.tarih] || 0) + 1; });
console.log('Gün başına:', Object.keys(byDate).length, 'gün, toplam', withIds.length);

/**
 * haziran2026-faaliyet-draft.json → haziran2026SahaFaaliyetleri.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const draft = JSON.parse(fs.readFileSync(path.join(root, 'haziran2026-output/haziran2026-faaliyet-draft.json'), 'utf8'));

function normalizeParsel(raw) {
  const s = String(raw || '157/46').trim().toUpperCase();
  if (/160/.test(s)) return 'Parsel Bölge 160/2';
  if (/157\s*\/\s*51|157\/51/.test(s)) return 'Parsel Bölge 157/51';
  return 'Parsel Bölge 157/46';
}

function dayFromGun(g, idx) {
  if (g.sayfaNo >= 1 && g.sayfaNo <= 30) {
    return `2026-06-${String(g.sayfaNo).padStart(2, '0')}`;
  }
  if (g.tarih?.match(/^2026-06-/)) return g.tarih;
  return `2026-06-${String(idx + 1).padStart(2, '0')}`;
}

const records = [];
let seq = 0;
for (let i = 0; i < draft.gunler.length; i++) {
  const gun = draft.gunler[i];
  const tarih = dayFromGun(gun, i);
  for (const f of gun.faaliyetler || []) {
    if (!f.isNiteligi?.trim()) continue;
    seq++;
    const parsel = normalizeParsel(f.parsel);
    const blok = (f.blok || 'GENEL SAHA').trim().toUpperCase() || 'GENEL SAHA';
    const isNiteligi = f.isNiteligi.trim().toUpperCase().slice(0, 120);
    const aciklama = `${parsel.replace('Parsel Bölge ', 'PARSEL BÖLGE ')} - ${blok} — ${isNiteligi}${f.hamMetin ? ` (${f.hamMetin})` : ''}`;
    const id = `SF-HAZ26-${tarih.replace(/-/g, '')}-${String(seq).padStart(3, '0')}`;
    const rec = {
      id,
      personelId: 'LEGACY-SAHA-IMPORT',
      tarih,
      isNiteligi,
      parsel,
      blok,
      aciklama,
    };
    if (f.ustaSayisi > 0) rec.ustaSayisi = f.ustaSayisi;
    if (f.isciSayisi > 0) rec.isciSayisi = f.isciSayisi;
    records.push(rec);
  }
}

const ts = `import { SahaFaaliyeti } from '../types/erp';

/** Haziran 2026 — 157-46 Doğrama el yazısı günlük faaliyet (${records.length} kayıt, ${draft.gunler.length} gün) */
export const HAZIRAN_2026_SAHA_FAALIYETLERI: SahaFaaliyeti[] = ${JSON.stringify(records, null, 2)};

export const HAZIRAN_2026_SAHA_FAALIYET_COUNT = ${records.length};
`;

const out = path.join(root, '../src/data/haziran2026SahaFaaliyetleri.ts');
fs.writeFileSync(out, ts, 'utf8');
console.log(`→ ${out} (${records.length} kayıt, ${draft.gunler.length} gün)`);

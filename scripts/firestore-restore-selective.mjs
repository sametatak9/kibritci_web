#!/usr/bin/env node
/**
 * Guvenli secici Firestore geri yukleme.
 *
 * Varsayilan: SADECE yoklama (global_yoklama_map) — yedek + canli BIRLESTIRIR.
 * Kamp / saha faaliyet / kamp gunluk faaliyet koleksiyonlarina DOKUNMAZ.
 *
 *   node scripts/firestore-restore-selective.mjs --dry-run
 *   node scripts/firestore-restore-selective.mjs --execute
 *   node scripts/firestore-restore-selective.mjs --execute --date 2026-07-05
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return '';
  return args[i + 1] || '';
};
const hasFlag = (name) => args.includes(name);

const execute = hasFlag('--execute');
const dryRun = !execute || hasFlag('--dry-run');
const backupDate =
  getArg('--date') ||
  (existsSync(join(ROOT, 'backups', 'firestore', 'LATEST.txt'))
    ? readFileSync(join(ROOT, 'backups', 'firestore', 'LATEST.txt'), 'utf8').trim()
    : '');

const PROTECTED_FROM_FULL_RESTORE = new Set([
  'kampKayitlari',
  'kampOdalari',
  'kampYerleskeleri',
  'kampKatlari',
  'kampMeta',
  'kampGunlukFaaliyetleri',
  'kampDepoSayimlari',
  'sahaFaaliyetleri',
  'personeller',
]);

function parseYoklamaMap(raw) {
  if (!raw) return {};
  if (typeof raw.dataJson === 'string') {
    try {
      return JSON.parse(raw.dataJson);
    } catch {
      return {};
    }
  }
  return raw.data || {};
}

function yoklamaStats(map) {
  let persons = Object.keys(map || {}).length;
  let dateKeys = 0;
  let filled = 0;
  let july = 0;
  let may = 0;
  let june = 0;
  for (const personMap of Object.values(map || {})) {
    if (!personMap || typeof personMap !== 'object') continue;
    for (const [key, data] of Object.entries(personMap)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      dateKeys += 1;
      const durum = data?.durum;
      if (durum && durum !== 'Girilmedi') filled += 1;
      if (key.startsWith('2026-07-')) july += 1;
      if (key.startsWith('2026-05-')) may += 1;
      if (key.startsWith('2026-06-')) june += 1;
    }
  }
  return { persons, dateKeys, filled, july, may, june };
}

/** Uzak + yerel birlestirme (yoklamaGuard ile ayni mantik) */
function mergeYoklamaMaps(remote, local) {
  const result = { ...remote };
  for (const [personId, days] of Object.entries(local || {})) {
    const remoteDays = result[personId] || {};
    result[personId] = { ...remoteDays, ...days };
  }
  return result;
}

function buildYoklamaPayload(map) {
  return { dataJson: JSON.stringify(map) };
}

if (!backupDate) {
  console.error('Yedek tarihi bulunamadi. --date YYYY-MM-DD veya once npm run backup:firestore');
  process.exit(1);
}

const backupDir = join(ROOT, 'backups', 'firestore', backupDate);
const yoklamaBackupPath = join(backupDir, 'yoklamalar.json');
if (!existsSync(yoklamaBackupPath)) {
  console.error(`Yedek dosyasi yok: ${yoklamaBackupPath}`);
  process.exit(1);
}

const cfgPath = resolve(ROOT, 'firebase-target.config.json');
if (!existsSync(cfgPath)) {
  console.error('firebase-target.config.json yok');
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const app = initializeApp({ ...cfg }, `RESTORE_${Date.now()}`);
const db = getFirestore(app);

console.log('=== GUVENLI SECICI GERI YUKLEME ===');
console.log(`Proje: ${cfg.projectId}`);
console.log(`Yedek gunu: ${backupDate}`);
console.log(`Mod: ${dryRun ? 'DRY-RUN (yazilmaz)' : 'EXECUTE (yazilir)'}`);
console.log(`Kapsam: yoklamalar (global_yoklama_map) — kamp/saha DOKUNULMAZ\n`);

const backupDocs = JSON.parse(readFileSync(yoklamaBackupPath, 'utf8'));
const backupRaw = backupDocs.find((d) => d.id === 'global_yoklama_map') || backupDocs[0];
const backupMap = parseYoklamaMap(backupRaw);

const liveSnap = await getDocs(collection(db, 'yoklamalar'));
const liveDoc = liveSnap.docs.find((d) => d.id === 'global_yoklama_map');
const liveMap = liveDoc ? parseYoklamaMap(liveDoc.data()) : {};

const backupStats = yoklamaStats(backupMap);
const liveStats = yoklamaStats(liveMap);

console.log('Yedek yoklama:', backupStats);
console.log('Canli yoklama:', liveStats);

// Yedek daha zengin personel/gun iceriyorsa birlestirme yedek ustune canli degil:
// canli temel, yedek ustune (yedekteki eksik aylar geri gelir; canlida yeni gunler kalir)
const mergedMap = mergeYoklamaMaps(liveMap, backupMap);
const mergedStats = yoklamaStats(mergedMap);

console.log('\nBirlesik sonuc (canli + yedek):', mergedStats);

if (mergedStats.persons < liveStats.persons) {
  console.error('\nENGELLENDI: Birlesik sonuc personel sayisini dusuruyor.');
  process.exit(1);
}
if (mergedStats.filled < liveStats.filled * 0.95 && liveStats.filled > 100) {
  console.warn('\nUYARI: Dolu gun sayisi beklenenden dusuk; yine de yedekten gelen eksikler tamamlaniyor.');
}

const preRestoreDir = join(ROOT, 'backups', 'pre-restore', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(preRestoreDir, { recursive: true });
writeFileSync(
  join(preRestoreDir, 'yoklamalar-live-before-restore.json'),
  JSON.stringify({ id: 'global_yoklama_map', ...buildYoklamaPayload(liveMap), stats: liveStats }, null, 2),
  'utf8'
);
writeFileSync(
  join(preRestoreDir, 'yoklamalar-merged-preview.json'),
  JSON.stringify({ id: 'global_yoklama_map', ...buildYoklamaPayload(mergedMap), stats: mergedStats }, null, 2),
  'utf8'
);
console.log(`\nOn-yedek (yerel): ${preRestoreDir}`);

if (dryRun) {
  console.log('\nDRY-RUN tamamlandi. Yazmak icin: node scripts/firestore-restore-selective.mjs --execute');
  process.exit(0);
}

console.log('\nFirestore\'a yaziliyor...');
await setDoc(doc(db, 'yoklamalar', 'global_yoklama_map'), buildYoklamaPayload(mergedMap), { merge: false });

const verifySnap = await getDocs(collection(db, 'yoklamalar'));
const verifyDoc = verifySnap.docs.find((d) => d.id === 'global_yoklama_map');
const verifyMap = verifyDoc ? parseYoklamaMap(verifyDoc.data()) : {};
console.log('Dogrulama:', yoklamaStats(verifyMap));
console.log('\nYoklama geri yukleme tamamlandi.');
console.log('Kamp / saha faaliyet / kamp gunluk faaliyet degistirilmedi.');

for (const name of PROTECTED_FROM_FULL_RESTORE) {
  if (hasFlag('--include') && getArg('--include').split(',').includes(name)) {
    console.warn(`--include ${name} bu scriptte henuz desteklenmiyor (guvenlik).`);
  }
}

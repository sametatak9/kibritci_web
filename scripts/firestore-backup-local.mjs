#!/usr/bin/env node
/**
 * kibritci-erp Firestore yerel JSON yedek (Blaze / Spark fark etmez).
 * Canlı veriyi OKUR; silmez veya değiştirmez.
 *
 * Kullanım:
 *   npm run backup:firestore
 *   node scripts/firestore-backup-local.mjs --out backups/firestore
 *
 * Windows Görev Zamanlayıcı ile her gece 02:00 çalıştırılabilir.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from './firestore-collections.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return '';
  return args[i + 1] || '';
};

const outRoot = resolve(getArg('--out') || join(ROOT, 'backups', 'firestore'));
const cfgPath = resolve(ROOT, 'firebase-target.config.json');

if (!existsSync(cfgPath)) {
  console.error('firebase-target.config.json yok. Once: npm run migrate:ensure-config');
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const app = initializeApp(
  {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  },
  `BACKUP_${Date.now()}`
);
const db = getFirestore(app);

const stamp = new Date();
const folderName = stamp.toISOString().slice(0, 10);
const outDir = join(outRoot, folderName);

mkdirSync(outDir, { recursive: true });

console.log(`Proje: ${cfg.projectId}`);
console.log(`Yedek klasoru: ${outDir}`);
console.log(`Koleksiyon sayisi: ${FIRESTORE_COLLECTIONS.length}\n`);

const manifest = {
  projectId: cfg.projectId,
  exportedAt: stamp.toISOString(),
  collections: {},
  totalDocuments: 0,
};

for (const name of FIRESTORE_COLLECTIONS) {
  process.stdout.write(`${name.padEnd(36)} `);
  try {
    const snap = await getDocs(collection(db, name));
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(docs, null, 0), 'utf8');
    manifest.collections[name] = docs.length;
    manifest.totalDocuments += docs.length;
    console.log(`${docs.length} kayit`);
  } catch (err) {
    manifest.collections[name] = { error: String(err?.message || err) };
    console.log(`HATA: ${err?.message || err}`);
  }
}

writeFileSync(join(outDir, '_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
writeFileSync(join(outRoot, 'LATEST.txt'), folderName, 'utf8');

console.log('\n--- OZET ---');
console.log(`Toplam dokuman: ${manifest.totalDocuments}`);
console.log(`Manifest: ${join(outDir, '_manifest.json')}`);
console.log('Yedek tamamlandi (salt okunur export).');

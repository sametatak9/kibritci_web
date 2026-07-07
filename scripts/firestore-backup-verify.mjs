#!/usr/bin/env node
/**
 * Son yerel yedek ile canli Firestore kayit sayilarini karsilastirir.
 *
 *   npm run backup:verify
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from './firestore-collections.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const backupRoot = join(ROOT, 'backups', 'firestore');

const latestFile = join(backupRoot, 'LATEST.txt');
if (!existsSync(latestFile)) {
  console.error('Henuz yedek yok. Once: npm run backup:firestore');
  process.exit(1);
}

const latestDay = readFileSync(latestFile, 'utf8').trim();
const manifestPath = join(backupRoot, latestDay, '_manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`Manifest bulunamadi: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cfg = JSON.parse(readFileSync(resolve(ROOT, 'firebase-target.config.json'), 'utf8'));
const app = initializeApp(
  {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  },
  `VERIFY_${Date.now()}`
);
const db = getFirestore(app);

console.log(`Yedek tarihi: ${manifest.exportedAt}`);
console.log(`Karsilastirma: ${latestDay}\n`);

let ok = 0;
let warn = 0;

for (const name of FIRESTORE_COLLECTIONS) {
  const backed = manifest.collections[name];
  if (typeof backed !== 'number') continue;
  const snap = await getDocs(collection(db, name));
  const live = snap.size;
  const diff = live - backed;
  const status = diff === 0 ? 'OK' : diff > 0 ? `+${diff} yeni` : `${diff} eksik`;
  if (diff === 0) ok += 1;
  else warn += 1;
  console.log(`${name.padEnd(36)} yedek=${String(backed).padStart(5)}  canli=${String(live).padStart(5)}  ${status}`);
}

console.log(`\nSonuc: ${ok} koleksiyon esit, ${warn} fark var.`);

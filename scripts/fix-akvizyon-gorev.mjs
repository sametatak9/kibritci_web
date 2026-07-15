#!/usr/bin/env node
/**
 * Akvizyon firmasına kayıtlı personellerin görevini GÜVENLİK olarak düzeltir.
 *
 * Kullanım:
 *   node scripts/fix-akvizyon-gorev.mjs --dry-run
 *   node scripts/fix-akvizyon-gorev.mjs --execute
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');

const configPath = resolve('firebase-target.config.json');
if (!existsSync(configPath)) {
  console.error(`firebase-target.config.json bulunamadı: ${configPath}`);
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
const app = initializeApp(
  {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  },
  `FIX_AKVIZYON_${Date.now()}`
);
const db = getFirestore(app);

function isAkvizyon(name) {
  const n = String(name || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();
  return n.includes('AKVIZYON');
}

async function main() {
  const snap = await getDocs(collection(db, 'personeller'));
  const toFix = [];
  snap.forEach((d) => {
    const data = d.data();
    if (!isAkvizyon(data.firmaAdi)) return;
    const gorev = String(data.gorev || '').toLocaleUpperCase('tr-TR');
    if (gorev === 'GÜVENLİK' || gorev === 'GUVENLIK') return;
    toFix.push({ id: d.id, ad: data.ad, soyad: data.soyad, gorev: data.gorev, firmaAdi: data.firmaAdi });
  });

  console.log(`Akvizyon personel: ${toFix.length} kayıt düzeltilecek`);
  toFix.forEach((p) => console.log(`  - ${p.ad} ${p.soyad} (${p.firmaAdi}): "${p.gorev}" → GÜVENLİK`));

  if (!EXECUTE) {
    console.log('\nDry-run. Uygulamak için: node scripts/fix-akvizyon-gorev.mjs --execute');
    return;
  }

  const batch = writeBatch(db);
  toFix.forEach((p) => {
    batch.set(
      doc(db, 'personeller', p.id),
      { gorev: 'GÜVENLİK', firmaTipi: 'TASERON' },
      { merge: true }
    );
  });
  await batch.commit();
  console.log(`\n✓ ${toFix.length} personel güncellendi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

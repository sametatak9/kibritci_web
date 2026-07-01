#!/usr/bin/env node
/**
 * Firestore veri taşıma: learned-spark-25xj8 → kibritci-erp
 *
 * Canlı siteyi etkilemez — yalnızca yerel bilgisayardan çalışır.
 *
 * Kullanım:
 *   npm run migrate:firestore:audit          # kaynak sayım (canlı veri)
 *   npm run migrate:firestore:dry-run        # hedefe yazmadan simülasyon
 *   npm run migrate:firestore                # kopyala
 *   npm run migrate:firestore:verify         # kaynak vs hedef sayım
 *
 * Ön koşul: firebase-target.config.json (örnek: firebase-target.config.example.json)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { FIRESTORE_COLLECTIONS } from './firestore-collections.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const VERIFY_ONLY = args.has('--verify-only');
const AUDIT_ONLY = args.has('--audit-only');
const EXECUTE = args.has('--execute');

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`Dosya bulunamadı: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function resolveDbId(raw) {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id || id === '(default)' || id === 'default') return undefined;
  return id;
}

function getDb(app, config) {
  const dbId = resolveDbId(config.firestoreDatabaseId);
  return dbId ? getFirestore(app, dbId) : getFirestore(app);
}

function describeSide(label, config) {
  const dbId = resolveDbId(config.firestoreDatabaseId) ?? '(default)';
  return `${label}: projectId=${config.projectId} firestoreDb=${dbId}`;
}

async function countCollection(db, name) {
  try {
    const snap = await getDocs(collection(db, name));
    return { name, count: snap.size, error: null, docs: snap.docs };
  } catch (err) {
    return { name, count: 0, error: String(err?.message || err), docs: [] };
  }
}

async function auditAll(db, label) {
  console.log(`\n=== ${label} ===`);
  const rows = [];
  let total = 0;
  for (const name of FIRESTORE_COLLECTIONS) {
    const row = await countCollection(db, name);
    rows.push(row);
    if (row.error) {
      console.log(`  ${name.padEnd(32)} HATA: ${row.error}`);
    } else if (row.count > 0) {
      console.log(`  ${name.padEnd(32)} ${row.count}`);
      total += row.count;
    }
  }
  console.log(`  ${'TOPLAM (boş olmayan)'.padEnd(32)} ${total}`);
  return rows;
}

async function transformDocForTarget(name, docSnap) {
  if (name === 'yoklamalar' && docSnap.id === 'global_yoklama_map') {
    const src = docSnap.data();
    const map = src.data || {};
    return { dataJson: JSON.stringify(map) };
  }
  return docSnap.data();
}

async function copyCollection(sourceDb, targetDb, name, dryRun) {
  const { docs, error } = await countCollection(sourceDb, name);
  if (error) return { name, copied: 0, skipped: true, reason: error };
  if (docs.length === 0) return { name, copied: 0, skipped: true, reason: 'empty' };

  if (dryRun) {
    return { name, copied: docs.length, skipped: false, reason: 'dry-run' };
  }

  let copied = 0;
  const BATCH_SIZE = 400;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const yoklamaHeavy =
      name === 'yoklamalar' && chunk.some((d) => d.id === 'global_yoklama_map');

    if (yoklamaHeavy) {
      for (const d of chunk) {
        const payload = await transformDocForTarget(name, d);
        await setDoc(doc(targetDb, name, d.id), payload);
        copied += 1;
        process.stdout.write(`\r  ${name}: ${copied}/${docs.length}`);
      }
      continue;
    }

    const batch = writeBatch(targetDb);
    for (const d of chunk) {
      batch.set(doc(targetDb, name, d.id), d.data());
    }
    await batch.commit();
    copied += chunk.length;
    process.stdout.write(`\r  ${name}: ${copied}/${docs.length}`);
  }
  if (docs.length > 0) process.stdout.write('\n');
  return { name, copied, skipped: false, reason: 'ok' };
}

async function main() {
  const sourcePath = process.env.MIGRATE_SOURCE_CONFIG
    ? resolve(process.env.MIGRATE_SOURCE_CONFIG)
    : resolve(ROOT, 'firebase-applet-config.json');
  const targetPath = process.env.MIGRATE_TARGET_CONFIG
    ? resolve(process.env.MIGRATE_TARGET_CONFIG)
    : resolve(ROOT, 'firebase-target.config.json');

  const sourceConfig = loadJson(sourcePath);

  console.log('Kibritçi ERP — Firestore taşıma aracı');
  console.log(describeSide('Kaynak', sourceConfig));

  const sourceApp = initializeApp(
    {
      apiKey: sourceConfig.apiKey,
      authDomain: sourceConfig.authDomain,
      projectId: sourceConfig.projectId,
      storageBucket: sourceConfig.storageBucket,
      messagingSenderId: sourceConfig.messagingSenderId,
      appId: sourceConfig.appId,
    },
    'MIGRATE_SOURCE'
  );
  const sourceDb = getDb(sourceApp, sourceConfig);

  if (AUDIT_ONLY) {
    await auditAll(sourceDb, 'Kaynak denetim');
    console.log('\nCanlı site etkilenmedi. Render env değişkenlerine dokunulmadı.');
    return;
  }

  if (!existsSync(targetPath)) {
    console.error(`
Hedef yapılandırma yok: ${targetPath}

1. Firebase Console → kibritci-erp → Project settings → Web app oluştur
2. Authentication → Email/Password etkinleştir
3. Firestore → (default) veritabanı oluştur
4. firestore.rules dosyasını deploy et (aşağıdaki komut)
5. firebase-target.config.example.json → firebase-target.config.json kopyala, değerleri doldur

Firestore kuralları:
  npx firebase-tools deploy --only firestore:rules --project kibritci-erp
`);
    process.exit(1);
  }

  const targetConfig = loadJson(targetPath);
  console.log(describeSide('Hedef', targetConfig));

  if (sourceConfig.projectId === targetConfig.projectId) {
    console.error('Kaynak ve hedef aynı projectId — işlem iptal.');
    process.exit(1);
  }

  const targetApp = initializeApp(
    {
      apiKey: targetConfig.apiKey,
      authDomain: targetConfig.authDomain,
      projectId: targetConfig.projectId,
      storageBucket: targetConfig.storageBucket,
      messagingSenderId: targetConfig.messagingSenderId,
      appId: targetConfig.appId,
    },
    'MIGRATE_TARGET'
  );
  const targetDb = getDb(targetApp, targetConfig);

  if (VERIFY_ONLY) {
    const sourceRows = await auditAll(sourceDb, 'Kaynak');
    const targetRows = await auditAll(targetDb, 'Hedef');
    console.log('\n=== Karşılaştırma (kaynak > 0) ===');
    let mismatches = 0;
    for (const s of sourceRows) {
      if (s.count === 0) continue;
      const t = targetRows.find((r) => r.name === s.name);
      const tc = t?.count ?? 0;
      const ok = tc === s.count;
      if (!ok) mismatches++;
      console.log(
        `  ${s.name.padEnd(32)} kaynak=${s.count} hedef=${tc} ${ok ? 'OK' : 'FARKLI'}`
      );
    }
    if (mismatches === 0) {
      console.log('\nTüm dolu koleksiyonlar eşleşiyor. Render env geçişine hazırsınız.');
    } else {
      console.log(`\n${mismatches} koleksiyonda fark var. Geçiş yapmayın — önce migrate çalıştırın.`);
      process.exit(1);
    }
    return;
  }

  if (!DRY_RUN && !VERIFY_ONLY && !AUDIT_ONLY && !EXECUTE) {
    console.log(`
Mod seçilmedi. Güvenlik için yazma işlemi --execute gerektirir.

  npm run migrate:firestore:audit
  npm run migrate:firestore:dry-run
  npm run migrate:firestore          (--execute ile kopyalar)
  npm run migrate:firestore:verify
`);
    process.exit(0);
  }

  const mode = DRY_RUN ? 'DRY-RUN (yazma yok)' : EXECUTE ? 'KOPYALAMA' : VERIFY_ONLY ? 'DOĞRULAMA' : 'DENETIM';
  console.log(`\nMod: ${mode}`);

  if (EXECUTE && !DRY_RUN) {
    console.log(`
UYARI: Hedef projeye veri yazılacak.
Canlı Render sitesi hâlâ eski projeye bağlı — bu güvenli.
Devam etmek için 5 saniye bekleniyor... (Ctrl+C ile iptal)
`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  const results = [];
  for (const name of FIRESTORE_COLLECTIONS) {
    const result = await copyCollection(sourceDb, targetDb, name, DRY_RUN);
    results.push(result);
    if (!result.skipped && result.copied > 0) {
      if (DRY_RUN) console.log(`  ${name.padEnd(32)} ${result.copied} belge (simülasyon)`);
    }
  }

  const totalCopied = results.reduce((n, r) => n + (r.copied || 0), 0);
  console.log(`\n${DRY_RUN ? 'Simüle edilen' : 'Kopyalanan'} toplam belge: ${totalCopied}`);

  if (DRY_RUN) {
    console.log(`
Sonraki adım:
  npm run migrate:firestore          # gerçek kopya
  npm run migrate:firestore:verify   # sayım doğrula
`);
    return;
  }

  if (EXECUTE) {
    console.log(`
Kopyalama bitti. Şimdi:
  1. npm run migrate:firestore:verify
  2. Yerel .env ile kibritci-erp'ye bağlanıp giriş / personel / kamp test edin
  3. Render'da VITE_FIREBASE_* env tanımlayın (firebase-target.config.json değerleri)
  4. VITE_FIREBASE_FIRESTORE_DATABASE_ID boş bırakın → (default)
  5. Manual Deploy — konsolda [Firebase] projectId=kibritci-erp görün

Geri alma: Render env'leri silin → yeniden deploy → learned-spark-25xj8
`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Kuter taşeron personel listesini kontrol eder / eksikleri ekler (mükerrersiz).
 *
 *   node scripts/import-kuter-personel.mjs --dry-run
 *   node scripts/import-kuter-personel.mjs --execute
 *
 * Tercihen: FIREBASE_SERVICE_ACCOUNT_JSON (Admin SDK)
 * Yoksa: firebase-target.config.json + anonim oturum (kurallar izin verirse)
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');

const FIRMA = 'KUTER';
const ROSTER = [
  { ad: 'ADEM', soyad: 'AKDAĞ', tcNo: '10962087698', iseGirisTarihi: '2026-03-01' },
  { ad: 'BARIŞ', soyad: 'AĞGÜL', tcNo: '27665086538', iseGirisTarihi: '2026-03-30' },
  { ad: 'BÜLENT', soyad: 'KILIÇ', tcNo: '60124410222', iseGirisTarihi: '2026-06-01' },
  { ad: 'EKREM', soyad: 'GERÇEK', tcNo: '51616288108', iseGirisTarihi: '2026-03-30' },
  { ad: 'ERCAN', soyad: 'ARAS', tcNo: '57832041404', iseGirisTarihi: '2026-03-30' },
  { ad: 'ERKAN', soyad: 'GEVŞEK', tcNo: '14339532156', iseGirisTarihi: '2026-06-15' },
  { ad: 'FERHAT', soyad: 'GÜNEY', tcNo: '41314626760', iseGirisTarihi: '2026-06-01' },
  { ad: 'HALİL', soyad: 'KAZOĞLU', tcNo: '25541569816', iseGirisTarihi: '2026-06-03' },
  { ad: 'İBRAHİM HALİL', soyad: 'HURMA', tcNo: '30209407454', iseGirisTarihi: '2025-10-20' },
  { ad: 'İSA', soyad: 'DÖLEK', tcNo: '43921544710', iseGirisTarihi: '2026-03-30' },
  { ad: 'MEHMET', soyad: 'AĞGÜL', tcNo: '42937576968', iseGirisTarihi: '2026-06-16' },
  { ad: 'MEHMET SALİH', soyad: 'KARA', tcNo: '18202879300', iseGirisTarihi: '2026-03-01' },
  { ad: 'MUHAMMET', soyad: 'ŞAHİN', tcNo: '10365077548', iseGirisTarihi: '2026-03-30' },
  { ad: 'MURAT', soyad: 'GUNEY', tcNo: '41362625166', iseGirisTarihi: '2025-04-01' },
  { ad: 'RECEP TAYİP', soyad: 'TAŞKIN', tcNo: '17578267902', iseGirisTarihi: '2026-06-15' },
  { ad: 'SAMET', soyad: 'ACAR', tcNo: '13160122376', iseGirisTarihi: '2026-03-30' },
  { ad: 'VOLKAN', soyad: 'DÜZ', tcNo: '33128405006', iseGirisTarihi: '2024-08-26' },
  { ad: 'YUSUF', soyad: 'KARA', tcNo: '10310665080', iseGirisTarihi: '2026-06-05' },
];

function norm(s) {
  return String(s || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameKey(ad, soyad) {
  return norm(`${ad} ${soyad}`);
}

function digits(tc) {
  return String(tc || '').replace(/\D/g, '');
}

function ensureTargetConfig() {
  const target = resolve(ROOT, 'firebase-target.config.json');
  if (existsSync(target)) return target;
  const applet = resolve(ROOT, 'firebase-applet-config.json');
  if (!existsSync(applet)) throw new Error('firebase config yok');
  writeFileSync(target, readFileSync(applet, 'utf8'));
  return target;
}

async function getAdminDb() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!json) return null;
  const require = createRequire(import.meta.url);
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  }
  return admin.firestore();
}

async function getClientDb() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInAnonymously } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');
  const cfg = JSON.parse(readFileSync(ensureTargetConfig(), 'utf8'));
  const app = initializeApp(
    {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
    },
    `KUTER_${Date.now()}`
  );
  const auth = getAuth(app);
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.warn('Anonim oturum açılamadı:', e.message);
  }
  return { db: getFirestore(app), mode: 'client' };
}

function makePersonel(row, id) {
  return {
    id,
    tcNo: row.tcNo,
    ad: row.ad,
    soyad: row.soyad,
    babaAdi: '',
    dogumTarihi: '',
    telefonNo: '',
    eposta: '',
    adres: '',
    il: '',
    ilce: '',
    departman: 'ŞANTİYE',
    gorev: 'DÜZ İŞÇİ',
    iseGirisTarihi: row.iseGirisTarihi,
    cinsiyet: 'Erkek',
    maas: 0,
    ucretTipi: 'Günlük',
    sgkDurumu: "SGK'lı",
    bankaAdi: '',
    subeAdi: '',
    ibanNo: '',
    durum: true,
    firmaTipi: 'TASERON',
    firmaAdi: FIRMA,
    personelGrubu: 'SAHA',
  };
}

function makeCari(id, kodNo) {
  return {
    id,
    kartTipi: 'TASERON',
    kod: `TSR-KUTER-${String(kodNo).padStart(3, '0')}`,
    unvan: FIRMA,
    yetkili: '',
    telefon: '',
    eposta: '',
    vergiNo: '',
    vergiDairesi: '',
    adres: 'Kuter taşeron personel ithalatı',
    iban: '',
    durum: 'AKTIF',
    notlar: 'scripts/import-kuter-personel.mjs',
  };
}

async function main() {
  const adminDb = await getAdminDb();
  let personeller = [];
  let cariKartlar = [];
  let writeFn;

  if (adminDb) {
    console.log('Mod: Firebase Admin');
    const [pSnap, cSnap] = await Promise.all([
      adminDb.collection('personeller').get(),
      adminDb.collection('cariKartlar').get(),
    ]);
    personeller = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cariKartlar = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeFn = async (ops) => {
      const batch = adminDb.batch();
      for (const op of ops) {
        const ref = adminDb.collection(op.col).doc(op.id);
        batch.set(ref, op.data, { merge: !!op.merge });
      }
      await batch.commit();
    };
  } else {
    console.log('Mod: Client SDK (anonim) — yazma kurallara takılabilir');
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const {
      getFirestore,
      collection,
      getDocs,
      doc,
      setDoc,
      writeBatch,
    } = await import('firebase/firestore');
    const cfg = JSON.parse(readFileSync(ensureTargetConfig(), 'utf8'));
    const app = initializeApp(
      {
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      },
      `KUTER_${Date.now()}`
    );
    const auth = getAuth(app);
    await signInAnonymously(auth);
    const db = getFirestore(app);
    const [pSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'personeller')),
      getDocs(collection(db, 'cariKartlar')),
    ]);
    personeller = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cariKartlar = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    writeFn = async (ops) => {
      const batch = writeBatch(db);
      for (const op of ops) {
        batch.set(doc(db, op.col, op.id), op.data, { merge: !!op.merge });
      }
      await batch.commit();
    };
  }

  console.log(`DB personel: ${personeller.length}, cari: ${cariKartlar.length}`);

  const byTc = new Map();
  const byName = new Map();
  for (const p of personeller) {
    const tc = digits(p.tcNo);
    if (tc) byTc.set(tc, p);
    byName.set(nameKey(p.ad, p.soyad), p);
  }

  let kuterCari = cariKartlar.find(
    (c) => c.kartTipi === 'TASERON' && norm(c.unvan).includes('KUTER')
  );

  const existingKuter = personeller.filter(
    (p) =>
      norm(p.firmaAdi).includes('KUTER') ||
      ROSTER.some((r) => digits(r.tcNo) === digits(p.tcNo) && digits(r.tcNo))
  );

  console.log(`\nMevcut Kuter cari: ${kuterCari ? kuterCari.unvan + ' (' + kuterCari.id + ')' : 'YOK'}`);
  console.log(`Kuter/TC eşleşmeli mevcut personel taraması: ${existingKuter.length}`);

  const ops = [];
  const report = { createCari: false, create: [], updateFirma: [], alreadyOk: [], nameConflict: [] };

  if (!kuterCari) {
    const id = `ck_kuter_${Date.now()}`;
    kuterCari = makeCari(id, cariKartlar.filter((c) => c.kartTipi === 'TASERON').length + 1);
    ops.push({ col: 'cariKartlar', id, data: kuterCari });
    report.createCari = true;
  }

  for (const row of ROSTER) {
    const tc = digits(row.tcNo);
    const nk = nameKey(row.ad, row.soyad);
    const byTcHit = byTc.get(tc);
    const byNameHit = byName.get(nk);

    if (byTcHit) {
      const firmaOk =
        byTcHit.firmaTipi === 'TASERON' && norm(byTcHit.firmaAdi).includes('KUTER');
      if (firmaOk) {
        report.alreadyOk.push({ ...row, id: byTcHit.id, reason: 'TC ile mevcut (Kuter)' });
      } else {
        report.updateFirma.push({
          ...row,
          id: byTcHit.id,
          oldFirma: `${byTcHit.firmaTipi || '-'} / ${byTcHit.firmaAdi || '-'}`,
        });
        ops.push({
          col: 'personeller',
          id: byTcHit.id,
          merge: true,
          data: {
            firmaTipi: 'TASERON',
            firmaAdi: FIRMA,
            iseGirisTarihi: byTcHit.iseGirisTarihi || row.iseGirisTarihi,
            durum: byTcHit.durum !== false,
          },
        });
      }
      continue;
    }

    if (byNameHit) {
      // TC farklı ama isim aynı → mükerrer riski; TC güncelle + Kuter bağla
      report.updateFirma.push({
        ...row,
        id: byNameHit.id,
        oldFirma: `${byNameHit.firmaTipi || '-'} / ${byNameHit.firmaAdi || '-'} (isim eşleşti, TC: ${byNameHit.tcNo || 'yok'}→${tc})`,
      });
      ops.push({
        col: 'personeller',
        id: byNameHit.id,
        merge: true,
        data: {
          tcNo: tc || byNameHit.tcNo || '',
          firmaTipi: 'TASERON',
          firmaAdi: FIRMA,
          iseGirisTarihi: byNameHit.iseGirisTarihi || row.iseGirisTarihi,
          durum: true,
        },
      });
      continue;
    }

    const id = `prs_kuter_${tc || Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const personel = makePersonel(row, id);
    ops.push({ col: 'personeller', id, data: personel });
    report.create.push({ ...row, id });
  }

  console.log('\n=== PLAN ===');
  if (report.createCari) console.log('+ Cari kart: KUTER (TASERON)');
  console.log(`✓ Zaten Kuter: ${report.alreadyOk.length}`);
  report.alreadyOk.forEach((p) => console.log(`  · ${p.ad} ${p.soyad} (${p.tcNo})`));
  console.log(`↻ Firma/TC güncelle: ${report.updateFirma.length}`);
  report.updateFirma.forEach((p) =>
    console.log(`  · ${p.ad} ${p.soyad} — eski: ${p.oldFirma}`)
  );
  console.log(`+ Yeni kayıt: ${report.create.length}`);
  report.create.forEach((p) =>
    console.log(`  · ${p.ad} ${p.soyad} TC:${p.tcNo} giriş:${p.iseGirisTarihi}`)
  );

  if (!EXECUTE) {
    console.log('\nDry-run. Yazmak için: node scripts/import-kuter-personel.mjs --execute');
    return;
  }

  // Firestore batch max 500
  for (let i = 0; i < ops.length; i += 400) {
    await writeFn(ops.slice(i, i + 400));
  }
  console.log(`\n✓ Yazıldı: ${ops.length} işlem`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * DELTA KAPI taşeron personel listesini kontrol eder / eksikleri ekler (mükerrersiz).
 *
 *   node scripts/import-delta-kapi-personel.mjs --dry-run
 *   node scripts/import-delta-kapi-personel.mjs --execute
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

const FIRMA = 'DELTA KAPI';

function trDate(d) {
  const [day, month, year] = d.split('.');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const ROSTER = [
  {
    ad: 'UFUK',
    soyad: 'TEZCAN',
    tcNo: '23138252578',
    iseGirisTarihi: trDate('23.07.2025'),
    gorev: 'Pazarlamacı',
    maas: 3322.03,
    meslekKodu: '00000',
  },
  {
    ad: 'ŞAHİN',
    soyad: 'ELTER',
    tcNo: '32530740330',
    iseGirisTarihi: trDate('24.12.2025'),
    gorev: 'Çelik Kapı Montaj İşçisi',
    maas: 8219.05,
    meslekKodu: '05510',
  },
  {
    ad: 'YUNUS',
    soyad: 'ÖZKOL',
    tcNo: '49900028776',
    iseGirisTarihi: trDate('29.01.2026'),
    gorev: 'Çelik Kapı Montaj İşçisi',
    maas: 8219.05,
    meslekKodu: '05510',
  },
  {
    ad: 'SİNAN',
    soyad: 'BİLGİN',
    tcNo: '17099126870',
    iseGirisTarihi: trDate('20.02.2026'),
    istenCikisTarihi: trDate('01.07.2026'),
    gorev: 'İnşaat İşçisi',
    maas: 9313.02,
    meslekKodu: '05510',
  },
  {
    ad: 'MUHAMMET SAMET',
    soyad: 'MUÇİN',
    tcNo: '10223356518',
    iseGirisTarihi: trDate('06.05.2026'),
    istenCikisTarihi: trDate('01.07.2026'),
    gorev: 'Çelik Kapı Montaj İşçisi',
    maas: 8219.05,
    meslekKodu: '05510',
  },
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

function makePersonel(row, id) {
  const aktif = !row.istenCikisTarihi;
  return {
    id,
    tcNo: row.tcNo,
    ad: row.ad,
    soyad: row.soyad,
    babaAdi: '',
    dogumTarihi: '',
    telefonNo: '',
    eposta: '',
    adres: row.meslekKodu ? `SGK meslek kodu: ${row.meslekKodu}` : '',
    il: '',
    ilce: '',
    departman: 'ŞANTİYE',
    gorev: row.gorev,
    iseGirisTarihi: row.iseGirisTarihi,
    ...(row.istenCikisTarihi ? { istenCikisTarihi: row.istenCikisTarihi } : {}),
    cinsiyet: 'Erkek',
    maas: row.maas,
    ucretTipi: 'Aylık',
    sgkDurumu: "SGK'lı",
    bankaAdi: '',
    subeAdi: '',
    ibanNo: '',
    durum: aktif,
    firmaTipi: 'TASERON',
    firmaAdi: FIRMA,
    personelGrubu: 'SAHA',
  };
}

function makeCari(id, kodNo) {
  return {
    id,
    kartTipi: 'TASERON',
    kod: `TSR-DELTAKAPI-${String(kodNo).padStart(3, '0')}`,
    unvan: FIRMA,
    yetkili: '',
    telefon: '',
    eposta: '',
    vergiNo: '',
    vergiDairesi: '',
    adres: 'DELTA KAPI taşeron personel ithalatı',
    iban: '',
    durum: 'AKTIF',
    notlar: 'scripts/import-delta-kapi-personel.mjs',
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
      `DELTAKAPI_${Date.now()}`
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

  let deltaCari = cariKartlar.find(
    (c) => c.kartTipi === 'TASERON' && norm(c.unvan).includes('DELTA KAPI')
  );

  console.log(`\nMevcut DELTA KAPI cari: ${deltaCari ? deltaCari.unvan + ' (' + deltaCari.id + ')' : 'YOK'}`);

  const ops = [];
  const report = { createCari: false, create: [], updateFirma: [], alreadyOk: [] };

  if (!deltaCari) {
    const id = `ck_delta_kapi_${Date.now()}`;
    deltaCari = makeCari(id, cariKartlar.filter((c) => c.kartTipi === 'TASERON').length + 1);
    ops.push({ col: 'cariKartlar', id, data: deltaCari });
    report.createCari = true;
  }

  for (const row of ROSTER) {
    const tc = digits(row.tcNo);
    const nk = nameKey(row.ad, row.soyad);
    const byTcHit = byTc.get(tc);
    const byNameHit = byName.get(nk);
    const aktif = !row.istenCikisTarihi;

    if (byTcHit) {
      const firmaOk =
        byTcHit.firmaTipi === 'TASERON' && norm(byTcHit.firmaAdi).includes('DELTA KAPI');
      const sameMeta =
        (byTcHit.gorev || '') === row.gorev &&
        Number(byTcHit.maas || 0) === Number(row.maas) &&
        (byTcHit.iseGirisTarihi || '') === row.iseGirisTarihi &&
        (byTcHit.istenCikisTarihi || '') === (row.istenCikisTarihi || '') &&
        Boolean(byTcHit.durum) === aktif;
      if (firmaOk && sameMeta) {
        report.alreadyOk.push({ ...row, id: byTcHit.id, reason: 'TC ile mevcut (DELTA KAPI)' });
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
            ad: row.ad,
            soyad: row.soyad,
            tcNo: tc,
            gorev: row.gorev,
            maas: row.maas,
            ucretTipi: 'Aylık',
            firmaTipi: 'TASERON',
            firmaAdi: FIRMA,
            iseGirisTarihi: byTcHit.iseGirisTarihi || row.iseGirisTarihi,
            ...(row.istenCikisTarihi
              ? { istenCikisTarihi: row.istenCikisTarihi, durum: false }
              : { durum: byTcHit.durum !== false }),
            personelGrubu: byTcHit.personelGrubu || 'SAHA',
          },
        });
      }
      continue;
    }

    if (byNameHit) {
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
          ad: row.ad,
          soyad: row.soyad,
          gorev: row.gorev,
          maas: row.maas,
          ucretTipi: 'Aylık',
          firmaTipi: 'TASERON',
          firmaAdi: FIRMA,
          iseGirisTarihi: byNameHit.iseGirisTarihi || row.iseGirisTarihi,
          ...(row.istenCikisTarihi
            ? { istenCikisTarihi: row.istenCikisTarihi, durum: false }
            : { durum: true }),
          personelGrubu: byNameHit.personelGrubu || 'SAHA',
        },
      });
      continue;
    }

    const id = `prs_delta_kapi_${tc || Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const personel = makePersonel(row, id);
    ops.push({ col: 'personeller', id, data: personel });
    report.create.push({ ...row, id });
  }

  console.log('\n=== PLAN ===');
  if (report.createCari) console.log('+ Cari kart: DELTA KAPI (TASERON)');
  console.log(`✓ Zaten DELTA KAPI: ${report.alreadyOk.length}`);
  report.alreadyOk.forEach((p) => console.log(`  · ${p.ad} ${p.soyad} (${p.tcNo})`));
  console.log(`↻ Firma/alan güncelle: ${report.updateFirma.length}`);
  report.updateFirma.forEach((p) =>
    console.log(`  · ${p.ad} ${p.soyad} — eski: ${p.oldFirma}`)
  );
  console.log(`+ Yeni kayıt: ${report.create.length}`);
  report.create.forEach((p) =>
    console.log(
      `  · ${p.ad} ${p.soyad} TC:${p.tcNo} giriş:${p.iseGirisTarihi}${p.istenCikisTarihi ? ' çıkış:' + p.istenCikisTarihi : ''} — ${p.gorev}`
    )
  );

  if (!EXECUTE) {
    console.log('\nDry-run. Yazmak için: node scripts/import-delta-kapi-personel.mjs --execute');
    return;
  }

  for (let i = 0; i < ops.length; i += 400) {
    await writeFn(ops.slice(i, i + 400));
  }
  console.log(`\n✓ Yazıldı: ${ops.length} işlem`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

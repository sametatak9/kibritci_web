#!/usr/bin/env node
/**
 * Taşeron personel kayıtlarını normalize eder:
 * - Ad/soyaddaki parantezli firma ifadelerini temizler
 * - Firma adını çıkarıp personeli TASERON olarak işaretler
 * - Taşeron firma için cari kart yoksa oluşturur
 *
 * Kullanım:
 *   node scripts/normalize-taseron-personel.mjs --dry-run
 *   node scripts/normalize-taseron-personel.mjs --execute
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, deleteDoc, writeBatch } from 'firebase/firestore';

const args = new Set(process.argv.slice(2));
const EXECUTE = args.has('--execute');
const DRY_RUN = !EXECUTE || args.has('--dry-run');

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
  `NORMALIZE_TASERON_${Date.now()}`
);
const db = getFirestore(app);

const normalize = (raw) =>
  String(raw || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();

const isKibritci = (name) => normalize(name).includes('KIBRITCI');

const cleanText = (raw) =>
  String(raw || '')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\bsoyadı?\s+belli\s+değil\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanName = (raw) =>
  cleanText(raw)
    .replace(/\bf[ıiİI]rma\s*:\s*.*$/i, ' ')
    .replace(/\bf[ıiİI]rma\b.*$/i, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractFirmFromName = (fullName) => {
  const matches = [...String(fullName || '').matchAll(/\(([^)]+)\)/g)];
  for (const m of matches) {
    const candidate = cleanText(m[1]);
    if (!candidate) continue;
    const up = normalize(candidate);
    if (up.includes('SOYADI BELLI DEGIL') || up.includes('SOYISIM BELLI DEGIL') || up === 'HEPSI') continue;
    return candidate;
  }
  return '';
};

const makeTaseronCari = (firma, existingCount) => ({
  id: `ck_taseron_fix_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  kartTipi: 'TASERON',
  kod: `TSR-FIX-${String(existingCount + 1).padStart(3, '0')}`,
  unvan: firma,
  yetkili: '',
  telefon: '',
  eposta: '',
  vergiNo: '',
  vergiDairesi: '',
  adres: 'Taşeron personel normalizasyonu ile otomatik oluşturuldu.',
  iban: '',
  durum: 'AKTIF',
  notlar: 'scripts/normalize-taseron-personel.mjs ile oluşturuldu.',
});

async function main() {
  const [personSnap, cariSnap] = await Promise.all([
    getDocs(collection(db, 'personeller')),
    getDocs(collection(db, 'cariKartlar')),
  ]);

  const personeller = personSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const cariKartlar = cariSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const existingTaseronCari = new Map(
    cariKartlar
      .filter((c) => c.kartTipi === 'TASERON' && c.unvan)
      .map((c) => [normalize(c.unvan), c])
  );

  const toPatch = [];
  const toCreateCari = [];

  for (const p of personeller) {
    const full = `${p.ad || ''} ${p.soyad || ''}`.trim();
    const extractedFirma = extractFirmFromName(full);
    const nameHadParens = /\([^)]*\)/.test(full);
    const rawFirma = cleanText(p.firmaAdi || extractedFirma);
    const hasNonKibritciFirma = rawFirma && !isKibritci(rawFirma);
    const shouldBeTaseron = p.firmaTipi === 'TASERON' || hasNonKibritciFirma || (nameHadParens && !isKibritci(extractedFirma));

    if (!shouldBeTaseron && !nameHadParens) continue;

    const cleanedAd = cleanName(p.ad || '');
    const cleanedSoyad = cleanName(p.soyad || '');
    const nextAd = cleanedAd || p.ad || '';
    const nextSoyad = cleanedSoyad || p.soyad || '';
    const nextFirmaAdi = hasNonKibritciFirma ? rawFirma : (p.firmaTipi === 'TASERON' ? cleanText(p.firmaAdi || '') || 'TAŞERON' : p.firmaAdi || 'TAŞERON');
    const nextTip = hasNonKibritciFirma || p.firmaTipi === 'TASERON' || nameHadParens ? 'TASERON' : (p.firmaTipi || 'ANA_FIRMA');

    const changed =
      nextAd !== (p.ad || '') ||
      nextSoyad !== (p.soyad || '') ||
      nextTip !== (p.firmaTipi || 'ANA_FIRMA') ||
      nextFirmaAdi !== (p.firmaAdi || '');

    if (!changed) continue;

    toPatch.push({
      id: p.id,
      ad: nextAd,
      soyad: nextSoyad,
      firmaTipi: nextTip,
      firmaAdi: nextTip === 'TASERON' ? nextFirmaAdi : (p.firmaAdi || 'Kibritçi İnşaat'),
      gorev: nextTip === 'TASERON' ? (p.gorev || 'TAŞERON PERSONEL') : p.gorev,
      departman: nextTip === 'TASERON' ? (p.departman || 'TAŞERON') : p.departman,
    });

    if (nextTip === 'TASERON') {
      const key = normalize(nextFirmaAdi);
      if (key && !existingTaseronCari.has(key) && !toCreateCari.some((c) => normalize(c.unvan) === key)) {
        toCreateCari.push(makeTaseronCari(nextFirmaAdi, existingTaseronCari.size + toCreateCari.length));
      }
    }
  }

  console.log(`👷 Güncellenecek personel: ${toPatch.length}`);
  console.log(`🏢 Oluşturulacak taşeron cari: ${toCreateCari.length}`);

  if (DRY_RUN) {
    console.log('--- DRY RUN ÖRNEK ---');
    toPatch.slice(0, 12).forEach((p) => {
      console.log(`- ${p.id}: ${p.ad} ${p.soyad} | ${p.firmaTipi} | ${p.firmaAdi}`);
    });
    toCreateCari.slice(0, 12).forEach((c) => {
      console.log(`+ CARI: ${c.unvan}`);
    });
    if (!EXECUTE) return;
  }

  if (!EXECUTE) {
    console.log('Uygulamak için --execute ile çalıştırın.');
    return;
  }

  const batch = writeBatch(db);
  toPatch.forEach((p) => {
    batch.update(doc(db, 'personeller', p.id), {
      ad: p.ad,
      soyad: p.soyad,
      firmaTipi: p.firmaTipi,
      firmaAdi: p.firmaAdi,
      gorev: p.gorev,
      departman: p.departman,
    });
  });
  toCreateCari.forEach((c) => {
    batch.set(doc(db, 'cariKartlar', c.id), c);
  });

  await batch.commit();
  console.log(`✅ Uygulandı: ${toPatch.length} personel güncellendi, ${toCreateCari.length} taşeron cari oluşturuldu.`);

  // Güvenlik için tașeron personellerde yoklama map'i varsa temizle
  const fresh = await getDocs(collection(db, 'personeller'));
  const taseronIds = fresh.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.firmaTipi === 'TASERON')
    .map((p) => p.id);
  console.log(`🔎 Taşeron personel adedi: ${taseronIds.length}`);

  let cleanedYoklama = 0;
  for (const id of taseronIds) {
    try {
      await deleteDoc(doc(db, 'yoklamalar', id));
      cleanedYoklama += 1;
    } catch {
      // noop
    }
  }
  console.log(`🧹 Temizlenen taşeron yoklama dokümanı: ${cleanedYoklama}`);
}

main().catch((err) => {
  console.error('Hata:', err);
  process.exit(1);
});

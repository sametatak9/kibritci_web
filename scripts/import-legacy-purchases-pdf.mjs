#!/usr/bin/env node
/**
 * 49 sayfalik eski satin alma PDF'ini sayfa bazli parse edip Firestore'a arsiv kaydi olarak yazar.
 *
 * Kullanim:
 *   node scripts/import-legacy-purchases-pdf.mjs --pdf "d:/157-46 dograma hesap_04072026110746.PDF" --execute
 *   node scripts/import-legacy-purchases-pdf.mjs --pdf "d:/157-46 dograma hesap_04072026110746.PDF" --dry-run
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return '';
  return args[i + 1] || '';
};
const hasArg = (name) => args.includes(name);

const pdfPathRaw = getArg('--pdf');
const execute = hasArg('--execute');
const dryRun = hasArg('--dry-run') || !execute;
const endpoint = getArg('--endpoint') || 'https://kibritci-erp.onrender.com/api/parse-legacy-document';
const perPageDelayMs = Number(getArg('--delay-ms') || 250);

if (!pdfPathRaw) {
  console.error('Eksik parametre: --pdf "<dosya-yolu>"');
  process.exit(1);
}

const pdfPath = resolve(pdfPathRaw);
if (!existsSync(pdfPath)) {
  console.error(`PDF bulunamadi: ${pdfPath}`);
  process.exit(1);
}

const targetCfgPath = resolve('firebase-target.config.json');
if (!existsSync(targetCfgPath)) {
  console.error(`firebase-target.config.json bulunamadi: ${targetCfgPath}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

const normalizeText = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/\s+/g, ' ')
    .trim();

const levenshteinDistance = (a, b) => {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (s === t) return 0;
  if (!s) return t.length;
  if (!t) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[rows - 1][cols - 1];
};

const toIsoDate = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return nowIso().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return nowIso().slice(0, 10);
};

const sanitizeOnayDurumu = (raw) => {
  const text = String(raw || '').toUpperCase();
  if (text.includes('ONAYLANDI')) return 'ONAYLANDI';
  if (text.includes('BILINMIYOR') || text.includes('BİLİNMİYOR')) return 'BİLİNMİYOR';
  return 'BİLİNMİYOR';
};

const buildSaIdFromSet = (orderDate, usedSaIds) => {
  const dateKey = String(orderDate || nowIso().slice(0, 10)).replace(/-/g, '');
  let seq = 1;
  let candidate = `SA-${dateKey}-${String(seq).padStart(3, '0')}`;
  while (usedSaIds.has(candidate)) {
    seq += 1;
    candidate = `SA-${dateKey}-${String(seq).padStart(3, '0')}`;
  }
  usedSaIds.add(candidate);
  return candidate;
};

const splitPdfToPageBase64 = async (pdfBuffer) => {
  const src = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = src.getPageCount();
  const out = [];
  for (let i = 0; i < pages; i++) {
    const one = await PDFDocument.create();
    const [copied] = await one.copyPages(src, [i]);
    one.addPage(copied);
    const bytes = await one.save();
    out.push(Buffer.from(bytes).toString('base64'));
  }
  return out;
};

const requestParse = async (fileBase64) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64,
      mimeType: 'application/pdf',
      docType: 'auto',
    }),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${payload?.error || text || 'parse hatasi'}`);
  }
  return payload;
};

const cfg = JSON.parse(readFileSync(targetCfgPath, 'utf8'));
const app = initializeApp(
  {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  },
  `LEGACY_IMPORT_${Date.now()}`
);
const db = getFirestore(app);

const loadExisting = async () => {
  const [saSnap, stokSnap] = await Promise.all([
    getDocs(collection(db, 'satinAlmaTalepleri')),
    getDocs(collection(db, 'stokKartlar')),
  ]);
  const talepler = saSnap.docs.map((d) => d.data());
  const stoklar = stokSnap.docs.map((d) => d.data());
  return { talepler, stoklar };
};

const sourceFileTag = basename(pdfPath);
const buildSourceTag = (pageNo) => `[LegacyPDF:${sourceFileTag}#P${pageNo}]`;

const findExistingStok = (urunAdi, stoklar) => {
  const norm = normalizeText(urunAdi);
  if (!norm) return null;
  const exact = stoklar.find((s) => normalizeText(s.stokAdi) === norm);
  if (exact) return exact;
  let best = null;
  let bestDist = 999;
  for (const s of stoklar) {
    const dist = levenshteinDistance(norm, s.stokAdi);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return bestDist <= 1 ? best : null;
};

const main = async () => {
  console.log(`Mod: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Endpoint: ${endpoint}`);

  const { talepler: existingTalepler, stoklar: existingStoklar } = await loadExisting();
  const usedSaIds = new Set(existingTalepler.map((x) => String(x.saId || '')));
  const existingSourceTags = new Set(
    existingTalepler.map((x) => String(x.aciklama || '')).filter((x) => x.includes('[LegacyPDF:'))
  );
  const mutableStok = [...existingStoklar];

  const pdfBuffer = readFileSync(pdfPath);
  const pageBase64List = await splitPdfToPageBase64(pdfBuffer);
  console.log(`Toplam sayfa: ${pageBase64List.length}`);

  const imported = [];
  const skipped = [];
  const errors = [];

  for (let i = 0; i < pageBase64List.length; i++) {
    const pageNo = i + 1;
    const sourceTag = buildSourceTag(pageNo);
    if ([...existingSourceTags].some((x) => x.includes(sourceTag))) {
      skipped.push({ pageNo, reason: 'zaten aktarilmis' });
      continue;
    }

    try {
      const payload = await requestParse(pageBase64List[i]);
      const data = payload?.data || {};
      const record = Array.isArray(data.records) && data.records.length > 0 ? data.records[0] : data;
      const kalemlerRaw = Array.isArray(record?.kalemler) ? record.kalemler : [];

      const kalemler =
        kalemlerRaw.length > 0
          ? kalemlerRaw.map((k, idx) => ({
              id: `sai_${Date.now()}_${pageNo}_${idx}`,
              urunAdi: String(k?.urunAdi || `Malzeme ${idx + 1}`).trim() || `Malzeme ${idx + 1}`,
              miktar: Number(k?.miktar || 1),
              birim: String(k?.birim || 'ADET').trim() || 'ADET',
              marka: String(k?.marka || ''),
              kullanilacakYer: String(k?.kullanilacakYer || ''),
              aciklama: String(k?.aciklama || ''),
            }))
          : [
              {
                id: `sai_${Date.now()}_${pageNo}_fallback`,
                urunAdi: String(record?.aciklama || data?.aciklama || 'Toplu Satın Alma Kalemi'),
                miktar: 1,
                birim: 'ADET',
                marka: '',
                kullanilacakYer: '',
                aciklama: '',
              },
            ];

      const tarih = toIsoDate(record?.tarih || data?.tarih);
      const saId = buildSaIdFromSet(tarih, usedSaIds);
      const onayDurumu = sanitizeOnayDurumu(record?.onayDurumu || data?.onayDurumu);
      const cariFirma = String(
        record?.firma || record?.cariUnvan || data?.firma || data?.cariUnvan || 'Eski Kayıt'
      ).trim();

      const talep = {
        id: `sa_${Date.now()}_${pageNo}_${Math.random().toString(36).slice(2, 7)}`,
        saId,
        tarih,
        talepEden: 'SİSTEM AKTARIM',
        cariFirma: cariFirma || 'Eski Kayıt',
        aciklama: `${String(record?.aciklama || data?.aciklama || '').trim()} ${sourceTag}`.trim(),
        onayDurumu,
        kalemler,
        eImzalar: [],
        arsivde: true,
      };

      imported.push({ pageNo, talep, detectedType: String(data?.detectedType || 'auto') });
      if (perPageDelayMs > 0) await sleep(perPageDelayMs);
    } catch (err) {
      errors.push({ pageNo, error: String(err?.message || err) });
    }
  }

  console.log(`Hazirlanan yeni kayit: ${imported.length}`);
  console.log(`Atlanan sayfa: ${skipped.length}`);
  console.log(`Hata: ${errors.length}`);

  if (errors.length > 0) {
    console.log('Ilk 10 hata:');
    errors.slice(0, 10).forEach((e) => console.log(`  P${e.pageNo}: ${e.error}`));
  }

  if (dryRun) {
    console.log('DRY-RUN tamamlandi, Firestore yazimi yapilmadi.');
    return;
  }

  let createdStok = 0;
  let createdIslem = 0;
  let writtenSa = 0;

  for (const item of imported) {
    const talep = item.talep;
    await setDoc(doc(db, 'satinAlmaTalepleri', talep.id), talep);
    writtenSa += 1;

    const batch = writeBatch(db);
    for (const kalem of talep.kalemler) {
      const urunAdi = String(kalem.urunAdi || '').trim();
      if (!urunAdi) continue;
      let stok = findExistingStok(urunAdi, mutableStok);
      if (!stok) {
        stok = {
          id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
          stokAdi: urunAdi,
          kategori: 'Kaba İnşaat İmalatı',
          birim: kalem.birim || 'ADET',
          kritikSeviye: 5,
          durum: 'AKTIF',
          aciklama: 'Legacy satın alma importu ile otomatik oluşturuldu.',
        };
        mutableStok.unshift(stok);
        batch.set(doc(db, 'stokKartlar', stok.id), stok);
        createdStok += 1;
      }

      const historyLine = `${talep.tarih} ${talep.saId} · ${talep.cariFirma} · ${kalem.miktar} ${kalem.birim || stok.birim}`;
      const currentDesc = String(stok.aciklama || '');
      if (!currentDesc.includes(talep.saId)) {
        const mergedDesc = `${currentDesc}\n[Satın Alma] ${historyLine}`.trim();
        stok = { ...stok, aciklama: mergedDesc };
        const idx = mutableStok.findIndex((s) => s.id === stok.id);
        if (idx >= 0) mutableStok[idx] = stok;
        batch.set(doc(db, 'stokKartlar', stok.id), stok);
      }

      const stokIslem = {
        id: `stk_islem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        stokKartId: stok.id,
        islemTipi: 'GIRIS',
        islemId: talep.id,
        islemBaslik: `Satın Alma ${talep.saId}`,
        islemDetay: `${kalem.urunAdi} · ${kalem.miktar} ${kalem.birim || stok.birim} · ${talep.cariFirma}`,
        miktarDegisimi: Number(kalem.miktar || 0),
        tarih: talep.tarih,
        belgeNo: talep.saId,
      };
      batch.set(doc(db, 'stokIslemGecmisi', stokIslem.id), stokIslem);
      createdIslem += 1;
    }
    await batch.commit();
  }

  console.log('--- YAZIM OZETI ---');
  console.log(`Yazilan satin alma: ${writtenSa}`);
  console.log(`Olusturulan stok kart: ${createdStok}`);
  console.log(`Yazilan stok islem: ${createdIslem}`);
};

main().catch((err) => {
  console.error('Import script hatasi:', err);
  process.exit(1);
});


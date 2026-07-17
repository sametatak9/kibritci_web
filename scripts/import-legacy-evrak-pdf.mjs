#!/usr/bin/env node
/**
 * Çok sayfalı PDF evrak taramasını sayfa bazlı AI ile okuyup uygun ERP kaydına aktarır.
 * Cari kart + stok kart eşleştirmesi / otomatik oluşturma yapar.
 *
 * Kullanım:
 *   node scripts/import-legacy-evrak-pdf.mjs --pdf "d:/157-46 dograma hesap.PDF" --dry-run
 *   node scripts/import-legacy-evrak-pdf.mjs --pdf "d:/157-46 dograma hesap.PDF" --execute
 *   node scripts/import-legacy-evrak-pdf.mjs --pdf "..." --execute --pages 1-5
 *   node scripts/import-legacy-evrak-pdf.mjs --pdf "..." --execute --remote
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
dotenv.config({ path: resolve(ROOT, '.env.local') });
dotenv.config({ path: resolve(ROOT, '.env') });

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
const useRemote = hasArg('--remote');
const endpoint = getArg('--endpoint') || 'https://kibritci-erp.onrender.com/api/parse-legacy-document';
const perPageDelayMs = Number(getArg('--delay-ms') || 65000);
const pagesFilter = getArg('--pages'); // örn: 1-19 veya 3,5,7

if (!pdfPathRaw) {
  console.error('Eksik parametre: --pdf "<dosya-yolu>"');
  process.exit(1);
}

const pdfPath = resolve(pdfPathRaw);
if (!existsSync(pdfPath)) {
  console.error(`PDF bulunamadi: ${pdfPath}`);
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!useRemote && !apiKey) {
  console.error('Yerel parse icin GEMINI_API_KEY gerekli (.env.local) veya --remote kullanin.');
  process.exit(1);
}

const targetCfgPath = resolve(ROOT, 'firebase-target.config.json');
if (!existsSync(targetCfgPath)) {
  console.error(`firebase-target.config.json bulunamadi. Once: node scripts/ensure-target-config.mjs`);
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

const parsePagesFilter = (total) => {
  if (!pagesFilter) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set();
  for (const part of pagesFilter.split(',')) {
    const p = part.trim();
    if (p.includes('-')) {
      const [a, b] = p.split('-').map(Number);
      for (let i = a; i <= b; i++) if (i >= 1 && i <= total) set.add(i);
    } else {
      const n = Number(p);
      if (n >= 1 && n <= total) set.add(n);
    }
  }
  return [...set].sort((a, b) => a - b);
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

const AUTO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedType: { type: Type.STRING },
    faturaNo: { type: Type.STRING },
    irsaliyeNo: { type: Type.STRING },
    referansId: { type: Type.STRING },
    tarih: { type: Type.STRING },
    donem: { type: Type.STRING },
    firma: { type: Type.STRING },
    cariUnvan: { type: Type.STRING },
    toplamTutar: { type: Type.STRING },
    kdvTutar: { type: Type.STRING },
    genelToplam: { type: Type.STRING },
    aciklama: { type: Type.STRING },
    hareketTipi: { type: Type.STRING },
    kalemler: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          urunAdi: { type: Type.STRING },
          miktar: { type: Type.STRING },
          birim: { type: Type.STRING },
          birimFiyat: { type: Type.STRING },
          kdvOran: { type: Type.STRING },
          toplam: { type: Type.STRING },
        },
      },
    },
  },
  required: ['detectedType'],
};

const AUTO_PROMPT = `157-46 dograma / insaat santiye evragi. Sayfadaki belgeyi analiz et.
detectedType: fatura | irsaliye | makbuz | hakedis | yoklama | saha_faaliyet
Satın alma talep formu, malzeme siparişi, tedarik evrağı ise fatura veya irsaliye olarak siniflandir.
Tarih YYYY-MM-DD. Firma/cariUnvan, evrak no, kalemler (urunAdi, miktar, birim, birimFiyat, kdvOran, toplam) cikar.
157-46 dograma hesap evraklari icin urun adlarini net yaz.
Eğer belge irsaliye (waybill) ise, toplamTutar, kdvTutar, genelToplam alanlarını ve kalemler listesindeki birimFiyat, kdvOran, toplam alanlarını boş metin "" olarak doldur.
Sayısal değerler için virgülden sonra en fazla 2 basamak kullan. Değeri olmayan veya belgede bulunmayan sayısal alanlar için boş metin "" yaz, asla 0.00000... gibi uzayan ondalık sıfırlar üretme.`;

const localAi = !useRemote ? new GoogleGenAI({ apiKey }) : null;
const LOCAL_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

const requestParseLocal = async (fileBase64, pageNo, retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const model = LOCAL_MODELS[Math.min(attempt - 1, LOCAL_MODELS.length - 1)];
    try {
      const response = await localAi.models.generateContent({
        model,
        contents: [
          `${AUTO_PROMPT}\n(PDF sayfa ${pageNo})`,
          { inlineData: { mimeType: 'application/pdf', data: fileBase64 } },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: AUTO_SCHEMA,
          temperature: 0.08,
          maxOutputTokens: 8192,
        },
      });
      const text = response.text?.trim();
      if (!text) throw new Error('bos yanit');
      try {
        return { success: true, data: JSON.parse(text) };
      } catch (parseErr) {
        console.error("RAW TEXT WAS:\n", text);
        throw parseErr;
      }
    } catch (err) {
      const msg = String(err?.message || err);
      const is429 = /429|quota|RESOURCE_EXHAUSTED|rate/i.test(msg);
      console.warn(`  P${pageNo} deneme ${attempt}/${retries} (${model}): ${msg.slice(0, 120)}`);
      if (attempt === retries) throw err;
      await sleep(is429 ? Math.max(perPageDelayMs, 45000) : 8000 * attempt);
    }
  }
};

const requestParseRemote = async (fileBase64) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mimeType: 'application/pdf', docType: 'auto' }),
  });
  const text = await res.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${payload?.error || text}`);
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
  `EVRAK_IMPORT_${Date.now()}`
);
const db = getFirestore(app);

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
  return bestDist <= 2 ? best : null;
};

const findExistingCari = (unvan, cariler) => {
  const norm = normalizeText(unvan);
  if (!norm) return null;
  const exact = cariler.find((c) => normalizeText(c.unvan) === norm);
  if (exact) return exact;
  const contains = cariler.find(
    (c) => normalizeText(c.unvan).includes(norm) || norm.includes(normalizeText(c.unvan))
  );
  if (contains) return contains;
  let best = null;
  let bestDist = 999;
  for (const c of cariler) {
    const dist = levenshteinDistance(norm, c.unvan);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return bestDist <= 3 ? best : null;
};

const ensureCari = (unvan, cariler, batch, stats) => {
  const name = String(unvan || '').trim();
  if (!name) return null;
  let cari = findExistingCari(name, cariler);
  if (cari) return cari;
  cari = {
    id: `ck_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    kartTipi: 'TEDARIKCI',
    kod: `CAR-${Math.floor(100 + Math.random() * 900)}`,
    unvan: name,
    yetkili: 'Evrak Import',
    telefon: '',
    eposta: '',
    vergiNo: '',
    vergiDairesi: '',
    adres: 'PDF evrak aktarimindan otomatik olusturuldu.',
    iban: '',
    durum: 'AKTIF',
    notlar: buildSourceTag(0).replace('#P0', ''),
  };
  cariler.unshift(cari);
  batch.set(doc(db, 'cariKartlar', cari.id), cari);
  stats.createdCari += 1;
  return cari;
};

const ensureStok = (urunAdi, birim, stoklar, batch, stats) => {
  const name = String(urunAdi || '').trim();
  if (!name) return null;
  let stok = findExistingStok(name, stoklar);
  if (stok) return stok;
  stok = {
    id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
    stokAdi: name,
    kategori: '157-46 Dograma / Insaat Malzemesi',
    birim: birim || 'ADET',
    kritikSeviye: 5,
    durum: 'AKTIF',
    aciklama: 'PDF evrak aktarimindan otomatik olusturuldu.',
  };
  stoklar.unshift(stok);
  batch.set(doc(db, 'stokKartlar', stok.id), stok);
  stats.createdStok += 1;
  return stok;
};

const buildSaId = (date, used) => {
  const dateKey = String(date).replace(/-/g, '');
  let seq = 1;
  let id = `SA-${dateKey}-${String(seq).padStart(3, '0')}`;
  while (used.has(id)) {
    seq += 1;
    id = `SA-${dateKey}-${String(seq).padStart(3, '0')}`;
  }
  used.add(id);
  return id;
};

const normalizeKalemler = (record, pageNo) => {
  const raw = Array.isArray(record?.kalemler) ? record.kalemler : [];
  if (raw.length > 0) {
    return raw.map((k, idx) => ({
      id: `k_${Date.now()}_${pageNo}_${idx}`,
      urunAdi: String(k?.urunAdi || `Malzeme ${idx + 1}`).trim() || `Malzeme ${idx + 1}`,
      miktar: Number(k?.miktar || 1),
      birim: String(k?.birim || 'ADET').trim() || 'ADET',
      birimFiyat: Number(k?.birimFiyat || 0),
      kdvOran: Number(k?.kdvOran || 20),
      toplam: Number(k?.toplam || 0),
    }));
  }
  return [
    {
      id: `k_${Date.now()}_${pageNo}_fb`,
      urunAdi: String(record?.aciklama || 'Toplu evrak kalemi'),
      miktar: 1,
      birim: 'ADET',
      birimFiyat: Number(record?.toplamTutar || record?.genelToplam || 0),
      kdvOran: 20,
      toplam: Number(record?.genelToplam || record?.toplamTutar || 0),
    },
  ];
};

const mapToEvrak = (data, pageNo, sourceTag) => {
  const detected = String(data?.detectedType || 'fatura').toLowerCase();
  const firma = String(data?.cariUnvan || data?.firma || 'Bilinmeyen Firma').trim();
  const tarih = toIsoDate(data?.tarih);
  const kalemler = normalizeKalemler(data, pageNo);

  if (detected === 'irsaliye') {
    return {
      collection: 'irsaliyeler',
      detectedType: 'irsaliye',
      doc: {
        id: `ir_${Date.now()}_${pageNo}`,
        irsaliyeId: `IR-${Date.now().toString().slice(-4)}`,
        irsaliyeNo: data?.irsaliyeNo || data?.faturaNo || `IR-P${pageNo}-${Date.now().toString().slice(-5)}`,
        firma,
        tarih,
        onayDurumu: '2. ONAY TAMAMLANDI',
        kalemler: kalemler.map((k) => ({
          id: k.id,
          urunAdi: k.urunAdi,
          miktar: k.miktar,
          birim: k.birim,
        })),
        eImzalar: [],
        notlar: sourceTag,
      },
      firma,
      kalemler,
    };
  }

  if (detected === 'hakedis') {
    return {
      collection: 'faturalar',
      detectedType: 'hakedis',
      doc: {
        id: `ft_hk_${Date.now()}_${pageNo}`,
        faturaNo: data?.faturaNo || `HK-P${pageNo}-${Date.now().toString().slice(-5)}`,
        tarih,
        cariKartId: '',
        cariUnvan: firma,
        toplamTutar: Number(data?.toplamTutar || data?.genelToplam || 0),
        kdvTutar: Number(data?.kdvTutar || 0),
        genelToplam: Number(data?.genelToplam || data?.toplamTutar || 0),
        durum: 'ONAYLANDI',
        bagliIrsaliyeler: [],
        notlar: `Hakedis ${data?.donem || ''} ${sourceTag}`.trim(),
        kalemler,
      },
      firma,
      kalemler,
    };
  }

  // fatura veya taninamayan satin alma evragi → fatura
  if (detected === 'fatura' || detected === 'makbuz') {
    const matrah = Number(data?.toplamTutar || 0);
    const kdv = Number(data?.kdvTutar || 0);
    const genel = Number(data?.genelToplam || data?.tutar || matrah + kdv);
    return {
      collection: 'faturalar',
      detectedType: detected,
      doc: {
        id: `ft_${Date.now()}_${pageNo}`,
        faturaNo: data?.faturaNo || data?.referansId || `FT-P${pageNo}-${Date.now().toString().slice(-5)}`,
        tarih,
        cariKartId: '',
        cariUnvan: firma,
        toplamTutar: matrah || genel,
        kdvTutar: kdv,
        genelToplam: genel,
        durum: 'ONAYLANDI',
        bagliIrsaliyeler: [],
        notlar: `PDF evrak aktarimi ${sourceTag}`,
        kalemler,
      },
      firma,
      kalemler,
    };
  }

  // satin alma talebi fallback
  return {
    collection: 'satinAlmaTalepleri',
    detectedType: 'satin_alma',
    doc: null,
    firma,
    kalemler,
    saMeta: { tarih, aciklama: `${String(data?.aciklama || '').trim()} ${sourceTag}`.trim() },
  };
};

const main = async () => {
  console.log(`Mod: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`Parse: ${useRemote ? `remote ${endpoint}` : 'local GEMINI'}`);
  console.log(`Sayfa gecikmesi: ${perPageDelayMs}ms`);

  const [saSnap, stokSnap, cariSnap, ftSnap, irSnap] = await Promise.all([
    getDocs(collection(db, 'satinAlmaTalepleri')),
    getDocs(collection(db, 'stokKartlar')),
    getDocs(collection(db, 'cariKartlar')),
    getDocs(collection(db, 'faturalar')),
    getDocs(collection(db, 'irsaliyeler')),
  ]);

  const existingTags = new Set();
  for (const snap of [saSnap, ftSnap, irSnap]) {
    snap.docs.forEach((d) => {
      const n = JSON.stringify(d.data());
      const m = n.match(/\[LegacyPDF:[^\]]+\]/g);
      m?.forEach((t) => existingTags.add(t));
    });
  }

  const mutableStok = stokSnap.docs.map((d) => d.data());
  const mutableCari = cariSnap.docs.map((d) => d.data());
  const usedSaIds = new Set(saSnap.docs.map((d) => String(d.data().saId || '')));

  const pdfBuffer = readFileSync(pdfPath);
  const pageBase64List = await splitPdfToPageBase64(pdfBuffer);
  const pageNos = parsePagesFilter(pageBase64List.length);
  console.log(`Toplam sayfa: ${pageBase64List.length}, islenecek: ${pageNos.join(', ')}`);

  const prepared = [];
  const skipped = [];
  const errors = [];

  for (const pageNo of pageNos) {
    const sourceTag = buildSourceTag(pageNo);
    if (existingTags.has(sourceTag)) {
      skipped.push({ pageNo, reason: 'zaten aktarilmis' });
      continue;
    }

    process.stdout.write(`Sayfa ${pageNo}/${pageBase64List.length} parse... `);
    try {
      const payload = useRemote
        ? await requestParseRemote(pageBase64List[pageNo - 1])
        : await requestParseLocal(pageBase64List[pageNo - 1], pageNo);
      const data = payload?.data || payload;
      const mapped = mapToEvrak(data, pageNo, sourceTag);

      if (mapped.collection === 'satinAlmaTalepleri') {
        const saId = buildSaId(mapped.saMeta.tarih, usedSaIds);
        mapped.doc = {
          id: `sa_${Date.now()}_${pageNo}`,
          saId,
          tarih: mapped.saMeta.tarih,
          talepEden: 'PDF EVRAK AKTARIM',
          cariFirma: mapped.firma,
          aciklama: mapped.saMeta.aciklama,
          onayDurumu: 'ONAYLANDI',
          kalemler: mapped.kalemler.map((k, idx) => ({
            id: `sai_${Date.now()}_${pageNo}_${idx}`,
            urunAdi: k.urunAdi,
            miktar: k.miktar,
            birim: k.birim,
            marka: '',
            kullanilacakYer: '157-46 Dograma',
            aciklama: '',
          })),
          eImzalar: [],
          arsivde: true,
        };
        mapped.detectedType = 'satin_alma';
      }

      prepared.push({ pageNo, ...mapped, rawDetected: data?.detectedType });
      console.log(`OK → ${mapped.detectedType} / ${mapped.doc?.faturaNo || mapped.doc?.irsaliyeNo || mapped.doc?.saId}`);
      if (pageNo !== pageNos[pageNos.length - 1]) await sleep(perPageDelayMs);
    } catch (err) {
      console.log('HATA');
      errors.push({ pageNo, error: String(err?.message || err) });
    }
  }

  const outDir = resolve(ROOT, 'scripts/evrak-import-output');
  mkdirSync(outDir, { recursive: true });
  const previewPath = resolve(outDir, `${basename(pdfPath, '.PDF')}-preview.json`);
  writeFileSync(
    previewPath,
    JSON.stringify({ prepared, skipped, errors, generatedAt: nowIso() }, null, 2),
    'utf8'
  );

  console.log('\n--- OZET ---');
  console.log(`Hazir: ${prepared.length}`);
  console.log(`Atlanan: ${skipped.length}`);
  console.log(`Hata: ${errors.length}`);
  console.log(`Onizleme: ${previewPath}`);

  prepared.forEach((p) => {
    const no = p.doc?.faturaNo || p.doc?.irsaliyeNo || p.doc?.saId;
    console.log(`  P${p.pageNo}: ${p.detectedType} | ${p.firma} | ${no} | ${p.kalemler.length} kalem`);
  });

  if (dryRun) {
    console.log('\nDRY-RUN tamamlandi. Yazmak icin --execute ekleyin.');
    return;
  }

  const stats = { createdCari: 0, createdStok: 0, written: 0, stokIslem: 0 };

  for (const item of prepared) {
    const batch = writeBatch(db);
    const cari = ensureCari(item.firma, mutableCari, batch, stats);
    if (cari && item.doc.cariKartId !== undefined) item.doc.cariKartId = cari.id;
    if (cari && item.doc.cariUnvan !== undefined) item.doc.cariUnvan = cari.unvan;

    for (const k of item.kalemler) {
      const stok = ensureStok(k.urunAdi, k.birim, mutableStok, batch, stats);
      if (stok && k.id && item.doc.kalemler) {
        const idx = item.doc.kalemler.findIndex((x) => x.id === k.id);
        if (idx >= 0) item.doc.kalemler[idx].stokKartId = stok.id;
      }
      if (stok) {
        const islem = {
          id: `stk_islem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          stokKartId: stok.id,
          islemTipi: 'GIRIS',
          islemId: item.doc.id,
          islemBaslik: `${item.collection} ${item.doc.faturaNo || item.doc.irsaliyeNo || item.doc.saId}`,
          islemDetay: `${k.urunAdi} · ${k.miktar} ${k.birim} · ${item.firma}`,
          miktarDegisimi: Number(k.miktar || 0),
          tarih: item.doc.tarih,
          belgeNo: item.doc.faturaNo || item.doc.irsaliyeNo || item.doc.saId,
        };
        batch.set(doc(db, 'stokIslemGecmisi', islem.id), islem);
        stats.stokIslem += 1;
      }
    }

    batch.set(doc(db, item.collection, item.doc.id), item.doc);
    await batch.commit();
    stats.written += 1;
    console.log(`Yazildi P${item.pageNo} → ${item.collection}`);
  }

  console.log('\n--- YAZIM ---');
  console.log(`Evrak: ${stats.written}`);
  console.log(`Yeni cari: ${stats.createdCari}`);
  console.log(`Yeni stok: ${stats.createdStok}`);
  console.log(`Stok islem: ${stats.stokIslem}`);
};

main().catch((err) => {
  console.error('Import hatasi:', err);
  process.exit(1);
});

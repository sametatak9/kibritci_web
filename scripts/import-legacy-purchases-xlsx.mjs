#!/usr/bin/env node
/**
 * Legacy SATINALMA TALEP FORMU Excel dosyalarini Firestore'a arsiv satin alma kaydi olarak aktarir.
 *
 * Ornek:
 *  node scripts/import-legacy-purchases-xlsx.mjs --dir "c:/Users/DELL/Desktop/HERŞEY BU DOSYADA/SATINALMA SİPARİŞ FORMU" --dry-run
 *  node scripts/import-legacy-purchases-xlsx.mjs --dir "c:/Users/DELL/Desktop/HERŞEY BU DOSYADA/SATINALMA SİPARİŞ FORMU" --execute
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, setDoc, writeBatch } from 'firebase/firestore';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return '';
  return args[i + 1] || '';
};
const hasArg = (name) => args.includes(name);

const inputDirRaw = getArg('--dir');
const execute = hasArg('--execute');
const dryRun = hasArg('--dry-run') || !execute;
const limitArg = Number(getArg('--limit') || 0);
const LEGACY_ORDER_SITE = 'DURSUNKÖY KİBRİTÇİ İNŞAAT ŞANTİYESİ';

if (!inputDirRaw) {
  console.error('Eksik parametre: --dir "<klasor>"');
  process.exit(1);
}

const inputDir = resolve(inputDirRaw);
if (!existsSync(inputDir)) {
  console.error(`Klasor bulunamadi: ${inputDir}`);
  process.exit(1);
}

const configPath = resolve('firebase-target.config.json');
if (!existsSync(configPath)) {
  console.error(`firebase-target.config.json bulunamadi: ${configPath}`);
  process.exit(1);
}

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
  if (!raw) return nowIso().slice(0, 10);
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) return raw.toISOString().slice(0, 10);
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return nowIso().slice(0, 10);
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

const extractTalepNo = (raw, fallbackName) => {
  const text = String(raw || '');
  const m = text.match(/(\d{2,6})/);
  if (m) return m[1];
  const m2 = String(fallbackName).match(/NO\.?(\d{2,6})/i);
  return m2 ? m2[1] : '';
};

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

const getCellText = (ws, row, col) => {
  const cell = ws.getRow(row).getCell(col);
  if (!cell) return '';
  const value = cell.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return String(value.result).trim();
    if ('text' in value && value.text != null) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((x) => String(x?.text || '')).join('').trim();
    }
  }
  try {
    return String(cell.text || '').trim();
  } catch {
    return '';
  }
};

const parseFormFile = async (filePath) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error('Ilk worksheet bulunamadi');
  }

  const shantiyeRaw = getCellText(ws, 9, 2) || getCellText(ws, 10, 2);
  const tarihRaw = ws.getRow(9).getCell(4).value || ws.getRow(10).getCell(4).value;
  const talepNoRaw = getCellText(ws, 9, 6) || getCellText(ws, 10, 6);

  const sahaAdi = String(shantiyeRaw).replace(/ŞANTİYE ADI\s*:*/i, '').trim() || 'Eski Şantiye';
  const tarih = toIsoDate(tarihRaw);
  const talepNo = extractTalepNo(talepNoRaw, basename(filePath));

  const kalemler = [];
  // Bu formlar standartta 14. satirdan baslar.
  for (let row = 14; row <= 80; row++) {
    const siraNo = getCellText(ws, row, 2);
    const urunAdi = getCellText(ws, row, 3);
    const birim = getCellText(ws, row, 4);
    const miktarText = getCellText(ws, row, 5).replace(',', '.');
    const kullanilacakYer = getCellText(ws, row, 7);

    const numericSira = Number(siraNo);
    const hasRowSignal = (Number.isFinite(numericSira) && numericSira > 0) || urunAdi || birim || miktarText;
    if (!hasRowSignal) continue;

    if (!urunAdi) continue;
    const miktar = Number(miktarText);
    kalemler.push({
      id: `sai_${Date.now()}_${row}_${Math.random().toString(36).slice(2, 6)}`,
      urunAdi: urunAdi.trim(),
      miktar: Number.isFinite(miktar) && miktar > 0 ? miktar : 1,
      birim: birim || 'ADET',
      marka: '',
      kullanilacakYer: kullanilacakYer || sahaAdi,
      aciklama: '',
    });
  }

  if (kalemler.length === 0) {
    throw new Error('Malzeme satiri bulunamadi');
  }

  return {
    tarih,
    sahaAdi,
    talepNo,
    kalemler,
  };
};

const firebaseCfg = JSON.parse(readFileSync(configPath, 'utf8'));
const app = initializeApp(
  {
    apiKey: firebaseCfg.apiKey,
    authDomain: firebaseCfg.authDomain,
    projectId: firebaseCfg.projectId,
    storageBucket: firebaseCfg.storageBucket,
    messagingSenderId: firebaseCfg.messagingSenderId,
    appId: firebaseCfg.appId,
  },
  `LEGACY_XLSX_IMPORT_${Date.now()}`
);
const db = getFirestore(app);

const loadExisting = async () => {
  const [saSnap, stokSnap] = await Promise.all([
    getDocs(collection(db, 'satinAlmaTalepleri')),
    getDocs(collection(db, 'stokKartlar')),
  ]);
  return {
    talepler: saSnap.docs.map((d) => d.data()),
    stoklar: stokSnap.docs.map((d) => d.data()),
  };
};

const main = async () => {
  const allFiles = readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .map((f) => resolve(inputDir, f))
    .sort((a, b) => a.localeCompare(b, 'tr'));
  const files = limitArg > 0 ? allFiles.slice(0, limitArg) : allFiles;

  console.log(`Mod: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`Klasor: ${inputDir}`);
  console.log(`Toplam xlsx: ${files.length}`);

  const { talepler: existingTalepler, stoklar: existingStoklar } = await loadExisting();
  const usedSaIds = new Set(existingTalepler.map((x) => String(x.saId || '')));
  const existingTags = new Set(
    existingTalepler.map((x) => String(x.aciklama || '')).filter((x) => x.includes('[LegacyXLSX:'))
  );
  const mutableStoklar = [...existingStoklar];

  const prepared = [];
  const skipped = [];
  const errors = [];

  for (const filePath of files) {
    const sourceTag = `[LegacyXLSX:${basename(filePath)}]`;
    if ([...existingTags].some((x) => x.includes(sourceTag))) {
      skipped.push({ file: basename(filePath), reason: 'zaten aktarilmis' });
      continue;
    }
    try {
      const parsed = await parseFormFile(filePath);
      const saId = buildSaIdFromSet(parsed.tarih, usedSaIds);
      prepared.push({
        filePath,
        talep: {
          id: `sa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          saId,
          tarih: parsed.tarih,
          talepEden: 'SİSTEM AKTARIM',
          cariFirma: LEGACY_ORDER_SITE,
          aciklama: `Legacy satın alma formu ${parsed.talepNo ? `NO:${parsed.talepNo} ` : ''}` +
            `Kaynak Şantiye:${parsed.sahaAdi || '-'} ${sourceTag}`.trim(),
          onayDurumu: 'BİLİNMİYOR',
          kalemler: parsed.kalemler,
          eImzalar: [],
          arsivde: true,
        },
      });
    } catch (err) {
      errors.push({ file: basename(filePath), error: String(err?.message || err) });
    }
  }

  console.log(`Hazir kayit: ${prepared.length}`);
  console.log(`Atlanan dosya: ${skipped.length}`);
  console.log(`Hata: ${errors.length}`);
  if (errors.length) {
    errors.slice(0, 20).forEach((e) => console.log(`  ${e.file}: ${e.error}`));
  }

  if (dryRun) {
    console.log('DRY-RUN tamamlandi; Firestore yazimi yapilmadi.');
    return;
  }

  let writtenSa = 0;
  let createdStok = 0;
  let writtenStokIslem = 0;

  for (const p of prepared) {
    await setDoc(doc(db, 'satinAlmaTalepleri', p.talep.id), p.talep);
    writtenSa += 1;

    const batch = writeBatch(db);
    for (const kalem of p.talep.kalemler) {
      const urunAdi = String(kalem.urunAdi || '').trim();
      if (!urunAdi) continue;
      let stok = findExistingStok(urunAdi, mutableStoklar);
      if (!stok) {
        stok = {
          id: `sk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
          stokAdi: urunAdi,
          kategori: 'Kaba İnşaat İmalatı',
          birim: kalem.birim || 'ADET',
          kritikSeviye: 5,
          durum: 'AKTIF',
          aciklama: 'Legacy satın alma formundan otomatik oluşturuldu.',
        };
        mutableStoklar.unshift(stok);
        batch.set(doc(db, 'stokKartlar', stok.id), stok);
        createdStok += 1;
      }

      const historyLine = `${p.talep.tarih} ${p.talep.saId} · ${p.talep.cariFirma} · ${kalem.miktar} ${kalem.birim || stok.birim}`;
      const prevDesc = String(stok.aciklama || '');
      if (!prevDesc.includes(p.talep.saId)) {
        const nextStok = { ...stok, aciklama: `${prevDesc}\n[Satın Alma] ${historyLine}`.trim() };
        const idx = mutableStoklar.findIndex((x) => x.id === stok.id);
        if (idx >= 0) mutableStoklar[idx] = nextStok;
        batch.set(doc(db, 'stokKartlar', nextStok.id), nextStok);
      }

      const stokIslem = {
        id: `stk_islem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        stokKartId: stok.id,
        islemTipi: 'GIRIS',
        islemId: p.talep.id,
        islemBaslik: `Satın Alma ${p.talep.saId}`,
        islemDetay: `${kalem.urunAdi} · ${kalem.miktar} ${kalem.birim || stok.birim} · ${p.talep.cariFirma}`,
        miktarDegisimi: Number(kalem.miktar || 0),
        tarih: p.talep.tarih,
        belgeNo: p.talep.saId,
      };
      batch.set(doc(db, 'stokIslemGecmisi', stokIslem.id), stokIslem);
      writtenStokIslem += 1;
    }
    await batch.commit();
  }

  console.log('--- IMPORT OZET ---');
  console.log(`Yazilan satin alma: ${writtenSa}`);
  console.log(`Olusturulan stok kart: ${createdStok}`);
  console.log(`Yazilan stok islem: ${writtenStokIslem}`);
};

main().catch((err) => {
  console.error('Import hatasi:', err);
  process.exit(1);
});


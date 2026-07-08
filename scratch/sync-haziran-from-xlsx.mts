import ExcelJS from 'exceljs';
import { collection, deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, fetchCollection, parseYoklamaSnapshotData } from '../src/lib/firebase';
import { findPersonelByName, normalizeTurkishName, setYoklamaDay } from '../src/lib/yoklamaUtils';
import type { AylikYoklamaMap, Personel, YoklamaDurum } from '../src/types/erp';

type ParsedRow = {
  fullName: string;
  days: Array<{ day: number; durum: YoklamaDurum; mesaiSaati: number }>;
};

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const v = value as any;
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((x: any) => x?.text || '').join('');
    if (v.result != null) return String(v.result);
  }
  return '';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = toText(value).replace(',', '.').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function statusFromSymbol(symbol: string): YoklamaDurum | null {
  const s = symbol.trim().toUpperCase();
  if (s === 'X' || s === 'G') return 'Geldi';
  if (s === 'Y') return 'Yok';
  if (s === 'İ' || s === 'I') return 'İzinli';
  if (s === 'R') return 'Raporlu';
  if (s === 'P') return 'Pazar';
  if (s === 'T') return 'Tatil';
  return null;
}

function detectDayColumns(ws: ExcelJS.Worksheet): Array<{ col: number; day: number }> {
  const cols: Array<{ col: number; day: number }> = [];
  let started = false;
  for (let col = 7; col <= 80; col++) {
    const raw = ws.getCell(2, col).value;
    const day = Math.trunc(toNumber(raw));
    if (day >= 1 && day <= 31) {
      cols.push({ col, day });
      started = true;
      continue;
    }
    if (started) break;
  }
  return cols;
}

function parsePuantajSheet(ws: ExcelJS.Worksheet): ParsedRow[] {
  const dayCols = detectDayColumns(ws);
  const parsed: ParsedRow[] = [];
  for (let row = 4; row <= ws.rowCount; row++) {
    const rowType = toText(ws.getCell(row, 6).value).toUpperCase();
    if (!rowType.includes('ÇALIŞMA')) continue;

    const fullName = toText(ws.getCell(row, 2).value).trim();
    if (!fullName || fullName === '-') {
      row += 2;
      continue;
    }

    const days: ParsedRow['days'] = [];
    for (const { col, day } of dayCols) {
      const statusSymbol = toText(ws.getCell(row, col).value).trim();
      const mesai = toNumber(ws.getCell(row + 1, col).value);
      const durum = statusFromSymbol(statusSymbol);
      if (!durum) {
        if (mesai > 0) {
          days.push({ day, durum: 'Geldi', mesaiSaati: mesai });
        }
        continue;
      }
      days.push({ day, durum, mesaiSaati: mesai > 0 ? mesai : 0 });
    }

    parsed.push({ fullName, days });
    row += 2; // her personel 3 satır blok
  }
  return parsed;
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const fileArgIndex = process.argv.indexOf('--file');
  const reportPath =
    fileArgIndex >= 0
      ? process.argv[fileArgIndex + 1]
      : 'C:/Users/DELL/Downloads/Yoklama_Modern_Rapor_2026-06 (6).xlsx';
  if (!reportPath) throw new Error('--file parametresi eksik');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(reportPath);
  const ws = wb.getWorksheet('Puantaj') || wb.worksheets[0];
  if (!ws) throw new Error('Excel içinde çalışma sayfası bulunamadı');

  const parsedRows = parsePuantajSheet(ws);
  const parsedNameSet = new Set(parsedRows.map((r) => normalizeTurkishName(r.fullName)));
  const personeller = await fetchCollection<Personel>('personeller');
  const yoklamaDoc = await getDoc(doc(db, 'yoklamalar', 'global_yoklama_map'));
  const current = yoklamaDoc.exists()
    ? (parseYoklamaSnapshotData(yoklamaDoc.data() as Record<string, unknown>) as AylikYoklamaMap)
    : ({} as AylikYoklamaMap);

  const next: AylikYoklamaMap = JSON.parse(JSON.stringify(current || {}));
  const junePrefix = '2026-06-';

  // Haziran'ı tam eşitlemek için önce herkeste Haziran günlerini temizle.
  Object.keys(next).forEach((pid) => {
    const map = { ...(next[pid] || {}) };
    Object.keys(map).forEach((k) => {
      if (k.startsWith(junePrefix)) delete map[k];
    });
    next[pid] = map;
  });

  const matchedPersonIds = new Set<string>();
  const unmatchedInReport: string[] = [];
  let appliedDayCount = 0;

  parsedRows.forEach((entry) => {
    const match = findPersonelByName(personeller, entry.fullName);
    if (!match) {
      unmatchedInReport.push(entry.fullName);
      return;
    }
    matchedPersonIds.add(match.id);
    let personMap = { ...(next[match.id] || {}) };
    entry.days.forEach(({ day, durum, mesaiSaati }) => {
      personMap = setYoklamaDay(personMap, 2026, 6, day, { durum, mesaiSaati });
      appliedDayCount++;
    });
    next[match.id] = personMap;
  });

  // Kullanıcının silmiş olduğu ama legacy ile tekrar gelen kayıtları tekrar kaldır.
  const recreatedToDelete = personeller.filter((p) => {
    const key = normalizeTurkishName(`${p.ad} ${p.soyad}`);
    return p.id.startsWith('PRS-LEGACY') && !parsedNameSet.has(key);
  });

  recreatedToDelete.forEach((p) => {
    delete next[p.id];
  });

  const summary = {
    dryRun,
    reportPath,
    parsedPersonelRows: parsedRows.length,
    matchedPersonelRows: matchedPersonIds.size,
    unmatchedInReportCount: unmatchedInReport.length,
    appliedDayCount,
    recreatedPersonelDeleteCount: recreatedToDelete.length,
    recreatedSample: recreatedToDelete.slice(0, 20).map((p) => `${p.ad} ${p.soyad} (${p.id})`),
    unmatchedSample: unmatchedInReport.slice(0, 20),
  };
  console.log('HAZIRAN XLSX SYNC SUMMARY =>', JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log('Dry-run tamam. Uygulamak için: npx vite-node scratch/sync-haziran-from-xlsx.mts --file "<xlsx>" --apply');
    return;
  }

  await setDoc(doc(db, 'yoklamalar', 'global_yoklama_map'), { dataJson: JSON.stringify(next) });

  if (recreatedToDelete.length > 0) {
    const batch = writeBatch(db);
    recreatedToDelete.forEach((p) => {
      batch.delete(doc(collection(db, 'personeller'), p.id));
    });
    await batch.commit();
  }

  console.log('Haziran yoklaması Excel ile eşitlendi ve tekrar oluşan legacy personeller temizlendi.');
}

main().catch((err) => {
  console.error('Haziran Excel eşitleme başarısız:', err);
  process.exit(1);
});


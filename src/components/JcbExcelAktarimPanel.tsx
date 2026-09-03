import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import type {
  CariKart,
  CariKartIslem,
  OperatorFaaliyet,
  TaseronKesintiRaporu,
} from '../types/erp';
import { createExcelWorkbook } from '../lib/exceljsLoader';
import { firmaEslesir, getTaseronCariKartlar } from '../lib/taseronUtils';

type ExcelRow = {
  sourceFile: string;
  rowNo: number;
  tarih: string;
  yapilanIs: string;
  kaynakFirma: string;
  firmaAdi: string;
  firmaId?: string;
  calismaSuresi: number;
  not: string;
  eslesmeNotu?: string;
};

type ParseResult = {
  rows: ExcelRow[];
  warnings: string[];
};

type Props = {
  cariKartlar: CariKart[];
  operatorFaaliyetleri: OperatorFaaliyet[];
  setOperatorFaaliyetleri: React.Dispatch<React.SetStateAction<OperatorFaaliyet[]>>;
  setTaseronKesintiRaporlari: React.Dispatch<React.SetStateAction<TaseronKesintiRaporu[]>>;
  setCariIslemGecmisi?: React.Dispatch<React.SetStateAction<CariKartIslem[]>>;
  currentUser: any;
  addNotification?: (mesaj: string) => void;
};

const ALIAS_MAP: Record<string, string> = {
  altyapi: 'ÜÇGENAY',
  arguvan: 'Erguvan Peyzaj',
};

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/\s+/g, ' ');

function cellText(ws: any, row: number, col: number): string {
  const value = ws.getRow(row).getCell(col)?.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return String(value.result).trim();
    if ('text' in value && value.text != null) return String(value.text).trim();
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((item: any) => String(item?.text || '')).join('').trim();
    }
  }
  return String(ws.getRow(row).getCell(col)?.text || '').trim();
}

function numberValue(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const text = String(raw).trim().replace(/\s/g, '');
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function isoDate(raw: unknown): string {
  if (raw instanceof Date && !Number.isNaN(raw.valueOf())) {
    return raw.toISOString().slice(0, 10);
  }
  const text = String(raw ?? '').trim();
  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotted) {
    return `${dotted[3]}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
    return epoch.toISOString().slice(0, 10);
  }
  return '';
}

function findColumns(ws: any): { headerRow: number; columns: Record<string, number> } | null {
  const hints: Record<string, string[]> = {
    tarih: ['tarih'],
    yapilanIs: ['yapilan is', 'yapilan', 'aciklama', 'is / aciklama'],
    firma: ['firma', 'taseron'],
    saat: ['calisma', 'saat', 'sure'],
    not: ['not', 'mesai'],
  };
  let best: { headerRow: number; columns: Record<string, number>; score: number } | null = null;
  const maxCol = Math.min(Number(ws.columnCount || 20), 30);

  for (let row = 1; row <= 25; row += 1) {
    const columns: Record<string, number> = {};
    let score = 0;
    for (let col = 1; col <= maxCol; col += 1) {
      const text = normalize(cellText(ws, row, col));
      if (!text) continue;
      for (const [key, values] of Object.entries(hints)) {
        const hit = values.some((hint) => text === hint || text.includes(hint));
        if (hit && !columns[key]) {
          columns[key] = col;
          score += key === 'firma' || key === 'saat' ? 4 : 2;
        }
      }
    }
    if (columns.firma && columns.saat && columns.yapilanIs && score > (best?.score || 0)) {
      best = { headerRow: row, columns, score };
    }
  }
  return best ? { headerRow: best.headerRow, columns: best.columns } : null;
}

function resolveFirma(raw: string, cariler: CariKart[]): {
  firmaAdi: string;
  firmaId?: string;
  eslesmeNotu?: string;
} {
  const aliasTarget = ALIAS_MAP[normalize(raw)] || raw.trim();
  const matched = cariler.find((c) => firmaEslesir(aliasTarget, c.unvan));
  if (matched) {
    return {
      firmaAdi: matched.unvan,
      firmaId: matched.id,
      eslesmeNotu: aliasTarget !== raw.trim() ? `${raw.trim()} → ${matched.unvan}` : undefined,
    };
  }
  return {
    firmaAdi: aliasTarget,
    eslesmeNotu: aliasTarget !== raw.trim() ? `${raw.trim()} → ${aliasTarget} (cari bulunamadı)` : 'Program cari kartlarında bulunamadı',
  };
}

async function parseFiles(files: File[], cariler: CariKart[]): Promise<ParseResult> {
  const rows: ExcelRow[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const workbook = await createExcelWorkbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    workbook.worksheets.forEach((ws: any) => {
      const detected = findColumns(ws);
      if (!detected) {
        warnings.push(`${file.name}: tarih, firma, iş açıklaması ve saat sütunları bulunamadı.`);
        return;
      }
      const { headerRow, columns } = detected;
      let emptyStreak = 0;
      const maxRow = Math.max(Number(ws.rowCount || 0), headerRow + 500);
      for (let rowNo = headerRow + 1; rowNo <= maxRow; rowNo += 1) {
        const rawDate = columns.tarih ? ws.getRow(rowNo).getCell(columns.tarih).value : '';
        const rawFirma = columns.firma ? cellText(ws, rowNo, columns.firma) : '';
        const yapilanIs = columns.yapilanIs ? cellText(ws, rowNo, columns.yapilanIs) : '';
        const rawSaat = columns.saat ? ws.getRow(rowNo).getCell(columns.saat).value : '';
        const not = columns.not ? cellText(ws, rowNo, columns.not) : '';
        const summaryMarker = normalize(yapilanIs);
        if (
          !rawDate &&
          !rawFirma &&
          !rawSaat &&
          (summaryMarker.includes('genel toplam') ||
            summaryMarker.includes('firma / taseron bazli ozet') ||
            summaryMarker === 'toplam saat')
        ) {
          break;
        }
        if (!rawFirma && !yapilanIs && !rawSaat && !rawDate) {
          emptyStreak += 1;
          if (emptyStreak >= 8) break;
          continue;
        }
        emptyStreak = 0;
        const date = isoDate(rawDate);
        if (!date || !rawFirma || !yapilanIs) {
          warnings.push(`${file.name} ${rowNo}. satır atlandı: tarih, firma veya iş açıklaması eksik.`);
          continue;
        }
        const hours = numberValue(rawSaat);
        const match = resolveFirma(rawFirma, cariler);
        rows.push({
          sourceFile: file.name,
          rowNo,
          tarih: date,
          yapilanIs,
          kaynakFirma: rawFirma,
          firmaAdi: match.firmaAdi,
          firmaId: match.firmaId,
          calismaSuresi: Math.max(0, Math.round(hours * 100) / 100),
          not,
          eslesmeNotu: match.eslesmeNotu,
        });
        if (hours <= 0) warnings.push(`${file.name} ${rowNo}. satırda çalışma saati boş veya sıfır.`);
      }
    });
  }
  return { rows, warnings };
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'kayit';
}

function periodOf(date: string): { ay: number; yil: number; key: string } {
  const [yil, ay] = date.split('-').map(Number);
  return { ay, yil, key: `${yil}-${String(ay).padStart(2, '0')}` };
}

export const JcbExcelAktarimPanel: React.FC<Props> = ({
  cariKartlar,
  operatorFaaliyetleri,
  setOperatorFaaliyetleri,
  currentUser,
  addNotification,
}) => {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editRowsOpen, setEditRowsOpen] = useState(false);

  const taseronCariler = useMemo(() => getTaseronCariKartlar(cariKartlar), [cariKartlar]);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, { firmaAdi: string; firmaId?: string; period: string; periodKey: string; count: number; hours: number; unresolved: boolean }>();
    for (const row of parseResult?.rows || []) {
      const period = periodOf(row.tarih);
      const key = `${period.key}||${row.firmaAdi}`;
      const current = groups.get(key) || {
        firmaAdi: row.firmaAdi,
        firmaId: row.firmaId,
        period: `${String(period.ay).padStart(2, '0')}/${period.yil}`,
        periodKey: period.key,
        count: 0,
        hours: 0,
        unresolved: false,
      };
      current.count += 1;
      current.hours += row.calismaSuresi;
      current.unresolved ||= !row.firmaId;
      groups.set(key, current);
    }
    return [...groups.values()].sort((a, b) => a.firmaAdi.localeCompare(b.firmaAdi, 'tr'));
  }, [parseResult]);

  const updateParsedRow = (rowIndex: number, field: 'firmaAdi' | 'yapilanIs', value: string) => {
    setParseResult((previous) => {
      if (!previous) return previous;
      const rows = previous.rows.map((row, index) => {
        if (index !== rowIndex) return row;
        if (field === 'yapilanIs') return { ...row, yapilanIs: value };
        const match = resolveFirma(value, taseronCariler);
        return {
          ...row,
          firmaAdi: match.firmaAdi,
          firmaId: match.firmaId,
          eslesmeNotu: match.eslesmeNotu,
        };
      });
      return { ...previous, rows };
    });
  };

  const updateParsedGroupFirma = (periodKey: string, oldFirmaAdi: string, firmaId: string) => {
    const cari = taseronCariler.find((item) => item.id === firmaId);
    if (!cari) return;
    setParseResult((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        rows: previous.rows.map((row) => {
          if (periodOf(row.tarih).key !== periodKey || row.firmaAdi !== oldFirmaAdi) return row;
          return {
            ...row,
            firmaAdi: cari.unvan,
            firmaId: cari.id,
            eslesmeNotu: `${row.kaynakFirma} → ${cari.unvan}`,
          };
        }),
      };
    });
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await parseFiles(files, taseronCariler);
      setParseResult(result);
      setFileNames(files.map((file) => file.name));
      setEditRowsOpen(false);
      setMessage(`${result.rows.length} satır okundu. Aktarım öncesi aşağıdaki eşleşmeleri kontrol edin.`);
    } catch (error) {
      setParseResult(null);
      setMessage(`Excel okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const handleImport = () => {
    if (!parseResult?.rows.length) {
      alert('Önce bir Excel dosyası seçin.');
      return;
    }
    const existingIds = new Set(operatorFaaliyetleri.map((item) => item.id));
    const newRows = parseResult.rows.filter((row) => {
      const id = `of_excel_jcb_cafer_${slug(row.sourceFile)}_${row.rowNo}`;
      return !existingIds.has(id);
    });
    if (!newRows.length) {
      setMessage('Bu dosyanın satırları daha önce aktarılmış görünüyor; tekrar kayıt oluşturulmadı.');
      return;
    }

    const faaliyetler: OperatorFaaliyet[] = newRows.map((row) => {
      const id = `of_excel_jcb_cafer_${slug(row.sourceFile)}_${row.rowNo}`;
      const period = periodOf(row.tarih);
      return {
        id,
        aracId: 'kiralik_jcb_cafer',
        aracPlaka: 'JCB Cafer',
        operatorIsim: 'Cafer',
        operatorTipi: 'KİRALIK',
        tarih: row.tarih,
        baslangicSaat: '—',
        bitisSaat: '—',
        calismaSuresi: row.calismaSuresi,
        yapilanIs: row.not ? `${row.yapilanIs} · ${row.not}` : row.yapilanIs,
        firmaAdi: row.firmaAdi,
        firmaId: row.firmaId,
        isManualFirma: !row.firmaId,
        operatorTc: undefined,
        makineKaynak: 'KIRALIK',
        makineManuelAd: 'JCB Cafer',
        isKaydiEtiketi: `Kiralık JCB · Cafer · Excel ${period.key}`,
        onayDurumu: 'BEKLEMEDE',
        durum: 'ONAY BEKLİYOR',
        kesintiYansitildi: false,
        kaydedenKullanici: currentUser?.email || 'Excel aktarımı',
        kayitTarihi: new Date().toISOString(),
      };
    });

    setOperatorFaaliyetleri((previous) => [...previous, ...faaliyetler]);
    const totalHours = faaliyetler.reduce((sum, item) => sum + item.calismaSuresi, 0);
    const matchedCount = faaliyetler.filter((item) => item.firmaId).length;
    const summary = `${faaliyetler.length} faaliyet (${totalHours.toFixed(1)} saat) Kesinti kayıtlarına eklendi. ${matchedCount}/${faaliyetler.length} satır cariyle eşleşti; kesinti raporu henüz oluşturulmadı.`;
    setMessage(summary);
    addNotification?.(`JCB Cafer Excel aktarımı: ${summary}`);
  };

  const summaryStats = parseResult
    ? {
        rowCount: parseResult.rows.length,
        totalHours: parseResult.rows.reduce((sum, row) => sum + row.calismaSuresi, 0),
        firmCount: new Set(parseResult.rows.map((row) => row.firmaAdi)).size,
        matchedCount: parseResult.rows.filter((row) => row.firmaId).length,
        zeroHourCount: parseResult.rows.filter((row) => row.calismaSuresi <= 0).length,
      }
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-950 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
              <FileSpreadsheet size={15} /> Kiralık iş makinesi aktarımı
            </div>
            <h3 className="text-base font-black tracking-wide">JCB CAFER · EXCELDEN SAHA FAALİYET AKTARIMI</h3>
            <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-slate-300">
              Excel satırları önce programın kesinti kayıtlarına eklenir. Firma ve makine ayrımı kontrol edildikten
              sonra mevcut toplu işlem akışıyla taşeron kesinti raporuna dönüştürülür.
            </p>
          </div>
          <div className="rounded-xl border border-violet-400/30 bg-white/10 px-3 py-2 text-[10px] text-violet-100">
            <strong>Özel eşleştirme:</strong> ALTYAPI → ÜÇGENAY
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Excel dosyası</h4>
            <p className="mt-1 text-[10px] text-slate-500">
              Bir veya birden fazla .xlsx dosyası seçebilirsiniz. Önce okunur ve eşleşmeler gösterilir; kayıtlar
              yalnızca <strong>Faaliyetlere Aktar</strong> butonuyla yazılır, kesinti raporu otomatik oluşturulmaz.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-violet-800">
            <Upload size={14} /> {busy ? 'Okunuyor…' : 'Excel Seç'}
            <input type="file" accept=".xlsx,.xlsm" multiple className="hidden" onChange={handleFiles} disabled={busy} />
          </label>
        </div>
        {fileNames.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600">
            <strong>Seçilen:</strong> {fileNames.join(' · ')}
          </div>
        )}
        {message && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-semibold text-emerald-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {message}
          </div>
        )}
        {parseResult && (
          <>
            {summaryStats && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">Aktarım özeti</div>
                  <div className="text-[9px] font-semibold text-slate-500">Firma adları programdaki taşeron carileriyle kontrol edildi</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ['Kayıt', summaryStats.rowCount.toString(), 'text-slate-800'],
                    ['Toplam saat', `${summaryStats.totalHours.toFixed(1)} sa`, 'text-violet-700'],
                    ['Firma', summaryStats.firmCount.toString(), 'text-slate-800'],
                    ['Cari eşleşti', `${summaryStats.matchedCount}/${summaryStats.rowCount}`, 'text-emerald-700'],
                    ['Boş / sıfır saat', summaryStats.zeroHourCount.toString(), summaryStats.zeroHourCount ? 'text-amber-700' : 'text-emerald-700'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                      <div className={`mt-0.5 text-sm font-black ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[860px] text-left text-[10px]">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-3 py-2">Programdaki firma</th>
                    <th className="px-3 py-2">Dönem</th>
                    <th className="px-3 py-2 text-right">Kayıt</th>
                    <th className="px-3 py-2 text-right">Saat</th>
                    <th className="px-3 py-2">Eşleşme</th>
                    <th className="px-3 py-2">Toplu cari düzeltme</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((group) => (
                    <tr key={`${group.period}-${group.firmaAdi}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-black text-slate-800">{group.firmaAdi}</td>
                      <td className="px-3 py-2 text-slate-500">{group.period}</td>
                      <td className="px-3 py-2 text-right font-semibold">{group.count}</td>
                      <td className="px-3 py-2 text-right font-black text-violet-700">{group.hours.toFixed(1)}</td>
                      <td className={`px-3 py-2 font-bold ${group.unresolved ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {group.unresolved ? 'Cari bulunamadı — kontrol gerekli' : 'Eşleşti'}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={group.firmaId || ''}
                          onChange={(event) => updateParsedGroupFirma(group.periodKey, group.firmaAdi, event.target.value)}
                          className="w-full min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-violet-500"
                        >
                          <option value="">Program taşeronunu seç…</option>
                          {taseronCariler.map((cari) => (
                            <option key={cari.id} value={cari.id}>{cari.unvan}</option>
                          ))}
                        </select>
                        <div className="mt-1 text-[9px] text-slate-400">{group.count} kayda uygulanır</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-violet-900">
                    <Pencil size={13} /> Firma ve açıklama düzeltme
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-violet-800">
                    Excel’de hatalı yazılmış firma veya iş açıklamalarını aktarım öncesi satır satır düzeltebilirsiniz.
                    Firma alanı programdaki cari kartla yeniden eşleştirilir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditRowsOpen((open) => !open)}
                  className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-[10px] font-black text-violet-800 transition hover:bg-violet-100"
                >
                  {editRowsOpen ? 'Düzenlemeyi Kapat' : `${parseResult.rows.length} Satırı Düzenle`}
                </button>
              </div>
              {editRowsOpen && (
                <div className="mt-3 max-h-[520px] overflow-auto rounded-lg border border-violet-200 bg-white">
                  <datalist id="jcb-taseron-cari-listesi">
                    {taseronCariler.map((cari) => <option key={cari.id} value={cari.unvan} />)}
                  </datalist>
                  <table className="w-full min-w-[900px] text-left text-[10px]">
                    <thead className="sticky top-0 z-10 bg-violet-950 text-white">
                      <tr>
                        <th className="w-16 px-2 py-2">Satır</th>
                        <th className="w-28 px-2 py-2">Tarih</th>
                        <th className="w-56 px-2 py-2">Firma / Cari adı</th>
                        <th className="px-2 py-2">Yapılan iş / açıklama</th>
                        <th className="w-20 px-2 py-2 text-right">Saat</th>
                        <th className="w-32 px-2 py-2">Eşleşme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.map((row, index) => (
                        <tr key={`${row.sourceFile}-${row.rowNo}-${index}`} className="border-t border-slate-100 align-top">
                          <td className="px-2 py-2 font-mono text-slate-400">{row.rowNo}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-slate-600">{row.tarih}</td>
                          <td className="px-2 py-2">
                            <input
                              value={row.firmaAdi}
                              onChange={(event) => updateParsedRow(index, 'firmaAdi', event.target.value)}
                              list="jcb-taseron-cari-listesi"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                              title={`Excel’deki firma: ${row.kaynakFirma}`}
                            />
                            {row.kaynakFirma !== row.firmaAdi && (
                              <div className="mt-1 text-[9px] text-slate-400">Excel: {row.kaynakFirma}</div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input
                              value={row.yapilanIs}
                              onChange={(event) => updateParsedRow(index, 'yapilanIs', event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-800 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                            />
                            {row.not && <div className="mt-1 text-[9px] text-amber-700">Not: {row.not}</div>}
                          </td>
                          <td className="px-2 py-2 text-right font-black text-violet-700">{row.calismaSuresi.toFixed(1)}</td>
                          <td className={`px-2 py-2 font-bold ${row.firmaId ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {row.firmaId ? 'Eşleşti' : 'Cari bulunamadı'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {parseResult.warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900">
                <div className="mb-1 flex items-center gap-1 font-black"><AlertTriangle size={13} /> Kontrol notları ({parseResult.warnings.length})</div>
                <ul className="list-disc space-y-0.5 pl-4">{parseResult.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}</ul>
                {parseResult.warnings.length > 8 && <div className="mt-1 text-amber-700">… ve {parseResult.warnings.length - 8} not daha.</div>}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={handleImport} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700">
                <Upload size={14} /> Faaliyetlere Aktar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
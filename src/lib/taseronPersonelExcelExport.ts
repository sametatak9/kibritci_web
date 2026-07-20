import ExcelJS from 'exceljs';
import { KampKaydi, KampOdasi, Personel } from '../types/erp';
import { displayPersonelGorev } from './guvenlikHelpers';
import { formatPersonelKampYerlesim } from './taseronUtils';
import {
  CANONICAL_ANA_FIRMA_ADI,
  canonicalizeAnaFirmaAdi,
  isTaseronPersonel,
} from './yoklamaUtils';

export type PersonelExcelScope = 'taseron' | 'all';

function isAktif(p: Personel): boolean {
  return p.durum === true || String(p.durum).toLowerCase() === 'true';
}

function firmaTipiLabel(p: Personel): string {
  if (p.firmaTipi === 'TASERON' || isTaseronPersonel(p)) return 'Taşeron';
  return 'Ana Firma';
}

function firmaAdiLabel(p: Personel): string {
  if (isTaseronPersonel(p)) {
    const ad = String(p.firmaAdi || '').trim();
    return ad || '—';
  }
  return canonicalizeAnaFirmaAdi(p.firmaAdi);
}

function sortByFirmaThenName(a: Personel, b: Personel): number {
  const firma = firmaAdiLabel(a).localeCompare(firmaAdiLabel(b), 'tr');
  if (firma !== 0) return firma;
  return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr');
}

/** Taşeron firma personeli. */
export function collectTaseronPersoneller(
  personeller: Personel[],
  options?: { onlyActive?: boolean }
): Personel[] {
  return personeller
    .filter((p) => isTaseronPersonel(p))
    .filter((p) => (options?.onlyActive ? isAktif(p) : true))
    .sort(sortByFirmaThenName);
}

/** Ana firma dahil tüm firmaların personeli. */
export function collectTumFirmalarPersoneller(
  personeller: Personel[],
  options?: { onlyActive?: boolean }
): Personel[] {
  return personeller
    .filter((p) => (options?.onlyActive ? isAktif(p) : true))
    .sort(sortByFirmaThenName);
}

export async function exportPersonelExcel(options: {
  personeller: Personel[];
  scope?: PersonelExcelScope;
  onlyActive?: boolean;
  kampKayitlari?: KampKaydi[];
  kampOdalari?: KampOdasi[];
  fileNamePrefix?: string;
}): Promise<number> {
  const scope: PersonelExcelScope = options.scope || 'taseron';
  const rows =
    scope === 'all'
      ? collectTumFirmalarPersoneller(options.personeller, { onlyActive: options.onlyActive })
      : collectTaseronPersoneller(options.personeller, { onlyActive: options.onlyActive });

  if (rows.length === 0) {
    throw new Error(
      scope === 'all'
        ? 'Dışa aktarılacak personel bulunamadı.'
        : 'Dışa aktarılacak taşeron personeli bulunamadı.'
    );
  }

  const includeKamp = Boolean(options.kampKayitlari?.length || options.kampOdalari?.length);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kibritçi ERP';
  const sheetName = scope === 'all' ? 'Tüm Firmalar' : 'Taşeron Personel';
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const colCount = includeKamp ? 13 : 12;
  sheet.mergeCells(1, 1, 1, colCount);
  const title = sheet.getCell(1, 1);
  title.value =
    scope === 'all'
      ? `${CANONICAL_ANA_FIRMA_ADI} — Tüm Firmalar Personel Listesi (Ana Firma Dahil)`
      : `${CANONICAL_ANA_FIRMA_ADI} — Tüm Taşeron Firma Personeli`;
  title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4E78' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, colCount);
  const meta = sheet.getCell(2, 1);
  const stamp = new Date().toLocaleString('tr-TR');
  meta.value = `Oluşturma: ${stamp} · Kayıt: ${rows.length}${options.onlyActive ? ' (yalnız aktif)' : ''}`;
  meta.font = { name: 'Arial', size: 10, italic: true };
  meta.alignment = { horizontal: 'center', vertical: 'middle' };

  const headers = [
    'Firma Adı',
    'Firma Tipi',
    'Ad',
    'Soyad',
    'TC No',
    'Görev',
    'Departman',
    'Telefon',
    'İşe Giriş',
    'İşten Çıkış',
    'SGK Durumu',
    'Durum',
  ];
  if (includeKamp) headers.push('Kamp Yerleşimi');

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1E1E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  sheet.columns = [
    { width: 28 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    ...(includeKamp ? [{ width: 28 }] : []),
  ];

  rows.forEach((p) => {
    const values: (string | number)[] = [
      firmaAdiLabel(p),
      firmaTipiLabel(p),
      p.ad || '',
      p.soyad || '',
      p.tcNo || '',
      displayPersonelGorev(p),
      p.departman || '',
      p.telefonNo || '',
      p.iseGirisTarihi || '',
      p.istenCikisTarihi || '',
      p.sgkDurumu || '',
      isAktif(p) ? 'Aktif' : 'Pasif',
    ];
    if (includeKamp) {
      values.push(
        formatPersonelKampYerlesim(p, options.kampKayitlari || [], options.kampOdalari || []) || '—'
      );
    }
    const row = sheet.addRow(values);
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle' };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const day = new Date().toISOString().slice(0, 10);
  const prefix =
    options.fileNamePrefix ||
    (scope === 'all' ? 'Tum_Firmalar_Personel' : 'Taseron_Firma_Personel');
  const activeSuffix = options.onlyActive ? '_Aktif' : '';
  a.download = `${prefix}${activeSuffix}_${day}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

/** Geriye dönük uyumluluk — yalnızca taşeron. */
export async function exportTaseronPersonelExcel(options: {
  personeller: Personel[];
  onlyActive?: boolean;
  kampKayitlari?: KampKaydi[];
  kampOdalari?: KampOdasi[];
  fileNamePrefix?: string;
}): Promise<number> {
  return exportPersonelExcel({ ...options, scope: 'taseron' });
}

/** Ana firma dahil tüm firmalar. */
export async function exportTumFirmalarPersonelExcel(options: {
  personeller: Personel[];
  onlyActive?: boolean;
  kampKayitlari?: KampKaydi[];
  kampOdalari?: KampOdasi[];
  fileNamePrefix?: string;
}): Promise<number> {
  return exportPersonelExcel({ ...options, scope: 'all' });
}

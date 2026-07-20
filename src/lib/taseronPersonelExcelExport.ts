import ExcelJS from 'exceljs';
import { KampKaydi, KampOdasi, Personel } from '../types/erp';
import { displayPersonelGorev } from './guvenlikHelpers';
import { formatPersonelKampYerlesim } from './taseronUtils';
import { isTaseronPersonel } from './yoklamaUtils';

function isAktif(p: Personel): boolean {
  return p.durum === true || String(p.durum).toLowerCase() === 'true';
}

/** Tüm taşeron firma personeli (firmaTipi TASERON veya ana firma dışı firma adı). */
export function collectTaseronPersoneller(
  personeller: Personel[],
  options?: { onlyActive?: boolean }
): Personel[] {
  return personeller
    .filter((p) => isTaseronPersonel(p))
    .filter((p) => (options?.onlyActive ? isAktif(p) : true))
    .sort((a, b) => {
      const firma = String(a.firmaAdi || '').localeCompare(String(b.firmaAdi || ''), 'tr');
      if (firma !== 0) return firma;
      return `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, 'tr');
    });
}

export async function exportTaseronPersonelExcel(options: {
  personeller: Personel[];
  onlyActive?: boolean;
  kampKayitlari?: KampKaydi[];
  kampOdalari?: KampOdasi[];
  fileNamePrefix?: string;
}): Promise<number> {
  const rows = collectTaseronPersoneller(options.personeller, {
    onlyActive: options.onlyActive,
  });
  if (rows.length === 0) {
    throw new Error('Dışa aktarılacak taşeron personeli bulunamadı.');
  }

  const includeKamp = Boolean(options.kampKayitlari?.length || options.kampOdalari?.length);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kibritçi ERP';
  const sheet = workbook.addWorksheet('Taşeron Personel', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const colCount = includeKamp ? 13 : 12;
  sheet.mergeCells(1, 1, 1, colCount);
  const title = sheet.getCell(1, 1);
  title.value = 'Kibritçi İnşaat — Tüm Taşeron Firma Personeli';
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
      p.firmaAdi || '—',
      p.firmaTipi === 'TASERON' ? 'Taşeron' : p.firmaTipi === 'ANA_FIRMA' ? 'Ana Firma' : 'Taşeron',
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
  const prefix = options.fileNamePrefix || 'Taseron_Firma_Personel';
  const activeSuffix = options.onlyActive ? '_Aktif' : '';
  a.download = `${prefix}${activeSuffix}_${day}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

import { KasaHareketi } from '../types/erp';
import { createExcelWorkbook } from './exceljsLoader';

export async function exportKasaExcel(kasaHareketleri: KasaHareketi[], startDate: string, endDate: string): Promise<void> {
  const workbook = await createExcelWorkbook();
  const sheet = workbook.addWorksheet('Haftalık Kasa', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Top header
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Haftalık Kasa Raporu';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E4E78' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:D2');
  const dateCell = sheet.getCell('A2');
  dateCell.value = `Dönem: ${startDate} - ${endDate}`;
  dateCell.font = { name: 'Arial', size: 11, italic: true };
  dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Headers
  const headers = ['TARİH', 'HAREKET TİPİ', 'AÇIKLAMA', 'TUTAR'];
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1E1E' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Columns Width
  sheet.columns = [
    { key: 'tarih', width: 15 },
    { key: 'hareketTipi', width: 20 },
    { key: 'aciklama', width: 50 },
    { key: 'tutar', width: 15 }
  ];

  // Data Rows
  let totalIn = 0;
  let totalOut = 0;

  kasaHareketleri.forEach(kh => {
    const row = sheet.addRow([
      kh.tarih,
      kh.hareketTipi,
      kh.aciklama,
      kh.tutar
    ]);

    if (kh.hareketTipi === 'GİRİŞ') totalIn += kh.tutar;
    else totalOut += kh.tutar;

    row.getCell(4).numFmt = '#,##0.00 "₺"';

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle' };
    });
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // Totals Row
  sheet.addRow([]);
  const totalsRow = sheet.addRow(['', '', 'TOPLAM GİRİŞ:', totalIn]);
  totalsRow.getCell(3).font = { bold: true };
  totalsRow.getCell(4).font = { bold: true };
  totalsRow.getCell(4).numFmt = '#,##0.00 "₺"';

  const totalsOutRow = sheet.addRow(['', '', 'TOPLAM ÇIKIŞ:', totalOut]);
  totalsOutRow.getCell(3).font = { bold: true };
  totalsOutRow.getCell(4).font = { bold: true };
  totalsOutRow.getCell(4).numFmt = '#,##0.00 "₺"';

  const netRow = sheet.addRow(['', '', 'NET DURUM:', totalIn - totalOut]);
  netRow.getCell(3).font = { bold: true, color: { argb: 'FF1E4E78' } };
  netRow.getCell(4).font = { bold: true, color: { argb: 'FF1E4E78' } };
  netRow.getCell(4).numFmt = '#,##0.00 "₺"';

  // Export
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Haftalik_Kasa_${startDate}_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

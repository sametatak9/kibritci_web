import { LegacyExcelMonthData } from './legacyExcelYoklama';

const ALL = Array.from({ length: 31 }, (_, i) => i + 1);
/** Mayıs 2026 Pazar günleri (31. gün bayram — yine de çalışma kaydı var) */
const SUN = [3, 10, 17, 24];
const STD = ALL.filter(d => !SUN.includes(d));
const STD_IZIN = SUN;

const MAY1_12 = [1, 2, 4, 5, 6, 7, 8, 9, 11, 12];
const MAY1_12_IZIN = [3, 10];
const MAY1_17 = [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16];
const MAY1_17_IZIN = [3, 10];

const E8 = [1, 10, 17, 24, 30, 31];
const E8_19 = [1, 10, 17, 19, 24, 30, 31];

function m1e8(days: number[], e8: number[] = E8): Record<number, number> {
  const r: Record<number, number> = {};
  days.forEach(d => { r[d] = e8.includes(d) ? 8 : 1; });
  return r;
}

function m3e8(days: number[], e8: number[] = E8_19): Record<number, number> {
  const r: Record<number, number> = {};
  days.forEach(d => { r[d] = e8.includes(d) ? 8 : 3; });
  return r;
}

/** Mayıs 2026 — 3 ekran görüntüsü (satır 1–70) */
export const MAYIS_2026_YOKLAMA: LegacyExcelMonthData = {
  year: 2026,
  month: 5,
  personeller: [
    // — Resim 1 (1–30) —
    { excelId: 1, ad: 'MUTLU', soyad: 'ŞİMŞEK', gorev: 'FORMEN', maas: 60000, iseGirisTarihi: '2026-03-07', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 8, 4: 5, 5: 8, 6: 6, 7: 4, 8: 5, 9: 3, 10: 14, 11: 4, 12: 7, 14: 6, 15: 2, 16: 2, 17: 8, 18: 7, 19: 13, 20: 2, 21: 3, 23: 2, 24: 8, 30: 8, 31: 8 } },
    { excelId: 2, ad: 'ŞAHİN', soyad: 'ŞAHİNOĞLU', gorev: 'FORMEN', maas: 60000, iseGirisTarihi: '2026-03-07', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 4, 6: 3, 8: 3, 9: 8, 10: 3, 11: 4, 12: 3, 16: 3, 18: 3, 19: 12, 23: 3, 24: 8, 30: 8, 31: 8 } },
    { excelId: 3, ad: 'YASİN', soyad: 'EFE', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-03-24', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 3, 6: 3, 8: 3, 9: 8, 10: 3, 18: 3, 19: 3, 23: 3, 24: 8, 30: 8, 31: 8 } },
    { excelId: 4, ad: 'YUNUS', soyad: 'POLAT', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-03-24', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 10: 3, 11: 3, 12: 3, 13: 3, 14: 3 } },
    { excelId: 5, ad: 'VEYSİ', soyad: 'DOĞAN', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-03-24', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 10: 3, 11: 3, 12: 3, 13: 3, 14: 5 } },
    { excelId: 6, ad: 'İSMAİL', soyad: 'MALKOÇ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-03-04', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, [30, 31]) },
    { excelId: 7, ad: 'MUHAMMED', soyad: 'ÇELİK', gorev: 'ŞOFÖR', maas: 30000, iseGirisTarihi: '2026-04-13', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 9, 2: 4, 7: 4, 8: 4, 9: 8, 10: 4, 11: 4, 12: 4, 14: 4, 15: 8, 18: 4, 24: 8 } },
    { excelId: 8, ad: 'YUSUF ALİ', soyad: 'ŞİŞİK', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-04', calismaGunleri: [1, 2, 4], izinliGunleri: [3], mesaiGunleri: { 4: 4 } },
    { excelId: 9, ad: 'ENES', soyad: 'BULUT', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-03-24', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 1, 6: 1, 7: 3, 8: 1, 9: 1, 10: 8, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 8, 18: 4, 19: 11, 20: 1, 21: 3, 22: 1, 23: 1, 24: 8, 25: 1, 26: 1, 27: 1, 28: 1, 29: 1, 30: 8, 31: 8 } },
    { excelId: 10, ad: 'EMRAH', soyad: 'VANER', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-02', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, [1, 10, 17, 19, 24, 30, 31]) },
    { excelId: 11, ad: 'EYÜP', soyad: 'VANER', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-02', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8) },
    { excelId: 12, ad: 'ABDURRAHMAN', soyad: 'ÇİTO', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-12', calismaGunleri: MAY1_12, izinliGunleri: MAY1_12_IZIN },
    { excelId: 13, ad: 'ALİ SAMET', soyad: 'VANER', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-02', calismaGunleri: STD.filter(d => d < 13 || d > 17), izinliGunleri: [...STD_IZIN, 13, 14, 15, 16, 17], mesaiGunleri: m1e8(STD.filter(d => d < 13 || d > 17), E8) },
    { excelId: 14, ad: 'HARUN', soyad: 'ADIYAMAN', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-12', calismaGunleri: [1, 2, 4, 5, 6, 9], izinliGunleri: [3, 7, 8, 10] },
    { excelId: 15, ad: 'FURKAN', soyad: 'HİÇDÖNMEZ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-03-27', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8_19) },
    { excelId: 16, ad: 'TANER', soyad: 'AKTAŞ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2025-11-01', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, []) },
    { excelId: 17, ad: 'MEHMET', soyad: 'TURHAN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-03-30', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8) },
    { excelId: 18, ad: 'SEDAT', soyad: 'ÇITANAK', gorev: 'ŞOFÖR', maas: 30000, iseGirisTarihi: '2026-03-30', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 8, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 8, 18: 2, 19: 8, 20: 2, 21: 2, 22: 2, 23: 2, 24: 8, 25: 1, 26: 4, 27: 8, 28: 1, 29: 1, 30: 8, 31: 8 } },
    { excelId: 19, ad: 'MEVLÜT SEFA', soyad: 'BÜLBÜL', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-21', calismaGunleri: MAY1_12, izinliGunleri: [...MAY1_12_IZIN, 13, 14, 15, 16, 17, 18, 19, 20, 21], mesaiGunleri: { 1: 8, 10: 8, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1, 12: 1 } },
    { excelId: 20, ad: 'RECEP', soyad: 'SOLAK', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-12', calismaGunleri: MAY1_12, izinliGunleri: MAY1_12_IZIN, mesaiGunleri: { 1: 8, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1, 12: 1 } },
    { excelId: 21, ad: 'MUSA', soyad: 'MULLAOĞLU', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-12', calismaGunleri: MAY1_12, izinliGunleri: MAY1_12_IZIN, mesaiGunleri: { 1: 8 } },
    { excelId: 22, ad: 'HAKAN', soyad: 'ZORLU', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-10', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8) },
    { excelId: 23, ad: 'OLCAY', soyad: 'AYDIN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-10', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8) },
    { excelId: 24, ad: 'TAHSİN', soyad: 'OTMAN', gorev: 'TESİSATÇI', maas: 45000, iseGirisTarihi: '2026-04-13', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m3e8(STD, E8_19) },
    { excelId: 25, ad: 'MEDETULLAH', soyad: 'DEMİR', gorev: 'TESİSATÇI', maas: 45000, iseGirisTarihi: '2026-04-13', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m3e8(STD, E8) },
    { excelId: 26, ad: 'FIRAT', soyad: 'SAYGIN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-14', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8_19) },
    { excelId: 27, ad: 'TUNCAY', soyad: 'KOTAN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-14', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, E8_19) },
    { excelId: 28, ad: 'SERVET', soyad: 'ÖZKALSIN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-15', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: m1e8(STD, [1, 17, 19, 24]) },
    { excelId: 29, ad: 'METİN', soyad: 'ASLANER', gorev: 'ŞOFÖR', maas: 30000, iseGirisTarihi: '2026-04-16', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { ...m1e8(STD, [1, 10, 17, 19, 24, 30, 31]), 18: 3 } },
    { excelId: 30, ad: 'MEHMET', soyad: 'POLAT', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-17', calismaGunleri: MAY1_17, izinliGunleri: MAY1_17_IZIN, mesaiGunleri: { 1: 8, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 } },
    // — Resim 2 (31–54) —
    { excelId: 31, ad: 'MEVLAN', soyad: 'SARI', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-16', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 8, 5: 1, 6: 1, 7: 1, 8: 8, 9: 1, 11: 1, 12: 1, 13: 3, 14: 3, 15: 3, 16: 8, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 8, 29: 8 } },
    { excelId: 32, ad: 'SAMET', soyad: 'SARI', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-20', calismaGunleri: STD.filter(d => d <= 20), izinliGunleri: STD_IZIN.filter(d => d <= 20), mesaiGunleri: { 1: 3, 2: 3, 16: 3 } },
    { excelId: 33, ad: 'ARDA', soyad: 'SARI', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-24', calismaGunleri: STD.filter(d => d <= 24), izinliGunleri: STD_IZIN.filter(d => d <= 24), mesaiGunleri: m1e8(STD.filter(d => d <= 24), []) },
    { excelId: 34, ad: 'İSMAİL', soyad: 'SEVGİLİ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-30', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 4, 9: 8, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 8, 18: 1, 19: 8, 20: 1, 21: 1, 22: 1, 23: 1, 25: 1, 26: 1, 27: 1, 28: 1, 29: 8 } },
    { excelId: 35, ad: 'AZİZ', soyad: 'GÜLER', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-28', calismaGunleri: STD.filter(d => d !== 7 && d !== 22), izinliGunleri: [...STD_IZIN, 7, 22], mesaiGunleri: m1e8(STD.filter(d => d !== 7 && d !== 22), []) },
    { excelId: 36, ad: 'HÜSEYİN SAMET', soyad: 'ATAK', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-20', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 2, 4: 8, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 8, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 8, 18: 2, 19: 8, 20: 2, 21: 2, 22: 2, 23: 2, 24: 8, 25: 2, 26: 2, 27: 2, 28: 2, 29: 8 } },
    { excelId: 37, ad: 'ÖMER', soyad: 'SARI', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-04-21', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 3, 12: 3, 16: 8, 18: 3, 19: 8, 20: 3, 21: 3 } },
    { excelId: 38, ad: 'MUHAMMED', soyad: 'ALTINTAŞ', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-04-21', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 3, 12: 3, 16: 8, 18: 3, 19: 8, 20: 3, 21: 3 } },
    { excelId: 39, ad: 'CEVDET', soyad: 'ÜLEZ', gorev: 'MERMERCİ', maas: 60000, iseGirisTarihi: '2026-04-21', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 18: 8 } },
    { excelId: 40, ad: 'CEMİL', soyad: 'ÇETİM', gorev: 'USTA', maas: 60000, istenCikisTarihi: '2026-05-02', calismaGunleri: [1], izinliGunleri: [2] },
    { excelId: 41, ad: 'İSLAM', soyad: 'ÜLEZ', gorev: 'MERMERCİ', maas: 45000, iseGirisTarihi: '2026-04-25', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 18: 8 } },
    { excelId: 42, ad: 'DOĞUŞ', soyad: 'IRGI', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-07', calismaGunleri: [1, 2, 4, 6, 8, 9], izinliGunleri: [3, 5, 7] },
    { excelId: 43, ad: 'HAMZA', soyad: 'TOĞMUŞ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-27', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 1, 4: 2, 5: 2, 6: 2, 7: 8, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 8, 18: 2, 19: 9, 20: 3, 21: 2, 23: 1, 26: 8, 27: 8, 28: 8, 29: 8 } },
    { excelId: 44, ad: 'İBRAHİM', soyad: 'TUNÇ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-27', calismaGunleri: STD.filter(d => d !== 2), izinliGunleri: [...STD_IZIN, 2], mesaiGunleri: { ...m1e8(STD.filter(d => d !== 2), [23, 29]) } },
    { excelId: 45, ad: 'SİDAR', soyad: 'KÖSEN', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-01', calismaGunleri: [1] },
    { excelId: 46, ad: 'YAVUZ', soyad: 'BEYAZDUMAN', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-02', calismaGunleri: [1], izinliGunleri: [2] },
    { excelId: 47, ad: 'EMRE', soyad: 'DİNÇ', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-02', calismaGunleri: [1], izinliGunleri: [2] },
    { excelId: 48, ad: 'ADEM', soyad: 'ÇAĞLAR', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-28', calismaGunleri: STD.filter(d => d !== 7 && d !== 22), izinliGunleri: [...STD_IZIN, 7, 22], mesaiGunleri: m1e8(STD.filter(d => d !== 7 && d !== 22), []) },
    { excelId: 49, ad: 'EMRE', soyad: 'PEKMEZ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-04-30', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 1, 5: 1, 6: 1, 7: 1, 8: 4, 9: 8, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 8, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 25: 1, 26: 1, 27: 1, 28: 1, 29: 8 } },
    { excelId: 50, ad: 'KASIM', soyad: 'DOĞAN', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-04-09', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 18: 8, 21: 3 } },
    { excelId: 51, ad: 'ERCAN', soyad: 'AYBUĞA', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-20', calismaGunleri: [1, 2, 4, 6, 8, 9, 11, 12, 14, 15, 18, 19, 21, 22, 25, 26], izinliGunleri: [3, 5, 7, 10, 13, 16, 17, 20, 23, 24] },
    { excelId: 52, ad: 'MAHMUT', soyad: 'SARI', gorev: 'USTA', maas: 60000, iseGirisTarihi: '2026-05-02', calismaGunleri: STD, izinliGunleri: STD_IZIN, mesaiGunleri: { 1: 8, 2: 3, 4: 8, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 11: 3, 12: 3, 16: 8, 18: 3, 19: 8, 20: 3, 21: 3 } },
    { excelId: 53, ad: 'NUSRET', soyad: 'AKGÜL', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-13', calismaGunleri: [], izinliGunleri: [1, 2, 3] },
    { excelId: 54, ad: 'MEHMET EMİN', soyad: 'ASLAN', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-06', calismaGunleri: [6] },
    // — Resim 3 (55–70) —
    { excelId: 55, ad: 'YUSUF', soyad: 'ESENBOĞA', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-13', calismaGunleri: [13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 25, 28, 30, 31], izinliGunleri: [22, 24, 26, 27], mesaiGunleri: { 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 8, 20: 1, 21: 1, 23: 1, 25: 1 } },
    { excelId: 56, ad: 'NİHAT', soyad: 'ÖZER', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-15', calismaGunleri: [13], izinliGunleri: [14, 15] },
    { excelId: 57, ad: 'ENGİN', soyad: 'TARHAN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-13', calismaGunleri: [14, 15, 17, 19, 21, 22, 24, 25, 28, 30, 31], izinliGunleri: [16, 18, 20, 23, 26, 27], mesaiGunleri: { 14: 1, 15: 1, 17: 1, 19: 8, 21: 1, 22: 1, 24: 1, 25: 1 } },
    { excelId: 58, ad: 'ONUR', soyad: 'ÖZKANTAR', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-15', calismaGunleri: [] },
    { excelId: 59, ad: 'SEFA', soyad: 'GÜNEŞ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-15', calismaGunleri: [15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 28, 30, 31], izinliGunleri: [24, 27], mesaiGunleri: { 15: 1, 16: 1, 17: 8, 18: 1, 19: 8, 20: 1, 21: 1, 22: 1, 23: 1, 25: 1, 26: 1, 28: 1, 30: 1, 31: 1 } },
    { excelId: 60, ad: 'DENİZ', soyad: 'ÜNEY', gorev: 'DÜZ İŞÇİ', maas: 30000, istenCikisTarihi: '2026-05-21', calismaGunleri: [13, 14, 15, 16, 17, 18, 19, 20, 21], mesaiGunleri: { 13: 1, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 4, 20: 1, 21: 1 } },
    { excelId: 61, ad: 'SADIK', soyad: 'UYSAL', gorev: 'DÜZ İŞÇİ', maas: 24000, iseGirisTarihi: '2026-05-18', calismaGunleri: [18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 30, 31], izinliGunleri: [22], mesaiGunleri: { 18: 1, 19: 8, 20: 1, 21: 1, 23: 1, 24: 8, 25: 1, 26: 1, 27: 1, 28: 8, 30: 8, 31: 8 } },
    { excelId: 62, ad: 'İLHAN', soyad: 'ALPAR', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-18', calismaGunleri: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31], mesaiGunleri: { 18: 1, 19: 8, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 28: 8, 30: 8, 31: 8 } },
    { excelId: 63, ad: 'AZİZ', soyad: 'ÖZ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-18', calismaGunleri: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31], mesaiGunleri: { 19: 8, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 28: 8, 30: 1, 31: 8 } },
    { excelId: 64, ad: 'NEZİH', soyad: 'SERT', gorev: 'DÜZ İŞÇİ', maas: 35000, iseGirisTarihi: '2026-05-18', calismaGunleri: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31], mesaiGunleri: { 18: 3, 19: 8, 20: 3, 21: 3, 23: 3, 24: 3, 25: 9, 26: 3, 27: 4, 28: 8, 30: 8, 31: 8 } },
    { excelId: 65, ad: 'FERHAT', soyad: 'YAVUZKILIÇ', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-20', calismaGunleri: [20, 21, 23, 24, 25, 26, 27, 28, 30, 31], izinliGunleri: [22], mesaiGunleri: { 20: 1, 21: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 28: 8, 30: 1, 31: 8 } },
    { excelId: 66, ad: 'HAKAN', soyad: 'DEMİRBOĞA', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-20', calismaGunleri: [20, 21, 23, 24, 25, 26, 27, 28, 30, 31], izinliGunleri: [22], mesaiGunleri: { 20: 1, 21: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 1, 28: 8, 30: 1, 31: 8 } },
    { excelId: 67, ad: 'UĞUR', soyad: 'DURUKHAN', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-11', calismaGunleri: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31], mesaiGunleri: { 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1, 17: 8, 18: 1, 19: 8, 20: 1, 21: 1, 22: 4, 23: 1, 24: 8, 25: 1, 26: 1, 27: 8, 28: 8, 30: 8, 31: 8 } },
    { excelId: 68, ad: 'AZAD', soyad: 'DEMİR', gorev: 'DÜZ İŞÇİ', maas: 30000, iseGirisTarihi: '2026-05-25', calismaGunleri: [25, 26, 27, 28, 30, 31], mesaiGunleri: { 25: 1, 26: 1, 28: 8, 30: 8, 31: 8 } },
    { excelId: 69, ad: 'SEYHAN', soyad: 'TOKLUCU', gorev: 'USTA', maas: 60000, calismaGunleri: ALL, mesaiGunleri: { 20: 8, 21: 8, 22: 6 } },
    { excelId: 70, ad: 'SEZER', soyad: 'GÜVEN', gorev: 'USTA', maas: 60000, calismaGunleri: ALL, mesaiGunleri: { 22: 6 } },
  ],
};

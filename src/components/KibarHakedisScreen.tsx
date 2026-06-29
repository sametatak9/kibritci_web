import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Calendar, Printer, ShieldCheck, CheckCircle2,
  RefreshCw, UserX
} from 'lucide-react';
import { db, saveDocument } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Personel, AylikYoklamaMap } from '../types/erp';
import { buildPersonelListForMonth, iterateMonthYoklama } from '../lib/yoklamaUtils';
import { resolveStubPersonelFromLegacyId } from '../lib/legacyYoklamaImport';
import { normalizeGorev } from '../lib/gorevUtils';
import {
  prepareSahaFaaliyetRaporu,
  prepareKampFaaliyetRaporu,
  faaliyetIsTanimi,
  formatPersonelSayisi,
} from '../lib/kibarReportUtils';

interface KibarHakedisScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
  sahaFaaliyetleri: any[];
  currentUser: any;
}

interface StaffHakedisRow {
  personel: Personel;
  geldiGun: number;
  mesaiSaat: number;
  gunKazanci: number;
  mesaiKazanci: number;
  toplamKazanc: number;
  zerYapiHakedis: number;
}

const ZER_YAPI_GUNLUK = 200;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function calcGunKazanci(personel: Personel, geldiGun: number, year: number, month: number): number {
  if (geldiGun <= 0) return 0;
  const baseWage = personel.maas || 30000;
  return geldiGun * (baseWage / daysInMonth(year, month));
}

function calcMesaiKazanci(personel: Personel, mesaiSaat: number, year: number, month: number): number {
  if (mesaiSaat <= 0) return 0;
  const baseWage = personel.maas || 30000;
  const hourlyWage = baseWage / daysInMonth(year, month) / 7.5;
  return mesaiSaat * hourlyWage * 1.5;
}

function formatMoney(amount: number, fraction = 2): string {
  return `₺${amount.toLocaleString('tr-TR', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  })}`;
}

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function filterByMonth(items: { tarih?: string }[], year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return items.filter(item => (item.tarih || '').startsWith(prefix));
}

export const KibarHakedisScreen: React.FC<KibarHakedisScreenProps> = ({
  personeller,
  yoklamalar,
  sahaFaaliyetleri,
  currentUser
}) => {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(5);
  const [kampFaaliyetleri, setKampFaaliyetleri] = useState<any[]>([]);
  const [excludedStaffIds, setExcludedStaffIds] = useState<string[]>([]);
  const [reportType, setReportType] = useState<'NORMAL' | 'E-IMZALI'>('NORMAL');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const donemLabel = `${TURKISH_MONTHS[selectedMonth - 1]} ${selectedYear}`;
  const donemKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  useEffect(() => {
    const unsubKamp = onSnapshot(collection(db, 'kampGunlukFaaliyetleri'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setKampFaaliyetleri(list);
    });
    return () => unsubKamp();
  }, []);

  const monthPersoneller = useMemo(
    () => buildPersonelListForMonth(personeller, yoklamalar, selectedYear, selectedMonth, resolveStubPersonelFromLegacyId),
    [personeller, yoklamalar, selectedYear, selectedMonth]
  );

  const allStaffRows = useMemo((): StaffHakedisRow[] => {
    const rows: StaffHakedisRow[] = [];
    monthPersoneller.forEach(p => {
      let geldiGun = 0;
      let mesaiSaat = 0;
      iterateMonthYoklama(yoklamalar[p.id], selectedYear, selectedMonth, (_day, data) => {
        if (data?.durum === 'Geldi') geldiGun++;
        mesaiSaat += data?.mesaiSaati || 0;
      });
      if (geldiGun > 0) {
        const gunKazanci = calcGunKazanci(p, geldiGun, selectedYear, selectedMonth);
        const mesaiKazanci = calcMesaiKazanci(p, mesaiSaat, selectedYear, selectedMonth);
        rows.push({
          personel: p,
          geldiGun,
          mesaiSaat,
          gunKazanci,
          mesaiKazanci,
          toplamKazanc: gunKazanci + mesaiKazanci,
          zerYapiHakedis: geldiGun * ZER_YAPI_GUNLUK,
        });
      }
    });
    return rows.sort((a, b) =>
      `${a.personel.ad} ${a.personel.soyad}`.localeCompare(`${b.personel.ad} ${b.personel.soyad}`, 'tr')
    );
  }, [monthPersoneller, yoklamalar, selectedYear, selectedMonth]);

  const activeStaffRows = allStaffRows.filter(r => !excludedStaffIds.includes(r.personel.id));

  const monthlySahaFaaliyetleri = useMemo(
    () => filterByMonth(sahaFaaliyetleri, selectedYear, selectedMonth),
    [sahaFaaliyetleri, selectedYear, selectedMonth]
  );

  const monthlyKampFaaliyetleri = useMemo(
    () => filterByMonth(kampFaaliyetleri, selectedYear, selectedMonth),
    [kampFaaliyetleri, selectedYear, selectedMonth]
  );

  const sahaFaaliyetSatirlari = useMemo(
    () => prepareSahaFaaliyetRaporu(monthlySahaFaaliyetleri),
    [monthlySahaFaaliyetleri]
  );

  const kampFaaliyetSatirlari = useMemo(
    () => prepareKampFaaliyetRaporu(monthlyKampFaaliyetleri),
    [monthlyKampFaaliyetleri]
  );

  const totalPersonDays = activeStaffRows.reduce((s, r) => s + r.geldiGun, 0);
  const totalMesaiSaat = activeStaffRows.reduce((s, r) => s + r.mesaiSaat, 0);
  const totalGunKazanci = activeStaffRows.reduce((s, r) => s + r.gunKazanci, 0);
  const totalMesaiKazanci = activeStaffRows.reduce((s, r) => s + r.mesaiKazanci, 0);
  const totalMaasKazanci = activeStaffRows.reduce((s, r) => s + r.toplamKazanc, 0);
  const totalZerYapiHakedis = activeStaffRows.reduce((s, r) => s + r.zerYapiHakedis, 0);

  const handleExcludeStaff = (staffId: string) => {
    setExcludedStaffIds(prev => [...prev, staffId]);
  };

  const handleIncludeStaff = (staffId: string) => {
    setExcludedStaffIds(prev => prev.filter(id => id !== staffId));
  };

  const handleSaveReport = async () => {
    setLoading(true);
    try {
      const reportId = `ZER-YAPI-HKD-${donemKey}-${Date.now()}`;
      await saveDocument('kibarHakedisRaporlari', {
        id: reportId,
        donem: donemKey,
        donemLabel,
        yil: selectedYear,
        ay: selectedMonth,
        personelSayisi: activeStaffRows.length,
        toplamCalismaGunu: totalPersonDays,
        birimFiyat: ZER_YAPI_GUNLUK,
        toplamTutar: totalZerYapiHakedis,
        toplamMaasKazanci: totalMaasKazanci,
        olusturan: currentUser?.email || 'sametatak9@gmail.com',
        olusturmaTarihi: new Date().toISOString(),
        faaliyetlerCount: monthlySahaFaaliyetleri.length + monthlyKampFaaliyetleri.length,
        durum: 'KAYDEDİLDİ',
        raporTipi: 'ZER_YAPI_HAKEDIS',
      });
      showStatus('success', `${donemLabel} ZER YAPI Hakediş Raporu kaydedildi!`);
    } catch (err: any) {
      showStatus('error', `Rapor kaydedilirken hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('kibar-report-print-area')?.innerHTML;
    if (!printContent) return;

    const printCss = `
      @page { size: A4 portrait; margin: 10mm 8mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0; background: #fff; color: #0f172a;
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; line-height: 1.35;
      }
      .report-root { width: 100%; max-width: 194mm; margin: 0 auto; }
      section, div, table { overflow: visible !important; max-height: none !important; height: auto !important; }
      section { page-break-inside: auto !important; break-inside: auto !important; margin-bottom: 6mm; }
      table { width: 100%; border-collapse: collapse; table-layout: auto; page-break-inside: auto !important; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      th, td { padding: 2px 4px; vertical-align: top; word-wrap: break-word; }
      svg { display: none !important; }
      .rpt-banner { background: #1E4E78; color: #fff; padding: 8px 10px; border-radius: 6px 6px 0 0; }
      .rpt-banner-sub { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px; text-align: center; font-weight: 700; font-size: 9pt; color: #065f46; }
      .rpt-zer-box {
        border: 2px solid #059669; background: #ecfdf5; border-radius: 8px;
        padding: 10px 12px; margin: 8px 0 10px; page-break-inside: avoid;
      }
      .rpt-zer-box h4 { margin: 0 0 6px; font-size: 9pt; color: #065f46; text-transform: uppercase; letter-spacing: 0.04em; }
      .rpt-zer-formula { font-size: 8pt; color: #047857; margin: 0 0 4px; }
      .rpt-zer-total { font-size: 16pt; font-weight: 800; color: #047857; font-family: Consolas, monospace; }
      .rpt-zer-meta { font-size: 7.5pt; color: #059669; margin-top: 4px; }
      .rpt-sec-title { font-size: 8.5pt; font-weight: 800; color: #1E4E78; text-transform: uppercase; margin: 0 0 4px; }
      .rpt-sec-sub { font-size: 7pt; color: #64748b; margin: 0 0 6px; }
      .rpt-table-wrap { border: 1px solid #cbd5e1; border-radius: 6px; margin-top: 4px; }
      .rpt-th-dark { background: #1e293b; color: #fff; font-size: 7pt; font-weight: 700; text-transform: uppercase; }
      .rpt-th-blue { background: #1d4ed8; color: #fff; }
      .rpt-th-amber { background: #d97706; color: #fff; }
      .rpt-th-indigo { background: #4338ca; color: #fff; }
      .rpt-th-emerald { background: #059669; color: #fff; }
      .rpt-td-blue { background: #eff6ff; color: #1e40af; text-align: right; font-family: Consolas, monospace; }
      .rpt-td-amber { background: #fffbeb; color: #92400e; text-align: right; font-family: Consolas, monospace; }
      .rpt-td-indigo { background: #eef2ff; color: #312e81; text-align: right; font-weight: 700; font-family: Consolas, monospace; }
      .rpt-td-emerald { background: #ecfdf5; color: #065f46; text-align: right; font-weight: 800; font-family: Consolas, monospace; }
      .rpt-foot { background: #f1f5f9; font-weight: 700; border-top: 2px solid #94a3b8; }
      .rpt-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
      .rpt-summary-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; }
      .rpt-summary-emerald { border: 2px solid #059669; background: #ecfdf5; }
      .rpt-sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
      .rpt-sign-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; min-height: 52px; }
      @media print {
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    const htmlSnippet = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>ZER_YAPI_Hakedis_${donemKey}</title>
      <style>${printCss}</style>
      </head><body><div class="report-root">${printContent}</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlSnippet);
      win.document.close();
    }
  };

  return (
    <div className="flex-grow p-6 space-y-6 overflow-y-auto h-full font-sans bg-slate-50">

      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 font-black">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider block w-fit">
              ZER YAPI ÖZEL ERİŞİM
            </span>
            <h1 className="text-lg font-black tracking-tight mt-1 text-white">ZER YAPI HAKEDİŞ DÜZENLEME PANELİ</h1>
            <p className="text-[11px] text-slate-400">Aylık yoklama ve saha faaliyetlerine göre dönemsel hakediş raporu</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-2 px-3">
            <Calendar size={14} className="text-emerald-500" />
            <select
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(Number(e.target.value)); setExcludedStaffIds([]); }}
              className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
            >
              {TURKISH_MONTHS.map((m, i) => (
                <option key={m} value={i + 1} className="text-slate-900">{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(Number(e.target.value)); setExcludedStaffIds([]); }}
              className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y} className="text-slate-900">{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveReport}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer flex items-center space-x-1"
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            <span>Raporu Kaydet</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl border text-xs font-bold ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {statusMsg.type === 'success' ? '✓' : '⚠️'} {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">DÖNEM: {donemLabel}</span>
              <h3 className="text-xs font-black text-slate-800 mt-0.5">Personel Listesi ({allStaffRows.length})</h3>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Seçilen ayda en az 1 gün &quot;Geldi&quot; kaydı olan personeller. Hakedişten çıkarmak istediklerinizi işaretleyin.
              </p>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {allStaffRows.length === 0 ? (
                <div className="text-center py-8 text-slate-400 italic text-[11px]">
                  {donemLabel} döneminde yoklama kaydı bulunamadı. Yoklama ekranından Excel aktarımını yapın.
                </div>
              ) : (
                allStaffRows.map(({ personel: p, geldiGun, mesaiSaat, gunKazanci, mesaiKazanci, toplamKazanc, zerYapiHakedis }) => {
                  const isExcluded = excludedStaffIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex justify-between items-center p-2.5 rounded-xl border transition ${
                        isExcluded ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' : 'bg-slate-50/40 border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className={`text-xs font-bold block ${isExcluded ? 'line-through' : 'text-slate-800'}`}>
                          {p.ad} {p.soyad}
                        </span>
                        <span className="text-[9px] text-slate-500 block uppercase font-semibold">
                          {normalizeGorev(p.gorev)} • {geldiGun} gün
                          {mesaiSaat > 0 && ` • ${mesaiSaat} sa mesai`}
                        </span>
                        <span className="text-[8px] text-blue-700 block">
                          Gün kaz.: {formatMoney(gunKazanci)}
                          {mesaiKazanci > 0 && ` + Mesai: ${formatMoney(mesaiKazanci)}`}
                          {' = '}{formatMoney(toplamKazanc)}
                        </span>
                        <span className="text-[8px] text-emerald-700 font-bold block">
                          ZER YAPI: {formatMoney(zerYapiHakedis, 0)} ({geldiGun}×{ZER_YAPI_GUNLUK})
                        </span>
                      </div>
                      {isExcluded ? (
                        <button onClick={() => handleIncludeStaff(p.id)} className="bg-blue-50 border border-blue-100 text-blue-600 font-bold text-[9px] py-1 px-2.5 rounded-lg cursor-pointer">
                          Dahil Et
                        </button>
                      ) : (
                        <button onClick={() => handleExcludeStaff(p.id)} className="bg-rose-50 border border-rose-100 text-rose-600 font-bold text-[9px] py-1 px-2.5 rounded-lg cursor-pointer flex items-center space-x-1">
                          <UserX size={10} /><span>Çıkar</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider">Dönem Özeti</h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 border p-3 rounded-xl">
                <span className="text-[8px] text-slate-500 font-bold block uppercase">Personel</span>
                <span className="text-base font-extrabold text-blue-700 block mt-0.5">{activeStaffRows.length} Kişi</span>
              </div>
              <div className="bg-slate-50 border p-3 rounded-xl">
                <span className="text-[8px] text-slate-500 font-bold block uppercase">Toplam İş Günü</span>
                <span className="text-base font-extrabold text-slate-700 block mt-0.5">{totalPersonDays} Gün</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-2">
              <span className="text-[9px] text-blue-800 font-bold block uppercase">Maaş Kaynaklı Kazançlar (Bilgi)</span>
              <div className="flex justify-between text-[10px]">
                <span className="text-blue-700">Gün kazancı</span>
                <span className="font-mono font-bold text-blue-900">{formatMoney(totalGunKazanci)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-amber-700">Mesai kazancı</span>
                <span className="font-mono font-bold text-amber-800">{formatMoney(totalMesaiKazanci)}</span>
              </div>
              <div className="flex justify-between text-[10px] border-t border-blue-200 pt-2">
                <span className="text-indigo-800 font-bold">Toplam kazanç</span>
                <span className="font-mono font-black text-indigo-900">{formatMoney(totalMaasKazanci)}</span>
              </div>
            </div>

            <div className="bg-emerald-500/10 border-2 border-emerald-500/30 p-4 rounded-xl text-center">
              <span className="text-[9px] text-emerald-800 font-black block uppercase tracking-wide">
                ZER YAPI Hakediş — {donemLabel}
              </span>
              <span className="text-lg font-black text-emerald-700 font-mono mt-1 block">
                {formatMoney(totalZerYapiHakedis, 0)}
              </span>
              <span className="text-[8px] text-emerald-600 block mt-1 font-semibold">
                Formül: {totalPersonDays} gün × ₺{ZER_YAPI_GUNLUK} (maaş kazancından ayrı)
              </span>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Rapor Türü:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button onClick={() => setReportType('NORMAL')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${reportType === 'NORMAL' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>
                  Normal Rapor
                </button>
                <button onClick={() => setReportType('E-IMZALI')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition flex items-center space-x-1 ${reportType === 'E-IMZALI' ? 'bg-emerald-500 text-slate-950' : 'text-slate-500'}`}>
                  <ShieldCheck size={11} /><span>E-İmzalı</span>
                </button>
              </div>
            </div>
            <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-1.5 shadow cursor-pointer">
              <Printer size={13} /><span>Yazdır / PDF</span>
            </button>
          </div>

          <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <div id="kibar-report-print-area" className="report-root bg-white space-y-4 text-xs text-slate-800">

              {/* —— Başlık —— */}
              <div className="border border-slate-200 rounded-lg">
                <div className="rpt-banner bg-gradient-to-r from-[#1E4E78] to-[#2563a8] px-4 py-3 flex justify-between items-center text-white">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide m-0">KİBRİTÇİ İNŞAAT TAAHHÜT A.Ş.</h2>
                    <p className="text-[8px] opacity-90 uppercase tracking-widest m-0 mt-0.5">ZER YAPI · Aylık Hakediş & Faaliyet Mutabakatı</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-emerald-400/20 border border-emerald-300/40 text-[8px] font-bold px-2 py-0.5 rounded uppercase">
                      ZER-YAPI-{donemKey}
                    </span>
                    <p className="text-[8px] opacity-80 mt-1 m-0">{donemLabel} · {new Date().toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
                <div className="rpt-banner-sub bg-emerald-50 border-t border-emerald-100 px-4 py-2 text-center">
                  <h3 className="font-bold text-emerald-900 uppercase text-[10px] tracking-wide m-0">
                    Şantiye Sahası Aylık Hakediş ve Faaliyet Raporu — {donemLabel}
                  </h3>
                </div>
              </div>

              {/* —— ZER YAPI Hakediş Özeti (rapor başı) —— */}
              <div className="rpt-zer-box">
                <h4>ZER YAPI Hakediş Formülü — Dönem Kazancı</h4>
                <p className="rpt-zer-formula">
                  Formül: Toplam çalışma günü × ₺{ZER_YAPI_GUNLUK} günlük birim bedel
                  &nbsp;|&nbsp; {totalPersonDays} gün × ₺{ZER_YAPI_GUNLUK} = {formatMoney(totalZerYapiHakedis, 0)}
                </p>
                <div className="rpt-zer-total">{formatMoney(totalZerYapiHakedis, 0)}</div>
                <p className="rpt-zer-meta">
                  {activeStaffRows.length} personel · {totalPersonDays} iş-günü · {donemLabel}
                  &nbsp;—&nbsp; Bu tutar maaş kazancından bağımsızdır.
                </p>
              </div>

              {/* —— 1. PERSONEL —— */}
              <section>
                <p className="rpt-sec-title m-0">1 · Personel Kazanç ve Hakediş Detayı</p>
                <p className="rpt-sec-sub">{activeStaffRows.length} personel · {totalPersonDays} gün · {totalMesaiSaat} sa mesai</p>
                <div className="rpt-table-wrap">
                  <table className="w-full text-left border-collapse text-[7px]">
                    <thead>
                      <tr className="rpt-th-dark">
                        <th className="p-1 text-center" rowSpan={2}>#</th>
                        <th className="p-1" rowSpan={2}>Ad Soyad</th>
                        <th className="p-1" rowSpan={2}>Görev</th>
                        <th className="p-1 text-right" rowSpan={2}>Maaş</th>
                        <th className="p-1 text-center" rowSpan={2}>Gün</th>
                        <th className="p-1 text-center" rowSpan={2}>Mesai</th>
                        <th className="p-1 text-center rpt-th-blue" colSpan={3}>Maaş Kazancı</th>
                        <th className="p-1 text-center rpt-th-emerald" colSpan={2}>ZER YAPI Hakediş</th>
                      </tr>
                      <tr className="text-[6px] font-bold uppercase">
                        <th className="p-1 rpt-th-blue text-right">Gün</th>
                        <th className="p-1 rpt-th-amber text-right">Mesai</th>
                        <th className="p-1 rpt-th-indigo text-right">Toplam</th>
                        <th className="p-1 rpt-th-emerald text-center">₺/Gün</th>
                        <th className="p-1 rpt-th-emerald text-right">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeStaffRows.map((row, idx) => (
                        <tr key={row.personel.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-1 text-center font-mono text-slate-500 border-b border-slate-100">{idx + 1}</td>
                          <td className="p-1 font-bold uppercase border-b border-slate-100">{row.personel.ad} {row.personel.soyad}</td>
                          <td className="p-1 uppercase border-b border-slate-100">{normalizeGorev(row.personel.gorev)}</td>
                          <td className="p-1 text-right font-mono border-b border-slate-100">{formatMoney(row.personel.maas || 30000, 0)}</td>
                          <td className="p-1 text-center font-mono font-bold border-b border-slate-100">{row.geldiGun}</td>
                          <td className="p-1 text-center font-mono border-b border-slate-100">{row.mesaiSaat > 0 ? row.mesaiSaat : '—'}</td>
                          <td className="p-1 rpt-td-blue border-b border-slate-100">{formatMoney(row.gunKazanci)}</td>
                          <td className="p-1 rpt-td-amber border-b border-slate-100">{row.mesaiKazanci > 0 ? formatMoney(row.mesaiKazanci) : '—'}</td>
                          <td className="p-1 rpt-td-indigo border-b border-slate-100">{formatMoney(row.toplamKazanc)}</td>
                          <td className="p-1 text-center font-mono text-emerald-700 border-b border-slate-100">{ZER_YAPI_GUNLUK}</td>
                          <td className="p-1 rpt-td-emerald border-b border-slate-100">{formatMoney(row.zerYapiHakedis, 0)}</td>
                        </tr>
                      ))}
                      {activeStaffRows.length === 0 && (
                        <tr><td colSpan={11} className="text-center py-6 text-slate-400 italic">Kayıt yok</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="rpt-foot">
                        <td colSpan={4} className="p-1 text-right uppercase text-[7px]">Toplam</td>
                        <td className="p-1 text-center font-mono">{totalPersonDays}</td>
                        <td className="p-1 text-center font-mono">{totalMesaiSaat}</td>
                        <td className="p-1 rpt-td-blue">{formatMoney(totalGunKazanci)}</td>
                        <td className="p-1 rpt-td-amber">{formatMoney(totalMesaiKazanci)}</td>
                        <td className="p-1 rpt-td-indigo">{formatMoney(totalMaasKazanci)}</td>
                        <td className="p-1 text-center text-emerald-600">×{ZER_YAPI_GUNLUK}</td>
                        <td className="p-1 rpt-td-emerald">{formatMoney(totalZerYapiHakedis, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* —— 2. SAHA FAALİYETLERİ —— */}
              <section>
                <p className="rpt-sec-title m-0">2 · Saha Faaliyet Raporları</p>
                <p className="rpt-sec-sub">{sahaFaaliyetSatirlari.length} kayıt · eskiden yeniye tarih sırası</p>
                {sahaFaaliyetSatirlari.length === 0 ? (
                  <p className="text-[9px] text-slate-400 italic">Bu dönemde saha faaliyeti kaydı yok.</p>
                ) : (
                  <div className="rpt-table-wrap">
                    <table className="w-full border-collapse text-[7px]">
                      <thead>
                        <tr className="rpt-th-dark">
                          <th className="p-1 w-7 text-center">No</th>
                          <th className="p-1 w-[82px] text-left">Tarih</th>
                          <th className="p-1 w-[48px] text-left">Parsel</th>
                          <th className="p-1 w-[32px] text-left">Blok</th>
                          <th className="p-1 text-left">Yapılan İş / Faaliyet</th>
                          <th className="p-1 w-[56px] text-right">Personel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sahaFaaliyetSatirlari.map(sf => (
                          <tr key={sf.id} className={sf.siraNo % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1 text-center font-mono font-bold text-slate-500 border-b border-slate-100">{sf.siraNo}</td>
                            <td className="p-1 font-mono whitespace-nowrap border-b border-slate-100">{sf.tarihLabel}</td>
                            <td className="p-1 font-semibold border-b border-slate-100">{sf.parselKisa}</td>
                            <td className="p-1 font-semibold border-b border-slate-100">{sf.blokKisa}</td>
                            <td className="p-1 leading-snug border-b border-slate-100">{faaliyetIsTanimi(sf)}</td>
                            <td className="p-1 text-right whitespace-nowrap border-b border-slate-100">{formatPersonelSayisi(sf)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* —— 3. KAMP FAALİYETLERİ —— */}
              <section>
                <p className="rpt-sec-title m-0">3 · Kamp / Lojman Faaliyetleri</p>
                <p className="rpt-sec-sub">{kampFaaliyetSatirlari.length} kayıt</p>
                {kampFaaliyetSatirlari.length === 0 ? (
                  <p className="text-[9px] text-slate-400 italic">Bu dönemde kamp faaliyeti kaydı yok.</p>
                ) : (
                  <div className="rpt-table-wrap">
                    <table className="w-full border-collapse text-[7px]">
                      <thead>
                        <tr className="rpt-th-dark">
                          <th className="p-1 w-7 text-center">No</th>
                          <th className="p-1 w-[82px] text-left">Tarih</th>
                          <th className="p-1 w-[72px] text-left">Tip</th>
                          <th className="p-1 text-left">Açıklama</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kampFaaliyetSatirlari.map(kf => (
                          <tr key={kf.id} className={kf.siraNo % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1 text-center font-mono border-b border-slate-100">{kf.siraNo}</td>
                            <td className="p-1 font-mono border-b border-slate-100">{kf.tarihLabel}</td>
                            <td className="p-1 font-semibold border-b border-slate-100">{kf.faaliyetTipi}</td>
                            <td className="p-1 border-b border-slate-100">{kf.aciklama}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* —— Özet —— */}
              <div className="rpt-summary-grid">
                <div className="rpt-summary-card">
                  <span className="text-[7px] font-bold text-indigo-700 uppercase block">Toplam Maaş Kazancı</span>
                  <span className="text-base font-black text-indigo-900 font-mono">{formatMoney(totalMaasKazanci)}</span>
                  <span className="text-[6px] text-indigo-500 block mt-0.5">Gün + mesai (bilgi amaçlı)</span>
                </div>
                <div className="rpt-summary-card rpt-summary-emerald">
                  <span className="text-[7px] font-black text-emerald-800 uppercase block">ZER YAPI Hakediş Toplamı</span>
                  <span className="text-base font-black text-emerald-800 font-mono">{formatMoney(totalZerYapiHakedis, 0)}</span>
                  <span className="text-[6px] text-emerald-600 block mt-0.5 font-semibold">{totalPersonDays} gün × ₺{ZER_YAPI_GUNLUK}</span>
                </div>
              </div>

              {/* —— İmza —— */}
              <div className="pt-2 border-t border-slate-200">
                {reportType === 'E-IMZALI' ? (
                  <div className="border border-emerald-500/30 rounded-xl p-3 bg-emerald-500/5 flex items-center space-x-3">
                    <ShieldCheck size={26} className="text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-emerald-700 uppercase block">E-İMZA İLE ONAYLANMIŞTIR</span>
                      <p className="text-[9px] text-slate-500">Doğrulayan: {currentUser?.email || 'sametatak9@gmail.com'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rpt-sign-grid">
                    <div className="rpt-sign-box">
                      <span className="font-extrabold text-[#1e4e78] block text-[8px]">Hakedişi Düzenleyen</span>
                      <div className="h-8" /><span className="text-[8px] font-bold text-slate-400">İmza</span>
                    </div>
                    <div className="rpt-sign-box">
                      <span className="font-extrabold text-[#1e4e78] block text-[8px]">Proje Koordinatörü</span>
                      <div className="h-8" /><span className="text-[8px] font-bold text-slate-400">İmza / Kaşe</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

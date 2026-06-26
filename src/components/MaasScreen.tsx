import React, { useState } from 'react';
import { CreditCard, Copy, Check, DollarSign, Download, Building } from 'lucide-react';
import { Personel, AylikYoklamaMap } from '../types/erp';
import { KibritciLogo } from './KibritciLogo';

interface MaasScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
}

export const MaasScreen: React.FC<MaasScreenProps> = ({ personeller, yoklamalar }) => {
  const [selectedMonth, setSelectedMonth] = useState(6);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [avansCuts, setAvansCuts] = useState<{ [personelId: string]: number }>({});
  const [paidStatus, setPaidStatus] = useState<{ [personelId: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const handleCutChange = (personelId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setAvansCuts(prev => ({
      ...prev,
      [personelId]: amount
    }));
  };

  const togglePaidStatus = (personelId: string) => {
    setPaidStatus(prev => ({
      ...prev,
      [personelId]: !prev[personelId]
    }));
  };

  const handleCopyIban = (personelId: string, iban: string) => {
    navigator.clipboard.writeText(iban);
    setCopiedId(personelId);
    setTimeout(() => {
      setCopiedId(null);
    }, 1200);
  };

  const isEmployeeVisibleInMonth = (p: Personel) => {
    const isAktif = p.durum === true || String(p.durum).toLowerCase() === 'true';
    if (p.iseGirisTarihi) {
      const [hireY, hireM] = p.iseGirisTarihi.split('-').map(Number);
      if (hireY > selectedYear || (hireY === selectedYear && hireM > selectedMonth)) {
        return false; // Not hired yet in this period
      }
    }
    if (p.istenCikisTarihi) {
      const [exitY, exitM] = p.istenCikisTarihi.split('-').map(Number);
      if (exitY < selectedYear || (exitY === selectedYear && exitM < selectedMonth)) {
        return false; // Already left before this period
      }
    } else if (!isAktif) {
      return false; // Fully passive and no exit date
    }
    return true;
  };

  const isDayActiveForEmployee = (emp: Personel, day: number) => {
    if (emp.iseGirisTarihi) {
      const [hireY, hireM, hireD] = emp.iseGirisTarihi.split('-').map(Number);
      const currentDateVal = selectedYear * 10000 + selectedMonth * 100 + day;
      const hireDateVal = hireY * 10000 + hireM * 100 + hireD;
      if (currentDateVal < hireDateVal) {
        return false;
      }
    }
    if (emp.istenCikisTarihi) {
      const [exitY, exitM, exitD] = emp.istenCikisTarihi.split('-').map(Number);
      const currentDateVal = selectedYear * 10000 + selectedMonth * 100 + day;
      const exitDateVal = exitY * 10000 + exitM * 100 + exitD;
      if (currentDateVal > exitDateVal) {
        return false;
      }
    }
    return true;
  };

  // Calculations loop
  let grandBaseHakedis = 0;
  let grandOvertimeHakedis = 0;
  let grandKesinti = 0;
  let grandNetPayment = 0;

  const calculatedSalaries = personeller.filter(isEmployeeVisibleInMonth).map(p => {
    const personYoklama = yoklamalar[p.id] || {};
    
    // Count "Geldi" days
    let hakedisDays = 0;
    let totalOvertimeHours = 0;

    // If there is recorded data
    if (Object.keys(personYoklama).length > 0) {
      Object.keys(personYoklama).forEach(dayStr => {
        const day = parseInt(dayStr);
        const dayData = personYoklama[day];
        if (dayData && isDayActiveForEmployee(p, day)) {
          if (dayData.durum === 'Geldi' || dayData.durum === 'İzinli' || dayData.durum === 'Pazar' || dayData.durum === 'Tatil') {
            hakedisDays++;
          }
          totalOvertimeHours += dayData.mesaiSaati;
        }
      });
    } else {
      // Fallback: calculate total active days in this month
      for (let day = 1; day <= daysInMonth; day++) {
        if (isDayActiveForEmployee(p, day)) {
          hakedisDays++;
        }
      }
      totalOvertimeHours = 0;
    }

    const baseWage = p.maas;
    const dailyWageRate = baseWage / 30;
    const totalBaseHakedis = hakedisDays * dailyWageRate;

    const hourlyOvertimeRate = (dailyWageRate / 7.5) * 1.5;
    const totalOvertimeHakedis = totalOvertimeHours * hourlyOvertimeRate;

    const cutAmount = avansCuts[p.id] || 0;
    const netPayable = (totalBaseHakedis + totalOvertimeHakedis) - cutAmount;

    // Accumulate grand totals
    grandBaseHakedis += totalBaseHakedis;
    grandOvertimeHakedis += totalOvertimeHakedis;
    grandKesinti += cutAmount;
    grandNetPayment += netPayable;

    return {
      personel: p,
      hakedisDays,
      totalOvertimeHours,
      totalBaseHakedis,
      totalOvertimeHakedis,
      cutAmount,
      netPayable
    };
  });

  const [showMaasRaporu, setShowMaasRaporu] = useState(false);

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col font-sans gap-6 select-none bg-slate-50/50">
      
      {/* Top Total Statistics Odometer Center */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        {[
          { title: "Toplam Hakediş Maaş", value: `₺${grandBaseHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, color: "border-slate-200 bg-white" },
          { title: "Toplam Mesai Hakediş", value: `₺${grandOvertimeHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, color: "border-blue-100 bg-blue-50/30 text-blue-800" },
          { title: "Toplam Kesinti / Avans", value: `₺${grandKesinti.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, color: "border-rose-100 bg-rose-50/30 text-rose-800" },
          { title: "Net Ödenecek Banka Tutarı", value: `₺${grandNetPayment.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, color: "border-emerald-100 bg-emerald-50 text-emerald-800 font-bold" }
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl border flex flex-col shadow-sm ${item.color}`}>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
              {item.title}
            </span>
            <span className="text-lg font-bold font-display">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main List Box */}
      <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Header bar controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <CreditCard size={16} className="text-[#f59e0b]" />
            <h4 className="font-display font-bold text-sm text-slate-800 uppercase tracking-widest">
              Hakediş &amp; Otomatik Banka Ödeme Talimatları
            </h4>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={() => setShowMaasRaporu(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer mr-2 flex items-center space-x-1"
            >
              <span>📄 Maaş Raporu (PDF / Yazdır)</span>
            </button>
            <span>Dönem:</span>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="text-xs font-semibold border border-slate-200 rounded-lg p-1 px-2 bg-white cursor-pointer"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{m}. Ay</option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable list items panel */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {calculatedSalaries.map(({ personel, hakedisDays, totalOvertimeHours, totalBaseHakedis, totalOvertimeHakedis, cutAmount, netPayable }) => {
            const isPaid = paidStatus[personel.id] || false;
            
            return (
              <div 
                key={personel.id}
                className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition duration-200 ${
                  isPaid 
                    ? 'bg-emerald-50/20 border-emerald-500/30' 
                    : 'bg-white border-slate-150 hover:border-slate-200'
                }`}
              >
                
                {/* Personel Avatar and Identity */}
                <div className="flex items-center gap-3 w-64 shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ring-1 ${
                    isPaid ? 'bg-emerald-100 text-emerald-800 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}>
                    {personel.ad[0]}{personel.soyad[0]}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs">
                      {personel.ad} {personel.soyad}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {personel.gorev} · Base: <span className="font-bold">₺{personel.maas.toLocaleString('tr-TR')}</span>
                    </p>
                  </div>
                </div>

                {/* Days and Overtime analysis stats */}
                <div className="flex items-center space-x-6 shrink-0">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Hakediş Gün</span>
                    <span className="text-xs font-semibold text-slate-800">{hakedisDays} Gün</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Ört. Mesai</span>
                    <span className="text-xs font-semibold text-blue-600">{totalOvertimeHours} Saat</span>
                  </div>
                </div>

                {/* Hakediş breakdown components */}
                <div className="flex items-center space-x-6 text-[11px] font-medium text-slate-500 shrink-0">
                  <div>
                    <span>Maaş:</span> <span className="font-bold text-slate-800">₺{totalBaseHakedis.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div>
                    <span>Mesai:</span> <span className="font-bold text-slate-800">₺{totalOvertimeHakedis.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                  </div>
                  
                  {/* Cuts input field - allows dynamic writes */}
                  <div className="flex items-center space-x-1.5">
                    <span>Kesinti/Avans:</span>
                    <input 
                      type="number"
                      value={cutAmount || ""}
                      placeholder="0"
                      onChange={(e) => handleCutChange(personel.id, e.target.value)}
                      className="w-16 bg-slate-50 border border-slate-200 focus:outline-none focus:border-red-400 font-bold font-mono text-center rounded py-0.5 text-red-600 text-[10px]"
                    />
                  </div>
                </div>

                {/* Banking details */}
                <div className="flex items-center space-x-2 border-l pl-4 border-slate-100 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Banka / IBAN</p>
                    <p className="text-[10px] font-semibold text-slate-700 font-mono truncate w-36">
                      {personel.ibanNo ? personel.ibanNo : "IBAN GİRİLMEMİŞ"}
                    </p>
                  </div>
                  
                  {personel.ibanNo && (
                    <button
                      onClick={() => handleCopyIban(personel.id, personel.ibanNo)}
                      className="p-1 px-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      title="IBAN Kopyala"
                    >
                      {copiedId === personel.id ? (
                        <Check size={12} className="text-emerald-600 stroke-[3]" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>

                {/* NET PAYABLE AMOUNT & TOGGLE STATUS */}
                <div className="flex items-center gap-4 shrink-0 justify-between md:justify-start">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Ödenecek Net Tutar</span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      ₺{netPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => togglePaidStatus(personel.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase cursor-pointer transition active:scale-95 shadow-sm border ${
                      isPaid 
                        ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                  >
                    {isPaid ? "✖ Ödeme Kaldır" : "💵 Ödeme Tamam"}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📄 LANDSCAPE PDF / PRINT MODAL: MAAŞ BANKA ÖDEME DEKONT CETVELİ          */}
      {/* ========================================================================= */}
      {showMaasRaporu && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-start justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-7xl shadow-2xl flex flex-col overflow-hidden my-4">
            
            {/* Modal Actions Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center px-6 shrink-0 print:hidden">
              <div className="flex items-center space-x-2">
                <span className="text-xl">💰</span>
                <h3 className="font-display font-bold text-sm">
                  KİBRİTÇİ İNŞAAT ŞANTİYESİ AYI MAAŞ RAPORU
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow cursor-pointer"
                >
                  🖨️ Yazdır / PDF Olarak Kaydet (Ctrl+P)
                </button>
                <button
                  onClick={() => {
                    const el = document.querySelector('.printable-document');
                    if (el) {
                      const heading = "Kibritci_Insaat_Santiye_Maas_Hakedis_Raporu";
                      const blob = new Blob([`
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <title>Şantiye Maaş Hakediş Raporu</title>
                            <script src="https://cdn.tailwindcss.com"></script>
                            <style>
                              @media print { .no-print { display: none; } }
                            </style>
                          </head>
                          <body class="p-8 bg-white text-slate-900 font-sans">
                            ${el.innerHTML}
                          </body>
                        </html>
                      `], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${heading}_${selectedMonth}_${selectedYear}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow cursor-pointer"
                >
                  💾 Masaüstüne HTML Rapor Dosyası Kaydet
                </button>
                <button
                  onClick={() => setShowMaasRaporu(false)}
                  className="bg-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Document Body (Landcaped styled report) */}
            <div className="flex-1 overflow-auto bg-white p-12 text-slate-900 printable-document font-sans">
              
              {/* Report Header */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <KibritciLogo size="xl" />
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">KİBRİTÇİ İNŞAAT TAAHHÜT A.Ş.</h1>
                    <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">MUHASEBE VE FİNANSAL HAKEDİŞ DAİRE BAŞKANLIĞI</p>
                    <p className="text-xs text-slate-600 mt-1">Hakediş Dönemi: <strong className="text-slate-900 font-bold">{selectedMonth}. Ay / {selectedYear}</strong></p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="border border-slate-900 text-[10px] font-bold px-3 py-1 bg-slate-50 uppercase tracking-widest block mb-1">
                    KOD: KBR-MAAS-2026-{selectedMonth}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Dekont Baskı: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR')}</span>
                </div>
              </div>

              {/* Document Subtitle */}
              <div className="text-center mb-6">
                <h2 className="text-sm font-bold text-slate-900 tracking-wider uppercase border-y border-slate-205 py-2.5 bg-slate-50">
                  KİBRİTÇİ İNŞAAT ŞANTİYESİ {[
                    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
                  ][selectedMonth - 1]?.toUpperCase()} AYI RAPORU
                </h2>
                <p className="text-[9px] text-slate-400 mt-1 italic">
                  * Bu ödeme listesi banka entegrasyonu virman şablonu olup, toplam hakediş mutabakatları için ıslak imzalı yetkili onayı içermektedir.
                </p>
              </div>

              {/* Data Table */}
              <div className="border border-slate-350 rounded-md overflow-hidden mb-8 font-sans">
                <table className="w-full text-[9px] border-collapse bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                      <th className="p-2 text-left border-r border-slate-300">TC Kimlik No</th>
                      <th className="p-2 text-left border-r border-slate-300">Personel Adı Soyadı</th>
                      <th className="p-2 text-left border-r border-slate-300">Görevi</th>
                      <th className="p-2 text-center border-r border-slate-300">Çalışma Gün</th>
                      <th className="p-2 text-center border-r border-slate-300">Fazla Mesai (Saat)</th>
                      <th className="p-2 text-right border-r border-slate-300 text-[#1E4E78]">Günden Doğan Kazanç (₺)</th>
                      <th className="p-2 text-right border-r border-slate-300 text-blue-800">Mesayiden Doğan Kazanç (₺)</th>
                      <th className="p-2 text-right border-r border-slate-300 text-rose-800">Kesinti / Avans / Borç (₺)</th>
                      <th className="p-2 text-left border-r border-slate-300">Banka Bilgisi</th>
                      <th className="p-2 text-right text-emerald-800 font-bold bg-slate-55 w-28">En Son Alacağı Maaş (Net ₺)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatedSalaries.map(({ personel, hakedisDays, totalOvertimeHours, totalBaseHakedis, totalOvertimeHakedis, cutAmount, netPayable }) => (
                      <tr key={personel.id} className="border-b border-slate-200 hover:bg-slate-50 font-medium">
                        <td className="p-2 border-r border-slate-300 font-mono text-slate-500">{personel.tcNo}</td>
                        <td className="p-2 border-r border-slate-300 font-bold text-slate-850">{personel.ad} {personel.soyad}</td>
                        <td className="p-2 border-r border-slate-300 uppercase text-[8px] font-bold text-slate-600">{personel.gorev}</td>
                        <td className="p-2 text-center border-r border-slate-300">{hakedisDays} Gün</td>
                        <td className="p-2 text-center border-r border-slate-300 font-mono text-blue-700">{totalOvertimeHours} st</td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono">₺{totalBaseHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-blue-700">₺{totalOvertimeHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-rose-700 font-mono">-₺{cutAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 border-r border-slate-300 text-slate-500 text-[8px] truncate max-w-[120px]">{personel.bankaAdi} · {personel.ibanNo || "IBAN_YOK"}</td>
                        <td className="p-2 text-right text-emerald-750 font-bold bg-emerald-50/40 font-mono">
                          ₺{netPayable.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {/* Grand Total Row */}
                    <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-900 text-slate-800">
                      <td colSpan={3} className="p-2.5 text-left uppercase text-[10px]">TOPLAM ÖDEME PORTFÖYÜ</td>
                      <td colSpan={2} className="p-2.5 text-center"></td>
                      <td className="p-2.5 text-right font-mono text-[#1E4E78]">₺{grandBaseHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2.5 text-right font-mono text-blue-700">₺{grandOvertimeHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2.5 text-right text-rose-800 font-mono">-₺{grandKesinti.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2.5"></td>
                      <td className="p-2.5 text-right text-emerald-800 font-display font-mono text-[10px] bg-emerald-100 border-l border-emerald-250">
                        ₺{grandNetPayment.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Corporate Sign-off Area arranged in user specified order */}
              <div className="mt-12 text-xs">
                <div className="bg-[#1E4E78] text-white p-2 text-[9px] font-bold uppercase tracking-wider mb-6 rounded-md">
                  📌 HAKEDİŞ ONAY VE SENKRONİZE LİKİDİTE YÖNETİM MERCİLERİ
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  
                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#8B1E1E] tracking-wider uppercase block mb-1">1. MUHASEBE</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Finansal hakediş ve banka mutabakatı</span>
                    <div className="h-0.5 bg-slate-305 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">Ayşe Demir</span>
                    <span className="text-[8px] text-slate-400 italic">Bordro Sorumlusu</span>
                  </div>

                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#1E4E78] tracking-wider uppercase block mb-1">2. İDARİ İŞLER</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Personel Sicil ve İK Onayı</span>
                    <div className="h-0.5 bg-slate-305 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">Nuri Mutlu</span>
                    <span className="text-[8px] text-slate-400 italic">İdari İşler Şefi</span>
                  </div>

                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#1E4E78] tracking-wider uppercase block mb-1">3. ŞANTİYE ŞEFİ</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Saha organizasyonu ve puantaj kontrol</span>
                    <div className="h-0.5 bg-slate-305 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">Ayhan Yılmaz</span>
                    <span className="text-[8px] text-slate-400 italic">Şantiye Şefi</span>
                  </div>

                  <div className="border border-slate-150 p-3 rounded-xl bg-slate-50">
                    <span className="font-extrabold text-[#8B1E1E] tracking-wider uppercase block mb-1">4. PROJE MÜDÜRÜ</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Nihai Mali Hak Onaylama İmzası</span>
                    <div className="h-0.5 bg-slate-305 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">Kuzey Samet Atak</span>
                    <span className="text-[8px] text-slate-400 italic">Proje Müdürü</span>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default MaasScreen;

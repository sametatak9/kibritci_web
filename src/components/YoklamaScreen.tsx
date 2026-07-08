import React, { useState } from 'react';
import { Calendar, Trash2, ShieldAlert, CheckCircle, FileText, ChevronRight } from 'lucide-react';
import { Personel, AylikYoklamaMap, YoklamaDurum } from '../types/erp';
import { CorporateReportLayout } from './CorporateReportLayout';

const maskName = (name?: string): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.map(part => {
    if (part.length <= 1) return part;
    return part[0] + '*'.repeat(part.length - 1);
  }).join(' ');
};

interface YoklamaScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
  setYoklamalar: React.Dispatch<React.SetStateAction<AylikYoklamaMap>>;
  addNotification?: (mesaj: string) => void;
}

export const YoklamaScreen: React.FC<YoklamaScreenProps> = ({ 
  personeller, 
  yoklamalar, 
  setYoklamalar,
  addNotification
}) => {
  const [selectedMonth, setSelectedMonth] = useState(6); // June as default
  const [selectedYear, setSelectedYear] = useState(2026);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Custom Overtime state variables
  const [overtimeStaffId, setOvertimeStaffId] = useState<string>("ALL");
  const [overtimeDay, setOvertimeDay] = useState<number>(1);
  const [overtimeHours, setOvertimeHours] = useState<number>(2);

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Yoklama codes list for cycling: G: Geldi, Y: Yok, İ: İzinli, R: Raporlu, P: Pazar, T: Tatil
  const statusCycle: YoklamaDurum[] = ['Geldi', 'Yok', 'İzinli', 'Raporlu', 'Pazar', 'Tatil', 'Girilmedi'];
  
  const getStatusColor = (status: YoklamaDurum) => {
    switch (status) {
      case 'Geldi': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Yok': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'İzinli': return 'bg-sky-100 text-blue-800 border-sky-200';
      case 'Raporlu': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Pazar': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Tatil': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getStatusAbbreviation = (status: YoklamaDurum) => {
    switch (status) {
      case 'Geldi': return 'G';
      case 'Yok': return 'Y';
      case 'İzinli': return 'İ';
      case 'Raporlu': return 'R';
      case 'Pazar': return 'P';
      case 'Tatil': return 'T';
      default: return '-';
    }
  };

  const dayOfWeekAbbreviation = (day: number) => {
    const d = new Date(selectedYear, selectedMonth - 1, day);
    const dayNames = ["Pa", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];
    return dayNames[d.getDay()];
  };

  const isSundayOrPublicHoliday = (day: number) => {
    const d = new Date(selectedYear, selectedMonth - 1, day);
    const isSunday = d.getDay() === 0;
    
    // Check Turkey national holidays:
    const month = selectedMonth; // 1-indexed
    if (month === 1 && day === 1) return { isHoliday: true, name: 'Yılbaşı', isOfficial: true };
    if (month === 4 && day === 23) return { isHoliday: true, name: '23 Nisan', isOfficial: true };
    if (month === 5 && day === 1) return { isHoliday: true, name: '1 Mayıs', isOfficial: true };
    if (month === 5 && day === 19) return { isHoliday: true, name: '19 Mayıs', isOfficial: true };
    if (month === 7 && day === 15) return { isHoliday: true, name: '15 Temmuz', isOfficial: true };
    if (month === 8 && day === 30) return { isHoliday: true, name: '30 Ağustos', isOfficial: true };
    if (month === 10 && day === 29) return { isHoliday: true, name: '29 Ekim', isOfficial: true };
    
    return { isHoliday: isSunday, name: isSunday ? 'Pazar' : '', isOfficial: false };
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

  const isDayActiveForEmployee = (p: Personel, day: number) => {
    if (p.iseGirisTarihi) {
      const [hireY, hireM, hireD] = p.iseGirisTarihi.split('-').map(Number);
      const currentDateVal = selectedYear * 10000 + selectedMonth * 100 + day;
      const hireDateVal = hireY * 10000 + hireM * 100 + hireD;
      if (currentDateVal < hireDateVal) {
        return false; // Not hired yet
      }
    }
    if (p.istenCikisTarihi) {
      const [exitY, exitM, exitD] = p.istenCikisTarihi.split('-').map(Number);
      const currentDateVal = selectedYear * 10000 + selectedMonth * 100 + day;
      const exitDateVal = exitY * 10000 + exitM * 100 + exitD;
      if (currentDateVal > exitDateVal) {
        return false; // Already left / Dismissed
      }
    }
    return true;
  };

  const handleCellClick = (personelId: string, day: number) => {
    const p = personeller.find(emp => emp.id === personelId);
    if (p && !isDayActiveForEmployee(p, day)) return;

    const currentPersonelMap = yoklamalar[personelId] || {};
    const dayData = currentPersonelMap[day] || { durum: 'Girilmedi', mesaiSaati: 0 };
    
    // Cycle to next status
    const currentIndex = statusCycle.indexOf(dayData.durum);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];

    setYoklamalar(prev => ({
      ...prev,
      [personelId]: {
        ...currentPersonelMap,
        [day]: {
          ...dayData,
          durum: nextStatus
        }
      }
    }));

    if (addNotification && p) {
      addNotification(`${maskName(`${p.ad} ${p.soyad}`)} için ${day}. gün durumu "${nextStatus}" yapıldı.`);
    }
  };

  const handleMesaiChange = (personelId: string, day: number, hours: number) => {
    const p = personeller.find(emp => emp.id === personelId);
    if (p && !isDayActiveForEmployee(p, day)) return;

    const currentPersonelMap = yoklamalar[personelId] || {};
    const dayData = currentPersonelMap[day] || { durum: 'Girilmedi', mesaiSaati: 0 };

    setYoklamalar(prev => ({
      ...prev,
      [personelId]: {
        ...currentPersonelMap,
        [day]: {
          ...dayData,
          mesaiSaati: hours
        }
      }
    }));

    if (addNotification && p) {
      addNotification(`${maskName(`${p.ad} ${p.soyad}`)} için ${day}. gün mesai saati ${hours} olarak ayarlandı.`);
    }
  };

  const handleBulkSetStatus = (status: YoklamaDurum) => {
    const newYoklamalar = { ...yoklamalar };
    
    personeller.forEach(p => {
      if (!isEmployeeVisibleInMonth(p)) return;
      const personYoklama = { ...(newYoklamalar[p.id] || {}) };
      daysArray.forEach(d => {
        if (!isDayActiveForEmployee(p, d)) return;
        const isSunday = new Date(selectedYear, selectedMonth - 1, d).getDay() === 0;
        personYoklama[d] = {
          durum: isSunday ? 'Pazar' : status,
          mesaiSaati: personYoklama[d]?.mesaiSaati || 0
        };
      });
      newYoklamalar[p.id] = personYoklama;
    });
    
    setYoklamalar(newYoklamalar);
    alert(`Seçili ayın tüm günleri aktif personeller için topluca "${status}" olarak güncellendi.`);
    if (addNotification) {
      addNotification(`${selectedMonth}. Ay / ${selectedYear} dönemi tüm yoklama durumları topluca "${status}" yapıldı.`);
    }
  };

  const [printModal, setPrintModal] = useState<'NONE' | 'BOS' | 'DOLU'>('NONE');

  const filteredPersonel = personeller
    .filter(isEmployeeVisibleInMonth)
    .filter(p => {
      const term = searchTerm.toLowerCase();
      const fullName = `${p.ad} ${p.soyad}`.toLowerCase();
      return fullName.includes(term) || p.tcNo.includes(term) || p.gorev.toLowerCase().includes(term);
    });

  const handleBulkOvertime = (hours: number) => {
    const newYoklamalar = { ...yoklamalar };
    
    personeller.forEach(p => {
      if (!isEmployeeVisibleInMonth(p)) return;
      const personYoklama = { ...(newYoklamalar[p.id] || {}) };
      daysArray.forEach(d => {
        if (!isDayActiveForEmployee(p, d)) return;
        const isSunday = new Date(selectedYear, selectedMonth - 1, d).getDay() === 0;
        personYoklama[d] = {
          durum: personYoklama[d]?.durum || (isSunday ? 'Pazar' : 'Geldi'),
          mesaiSaati: hours
        };
      });
      newYoklamalar[p.id] = personYoklama;
    });

    setYoklamalar(newYoklamalar);
    alert(`Seçili ayın tüm iş günlerine aktif personeller için topluca günlük ${hours} saat fazla mesai işlendi.`);
    if (addNotification) {
      addNotification(`${selectedMonth}. Ay / ${selectedYear} dönemi tüm iş günlerine topluca günlük ${hours} saat fazla mesai yazıldı.`);
    }
  };

  const handleQuickOvertimeSubmit = () => {
    if (overtimeDay < 1 || overtimeDay > daysInMonth) {
      alert(`Lütfen geçerli bir gün seçin (1-${daysInMonth}).`);
      return;
    }

    setYoklamalar(prev => {
      const updated = { ...prev };

      const applyToPerson = (pid: string) => {
        const p = personeller.find(emp => emp.id === pid);
        if (!p || !isEmployeeVisibleInMonth(p) || !isDayActiveForEmployee(p, overtimeDay)) return;

        const currentPersonelMap = { ...updated[pid] };
        const dayData = currentPersonelMap[overtimeDay] || { durum: 'Girilmedi', mesaiSaati: 0 };
        const targetDurum = (dayData.durum === 'Girilmedi' || dayData.durum === 'Yok') ? 'Geldi' : dayData.durum;
        
        currentPersonelMap[overtimeDay] = {
          durum: targetDurum,
          mesaiSaati: overtimeHours
        };
        updated[pid] = currentPersonelMap;
      };

      if (overtimeStaffId === 'ALL') {
        personeller.forEach(p => applyToPerson(p.id));
      } else {
        applyToPerson(overtimeStaffId);
      }

      return updated;
    });

    alert(`Seçilen ${overtimeDay}. güne fiili +${overtimeHours} Saat fazla mesai kaydı işlendi.`);
    if (addNotification) {
      if (overtimeStaffId === 'ALL') {
        addNotification(`${selectedMonth}. Ay / ${selectedYear} dönemi ${overtimeDay}. günü için tüm şantiyeye +${overtimeHours} saat mesai yazıldı.`);
      } else {
        const p = personeller.find(emp => emp.id === overtimeStaffId);
        addNotification(`${p ? maskName(`${p.ad} ${p.soyad}`) : 'Personel'} için ${overtimeDay}. güne +${overtimeHours} saat mesai yazıldı.`);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col font-sans gap-6 select-none bg-slate-50/50">
      
      {/* Filters Row Card */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm flex flex-col gap-4 shrink-0">
        
        {/* Top line controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700">Dönem Seçimi:</span>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="text-xs font-semibold border border-slate-200 rounded-lg p-1.5 focus:border-amber-400 bg-slate-50 cursor-pointer text-slate-800"
              >
                {[
                  {k: 1, v: "Ocak"}, {k: 2, v: "Şubat"}, {k: 3, v: "Mart"}, {k: 4, v: "Nisan"},
                  {k: 5, v: "Mayıs"}, {k: 6, v: "Haziran"}, {k: 7, v: "Temmuz"}, {k: 8, v: "Ağustos"},
                  {k: 9, v: "Eylül"}, {k: 10, v: "Ekim"}, {k: 11, v: "Kasım"}, {k: 12, v: "Aralık"}
                ].map(m => (
                  <option key={m.k} value={m.k}>{m.v} (Dönem {m.k})</option>
                ))}
              </select>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="text-xs font-semibold border border-slate-200 rounded-lg p-1.5 focus:border-amber-400 bg-slate-50 cursor-pointer text-slate-800"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Quick bulk actions */}
            <div className="flex flex-wrap items-center gap-2 border-l pl-4 border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Toplu Puantaj:</span>
              <button 
                onClick={() => handleBulkSetStatus('Geldi')}
                className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-150 rounded-lg px-2 py-1 font-bold cursor-pointer transition"
              >
                ✓ Herkesi Geldi Yap
              </button>
              <button 
                onClick={() => handleBulkOvertime(2)}
                className="text-[10px] bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-150 rounded-lg px-2 py-1 font-bold cursor-pointer transition"
                title="Her iş gününe stabil 2 saat fazla mesai yazar"
              >
                ⏱ Herkese +2sa Mesai Girişi
              </button>
              <button 
                onClick={() => handleBulkSetStatus('Girilmedi')}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-150 rounded-lg px-2 py-1 font-bold cursor-pointer transition"
              >
                Sıfırla
              </button>
            </div>
          </div>

          {/* PDF & Reports buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPrintModal('BOS')}
              className="text-[11px] bg-white text-slate-700 hover:bg-slate-50 border border-slate-250 rounded-lg px-3 py-1.5 font-bold cursor-pointer transition flex items-center space-x-1 shadow-sm animate-pulse"
              title="Şantiyede elle doldurmak için boş puantaj cetveli şablonu yazdırır."
            >
              <FileText size={13} className="text-rose-500" />
              <span>📄 Boş Puantaj (İmza Barlı PDF)</span>
            </button>
            <button
              onClick={() => setPrintModal('DOLU')}
              className="text-[11px] bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 rounded-lg px-3 py-1.5 font-bold cursor-pointer transition flex items-center space-x-1 shadow-sm"
              title="Kayıtlı ve girilmiş fiili puantajları imza çizgileriyle yazdırır."
            >
              <FileText size={13} className="text-white" />
              <span>📊 Dolu Güncel Puantaj Raporu (PDF)</span>
            </button>

            {/* Search */}
            <div className="relative w-40 ml-2">
              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400">
                <span className="text-[10px]">🔍</span>
              </span>
              <input
                type="text"
                placeholder="Personel süz..."
                className="w-full bg-slate-50 text-[10px] border border-slate-200 rounded-lg py-1.5 pl-6 pr-2 text-slate-750 focus:outline-none focus:border-amber-500 transition duration-150"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Bottom line: Interactive targeted / Overtime Input Panel */}
        <div className="bg-amber-50/55 rounded-xl border border-amber-200/70 p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center space-x-2">
            <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">MESAİ GİRİŞ PANELİ</span>
            <span className="text-[11px] text-slate-600 font-medium font-sans">Belirli güne özel saatlik fazla mesai işleyin:</span>
          </div>

          <div className="flex items-center space-x-3 flex-wrap text-xs">
            {/* Staff dropdown selector */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-bold text-[10px]">Kadro:</span>
              <select
                value={overtimeStaffId}
                onChange={(e) => setOvertimeStaffId(e.target.value)}
                className="text-[11px] font-bold bg-white border border-slate-200 rounded p-1"
              >
                <option value="ALL">📋 Tüm Şantiye Kadrosu</option>
                {personeller.filter(isEmployeeVisibleInMonth).map(p => (
                  <option key={p.id} value={p.id}>👤 {p.ad} {p.soyad} ({p.gorev})</option>
                ))}
              </select>
            </div>

            {/* Target Day */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-bold text-[10px]">Gün:</span>
              <input
                type="number"
                min={1}
                max={daysInMonth}
                value={overtimeDay}
                onChange={(e) => setOvertimeDay(Math.max(1, Math.min(daysInMonth, parseInt(e.target.value) || 1)))}
                className="w-12 text-center text-[11px] font-bold bg-white border border-slate-200 rounded p-1"
              />
            </div>

            {/* Overtime Hours */}
            <div className="flex items-center space-x-1">
              <span className="text-slate-500 font-bold text-[10px]">Mesai Saati:</span>
              <input
                type="number"
                min={0}
                max={16}
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(Math.max(0, Math.min(16, parseFloat(e.target.value) || 0)))}
                className="w-12 text-center text-[11px] font-bold bg-white border border-slate-200 rounded p-1"
              />
              <span className="text-slate-400 font-medium text-[10px]">Saat</span>
            </div>

            {/* Submit button */}
            <button
              onClick={handleQuickOvertimeSubmit}
              className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[10px] px-3.5 py-1 rounded transition duration-100 shadow-sm cursor-pointer"
            >
              ⏱️ Mesai Kaydet
            </button>
          </div>
        </div>

      </div>

      {/* Main Grid Card View */}
      <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Info Legend */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-400 font-sans tracking-tight">
          <div className="flex items-center space-x-3 flex-wrap">
            <span className="font-bold text-slate-600 uppercase">Hücre Değerini Değiştirmek İçin Harfe Tıklayınız:</span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-emerald-100 text-emerald-800 rounded font-bold text-center inline-block">G</span> <span>Geldi (G)</span></span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-rose-100 text-rose-800 rounded font-bold text-center inline-block">Y</span> <span>Yok (Y)</span></span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-sky-100 text-blue-800 rounded font-bold text-center inline-block">İ</span> <span>İzinli (İ)</span></span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-amber-100 text-amber-800 rounded font-bold text-center inline-block">R</span> <span>Raporlu (R)</span></span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-orange-100 text-orange-800 rounded font-bold text-center inline-block">P</span> <span>Pazar (P)</span></span>
            <span className="flex items-center space-x-1"><span className="w-4 h-4 bg-purple-100 text-purple-800 rounded font-bold text-center inline-block">T</span> <span>Tatil (T)</span></span>
          </div>

          <span className="text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
            Hücrelerin altındaki kutulardan günlük fazla mesai saatlerini (Saat) elle girebilirsiniz.
          </span>
        </div>

        {/* Scrollable Matrix Table grid wrapper */}
        <div className="flex-1 overflow-auto p-4">
          <div className="inline-block min-w-full align-middle">
            <div className="border border-slate-100 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-100">
                
                {/* Header columns */}
                <thead className="bg-slate-50 font-display text-[10px] font-bold text-slate-600 tracking-wider">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left w-56 sticky left-0 bg-slate-50 box-shadow z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)] border-r">
                      Personel Künyesi
                    </th>
                    {daysArray.map(day => {
                      const dayName = dayOfWeekAbbreviation(day);
                      const { isHoliday, name, isOfficial } = isSundayOrPublicHoliday(day);
                      let thClass = "px-1 py-1.5 text-center w-8 min-w-8 transition-colors";
                      if (isHoliday) {
                        if (isOfficial) {
                          thClass += " bg-purple-100/80 text-purple-900 font-extrabold border-x border-purple-200 z-10";
                        } else {
                          thClass += " bg-orange-100/80 text-orange-900 font-extrabold border-x border-orange-200 z-10";
                        }
                      }
                      return (
                        <th 
                          key={day} 
                          scope="col" 
                          className={thClass}
                          title={name || undefined}
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-[10px]">{day.toString().padStart(2, '0')}</span>
                            <span className="text-[8px] font-bold opacity-80 uppercase tracking-wide">{dayName}</span>
                          </div>
                        </th>
                      );
                    })}
                    <th scope="col" className="px-2 py-3 text-center w-16 min-w-16 border-l font-bold text-emerald-700 bg-slate-50">
                      Gelen Gün
                    </th>
                    <th scope="col" className="px-2 py-3 text-center w-20 min-w-20 font-bold text-blue-700 bg-slate-50">
                      Top. Mesai
                    </th>
                  </tr>
                </thead>
 
                {/* Table list rows */}
                <tbody className="bg-white divide-y divide-slate-100 text-[11px] font-sans">
                  {filteredPersonel.map((p) => {
                    const personYoklama = yoklamalar[p.id] || {};
                    let totalGeldi = 0;
                    let totalMesai = 0;

                    const rowCells = daysArray.map(day => {
                      const dayData = personYoklama[day] || { durum: 'Girilmedi', mesaiSaati: 0 };
                      const isActiveDay = isDayActiveForEmployee(p, day);
                      
                      if (isActiveDay && dayData.durum === 'Geldi') {
                        totalGeldi++;
                      }
                      if (isActiveDay) {
                        totalMesai += dayData.mesaiSaati;
                      }

                      const { isHoliday, name, isOfficial } = isSundayOrPublicHoliday(day);
                      let tdClass = "px-0.5 py-1.5 text-center min-w-8 transition-colors";
                      if (isActiveDay && isHoliday) {
                        if (isOfficial) {
                          tdClass += " bg-purple-55/35 border-x border-purple-100/30";
                        } else {
                          tdClass += " bg-orange-55/35 border-x border-orange-100/30";
                        }
                      }

                      return (
                        <td key={day} className={`${tdClass} relative`}>
                          <button
                            type="button"
                            disabled={!isActiveDay}
                            onClick={() => isActiveDay && handleCellClick(p.id, day)}
                            className={`w-7 h-7 rounded-md border font-bold text-[9px] flex items-center justify-center transition shadow-sm ${
                              isActiveDay
                                ? `hover:scale-105 active:scale-95 cursor-pointer ${getStatusColor(dayData.durum)}`
                                : 'bg-slate-200 border-slate-300 text-slate-400 opacity-60'
                            }`}
                          >
                            {isActiveDay ? getStatusAbbreviation(dayData.durum) : 'Ç'}
                          </button>
                          
                          {isActiveDay && dayData.gonderen && (
                            <span 
                              className="absolute top-0.5 right-0.5 text-[6px] text-amber-500 font-bold z-10 select-none cursor-help" 
                              title={`Formen tarafından gönderildi: ${dayData.gonderen}`}
                            >
                              👷
                            </span>
                          )}
                          
                          {/* Mini editable mesai box beneath */}
                          <div className="mt-1 flex items-center justify-center">
                            <input 
                              type="number"
                              disabled={!isActiveDay}
                              min={0}
                              max={16}
                              value={isActiveDay ? (dayData.mesaiSaati || "") : ""}
                              placeholder="-"
                              onChange={(e) => isActiveDay && handleMesaiChange(p.id, day, parseFloat(e.target.value) || 0)}
                              className={`w-7 text-[8px] font-bold font-mono text-center rounded border py-0.5 focus:outline-none ${
                                isActiveDay
                                  ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 focus:border-blue-500'
                                  : 'bg-slate-100 border-slate-200 text-slate-300'
                              }`}
                            />
                          </div>
                        </td>
                      );
                    });

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition">
                        
                        {/* Static Personel Name column */}
                        <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-900 sticky left-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)] z-10 border-r">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{p.ad} {p.soyad}</span>
                            <span className="text-[9px] text-[#2563EB] font-bold">{p.gorev} · {p.departman}</span>
                            <div className="text-[8px] text-slate-500 font-mono mt-0.5 space-y-0.5 leading-none">
                              <div>Giriş: {p.iseGirisTarihi || '-'}</div>
                              {p.istenCikisTarihi && (
                                <div className="text-rose-600 font-semibold">Çıkış: {p.istenCikisTarihi}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {rowCells}

                        {/* Summary cells */}
                        <td className="px-2 py-3 text-center whitespace-nowrap border-l font-bold text-emerald-700 bg-slate-50/50">
                          {totalGeldi} Gün
                        </td>
                        <td className="px-2 py-3 text-center whitespace-nowrap font-bold text-blue-700 font-mono bg-slate-50/50">
                          {totalMesai} Saat
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 📄 REPORT OVERLAYS: BOŞ PUANTAJ REPORT & DOLU GÜNCEL PUANTAJ REPORT     */}
      {/* ========================================================================= */}
      {printModal !== 'NONE' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-start justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-7xl shadow-2xl flex flex-col overflow-hidden my-4">
            
            {/* Modal Actions Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center px-6 shrink-0 print:hidden">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🖨️</span>
                <h3 className="font-display font-bold text-sm">
                  {printModal === 'BOS' ? 'Boş Şablon Şantiye Puantaj Cetveli Baskı Önizleme' : 'Dolu Güncel Şantiye Puantaj Cetveli Raporu'}
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow cursor-pointer"
                >
                  🖨️ Yazdır / PDF Olarak Kaydet (Ctrl+P)
                </button>
                <button
                  onClick={() => {
                    const el = document.querySelector('.printable-document');
                    if (el) {
                      const heading = "Kibritci_Insaat_Santiye_Puantaj_Cetveli";
                      const blob = new Blob([`
                        <html>
                          <head>
                            <meta charset="utf-8">
                            <title>Şantiye Raporu</title>
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
                      alert("GÜNCEL PUANTAJ RAPORU BAŞARIYLA DERLENDİ\n\nKibritçi İnşaat Taahhüt A.Ş. onaylı puantaj cetveli masaüstünüze HTML/Yazdırılabilir formatta başarıyla kaydedildi.");
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow cursor-pointer"
                >
                  💾 Masaüstüne HTML Rapor Dosyası Kaydet
                </button>
                <button
                  onClick={() => setPrintModal('NONE')}
                  className="bg-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Document Body — Kurumsal antetli A4 yatay format */}
            <div className="flex-1 overflow-auto bg-white p-8 text-slate-900 printable-document font-sans">
              <CorporateReportLayout
                orientation="landscape"
                docCode={`BELGE NO: KBR-PNT-2026-${printModal === 'BOS' ? 'BLANK' : 'FILLED'}`}
              >
              {/* Birim & dönem bilgisi */}
              <div className="mb-4 pb-3 border-b border-slate-200">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ŞANTİYE VE MERKEZ BORDRO VE PUANTAJ DENETLEME ŞEFLİĞİ</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Dönem: <strong className="text-slate-900 font-bold">{selectedMonth}. Ay / {selectedYear}</strong></p>
              </div>

              {/* Title Header Section */}
              <div className="text-center mb-6">
                <h2 className="text-sm font-bold text-slate-900 tracking-wider uppercase border-y border-slate-205 py-2.5 bg-slate-50">
                  {printModal === 'BOS' 
                    ? 'İAŞE VE ŞANTİYE SAHA ELEMANLARI BOŞ PUANTAJ REFAKAT CETVELİ' 
                    : 'RESMİ ŞANTİYE PERSONELİ FİİLİ ÇALIŞMA VE PUANTAJ RAPORU'}
                </h2>
                <p className="text-[9px] text-slate-400 mt-1 italic">
                  * Bu evrak, şantiye idaresi tarafından doldurulup imzalatıldıktan sonra finans merkezine iletilmek üzere hukuki belge niteliğindedir.
                </p>
              </div>

              {/* Printable Matrix Table */}
              <div className="border border-slate-350 rounded-md overflow-hidden mb-8">
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                      <th className="p-1 px-2 text-left border-r border-slate-300 w-48 font-bold">Personel Adı Soyadı &amp; Görevi</th>
                      {daysArray.map(day => {
                        const { isHoliday, name, isOfficial } = isSundayOrPublicHoliday(day);
                        let cellBg = "";
                        if (isHoliday) {
                          cellBg = isOfficial ? "bg-purple-100 font-extrabold text-purple-900 border-x border-purple-200" : "bg-orange-100 font-extrabold text-orange-900 border-x border-orange-200";
                        }
                        return (
                          <th 
                            key={day} 
                            className={`p-0.5 text-center border-r border-slate-300 font-bold text-[8px] ${cellBg}`}
                            style={{ width: '22px' }}
                            title={name}
                          >
                            {day}
                          </th>
                        );
                      })}
                      <th className="p-1 text-center w-12 border-l border-slate-300 font-bold">Giriş Gün</th>
                      <th className="p-1 text-center w-12 border-l border-slate-300 font-bold">Eksik (Yok)</th>
                      <th className="p-1 text-center w-12 border-l border-slate-300 font-bold">Mesai Saati</th>
                      <th className="p-1 text-center w-24 font-bold">Personel İmza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render actual loaded/filtered staff list */}
                    {filteredPersonel.map((p, idx) => {
                      const personYoklama = yoklamalar[p.id] || {};
                      let totalGeldi = 0;
                      let totalYok = 0;
                      let totalMesai = 0;

                      // Pre-scan to count
                      daysArray.forEach(day => {
                        const dayData = personYoklama[day] || { durum: 'Girilmedi', mesaiSaati: 0 };
                        if (isDayActiveForEmployee(p, day)) {
                          if (dayData.durum === 'Geldi') totalGeldi++;
                          if (dayData.durum === 'Yok') totalYok++;
                          totalMesai += dayData.mesaiSaati;
                        }
                      });

                      return (
                        <React.Fragment key={p.id}>
                          <tr className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-1.5 px-2 border-r border-slate-300 font-bold text-slate-900 bg-slate-50/50">
                              <div>{maskName(`${p.ad} ${p.soyad}`)}</div>
                              <div className="text-[8px] text-slate-400 uppercase font-medium">{p.gorev} · {p.departman}</div>
                              <div className="text-[7px] text-slate-500 font-mono">
                                Giriş: {p.iseGirisTarihi || '-'} {p.istenCikisTarihi ? `· Çıkış: ${p.istenCikisTarihi}` : ''}
                              </div>
                            </td>
                            
                            {daysArray.map(day => {
                              const isActiveDay = isDayActiveForEmployee(p, day);
                              const dayData = personYoklama[day] || { durum: 'Girilmedi', mesaiSaati: 0 };
                              let displayChar = "-";
                              
                              if (!isActiveDay) {
                                displayChar = "Ç"; // Çalışmıyor/Hizmet dışı
                              } else if (printModal === 'DOLU') {
                                displayChar = getStatusAbbreviation(dayData.durum);
                              }

                              const { isHoliday, isOfficial } = isSundayOrPublicHoliday(day);
                              let tdBg = "";
                              if (!isActiveDay) {
                                tdBg = "bg-slate-100 text-slate-400 font-semibold";
                              } else if (isHoliday) {
                                tdBg = isOfficial ? "bg-purple-50/60 font-bold text-purple-900 border-x border-purple-200/30" : "bg-orange-50/60 font-bold text-orange-950 border-x border-orange-200/30";
                              }

                              return (
                                <td key={day} className={`p-0.5 text-center border-r border-slate-300 text-[8px] font-mono relative ${tdBg}`}>
                                  <div className={`font-bold ${isActiveDay && dayData.durum === 'Yok' ? 'text-rose-600' : ''}`}>{displayChar}</div>
                                  {isActiveDay && dayData.gonderen && (
                                    <span className="absolute top-0 right-0 text-[5px] text-amber-500 font-bold" title="Formen Gönderdi">👷</span>
                                  )}
                                  {isActiveDay && printModal === 'DOLU' && dayData.mesaiSaati > 0 && (
                                    <div className="text-[7px] text-amber-600 font-bold">+{dayData.mesaiSaati}</div>
                                  )}
                                </td>
                              );
                            })}

                            <td className="p-1.5 text-center border-r border-slate-300 font-bold text-slate-800">
                              {printModal === 'DOLU' ? `${totalGeldi} G` : ""}
                            </td>
                            <td className="p-1.5 text-center border-r border-slate-300 font-bold font-mono text-rose-700 bg-rose-50/20">
                              {printModal === 'DOLU' ? `${totalYok} Gün` : ""}
                            </td>
                               <td className="p-1.5 text-center text-slate-300 italic text-[7px]">imza:</td>
                          </tr>
                          {printModal === 'DOLU' && (
                            <tr className="bg-slate-50/70 border-b border-slate-200 text-[8px]">
                              <td colSpan={daysInMonth + 5} className="p-2.5 px-4 text-slate-700 font-normal">
                                <div className="flex flex-col space-y-2.5 py-1">
                                  {/* Overtime hours (Mesai Cetveli) */}
                                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 w-full">
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                      <span className="shrink-0 inline-flex items-center justify-start font-black text-[9px] text-slate-700 uppercase tracking-wider bg-slate-100 border border-slate-200 px-2 py-1 rounded-md h-7 font-sans">
                                        ⏰ MESAİ CETVELİ:
                                      </span>
                                      <div className="flex flex-nowrap overflow-x-auto gap-1 pb-1 pr-2 max-w-[280px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-none scrollbar-thin scrollbar-thumb-slate-300">
                                        {daysArray.map(day => {
                                          const isActiveDay = isDayActiveForEmployee(p, day);
                                          const dayData = personYoklama[day] || { durum: 'Girilmedi', mesaiSaati: 0 };
                                          const hasOvertime = isActiveDay && dayData.mesaiSaati > 0;

                                          const { isHoliday, isOfficial } = isSundayOrPublicHoliday(day);
                                          let boxStyle = "bg-slate-50 text-slate-400 border-slate-150";
                                          
                                          if (!isActiveDay) {
                                            boxStyle = "bg-slate-200 text-slate-400 border-slate-350";
                                          } else if (hasOvertime) {
                                            boxStyle = "bg-blue-100 text-blue-800 border-blue-300 font-bold";
                                          } else if (isHoliday) {
                                            boxStyle = isOfficial 
                                              ? "bg-purple-100 text-purple-700 border-purple-200 font-semibold" 
                                              : "bg-orange-100 text-orange-700 border-orange-200 font-semibold";
                                          }

                                          return (
                                            <div key={day} className={`flex-shrink-0 flex flex-col items-center justify-center w-6.5 h-6.5 rounded-sm border text-[7px] font-mono leading-none ${boxStyle}`}>
                                              <span className="text-[5px] text-slate-400 block">{day}</span>
                                              <span className="mt-0.5">{!isActiveDay ? 'Ç' : hasOvertime ? `+${dayData.mesaiSaati}` : '0'}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                      <span className="text-[8.5px] font-bold text-emerald-800 font-mono bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 whitespace-nowrap">
                                        Gelen: {totalGeldi} Gün
                                      </span>
                                      <span className="text-[8.5px] font-bold text-rose-800 font-mono bg-rose-50 px-2.5 py-1 rounded border border-rose-200 whitespace-nowrap">
                                        Gelmeyen: {totalYok} Gün
                                      </span>
                                      <span className="text-[8.5px] font-bold text-blue-800 font-mono bg-blue-50 px-2.5 py-1 rounded border border-blue-200 whitespace-nowrap">
                                        Mesai: {totalMesai} Saat
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Additional empty rows for handwriting additions if it's the blank ticket */}
                    {printModal === 'BOS' && Array.from({ length: 6 }).map((_, extraIdx) => (
                      <tr key={`extra_${extraIdx}`} className="border-b border-slate-200 h-8">
                        <td className="p-1.5 px-2 border-r border-slate-300 text-slate-300 italic text-[8px]">
                          {extraIdx + 1}. İlave Personel Ekleme Satırı:
                        </td>
                        {daysArray.map(day => (
                          <td key={day} className="p-0.5 text-center border-r border-slate-300"></td>
                        ))}
                        <td className="p-1.5 text-center border-r border-slate-300"></td>
                        <td className="p-1.5 text-center border-r border-slate-300"></td>
                        <td className="p-1.5 text-center border-r border-slate-300"></td>
                        <td className="p-1 rounded text-slate-300 italic text-[7px]">imza:</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Sign-off Approval Bars arranged in strict order specified by user */}
              <div className="mt-12 text-xs">
                <div className="bg-[#1E4E78] text-white p-2 text-[9px] font-bold uppercase tracking-wider mb-6 rounded-md">
                  📌 RESMİ ŞANTİYE PUANTAJ DENETİM VE KANUNİ ONAY MERCİLERİ
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  
                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#8B1E1E] tracking-wider uppercase block mb-1">1. MUHASEBE</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Finansal hakediş ve Bordro Masası</span>
                    <div className="h-0.5 bg-slate-300 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">{maskName("Ayşe Demir")}</span>
                    <span className="text-[8px] text-slate-400 italic">Bordro Yetkilisi</span>
                  </div>

                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#1E4E78] tracking-wider uppercase block mb-1">2. İDARİ İŞLER</span>
                    <span className="text-[10px] text-slate-500 block mb-6">İnsan Kaynakları ve Şantiye Şefliği</span>
                    <div className="h-0.5 bg-slate-300 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">{maskName("Nuri Mutlu")}</span>
                    <span className="text-[8px] text-slate-400 italic">İdari İşler Şefi</span>
                  </div>

                  <div className="border border-slate-200 p-3 rounded-xl bg-slate-50/50">
                    <span className="font-extrabold text-[#1E4E78] tracking-wider uppercase block mb-1">3. ŞANTİYE ŞEFİ</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Saha organizasyonu ve fiili kontrol</span>
                    <div className="h-0.5 bg-slate-300 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">{maskName("Ayhan Yılmaz")}</span>
                    <span className="text-[8px] text-slate-400 italic">Şantiye Şefi</span>
                  </div>

                  <div className="border border-slate-150 p-3 rounded-xl bg-slate-50">
                    <span className="font-extrabold text-[#8B1E1E] tracking-wider uppercase block mb-1">4. PROJE MÜDÜRÜ</span>
                    <span className="text-[10px] text-slate-500 block mb-6">Yönetici Müteahhit ve Nihai Onay</span>
                    <div className="h-0.5 bg-slate-305 w-24 mx-auto mb-2"></div>
                    <span className="text-[10px] font-bold text-slate-800 block">{maskName("Kuzey Samet Atak")}</span>
                    <span className="text-[8px] text-slate-400 italic">Proje Müdürü</span>
                  </div>

                </div>
              </div>

              </CorporateReportLayout>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default YoklamaScreen;

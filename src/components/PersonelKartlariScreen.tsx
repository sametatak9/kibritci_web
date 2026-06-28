import React, { useState } from 'react';
import { 
  Users, User, Phone, Mail, MapPin, Calendar, CreditCard, 
  Truck, Tent, Clock, ClipboardList, Sparkles, ChevronRight, Activity 
} from 'lucide-react';
import { Personel, AylikYoklamaMap, AracBakim, KampKaydi, KampOdasi, HazirTutanak, KasaHareketi } from '../types/erp';

interface PersonelKartlariScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
  araclar: AracBakim[];
  kampKayitlari: KampKaydi[];
  kampOdalari: KampOdasi[];
  hazirTutanaklar?: HazirTutanak[];
  kasaHareketleri?: KasaHareketi[];
}

export const PersonelKartlariScreen: React.FC<PersonelKartlariScreenProps> = ({
  personeller,
  yoklamalar,
  araclar,
  kampKayitlari,
  kampOdalari,
  hazirTutanaklar = [],
  kasaHareketleri = []
}) => {
  const [selectedPersId, setSelectedPersId] = useState<string>(personeller[0]?.id || "");
  const selectedPersonnel = personeller.find(p => p.id === selectedPersId);

  // Remaining receivables math
  const getReceivableDetails = (p: Personel) => {
    // Basic calculation:
    // Worked days in current month (June 2026) * Daily wage (Salary / 30) - any Cash Advance (Avans) from kasa.
    const pYoklama = yoklamalar[p.id] || {};
    const workedDays = Object.values(pYoklama).filter((d: any) => d?.durum === 'Geldi').length;
    const dailyWage = p.maas / 30;
    const grossEarned = workedDays * dailyWage;

    // Check cash advances in kasa
    const personalAdvances = kasaHareketleri.filter(
      k => k.hareketTipi === 'ÇIKIŞ' && 
           k.referansTipi === 'MAAS' && 
           k.aciklama.toLowerCase().includes(p.ad.toLowerCase()) && 
           k.aciklama.toLowerCase().includes(p.soyad.toLowerCase())
    );
    const totalAvans = personalAdvances.reduce((acc, curr) => acc + curr.tutar, 0);
    const balance = Math.max(0, grossEarned - totalAvans);

    return {
      workedDays,
      grossEarned: Math.round(grossEarned),
      totalAvans: Math.round(totalAvans),
      balance: Math.round(balance)
    };
  };

  // Assigned vehicle
  const assignedVehicle = selectedPersonnel 
    ? araclar.find(a => a.sorumluPersonelId === selectedPersonnel.id) 
    : null;

  // Active camp room stay
  const activeStay = selectedPersonnel
    ? kampKayitlari.find(k => k.personelId === selectedPersonnel.id && k.durum === 'AKTIF')
    : null;
  const activeRoom = activeStay 
    ? kampOdalari.find(r => r.id === activeStay.odaId)
    : null;

  // Leave records (from hazirTutanaklar or mock list)
  const leaveTutanaklar = selectedPersonnel
    ? hazirTutanaklar.filter(
        t => t.personelId === selectedPersonnel.id && t.tutanakTipi === 'TESLİM'
      )
    : [];

  // Attendance calendar grid status helpers
  const getDayStatusColor = (durum: string) => {
    switch (durum) {
      case 'Geldi': return 'bg-emerald-500 text-white';
      case 'Yok': return 'bg-rose-500 text-white';
      case 'İzinli': return 'bg-blue-400 text-white';
      case 'Raporlu': return 'bg-amber-400 text-slate-900';
      case 'Pazar': case 'Tatil': return 'bg-slate-300 text-slate-700';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col font-sans select-none bg-slate-50/50 space-y-6">
      
      {/* Top Selector Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-xs gap-4 shrink-0">
        <div className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase">Personel Künyesi &amp; Raporlar</span>
          <h2 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
            👤 Şantiye Personel Detay ve Geçmiş Kartları
          </h2>
        </div>
        
        {/* Dropdown selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500">Personel Seçin:</span>
          <select
            value={selectedPersId}
            onChange={(e) => setSelectedPersId(e.target.value)}
            className="text-xs font-bold border border-[#e2e8f0] rounded-xl p-2.5 bg-slate-50 focus:border-blue-500 outline-none"
          >
            {personeller.map(p => (
              <option key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</option>
            ))}
          </select>
        </div>
      </div>

      {selectedPersonnel ? (
        <div className="flex-grow flex flex-col lg:flex-row gap-6">
          
          {/* LEFT 40%: General Info & Financials */}
          <div className="w-full lg:w-[400px] shrink-0 space-y-6">
            
            {/* General Card Profile */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-550/5 rounded-full -mr-8 -mt-8"></div>
              
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-blue-550 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md border border-blue-400/20">
                  {selectedPersonnel.ad[0]}{selectedPersonnel.soyad[0]}
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">{selectedPersonnel.gorev}</span>
                  <h3 className="font-display font-bold text-sm text-slate-900 mt-1">{selectedPersonnel.ad} {selectedPersonnel.soyad}</h3>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3.5 space-y-2.5 text-xs text-slate-650 font-medium">
                <div className="flex items-center space-x-2.5">
                  <Phone size={14} className="text-slate-400" />
                  <span>{selectedPersonnel.telefonNo || "Telefon Yok"}</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Mail size={14} className="text-slate-400" />
                  <span>{selectedPersonnel.eposta || "E-posta Belirtilmemiş"}</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Giriş: {selectedPersonnel.iseGirisTarihi}</span>
                </div>
                <div className="flex items-center space-x-2.5">
                  <MapPin size={14} className="text-slate-400" />
                  <span className="truncate">{selectedPersonnel.ilce} / {selectedPersonnel.il}</span>
                </div>
              </div>
            </div>

            {/* Financial Card Info */}
            {(() => {
              const fin = getReceivableDetails(selectedPersonnel);
              return (
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4 border border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>💵 HAKEDİŞ &amp; ALACAK HESABI</span>
                    <span className="text-amber-500 font-mono">Haziran 2026</span>
                  </h4>

                  <div className="space-y-2.5 text-xs text-slate-300 font-semibold">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Aylık Net Maaş:</span>
                      <span className="font-mono text-white">{selectedPersonnel.maas.toLocaleString('tr-TR')} TL</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Çalıştığı Gün:</span>
                      <span className="font-mono text-white">{fin.workedDays} Gün</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Kazanılan Hakediş:</span>
                      <span className="font-mono text-emerald-400">{fin.grossEarned.toLocaleString('tr-TR')} TL</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 pb-2.5">
                      <span className="text-slate-450">Dağıtılan Avans:</span>
                      <span className="font-mono text-rose-400">{fin.totalAvans.toLocaleString('tr-TR')} TL</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end pt-1 font-black text-amber-400">
                    <span className="text-xs">KALAN NET ALACAK:</span>
                    <span className="text-sm font-mono">{fin.balance.toLocaleString('tr-TR')} TL</span>
                  </div>
                </div>
              );
            })()}

            {/* Assigned Logistics & Lodgings info */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📋 ŞANTİYE ALAN TAHSİSLERİ</h4>
              
              <div className="space-y-3.5 text-xs font-semibold text-slate-700">
                {/* Vehicle */}
                <div className="flex items-start space-x-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/50">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Truck size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Tahsisli Araç</p>
                    <p className="text-slate-900 mt-0.5">{assignedVehicle ? `${assignedVehicle.plaka} - ${assignedVehicle.markaModel}` : "Araç Tahsisi Yok"}</p>
                  </div>
                </div>

                {/* Camp Room */}
                <div className="flex items-start space-x-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150/50">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Tent size={15} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Yatakhane Lojman Odası</p>
                    <p className="text-slate-900 mt-0.5">{activeRoom ? `${activeRoom.yerleskeAdi} / Oda ${activeRoom.odaNo}` : "Lojman Kaydı Yok"}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 60%: Attendance Calendar & History List */}
          <div className="flex-1 space-y-6">
            
            {/* Devam Grafiği Calendar Grid */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-500" />
                  📅 Günlük Devam Takvimi (Haziran 2026)
                </h4>
                <div className="flex gap-2 text-[8px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500 block"></span>Geldi</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500 block"></span>Yok</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-400 block"></span>İzin</span>
                </div>
              </div>

              {/* Grid 7 Columns for Days */}
              <div className="grid grid-cols-7 gap-2.5 text-center font-bold text-[10px]">
                {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(d => (
                  <div key={d} className="text-slate-400 uppercase tracking-wider">{d}</div>
                ))}
                {/* Simulated days for June 2026 (Starts on Monday June 1) */}
                {Array.from({ length: 30 }).map((_, idx) => {
                  const dayNo = idx + 1;
                  const pYoklama = yoklamalar[selectedPersonnel.id] || {};
                  const dayData = (pYoklama[dayNo] || { durum: 'Girilmedi' }) as any;
                  return (
                    <div 
                      key={idx} 
                      className={`h-9 border border-slate-100 rounded-lg flex flex-col items-center justify-center font-mono ${getDayStatusColor(dayData.durum)}`}
                    >
                      <span className="text-[8px] opacity-75">{dayNo}</span>
                      <span className="text-[7px] font-black tracking-tight">{dayData.durum === 'Geldi' ? 'G' : dayData.durum === 'Yok' ? 'Y' : dayData.durum === 'İzinli' ? 'İ' : dayData.durum === 'Raporlu' ? 'R' : dayData.durum[0] || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave certificates / Tutanaklar list */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ClipboardList size={14} className="text-slate-500" />
                İmzalı Evrak &amp; İzin Formları Arşivi
              </h4>

              <div className="space-y-3">
                {leaveTutanaklar.length === 0 ? (
                  <div className="h-20 border border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[10px] text-slate-400 font-medium italic">
                    Arşivlenmiş izin veya teslim tutanağı bulunmuyor.
                  </div>
                ) : (
                  leaveTutanaklar.map(t => (
                    <div key={t.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition text-xs font-semibold text-slate-700">
                      <div className="space-y-1">
                        <p className="text-slate-900">{t.konu}</p>
                        <p className="text-[9px] text-slate-450 font-mono">Kod: {t.belgeNo} · Tarih: {t.tarih}</p>
                      </div>
                      <ChevronRight size={15} className="text-slate-400" />
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="h-60 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
          <Sparkles size={36} className="text-slate-350 animate-pulse mb-3" />
          <p className="text-xs font-bold">Kayıtlı Personel Bulunmuyor</p>
          <p className="text-[10px] text-slate-400 mt-1">Lütfen Personel Yönetimi menüsünden yeni personel kaydı ekleyin.</p>
        </div>
      )}

    </div>
  );
};

export default PersonelKartlariScreen;

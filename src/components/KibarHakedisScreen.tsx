import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Calendar, Printer, ShieldCheck, CheckCircle2,
  RefreshCw, UserX
} from 'lucide-react';
import { db, saveDocument } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Personel, AylikYoklamaMap } from '../types/erp';
import { KibritciLogo } from './KibritciLogo';
import { iterateMonthYoklama } from '../lib/yoklamaUtils';

interface KibarHakedisScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
  sahaFaaliyetleri: any[];
  currentUser: any;
}

interface StaffHakedisRow {
  personel: Personel;
  geldiGun: number;
  tutar: number;
}

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const RATE_PER_DAY = 200;

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
  const [selectedMonth, setSelectedMonth] = useState(2);
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

  const allStaffRows = useMemo((): StaffHakedisRow[] => {
    const rows: StaffHakedisRow[] = [];
    personeller.forEach(p => {
      let geldiGun = 0;
      iterateMonthYoklama(yoklamalar[p.id], selectedYear, selectedMonth, (_day, data) => {
        if (data?.durum === 'Geldi') geldiGun++;
      });
      if (geldiGun > 0) {
        rows.push({ personel: p, geldiGun, tutar: geldiGun * RATE_PER_DAY });
      }
    });
    return rows.sort((a, b) =>
      `${a.personel.ad} ${a.personel.soyad}`.localeCompare(`${b.personel.ad} ${b.personel.soyad}`, 'tr')
    );
  }, [personeller, yoklamalar, selectedYear, selectedMonth]);

  const activeStaffRows = allStaffRows.filter(r => !excludedStaffIds.includes(r.personel.id));

  const monthlySahaFaaliyetleri = useMemo(
    () => filterByMonth(sahaFaaliyetleri, selectedYear, selectedMonth),
    [sahaFaaliyetleri, selectedYear, selectedMonth]
  );

  const monthlyKampFaaliyetleri = useMemo(
    () => filterByMonth(kampFaaliyetleri, selectedYear, selectedMonth),
    [kampFaaliyetleri, selectedYear, selectedMonth]
  );

  const totalPersonDays = activeStaffRows.reduce((s, r) => s + r.geldiGun, 0);
  const totalHakedis = activeStaffRows.reduce((s, r) => s + r.tutar, 0);

  const handleExcludeStaff = (staffId: string) => {
    setExcludedStaffIds(prev => [...prev, staffId]);
  };

  const handleIncludeStaff = (staffId: string) => {
    setExcludedStaffIds(prev => prev.filter(id => id !== staffId));
  };

  const handleSaveReport = async () => {
    setLoading(true);
    try {
      const reportId = `KIBAR-HKD-${donemKey}-${Date.now()}`;
      await saveDocument('kibarHakedisRaporlari', {
        id: reportId,
        donem: donemKey,
        donemLabel,
        yil: selectedYear,
        ay: selectedMonth,
        personelSayisi: activeStaffRows.length,
        toplamCalismaGunu: totalPersonDays,
        birimFiyat: RATE_PER_DAY,
        toplamTutar: totalHakedis,
        olusturan: currentUser?.email || 'sametatak9@gmail.com',
        olusturmaTarihi: new Date().toISOString(),
        faaliyetlerCount: monthlySahaFaaliyetleri.length + monthlyKampFaaliyetleri.length,
        durum: 'KAYDEDİLDİ',
      });
      showStatus('success', `${donemLabel} Kibar Hakediş Raporu kaydedildi!`);
    } catch (err: any) {
      showStatus('error', `Rapor kaydedilirken hata: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('kibar-report-print-area')?.innerHTML;
    if (!printContent) return;

    const htmlSnippet = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kibar_Hakedis_${donemKey}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body{font-family:Inter,sans-serif}@media print{.no-print{display:none}body{padding:0;margin:0;background:white}}</style>
      </head><body class="p-8 bg-white text-slate-900"><div class="max-w-4xl mx-auto border p-8 rounded-2xl">${printContent}</div>
      <script>window.onload=function(){window.print()}</script></body></html>`;

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
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 font-black">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider block w-fit">
              KİBAR ÖZEL ERİŞİM
            </span>
            <h1 className="text-lg font-black tracking-tight mt-1 text-white">KİBAR HAKEDİŞ DÜZENLEME PANELİ</h1>
            <p className="text-[11px] text-slate-400">Aylık yoklama ve saha faaliyetlerine göre dönemsel hakediş raporu</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-2 px-3">
            <Calendar size={14} className="text-amber-500" />
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
                allStaffRows.map(({ personel: p, geldiGun, tutar }) => {
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
                          {p.gorev || 'İŞÇİ'} • {geldiGun} gün • ₺{tutar.toLocaleString('tr-TR')}
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
            <h3 className="text-xs font-black text-slate-850 uppercase tracking-wider">Hakediş Özeti</h3>
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
            <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl text-center">
              <span className="text-[9px] text-amber-700 font-bold block uppercase">{donemLabel} Toplam Hakediş</span>
              <span className="text-lg font-black text-amber-600 font-mono mt-1 block">₺{totalHakedis.toLocaleString('tr-TR')}</span>
              <span className="text-[8px] text-slate-400 block mt-1">{totalPersonDays} gün × ₺{RATE_PER_DAY}</span>
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
                <button onClick={() => setReportType('E-IMZALI')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition flex items-center space-x-1 ${reportType === 'E-IMZALI' ? 'bg-amber-500 text-slate-950' : 'text-slate-500'}`}>
                  <ShieldCheck size={11} /><span>E-İmzalı</span>
                </button>
              </div>
            </div>
            <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center space-x-1.5 shadow cursor-pointer">
              <Printer size={13} /><span>Yazdır / PDF</span>
            </button>
          </div>

          <div className="bg-white border rounded-3xl p-6 shadow-sm overflow-hidden">
            <div id="kibar-report-print-area" className="bg-white p-4 space-y-6 text-xs text-slate-800">

              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <KibritciLogo size="lg" />
                  <div>
                    <h2 className="text-base font-black text-[#1E4E78] uppercase">KİBRİTÇİ İNŞAAT TAAHHÜT A.Ş.</h2>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">YÖNETİM VE DENETİM KURULU ÖZEL RAPORU</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">Dönem: <strong>{donemLabel}</strong></p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="border border-slate-900 text-[9px] font-bold px-3 py-1 bg-slate-50 uppercase tracking-widest block mb-1">
                    BELGE NO: KBR-KIBAR-{donemKey}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono">Döküm: {new Date().toLocaleDateString('tr-TR')}</span>
                </div>
              </div>

              <div className="text-center bg-slate-50 border-y py-2.5">
                <h3 className="font-bold text-slate-900 tracking-wider uppercase text-xs">
                  ŞANTİYE SAHASI KİBAR AYLIK HAKEDİŞ VE FAALİYET MUTABAKATI — {donemLabel.toUpperCase()}
                </h3>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-[9px] text-[#1E4E78] uppercase tracking-wider block">SAHA FAALİYET RAPORLARI ({monthlySahaFaaliyetleri.length} kayıt)</span>
                {monthlySahaFaaliyetleri.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">Bu dönemde saha faaliyeti kaydı yok.</p>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden text-[10px] max-h-48 overflow-y-auto">
                    {monthlySahaFaaliyetleri.map((sf, idx) => (
                      <div key={idx} className="p-2.5">
                        <div className="flex justify-between font-bold text-slate-900">
                          <span>{sf.baslik || 'Saha Faaliyeti'}</span>
                          <span className="text-slate-400 font-mono">{sf.tarih}</span>
                        </div>
                        <p className="text-slate-600">{sf.detay || sf.aciklama}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-bold text-[9px] text-[#1E4E78] uppercase tracking-wider block">KAMP / LOJMAN FAALİYETLERİ ({monthlyKampFaaliyetleri.length} kayıt)</span>
                {monthlyKampFaaliyetleri.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">Bu dönemde kamp faaliyeti kaydı yok.</p>
                ) : (
                  <div className="border rounded-xl divide-y overflow-hidden text-[10px] max-h-36 overflow-y-auto">
                    {monthlyKampFaaliyetleri.map((kf, idx) => (
                      <div key={idx} className="p-2.5">
                        <div className="flex justify-between font-bold">
                          <span>{kf.faaliyetTipi}</span>
                          <span className="text-slate-400 font-mono">{kf.tarih}</span>
                        </div>
                        <p className="text-slate-600">{kf.aciklama}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="font-bold text-[9px] text-[#1E4E78] uppercase tracking-wider block">FİİLİ HAKEDİŞE TABİ PERSONEL DETAYI</span>
                <div className="border rounded-xl overflow-hidden text-[9px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b text-slate-600 font-bold uppercase text-[8px]">
                        <th className="p-2 w-10 text-center">SIRA</th>
                        <th className="p-2">AD SOYAD</th>
                        <th className="p-2">GÖREV / ÜNVAN</th>
                        <th className="p-2 text-center">ÇALIŞMA GÜNÜ</th>
                        <th className="p-2 text-right">GÜNLÜK BEDEL</th>
                        <th className="p-2 text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-medium text-slate-700">
                      {activeStaffRows.map(({ personel: p, geldiGun, tutar }, idx) => (
                        <tr key={p.id}>
                          <td className="p-2 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 font-bold text-slate-900">{p.ad} {p.soyad}</td>
                          <td className="p-2">{p.gorev || 'İŞÇİ'}</td>
                          <td className="p-2 text-center font-mono">{geldiGun}</td>
                          <td className="p-2 text-right font-mono">₺{RATE_PER_DAY.toLocaleString('tr-TR')},00</td>
                          <td className="p-2 text-right font-mono font-bold">₺{tutar.toLocaleString('tr-TR')},00</td>
                        </tr>
                      ))}
                      {activeStaffRows.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-6 text-slate-400 italic">Kayıt yok</td></tr>
                      )}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-t">
                        <td colSpan={3} className="p-2 text-right uppercase">Dönem Toplamı:</td>
                        <td className="p-2 text-center font-mono">{totalPersonDays}</td>
                        <td className="p-2 text-right font-mono text-slate-400">—</td>
                        <td className="p-2 text-right font-mono text-amber-700 font-black">₺{totalHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-6 border-t">
                {reportType === 'E-IMZALI' ? (
                  <div className="border border-amber-500/30 rounded-xl p-3 bg-amber-500/5 flex items-center space-x-3">
                    <ShieldCheck size={26} className="text-amber-600 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-amber-700 uppercase block">E-İMZA İLE ONAYLANMIŞTIR</span>
                      <p className="text-[9px] text-slate-500">Doğrulayan: {currentUser?.email || 'sametatak9@gmail.com'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="border p-2.5 rounded-xl bg-slate-50/50">
                      <span className="font-extrabold text-[#1e4e78] block">Hakedişi Düzenleyen</span>
                      <div className="h-8" /><span className="text-[8px] font-bold text-slate-400">İmza</span>
                    </div>
                    <div className="border p-2.5 rounded-xl bg-slate-50/50">
                      <span className="font-extrabold text-[#1e4e78] block">Proje Koordinatörü</span>
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

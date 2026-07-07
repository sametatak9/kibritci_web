import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Camera, FileText, Loader2, RefreshCw } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { todayDateKey } from '../lib/dateKeyUtils';
import { normalizeKampFaaliyetForDisplay } from '../lib/mobilOnayUtils';
import {
  buildKampFaaliyetReportHtml,
  formatKampFaaliyetDonemLabel,
  KampGunlukFaaliyetKaydi,
  openKampFaaliyetReport,
} from '../lib/kampFaaliyetReport';

interface KampFaaliyetTakipTabProps {
  currentUser?: { email?: string };
}

export const KampFaaliyetTakipTab: React.FC<KampFaaliyetTakipTabProps> = ({ currentUser }) => {
  const [selectedDate, setSelectedDate] = useState(todayDateKey());
  const [records, setRecords] = useState<KampGunlukFaaliyetKaydi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'kampGunlukFaaliyetleri'),
      (snap) => {
        const list: KampGunlukFaaliyetKaydi[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...(d.data() as object) } as KampGunlukFaaliyetKaydi));
        list.sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));
        setRecords(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const dayRecords = useMemo(
    () => records.filter((r) => r.tarih === selectedDate),
    [records, selectedDate]
  );

  const monthRecords = useMemo(() => {
    const prefix = selectedDate.slice(0, 7);
    return records.filter((r) => String(r.tarih || '').startsWith(prefix));
  }, [records, selectedDate]);

  const handleReport = (mode: 'day' | 'month') => {
    const list = mode === 'day' ? dayRecords : monthRecords;
    const html = buildKampFaaliyetReportHtml({
      mode,
      anchorDate: selectedDate,
      records: list,
      olusturan: currentUser?.email || 'Kamp Yönetimi',
    });
    const label = formatKampFaaliyetDonemLabel(selectedDate, mode);
    openKampFaaliyetReport(
      html,
      mode === 'day' ? `Kamp Günlük Faaliyet — ${label}` : `Kamp Aylık Faaliyet — ${label}`
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-emerald-700 text-white p-4 shrink-0">
        <span className="text-[10px] font-bold tracking-widest text-emerald-200 uppercase">Kampçı Mobil Senkron</span>
        <h3 className="font-display font-semibold text-sm mt-1">📋 Faaliyet Takip &amp; Raporlama</h3>
        <p className="text-[10px] text-emerald-100 mt-1 max-w-2xl">
          Kampçı mobil ekranından girilen günlük faaliyet kayıtları burada listelenir. Seçili tarihe göre günlük veya aylık resimli evrak oluşturabilirsiniz.
        </p>
      </div>

      <div className="p-4 border-b bg-slate-50 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Seçili Tarih</label>
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
            <Calendar size={14} className="text-emerald-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleReport('day')}
          disabled={dayRecords.length === 0}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-4 py-2.5 rounded-lg disabled:opacity-40"
        >
          <FileText size={13} />
          GÜNÜ RAPORLA ({dayRecords.length})
        </button>

        <button
          type="button"
          onClick={() => handleReport('month')}
          disabled={monthRecords.length === 0}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-4 py-2.5 rounded-lg disabled:opacity-40"
        >
          <FileText size={13} />
          AYI RAPORLA ({monthRecords.length})
        </button>

        <div className="ml-auto text-[10px] text-slate-500 font-semibold">
          Toplam arşiv: {records.length} kayıt
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="py-16 flex flex-col items-center text-slate-500 gap-2">
            <Loader2 className="animate-spin text-emerald-600" size={24} />
            <span className="text-xs font-bold">Kamp faaliyet kayıtları yükleniyor...</span>
          </div>
        ) : dayRecords.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <RefreshCw size={28} className="mx-auto opacity-40" />
            <p className="text-sm font-bold text-slate-600">{selectedDate} için faaliyet kaydı yok</p>
            <p className="text-xs">Kampçı mobil uygulamasından günlük faaliyet girişi yapıldığında burada görünür.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {dayRecords.map((doc) => {
              const view = normalizeKampFaaliyetForDisplay(doc as Record<string, unknown>);
              return (
                <article
                  key={doc.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:border-emerald-300 transition"
                >
                  {view.photo ? (
                    <div className="aspect-video bg-slate-100 border-b">
                      <img
                        src={view.photo}
                        alt="Kamp faaliyet"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-50 border-b flex flex-col items-center justify-center text-slate-400">
                      <Camera size={28} className="opacity-40" />
                      <span className="text-[10px] font-bold mt-1">Fotoğraf yok</span>
                    </div>
                  )}

                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                          {view.kategori}
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-1">📍 {view.yerleske || '—'}</p>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {doc.durum || '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-4">{view.aciklama || '—'}</p>
                    <p className="text-[9px] text-slate-400">👤 {view.kaydeden}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KampFaaliyetTakipTab;

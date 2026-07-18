import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera, ChevronLeft, ChevronRight, Search, Users, Calendar,
  Clock, AlertTriangle, CheckCircle2, XCircle, FileText, MapPin
} from 'lucide-react';
import { AylikYoklamaMap, Personel, SahaFaaliyeti } from '../types/erp';
import {
  formatMesaiFaaliyetLabel,
  getFaaliyetFotolar,
  isMesaiSahaFaaliyet,
} from '../lib/sahaFaaliyetUtils';
import {
  buildFaaliyetPersoneller,
  buildPersonelAyOzeti,
  formatFaaliyetTarihLabel,
  getPersonFaaliyetleriInPeriod,
} from '../lib/faaliyetPersonelUtils';
import { normalizeTurkishName } from '../lib/yoklamaUtils';

interface FaaliyetPersonelScreenProps {
  personeller: Personel[];
  yoklamalar: AylikYoklamaMap;
  sahaFaaliyetleri?: SahaFaaliyeti[];
}

const DURUM_STYLE: Record<string, string> = {
  Geldi: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Yok: 'bg-rose-100 text-rose-800 border-rose-200',
  İzinli: 'bg-sky-100 text-sky-800 border-sky-200',
  Raporlu: 'bg-violet-100 text-violet-800 border-violet-200',
  Pazar: 'bg-slate-100 text-slate-500 border-slate-200',
  Girilmedi: 'bg-white text-slate-300 border-slate-100',
};

const DURUM_KISA: Record<string, string> = {
  Geldi: 'G',
  Yok: 'Y',
  İzinli: 'İ',
  Raporlu: 'R',
  Pazar: 'P',
  Girilmedi: '·',
};

export const FaaliyetPersonelScreen: React.FC<FaaliyetPersonelScreenProps> = ({
  personeller,
  yoklamalar,
  sahaFaaliyetleri = [],
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const periodLabel = useMemo(
    () =>
      new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('tr-TR', {
        month: 'long',
        year: 'numeric',
      }),
    [selectedYear, selectedMonth]
  );

  const faaliyetPersoneller = useMemo(
    () => buildFaaliyetPersoneller(sahaFaaliyetleri, personeller, selectedYear, selectedMonth),
    [sahaFaaliyetleri, personeller, selectedYear, selectedMonth]
  );

  const filteredList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const base = !term
      ? faaliyetPersoneller
      : faaliyetPersoneller.filter((p) => {
          const full = `${p.ad} ${p.soyad}`.toLowerCase();
          return (
            full.includes(term) ||
            (p.tcNo || '').includes(term) ||
            (p.gorev || '').toLowerCase().includes(term)
          );
        });
    // isim tekilleştirme
    const byName = new Map<string, Personel>();
    for (const p of base) {
      const key = normalizeTurkishName(`${p.ad} ${p.soyad}`);
      if (!byName.has(key)) byName.set(key, p);
    }
    return Array.from(byName.values());
  }, [faaliyetPersoneller, searchTerm]);

  useEffect(() => {
    if (!selectedPersonId) return;
    if (!filteredList.some((p) => p.id === selectedPersonId)) {
      setSelectedPersonId(filteredList[0]?.id || null);
    }
  }, [filteredList, selectedPersonId]);

  useEffect(() => {
    // Ay değişince ilk personeli seç
    setSelectedPersonId((prev) => {
      if (prev && filteredList.some((p) => p.id === prev)) return prev;
      return filteredList[0]?.id || null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const selectedPerson = useMemo(
    () => filteredList.find((p) => p.id === selectedPersonId) || null,
    [filteredList, selectedPersonId]
  );

  const personFaaliyetleri = useMemo(
    () =>
      selectedPerson
        ? getPersonFaaliyetleriInPeriod(
            selectedPerson,
            sahaFaaliyetleri,
            selectedYear,
            selectedMonth
          )
        : [],
    [selectedPerson, sahaFaaliyetleri, selectedYear, selectedMonth]
  );

  const ayOzeti = useMemo(
    () =>
      selectedPerson
        ? buildPersonelAyOzeti(selectedPerson, yoklamalar, selectedYear, selectedMonth)
        : null,
    [selectedPerson, yoklamalar, selectedYear, selectedMonth]
  );

  const shiftMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    if (y < 2024 || y > 2027) return;
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 rounded-3xl p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/90">
              Personel · Faaliyet Geçmişi
            </p>
            <h1 className="text-xl sm:text-2xl font-black mt-1 tracking-tight">
              Faaliyeti Olan Personeller
            </h1>
            <p className="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              Bu sekme salt okunur bir çalışma günlüğü gibidir: personel işe gelmiş mi, o ay ne
              yapmış, hangi parsel/blokta çalışmış, mesai ve devamsızlık özeti nedir — hepsi burada.
              Yoklama düzenleme Yoklama &amp; Puantaj sekmesinde kalır.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl p-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
              title="Önceki ay"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2 items-center px-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-900/60 border border-white/20 rounded-lg text-xs font-bold px-2 py-1.5 cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleDateString('tr-TR', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900/60 border border-white/20 rounded-lg text-xs font-bold px-2 py-1.5 cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-2 rounded-xl hover:bg-white/10 cursor-pointer"
              title="Sonraki ay"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full px-3 py-1 font-bold">
            <Calendar size={12} className="text-amber-300" /> {periodLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full px-3 py-1 font-bold">
            <Users size={12} className="text-amber-300" /> {faaliyetPersoneller.length} personel
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-full px-3 py-1 font-semibold text-slate-300">
            Eski aylarda kayıt yoksa liste boş görünür — beklenen durumdur
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[60vh]">
        {/* Sol: personel listesi */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden max-h-[75vh]">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ad, TC veya görev ara…"
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400"
              />
            </label>
            <p className="text-[10px] text-slate-500 font-semibold">
              {filteredList.length} sonuç · tıklayınca sağda özet açılır
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Camera className="mx-auto opacity-30" size={28} />
                <p className="font-bold text-slate-500">Bu dönemde faaliyetli personel yok</p>
                <p>Formen / idari saha faaliyetleri girdikçe burada listelenir.</p>
              </div>
            ) : (
              filteredList.map((p) => {
                const count = getPersonFaaliyetleriInPeriod(
                  p,
                  sahaFaaliyetleri,
                  selectedYear,
                  selectedMonth
                ).length;
                const active = p.id === selectedPersonId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersonId(p.id)}
                    className={`w-full text-left px-3 py-3 border-b border-slate-50 transition cursor-pointer ${
                      active ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">
                          {p.ad} {p.soyad}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {p.gorev || 'Görev yok'}
                          {p.tcNo ? ` · ${p.tcNo}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-[9px] font-black bg-slate-900 text-white rounded-full px-2 py-0.5">
                        {count} iş
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Sağ: detay */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-4">
          {!selectedPerson || !ayOzeti ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Soldan bir personel seçin; o ay geldiği günler, mesai/devamsızlık ve yaptığı işler burada açılır.
            </div>
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap justify-between gap-3 items-start">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {selectedPerson.ad} {selectedPerson.soyad}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {[selectedPerson.gorev, selectedPerson.tcNo && `TC ${selectedPerson.tcNo}`, selectedPerson.iseGirisTarihi && `Giriş ${selectedPerson.iseGirisTarihi}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-2 font-medium">
                      {periodLabel} döneminde bu personel için {personFaaliyetleri.length} saha
                      faaliyet kaydı bulundu.
                    </p>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Salt okunur · düzenleme yok
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 text-center">
                    <CheckCircle2 size={14} className="mx-auto text-emerald-600 mb-1" />
                    <p className="text-[9px] font-black text-emerald-800 uppercase">Geldi</p>
                    <p className="text-lg font-black text-emerald-900">{ayOzeti.geldiGun}</p>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-3 text-center">
                    <XCircle size={14} className="mx-auto text-rose-600 mb-1" />
                    <p className="text-[9px] font-black text-rose-800 uppercase">Yok / Devamsız</p>
                    <p className="text-lg font-black text-rose-900">{ayOzeti.yokGun}</p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-3 text-center">
                    <FileText size={14} className="mx-auto text-sky-600 mb-1" />
                    <p className="text-[9px] font-black text-sky-800 uppercase">İzinli</p>
                    <p className="text-lg font-black text-sky-900">{ayOzeti.izinliGun}</p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/80 p-3 text-center">
                    <AlertTriangle size={14} className="mx-auto text-violet-600 mb-1" />
                    <p className="text-[9px] font-black text-violet-800 uppercase">Raporlu</p>
                    <p className="text-lg font-black text-violet-900">{ayOzeti.raporluGun}</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-center col-span-2 sm:col-span-1">
                    <Clock size={14} className="mx-auto text-amber-600 mb-1" />
                    <p className="text-[9px] font-black text-amber-800 uppercase">Toplam Mesai</p>
                    <p className="text-lg font-black text-amber-900">{ayOzeti.toplamMesai} sa</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Günlük yoklama / mesai şeridi (değiştirilemez)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {ayOzeti.gunDetay.map((g) => (
                      <div
                        key={g.day}
                        title={`${g.day}. gün: ${g.durum}${g.mesaiSaati ? ` · mesai ${g.mesaiSaati}` : ''}`}
                        className={`w-8 rounded-md border text-center py-1 ${DURUM_STYLE[g.durum] || DURUM_STYLE.Girilmedi}`}
                      >
                        <div className="text-[8px] font-bold opacity-70">{g.day}</div>
                        <div className="text-[10px] font-black leading-none">
                          {DURUM_KISA[g.durum] || '·'}
                        </div>
                        {g.mesaiSaati > 0 && (
                          <div className="text-[7px] font-bold mt-0.5 opacity-80">{g.mesaiSaati}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Camera size={14} className="text-amber-600" />
                  Yaptığı işler / saha faaliyetleri ({personFaaliyetleri.length})
                </h3>

                {personFaaliyetleri.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
                    Bu ay için faaliyet kartı yok.
                  </div>
                ) : (
                  personFaaliyetleri.map((f) => {
                    const fotolar = getFaaliyetFotolar(f);
                    const foto = fotolar[0] || '';
                    return (
                      <article
                        key={f.id}
                        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col sm:flex-row"
                      >
                        <div
                          className={`shrink-0 bg-slate-100 relative ${
                            foto ? 'sm:w-52 h-40 sm:h-auto min-h-[10rem]' : 'hidden'
                          }`}
                        >
                          {foto ? (
                            <button
                              type="button"
                              className="w-full h-full cursor-pointer"
                              onClick={() => setLightboxUrl(foto)}
                            >
                              <img
                                src={foto}
                                alt="Saha"
                                className="w-full h-full object-cover min-h-[10rem]"
                                loading="lazy"
                              />
                              {fotolar.length > 1 && (
                                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  +{fotolar.length - 1} foto
                                </span>
                              )}
                            </button>
                          ) : null}
                        </div>
                        <div className="flex-1 p-4 min-w-0 space-y-2">
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-700">
                              {formatFaaliyetTarihLabel(f.tarih)}
                            </span>
                            {f.kaynakEkran && (
                              <span className="text-[9px] font-black uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                {String(f.kaynakEkran).replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-2">
                            {f.isNiteligi || 'İş niteliği belirtilmemiş'}
                            {isMesaiSahaFaaliyet(f) && (
                              <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                Mesai faaliyet
                              </span>
                            )}
                          </h4>
                          {(f.parsel || f.blok) && (
                            <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                              <MapPin size={12} />
                              {[f.parsel && `Parsel ${f.parsel}`, f.blok && `Blok ${f.blok}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          {f.aciklama ? (
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {f.aciklama}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">Açıklama girilmemiş.</p>
                          )}
                          {isMesaiSahaFaaliyet(f) && (
                            <p className="text-[11px] text-amber-800 font-semibold">
                              Mesai: {formatMesaiFaaliyetLabel(f, personeller) || '—'}
                            </p>
                          )}
                          {(f.ustaSayisi != null || f.isciSayisi != null) && (
                            <p className="text-[10px] text-slate-400">
                              {[
                                f.ustaSayisi != null && `Usta: ${f.ustaSayisi}`,
                                f.isciSayisi != null && `İşçi: ${f.isciSayisi}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          {!foto && (
                            <p className="text-[10px] text-slate-400 italic flex items-center gap-1">
                              <Camera size={12} /> Fotoğraf eklenmemiş
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Büyütülmüş saha fotoğrafı"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default FaaliyetPersonelScreen;

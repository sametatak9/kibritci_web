import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, HardHat, Zap, UtensilsCrossed, Archive, Mail, Printer,
  Download, CheckCircle2, Plus,
} from 'lucide-react';
import {
  CariKart,
  OperatorFaaliyet,
  HazirTutanak,
  TaseronKesintiRaporu,
  TaseronEnerjiKaydi,
  TaseronYemekKaydi,
} from '../types/erp';
import {
  getTaseronCariKartlar,
  faaliyetlerForTaseron,
  ilkOkumaFromOncekiAy,
  enerjiToplamTutar,
  yemekAylikOzet,
  hesaplaKesintiTutari,
  ayAdi,
} from '../lib/taseronUtils';
import {
  buildEnerjiKesintiReportHtml,
  buildYemekRaporHtml,
  indirIsMakinesiRaporu,
  mailtoForRapor,
  yazdirIsMakinesiRaporu,
} from '../lib/taseronReportUtils';
import { downloadKibritciReportHtml } from '../lib/kibritciReportTemplate';

type SubPage = 'makine' | 'enerji' | 'yemek' | 'arsiv';

interface TaseronKesintiScreenProps {
  cariKartlar: CariKart[];
  operatorFaaliyetleri: OperatorFaaliyet[];
  setOperatorFaaliyetleri?: React.Dispatch<React.SetStateAction<OperatorFaaliyet[]>>;
  hazirTutanaklar: HazirTutanak[];
  taseronKesintiRaporlari: TaseronKesintiRaporu[];
  setTaseronKesintiRaporlari: React.Dispatch<React.SetStateAction<TaseronKesintiRaporu[]>>;
  taseronEnerjiKayitlari: TaseronEnerjiKaydi[];
  setTaseronEnerjiKayitlari: React.Dispatch<React.SetStateAction<TaseronEnerjiKaydi[]>>;
  taseronYemekKayitlari: TaseronYemekKaydi[];
  setTaseronYemekKayitlari: React.Dispatch<React.SetStateAction<TaseronYemekKaydi[]>>;
  addNotification?: (mesaj: string) => void;
  currentUser?: { email?: string };
}

export const TaseronKesintiScreen: React.FC<TaseronKesintiScreenProps> = ({
  cariKartlar,
  operatorFaaliyetleri,
  setOperatorFaaliyetleri,
  hazirTutanaklar,
  taseronKesintiRaporlari,
  setTaseronKesintiRaporlari,
  taseronEnerjiKayitlari,
  setTaseronEnerjiKayitlari,
  taseronYemekKayitlari,
  setTaseronYemekKayitlari,
  addNotification,
  currentUser,
}) => {
  const taseronlar = useMemo(() => getTaseronCariKartlar(cariKartlar), [cariKartlar]);
  const [selectedTaseronId, setSelectedTaseronId] = useState('');
  const [subPage, setSubPage] = useState<SubPage>('makine');
  const [selectedAy, setSelectedAy] = useState(new Date().getMonth() + 1);
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear());
  const [saatlikUcret, setSaatlikUcret] = useState(1500);

  const selectedTaseron = taseronlar.find((t) => t.id === selectedTaseronId);

  useEffect(() => {
    if (!selectedTaseronId && taseronlar.length > 0) {
      setSelectedTaseronId(taseronlar[0].id);
    }
  }, [taseronlar, selectedTaseronId]);

  const donemAyStr = String(selectedAy).padStart(2, '0');
  const donemYilStr = String(selectedYil);

  const bekleyenMakineRaporlari = useMemo(
    () =>
      taseronKesintiRaporlari.filter(
        (r) =>
          (r.kesintiTipi === 'IS_MAKINESI' || !r.kesintiTipi) &&
          r.ucretOnayBekliyor &&
          (!selectedTaseron || r.taseronFirmaId === selectedTaseron.id || r.taseronFirmaAdi === selectedTaseron?.unvan)
      ),
    [taseronKesintiRaporlari, selectedTaseron]
  );

  const aylikFaaliyetler = useMemo(() => {
    if (!selectedTaseron) return [];
    return faaliyetlerForTaseron(operatorFaaliyetleri, selectedTaseron, selectedAy, selectedYil);
  }, [operatorFaaliyetleri, selectedTaseron, selectedAy, selectedYil]);

  const mevcutEnerji = useMemo(
    () =>
      taseronEnerjiKayitlari.find(
        (k) =>
          k.taseronCariId === selectedTaseronId &&
          k.donemAy === donemAyStr &&
          k.donemYil === donemYilStr
      ),
    [taseronEnerjiKayitlari, selectedTaseronId, donemAyStr, donemYilStr]
  );

  const [elek, setElek] = useState({ ilk: 0, son: 0, birim: 3.5 });
  const [su, setSu] = useState({ ilk: 0, son: 0, birim: 12 });
  const [gaz, setGaz] = useState({ ilk: 0, son: 0, birim: 8.5 });

  useEffect(() => {
    if (!selectedTaseronId) return;
    if (mevcutEnerji) {
      setElek({ ilk: mevcutEnerji.elektrik.ilkOkuma, son: mevcutEnerji.elektrik.sonOkuma, birim: mevcutEnerji.elektrik.birimFiyat });
      setSu({ ilk: mevcutEnerji.su.ilkOkuma, son: mevcutEnerji.su.sonOkuma, birim: mevcutEnerji.su.birimFiyat });
      setGaz({ ilk: mevcutEnerji.dogalgaz.ilkOkuma, son: mevcutEnerji.dogalgaz.sonOkuma, birim: mevcutEnerji.dogalgaz.birimFiyat });
    } else {
      const prev = ilkOkumaFromOncekiAy(taseronEnerjiKayitlari, selectedTaseronId, selectedAy, selectedYil);
      setElek({ ilk: prev.elektrik, son: prev.elektrik, birim: 3.5 });
      setSu({ ilk: prev.su, son: prev.su, birim: 12 });
      setGaz({ ilk: prev.dogalgaz, son: prev.dogalgaz, birim: 8.5 });
    }
  }, [selectedTaseronId, selectedAy, selectedYil, mevcutEnerji, taseronEnerjiKayitlari]);

  const [yemekTarih, setYemekTarih] = useState(new Date().toISOString().split('T')[0]);
  const [yemekSabah, setYemekSabah] = useState(0);
  const [yemekOgle, setYemekOgle] = useState(0);
  const [yemekAksam, setYemekAksam] = useState(0);

  const handleUcretOnayla = (raporId: string) => {
    if (saatlikUcret <= 0) {
      alert('Geçerli bir saatlik ücret girin.');
      return;
    }
    setTaseronKesintiRaporlari((prev) =>
      prev.map((r) => {
        if (r.id !== raporId) return r;
        const tutar = hesaplaKesintiTutari(r.toplamSaat, saatlikUcret);
        return {
          ...r,
          saatlikUcret,
          kesintiTutari: tutar,
          ucretOnayBekliyor: false,
          onayDurumu: 'ONAYLANDI' as const,
        };
      })
    );
    addNotification?.(`İş makinesi kesinti raporu onaylandı (${saatlikUcret} TL/sa).`);
  };

  const handleElleMakineRaporu = () => {
    if (!selectedTaseron) return;
    const faaliyetler = aylikFaaliyetler.filter((f) => !f.kesintiYansitildi);
    if (faaliyetler.length === 0) {
      alert('Bu dönem için yansıtılmamış faaliyet yok.');
      return;
    }
    const toplamSaat = faaliyetler.reduce((s, f) => s + f.calismaSuresi, 0);
    const rapor: TaseronKesintiRaporu = {
      id: `tkr_${Date.now()}`,
      kesintiTipi: 'IS_MAKINESI',
      taseronFirmaAdi: selectedTaseron.unvan,
      taseronFirmaId: selectedTaseron.id,
      donemAy: donemAyStr,
      donemYil: donemYilStr,
      toplamSaat,
      saatlikUcret: 0,
      kesintiTutari: 0,
      ucretOnayBekliyor: true,
      faaliyetler,
      onayDurumu: 'TASLAK',
      olusturanKullanici: currentUser?.email || 'yönetici',
      olusturmaTarihi: new Date().toISOString(),
    };
    setTaseronKesintiRaporlari((prev) => [rapor, ...prev]);
    if (setOperatorFaaliyetleri) {
      const ids = new Set(faaliyetler.map((f) => f.id));
      setOperatorFaaliyetleri((prev) =>
        prev.map((f) => (ids.has(f.id) ? { ...f, kesintiYansitildi: true } : f))
      );
    }
    alert('Taslak rapor oluşturuldu — saat ücretini girip onaylayın.');
  };

  const handleEnerjiKaydet = () => {
    if (!selectedTaseron) return;
    const kayit: TaseronEnerjiKaydi = {
      id: mevcutEnerji?.id || `ten_${Date.now()}`,
      taseronCariId: selectedTaseron.id,
      taseronFirmaAdi: selectedTaseron.unvan,
      donemAy: donemAyStr,
      donemYil: donemYilStr,
      elektrik: { ilkOkuma: elek.ilk, sonOkuma: elek.son, birimFiyat: elek.birim },
      su: { ilkOkuma: su.ilk, sonOkuma: su.son, birimFiyat: su.birim },
      dogalgaz: { ilkOkuma: gaz.ilk, sonOkuma: gaz.son, birimFiyat: gaz.birim },
      olusturmaTarihi: new Date().toISOString(),
      olusturanKullanici: currentUser?.email,
    };
    setTaseronEnerjiKayitlari((prev) => {
      const rest = prev.filter((k) => k.id !== kayit.id);
      return [kayit, ...rest.filter((k) => !(k.taseronCariId === kayit.taseronCariId && k.donemAy === kayit.donemAy && k.donemYil === kayit.donemYil))];
    });
    alert('Sayaç kaydı kaydedildi. Son okuma bir sonraki ayın ilk okuması olacaktır.');
  };

  const handleEnerjiRapor = () => {
    if (!selectedTaseron || !mevcutEnerji) {
      alert('Önce sayaç kaydını kaydedin.');
      return;
    }
    const tutar = enerjiToplamTutar(mevcutEnerji);
    const rapor: TaseronKesintiRaporu = {
      id: `tkr_en_${Date.now()}`,
      kesintiTipi: 'ENERJI',
      taseronFirmaAdi: selectedTaseron.unvan,
      taseronFirmaId: selectedTaseron.id,
      donemAy: donemAyStr,
      donemYil: donemYilStr,
      toplamSaat: 0,
      saatlikUcret: 0,
      kesintiTutari: tutar,
      faaliyetler: [],
      enerjiDetay: mevcutEnerji,
      onayDurumu: 'ONAYLANDI',
      olusturanKullanici: currentUser?.email || 'yönetici',
      olusturmaTarihi: new Date().toISOString(),
    };
    setTaseronKesintiRaporlari((prev) => [rapor, ...prev]);
    const html = buildEnerjiKesintiReportHtml(selectedTaseron.unvan, selectedAy, selectedYil, mevcutEnerji);
    downloadKibritciReportHtml(html, `Kibritci_Enerji_${selectedTaseron.unvan}_${donemAyStr}_${donemYilStr}.html`);
  };

  const handleYemekKaydet = () => {
    if (!selectedTaseron) return;
    const kayit: TaseronYemekKaydi = {
      id: `tym_${Date.now()}`,
      taseronCariId: selectedTaseron.id,
      taseronFirmaAdi: selectedTaseron.unvan,
      tarih: yemekTarih,
      sabah: yemekSabah,
      ogle: yemekOgle,
      aksam: yemekAksam,
    };
    setTaseronYemekKayitlari((prev) => [
      kayit,
      ...prev.filter((k) => !(k.taseronCariId === kayit.taseronCariId && k.tarih === kayit.tarih)),
    ]);
    setYemekSabah(0);
    setYemekOgle(0);
    setYemekAksam(0);
  };

  const handleYemekRapor = () => {
    if (!selectedTaseron) return;
    const ozet = yemekAylikOzet(taseronYemekKayitlari, selectedTaseron.id, selectedAy, selectedYil);
    const gunluk = taseronYemekKayitlari
      .filter((k) => {
        if (k.taseronCariId !== selectedTaseron.id) return false;
        const d = new Date(k.tarih);
        return d.getMonth() + 1 === selectedAy && d.getFullYear() === selectedYil;
      })
      .map((k) => ({ tarih: k.tarih, sabah: k.sabah, ogle: k.ogle, aksam: k.aksam }));
    if (gunluk.length === 0) {
      alert('Bu ay için yemek kaydı yok.');
      return;
    }
    const rapor: TaseronKesintiRaporu = {
      id: `tkr_ym_${Date.now()}`,
      kesintiTipi: 'YEMEK',
      taseronFirmaAdi: selectedTaseron.unvan,
      taseronFirmaId: selectedTaseron.id,
      donemAy: donemAyStr,
      donemYil: donemYilStr,
      toplamSaat: 0,
      saatlikUcret: 0,
      kesintiTutari: 0,
      faaliyetler: [],
      yemekOzet: ozet,
      onayDurumu: 'ONAYLANDI',
      olusturanKullanici: currentUser?.email || 'yönetici',
      olusturmaTarihi: new Date().toISOString(),
    };
    setTaseronKesintiRaporlari((prev) => [rapor, ...prev]);
    const html = buildYemekRaporHtml(selectedTaseron.unvan, selectedAy, selectedYil, ozet, gunluk);
    downloadKibritciReportHtml(html, `Kibritci_Yemek_${selectedTaseron.unvan}_${donemAyStr}.html`);
  };

  const arsivRaporlari = useMemo(() => {
    if (!selectedTaseron) return [];
    return taseronKesintiRaporlari.filter(
      (r) => r.taseronFirmaId === selectedTaseron.id || r.taseronFirmaAdi === selectedTaseron.unvan
    );
  }, [taseronKesintiRaporlari, selectedTaseron]);

  const cezaToplam = useMemo(() => {
    if (!selectedTaseron) return 0;
    return hazirTutanaklar
      .filter(
        (t) =>
          t.tutanakTipi === 'CEZA' &&
          (t.cariKartId === selectedTaseron.id || t.taseronAdi === selectedTaseron.unvan)
      )
      .reduce((s, t) => s + (t.cezaTutari || 0), 0);
  }, [hazirTutanaklar, selectedTaseron]);

  const SayacBlock = ({
    label,
    icon,
    state,
    setState,
    unit,
  }: {
    label: string;
    icon: string;
    state: { ilk: number; son: number; birim: number };
    setState: React.Dispatch<React.SetStateAction<{ ilk: number; son: number; birim: number }>>;
    unit: string;
  }) => (
    <div className="bg-slate-50 border rounded-2xl p-3 space-y-2">
      <div className="flex justify-between text-[10px] font-bold">
        <span>{icon} {label}</span>
        <span>Fark: {Math.max(0, state.son - state.ilk)} {unit}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="number" placeholder="İlk" value={state.ilk || ''} onChange={(e) => setState((s) => ({ ...s, ilk: Number(e.target.value) }))} className="p-2 border rounded-lg text-center text-xs" />
        <input type="number" placeholder="Son" value={state.son || ''} onChange={(e) => setState((s) => ({ ...s, son: Number(e.target.value) }))} className="p-2 border rounded-lg text-center text-xs" />
        <input type="number" step="0.01" placeholder="Birim ₺" value={state.birim || ''} onChange={(e) => setState((s) => ({ ...s, birim: Number(e.target.value) }))} className="p-2 border rounded-lg text-center text-xs" />
      </div>
      <p className="text-[9px] text-right font-bold text-slate-600">
        Tutar: {(Math.max(0, state.son - state.ilk) * state.birim).toLocaleString('tr-TR')} TL
      </p>
    </div>
  );

  return (
    <div className="flex-grow p-3 sm:p-4 lg:p-6 min-h-[calc(100vh-52px)] overflow-y-auto font-sans bg-slate-50/50 space-y-4 lg:space-y-5">
      <div className="bg-slate-900 text-white rounded-3xl p-5 flex flex-wrap gap-4 justify-between items-start">
        <div>
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Taşeron Yönetimi</span>
          <h2 className="text-sm font-black flex items-center gap-2 mt-1">
            <Building2 size={16} /> Kesinti &amp; Ay Sonu Raporları
          </h2>
          <p className="text-[10px] text-slate-400 mt-1 max-w-xl">
            Cari kartlarda <strong>TASERON</strong> tipindeki firmalar listelenir. İş makinesi, enerji, yemek ve ceza kesintileri ayrı raporlanır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <select
            value={selectedTaseronId}
            onChange={(e) => setSelectedTaseronId(e.target.value)}
            className="text-xs font-bold p-2.5 bg-slate-800 border border-slate-700 rounded-xl min-w-[200px]"
          >
            {taseronlar.length === 0 ? (
              <option value="">Taşeron cari kartı yok — Cari/Stok sekmesinden TASERON ekleyin</option>
            ) : (
              taseronlar.map((t) => (
                <option key={t.id} value={t.id}>{t.unvan} ({t.kod})</option>
              ))
            )}
          </select>
          <select value={selectedAy} onChange={(e) => setSelectedAy(Number(e.target.value))} className="text-xs p-2.5 bg-slate-800 border border-slate-700 rounded-xl">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{ayAdi(i + 1)}</option>
            ))}
          </select>
          <select value={selectedYil} onChange={(e) => setSelectedYil(Number(e.target.value))} className="text-xs p-2.5 bg-slate-800 border border-slate-700 rounded-xl">
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['makine', 'İş Makinesi', HardHat],
            ['enerji', 'Elektrik / Su / Gaz', Zap],
            ['yemek', 'Yemek Sayımı', UtensilsCrossed],
            ['arsiv', 'Rapor Arşivi', Archive],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubPage(key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${subPage === key ? 'bg-amber-500 text-slate-950' : 'bg-white border text-slate-700 hover:bg-slate-50'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {!selectedTaseron ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-slate-500 text-sm">
          Taşeron seçmek için önce cari kartlara <strong>kartTipi: TASERON</strong> ile firma ekleyin.
        </div>
      ) : (
        <>
          {subPage === 'makine' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-800">Yönetici — Saat Ücreti Onayı</h3>
                <div className="flex gap-2 items-end">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Saatlik Ücret (TL)</label>
                    <input type="number" value={saatlikUcret} onChange={(e) => setSaatlikUcret(Number(e.target.value))} className="w-full mt-1 p-2 border rounded-xl text-xs font-mono" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Formül: <strong>Kesinti = Toplam Saat × Saatlik Ücret</strong>. Operatör sekmesinden gelen raporlar ücret girilene kadar bekler.
                </p>
                {bekleyenMakineRaporlari.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Onay bekleyen iş makinesi raporu yok.</p>
                ) : (
                  bekleyenMakineRaporlari.map((r) => (
                    <div key={r.id} className="border rounded-xl p-3 bg-amber-50/50 space-y-2">
                      <p className="text-xs font-bold">{r.taseronFirmaAdi} · {r.donemAy}/{r.donemYil}</p>
                      <p className="text-[10px]">Toplam: {r.toplamSaat.toFixed(1)} sa · {r.faaliyetler.length} faaliyet</p>
                      <button type="button" onClick={() => handleUcretOnayla(r.id)} className="w-full py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1">
                        <CheckCircle2 size={14} /> Ücreti Onayla ({saatlikUcret} TL/sa → {hesaplaKesintiTutari(r.toplamSaat, saatlikUcret).toLocaleString('tr-TR')} TL)
                      </button>
                    </div>
                  ))
                )}
                <button type="button" onClick={handleElleMakineRaporu} className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1">
                  <Plus size={14} /> Dönem Faaliyetlerinden Taslak Oluştur
                </button>
              </div>
              <div className="bg-white border rounded-2xl p-5 space-y-2 max-h-[480px] overflow-y-auto">
                <h3 className="text-xs font-black uppercase text-slate-800 mb-2">{ayAdi(selectedAy)} {selectedYil} Faaliyetleri</h3>
                {aylikFaaliyetler.length === 0 ? (
                  <p className="text-xs text-slate-400">Kayıt yok.</p>
                ) : (
                  aylikFaaliyetler.map((f) => (
                    <div key={f.id} className="text-[10px] border-b py-2 flex justify-between gap-2">
                      <span>{f.tarih} · {f.yapilanIs}</span>
                      <span className="font-mono font-bold shrink-0">{f.calismaSuresi.toFixed(1)} sa</span>
                    </div>
                  ))
                )}
                {cezaToplam > 0 && (
                  <p className="text-[10px] text-rose-600 font-bold pt-2">Ceza tutanakları (ayrı rapor): {cezaToplam.toLocaleString('tr-TR')} TL</p>
                )}
              </div>
            </div>
          )}

          {subPage === 'enerji' && (
            <div className="bg-white border rounded-2xl p-5 space-y-4 max-w-2xl">
              <p className="text-[10px] text-slate-500">Aylık tek kayıt. Son okuma, sonraki ayın ilk okuması olur.</p>
              <SayacBlock label="Elektrik (kWh)" icon="⚡" state={elek} setState={setElek} unit="kWh" />
              <SayacBlock label="Su (m³)" icon="💧" state={su} setState={setSu} unit="m³" />
              <SayacBlock label="Doğalgaz (m³)" icon="🔥" state={gaz} setState={setGaz} unit="m³" />
              <div className="flex gap-2">
                <button type="button" onClick={handleEnerjiKaydet} className="flex-1 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer">Kaydet</button>
                <button type="button" onClick={handleEnerjiRapor} className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl cursor-pointer">Ay Sonu Rapor + Arşiv</button>
              </div>
            </div>
          )}

          {subPage === 'yemek' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-black uppercase">Günlük Yemek Girişi</h3>
                <input type="date" value={yemekTarih} onChange={(e) => setYemekTarih(e.target.value)} className="w-full p-2 border rounded-xl text-xs" />
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-bold">Sabah</label><input type="number" min={0} value={yemekSabah || ''} onChange={(e) => setYemekSabah(Number(e.target.value))} className="w-full p-2 border rounded-lg text-center text-xs" /></div>
                  <div><label className="text-[9px] font-bold">Öğle</label><input type="number" min={0} value={yemekOgle || ''} onChange={(e) => setYemekOgle(Number(e.target.value))} className="w-full p-2 border rounded-lg text-center text-xs" /></div>
                  <div><label className="text-[9px] font-bold">Akşam</label><input type="number" min={0} value={yemekAksam || ''} onChange={(e) => setYemekAksam(Number(e.target.value))} className="w-full p-2 border rounded-lg text-center text-xs" /></div>
                </div>
                <button type="button" onClick={handleYemekKaydet} className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer">Günü Kaydet</button>
                <button type="button" onClick={handleYemekRapor} className="w-full py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer">Ay Sonu Yemek Raporu</button>
              </div>
              <div className="bg-white border rounded-2xl p-5">
                <h3 className="text-xs font-black uppercase mb-3">Ay Özeti</h3>
                {(() => {
                  const o = yemekAylikOzet(taseronYemekKayitlari, selectedTaseron.id, selectedAy, selectedYil);
                  return (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <p>Sabah: <strong>{o.sabah}</strong></p>
                      <p>Öğle: <strong>{o.ogle}</strong></p>
                      <p>Akşam: <strong>{o.aksam}</strong></p>
                      <p>Gün kaydı: <strong>{o.gunSayisi}</strong></p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {subPage === 'arsiv' && (
            <div className="space-y-3">
              {arsivRaporlari.length === 0 ? (
                <div className="bg-white border rounded-2xl p-8 text-center text-slate-400 text-xs">Henüz rapor yok.</div>
              ) : (
                arsivRaporlari.map((r) => (
                  <div key={r.id} className="bg-white border rounded-2xl p-4 flex flex-wrap justify-between gap-3 items-start">
                    <div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 uppercase">{r.kesintiTipi || 'IS_MAKINESI'}</span>
                      <p className="text-xs font-bold mt-1">{r.taseronFirmaAdi} · {ayAdi(Number(r.donemAy))} {r.donemYil}</p>
                      <p className="text-[10px] text-slate-500">{r.onayDurumu} · {r.kesintiTipi === 'YEMEK' ? 'Adet raporu' : `${r.kesintiTutari.toLocaleString('tr-TR')} TL`}</p>
                    </div>
                    <div className="flex gap-1">
                      {r.kesintiTipi === 'IS_MAKINESI' && !r.ucretOnayBekliyor && (
                        <>
                          <button type="button" onClick={() => yazdirIsMakinesiRaporu(r)} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer" title="Yazdır"><Printer size={14} /></button>
                          <button type="button" onClick={() => indirIsMakinesiRaporu(r)} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer" title="İndir"><Download size={14} /></button>
                          <button type="button" onClick={() => mailtoForRapor(`Kibritçi — ${r.taseronFirmaAdi} İş Makinesi Kesinti`, '', r)} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer" title="E-posta"><Mail size={14} /></button>
                        </>
                      )}
                      {r.kesintiTipi === 'ENERJI' && r.enerjiDetay && (
                        <button type="button" onClick={() => downloadKibritciReportHtml(buildEnerjiKesintiReportHtml(r.taseronFirmaAdi, Number(r.donemAy), Number(r.donemYil), r.enerjiDetay!), `enerji_${r.id}.html`)} className="p-2 border rounded-lg cursor-pointer"><Download size={14} /></button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaseronKesintiScreen;

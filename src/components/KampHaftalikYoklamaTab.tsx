import React, { useMemo, useState } from 'react';
import { Calendar, Loader2, Mail, Save, Play } from 'lucide-react';
import {
  AylikYoklamaMap,
  KampKaydi,
  KampOdasi,
  Personel,
  YoklamaDurum,
} from '../types/erp';
import {
  OdaYoklamaSatir,
  archiveHaftalikYoklamaRaporu,
  buildHaftalikYoklamaRaporu,
  buildOdaYoklamaSatirlari,
  diffOdaYoklamaSatir,
  emailHaftalikYoklamaRaporu,
  getCurrentMonthMeta,
  getHaftalikGunNumaralari,
  mergeHaftalikIntoYoklamalar,
} from '../lib/kampHaftalikYoklama';

const DURUMLAR: YoklamaDurum[] = ['Geldi', 'Yok', 'İzinli', 'Raporlu', 'Pazar', 'Tatil', 'Girilmedi'];

interface KampHaftalikYoklamaTabProps {
  kampOdalari: KampOdasi[];
  kampKayitlari: KampKaydi[];
  yoklamalar: AylikYoklamaMap;
  setYoklamalar: (updater: AylikYoklamaMap | ((y: AylikYoklamaMap) => AylikYoklamaMap)) => void;
  personeller: Personel[];
  currentUser?: { email?: string };
  addNotification?: (mesaj: string) => void;
}

export const KampHaftalikYoklamaTab: React.FC<KampHaftalikYoklamaTabProps> = ({
  kampOdalari,
  kampKayitlari,
  yoklamalar,
  setYoklamalar,
  personeller,
  currentUser,
  addNotification,
}) => {
  const [started, setStarted] = useState(false);
  const [satirlar, setSatirlar] = useState<OdaYoklamaSatir[]>([]);
  const [savedOdaDiffs, setSavedOdaDiffs] = useState<string[][]>([]);
  const [selectedOdaId, setSelectedOdaId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gunNumaralari = useMemo(() => getHaftalikGunNumaralari(), []);
  const { ayAdi } = getCurrentMonthMeta();

  const odalar = useMemo(() => {
    const ids = new Set(satirlar.map((s) => s.odaId));
    return kampOdalari.filter((r) => ids.has(r.id));
  }, [satirlar, kampOdalari]);

  const handleBaslat = () => {
    const rows = buildOdaYoklamaSatirlari(
      kampOdalari,
      kampKayitlari,
      yoklamalar,
      personeller,
      gunNumaralari
    );
    if (rows.length === 0) {
      alert('Aktif konaklayan personel bulunamadı. Önce oda yerleşimi yapın.');
      return;
    }
    setSatirlar(rows);
    setSavedOdaDiffs([]);
    setStarted(true);
    setSelectedOdaId(rows[0]?.odaId ?? null);
  };

  const updateSatir = (idx: number, gunNo: number, field: 'durum' | 'mesaiSaati', value: string | number) => {
    setSatirlar((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        return {
          ...row,
          gunler: row.gunler.map((g) =>
            g.gunNo === gunNo
              ? { ...g, [field]: field === 'mesaiSaati' ? Number(value) : value }
              : g
          ),
        };
      })
    );
  };

  const handleOdayiKaydet = (odaId: string) => {
    const odaSatirlari = satirlar.filter((s) => s.odaId === odaId);
    const diffs = odaSatirlari.map(diffOdaYoklamaSatir).filter((d) => d.length > 0);
    if (diffs.length === 0) {
      alert('Bu odada değişiklik yok.');
      return;
    }
    setSavedOdaDiffs((prev) => [...prev, ...diffs]);
    setSatirlar((prev) =>
      prev.map((row) =>
        row.odaId === odaId
          ? { ...row, originalGunler: row.gunler.map((g) => ({ ...g })) }
          : row
      )
    );
    alert(`Oda kaydedildi. ${diffs.length} personel için değişiklik rapora eklendi.`);
  };

  const handleYoklamayiKaydet = async () => {
    setSaving(true);
    try {
      const pendingDiffs = satirlar.map(diffOdaYoklamaSatir).filter((d) => d.length > 0);
      const allDiffs = [...savedOdaDiffs, ...pendingDiffs];
      const merged = mergeHaftalikIntoYoklamalar(yoklamalar, satirlar);
      setYoklamalar(merged);

      const hazirlayan = currentUser?.email?.split('@')[0] ?? 'Kampçı';
      const rapor = buildHaftalikYoklamaRaporu(allDiffs, hazirlayan);
      await archiveHaftalikYoklamaRaporu(rapor, hazirlayan);
      emailHaftalikYoklamaRaporu(rapor, `Kamp Haftalık Yoklama — ${ayAdi}`);

      if (addNotification) {
        addNotification(`Kamp haftalık yoklama kaydedildi ve yönetime raporlandı (${ayAdi}).`);
      }
      alert('Yoklama güncellendi, rapor arşivlendi ve e-posta penceresi açıldı.');
      setStarted(false);
      setSatirlar([]);
      setSavedOdaDiffs([]);
    } catch (err) {
      console.error(err);
      alert('Yoklama kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (!started) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto">
        <Calendar size={40} className="mx-auto text-blue-500" />
        <h3 className="font-bold text-slate-800">Haftalık Yoklama</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Başlat dediğinizde kamp odalarındaki aktif personelin mevcut aylık yoklaması yüklenir.
          Oda bazında düzenleyip kaydedin; sonunda tüm değişiklikler raporlanır ve yönetime gönderilir.
        </p>
        <p className="text-[10px] font-bold text-slate-400 uppercase">{ayAdi} · Son 7 gün</p>
        <button
          type="button"
          onClick={handleBaslat}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl inline-flex items-center gap-2 cursor-pointer"
        >
          <Play size={14} />
          Haftalık Yoklamayı Başlat
        </button>
      </div>
    );
  }

  const visibleSatirlar = selectedOdaId
    ? satirlar.filter((s) => s.odaId === selectedOdaId)
    : satirlar;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-3">
        <span className="text-xs font-bold text-blue-900">{ayAdi} — Haftalık yoklama düzenleme</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleYoklamayiKaydet}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black px-4 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            Yoklamayı Kaydet &amp; Raporla
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {odalar.map((oda) => (
          <button
            key={oda.id}
            type="button"
            onClick={() => setSelectedOdaId(oda.id)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border cursor-pointer ${
              selectedOdaId === oda.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {oda.yerleskeAdi} · {oda.odaNo}
          </button>
        ))}
      </div>

      {selectedOdaId && (
        <button
          type="button"
          onClick={() => handleOdayiKaydet(selectedOdaId)}
          className="text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
        >
          <Save size={12} />
          Seçili Odayı Kaydet (farkları rapora yaz)
        </button>
      )}

      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-slate-900 text-white text-left">
              <th className="p-2">Personel</th>
              <th className="p-2">Firma</th>
              {gunNumaralari.map((g) => (
                <th key={g} className="p-2 text-center">G{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSatirlar.map((row, idx) => {
              const globalIdx = satirlar.indexOf(row);
              return (
                <tr key={`${row.odaId}-${row.personelIsim}`} className="border-b border-slate-100">
                  <td className="p-2 font-bold text-slate-800">{row.personelIsim}</td>
                  <td className="p-2 text-slate-500">{row.firma || '—'}</td>
                  {row.gunler.map((g) => (
                    <td key={g.gunNo} className="p-1">
                      <select
                        value={g.durum}
                        onChange={(e) => updateSatir(globalIdx, g.gunNo, 'durum', e.target.value)}
                        className="w-full text-[9px] border rounded p-0.5 mb-0.5"
                      >
                        {DURUMLAR.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        value={g.mesaiSaati}
                        onChange={(e) => updateSatir(globalIdx, g.gunNo, 'mesaiSaati', e.target.value)}
                        className="w-full text-[9px] border rounded p-0.5 text-center"
                        title="Mesai saati"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visibleSatirlar.some((r) => !r.personelId) && (
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2">
          ⚠️ Personel ID eşleşmeyen kayıtlar yoklamaya yazılmaz. Taşeronları personel kartına dönüştürün veya DB&apos;den seçin.
        </p>
      )}
    </div>
  );
};

export default KampHaftalikYoklamaTab;

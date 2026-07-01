import React, { useEffect, useMemo, useState } from 'react';
import { Link2, ChevronRight, CheckCircle2, Package, Truck, CreditCard } from 'lucide-react';
import {
  EvrakBaglantiGrubu,
  Fatura,
  Irsaliye,
  KalemBaglantisi,
  SatinAlmaTalebi,
} from '../types/erp';
import {
  applyEvrakBinding,
  buildBaglantiGrubu,
  suggestKalemBaglantilari,
} from '../lib/evrakBaglamaUtils';

export type BaglamaAnchor = 'satin_alma' | 'irsaliye' | 'fatura';

interface EvrakBaglamaWizardProps {
  accent: 'blue' | 'emerald';
  anchorHint?: BaglamaAnchor;
  satinAlmaTalepleri: SatinAlmaTalebi[];
  irsaliyeler: Irsaliye[];
  faturalar: Fatura[];
  setIrsaliyeler: React.Dispatch<React.SetStateAction<Irsaliye[]>>;
  setFaturalar: React.Dispatch<React.SetStateAction<Fatura[]>>;
  setEvrakBaglantiGruplari: React.Dispatch<React.SetStateAction<EvrakBaglantiGrubu[]>>;
  currentUser?: { email?: string };
  onComplete?: () => void;
  prefillSaId?: string;
  prefillIrIds?: string[];
  prefillFaturaId?: string;
}

export const EvrakBaglamaWizard: React.FC<EvrakBaglamaWizardProps> = ({
  accent,
  anchorHint = 'fatura',
  satinAlmaTalepleri,
  irsaliyeler,
  faturalar,
  setIrsaliyeler,
  setFaturalar,
  setEvrakBaglantiGruplari,
  currentUser,
  onComplete,
  prefillSaId,
  prefillIrIds,
  prefillFaturaId,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [anchor, setAnchor] = useState<BaglamaAnchor>(anchorHint);
  const [saId, setSaId] = useState(prefillSaId || '');
  const [irIds, setIrIds] = useState<string[]>(prefillIrIds || []);
  const [faturaId, setFaturaId] = useState(prefillFaturaId || '');
  const [kalemLinks, setKalemLinks] = useState<KalemBaglantisi[]>([]);

  const accentBtn = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700';
  const accentRing = accent === 'emerald' ? 'ring-emerald-500' : 'ring-blue-500';

  const selectedSa = satinAlmaTalepleri.find((s) => s.saId === saId);
  const selectedIrs = irsaliyeler.filter((ir) => irIds.includes(ir.id));
  const selectedFatura = faturalar.find((f) => f.id === faturaId);

  const availableIrs = useMemo(() => {
    if (saId) return irsaliyeler.filter((ir) => !ir.saId || ir.saId === saId);
    return irsaliyeler;
  }, [irsaliyeler, saId]);

  useEffect(() => {
    if (prefillSaId) setSaId(prefillSaId);
    if (prefillIrIds?.length) setIrIds(prefillIrIds);
    if (prefillFaturaId) setFaturaId(prefillFaturaId);
  }, [prefillSaId, prefillIrIds, prefillFaturaId]);

  const step1Valid = () => {
    const docCount = (saId ? 1 : 0) + (irIds.length ? 1 : 0) + (faturaId ? 1 : 0);
    return docCount >= 2 || (saId && irIds.length > 0) || (faturaId && irIds.length > 0);
  };

  const goStep2 = () => {
    if (!step1Valid()) {
      alert('En az iki evrak türünü bağlayın (ör. Satın Alma + İrsaliye veya İrsaliye + Fatura).');
      return;
    }
    const suggested = suggestKalemBaglantilari(selectedSa, selectedIrs, selectedFatura);
    setKalemLinks(suggested);
    setStep(2);
  };

  const toggleIr = (id: string) => {
    setIrIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleKalemOnay = (id: string) => {
    setKalemLinks((prev) =>
      prev.map((k) => (k.id === id ? { ...k, onaylandi: !k.onaylandi } : k))
    );
  };

  const confirmBinding = () => {
    const onayli = kalemLinks.filter((k) => k.onaylandi);
    if (onayli.length === 0) {
      alert('En az bir kalem bağlantısını onaylayın.');
      return;
    }

    const input = {
      saId: saId || undefined,
      irsaliyeIds: irIds,
      faturaId: faturaId || undefined,
      kalemBaglantilari: onayli,
    };

    const { irsaliyeler: nextIrs, faturalar: nextFt } = applyEvrakBinding(
      input,
      irsaliyeler,
      faturalar
    );
    setIrsaliyeler(nextIrs);
    setFaturalar(nextFt);

    const grup = buildBaglantiGrubu(
      input,
      nextIrs,
      nextFt,
      satinAlmaTalepleri,
      currentUser?.email
    );
    setEvrakBaglantiGruplari((prev) => [grup, ...prev.filter((g) => g.id !== grup.id)]);

    setStep(1);
    setSaId('');
    setIrIds([]);
    setFaturaId('');
    setKalemLinks([]);
    onComplete?.();
    alert(
      'Bağlama tamamlandı. Evraklar "Bağlı Evraklar" listesine alındı ve YZ Karşılaştır sekmesindeki havuza eklendi.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide">
        <span className={`px-3 py-1.5 rounded-full ${step === 1 ? accentBtn + ' text-white' : 'bg-slate-200 text-slate-600'}`}>
          1 · ID Bağlama
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className={`px-3 py-1.5 rounded-full ${step === 2 ? accentBtn + ' text-white' : 'bg-slate-200 text-slate-600'}`}>
          2 · Kalem Onayı
        </span>
      </div>

      {step === 1 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase">Başlangıç noktası</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['satin_alma', 'Satın Alma', Package],
                  ['irsaliye', 'İrsaliye', Truck],
                  ['fatura', 'Fatura', CreditCard],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAnchor(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    anchor === key ? `ring-2 ${accentRing} border-transparent bg-slate-50` : 'border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
            <p className="text-xs text-slate-600">
              Satın alma, irsaliye ve/veya fatura seçin. İsterseniz yalnızca irsaliye–fatura da bağlayabilirsiniz.
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Satın Alma (PO)</label>
              <select
                value={saId}
                onChange={(e) => setSaId(e.target.value)}
                className="w-full mt-1 text-xs border rounded-xl p-2.5 bg-slate-50"
              >
                <option value="">— Seçiniz —</option>
                {satinAlmaTalepleri.map((s) => (
                  <option key={s.id} value={s.saId}>
                    {s.saId} · {s.talepEden}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">İrsaliyeler (çoklu)</label>
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-xl divide-y">
                {availableIrs.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 italic">İrsaliye yok</p>
                ) : (
                  availableIrs.map((ir) => (
                    <label
                      key={ir.id}
                      className="flex items-center gap-2 p-2.5 text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={irIds.includes(ir.id)}
                        onChange={() => toggleIr(ir.id)}
                      />
                      <span className="font-mono font-bold">{ir.irsaliyeNo}</span>
                      <span className="text-slate-500">{ir.cariUnvan}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Fatura</label>
              <select
                value={faturaId}
                onChange={(e) => setFaturaId(e.target.value)}
                className="w-full mt-1 text-xs border rounded-xl p-2.5 bg-slate-50"
              >
                <option value="">— Seçiniz —</option>
                {faturalar.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.faturaNo} · {f.cariUnvan}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={goStep2}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs font-black cursor-pointer ${accentBtn}`}
            >
              2. Aşamaya Geç — Kalem Kontrolü →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex flex-wrap gap-2 text-[10px] font-bold">
            {saId && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">SA: {saId}</span>}
            {selectedIrs.map((ir) => (
              <span key={ir.id} className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                İRS: {ir.irsaliyeNo}
              </span>
            ))}
            {selectedFatura && (
              <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded-lg">
                FAT: {selectedFatura.faturaNo}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-[10px] uppercase text-slate-600">
                  <th className="p-2 text-left">Onay</th>
                  <th className="p-2 text-left">Ürün</th>
                  <th className="p-2 text-right">SA Miktar</th>
                  <th className="p-2 text-right">İrsaliye</th>
                  <th className="p-2 text-right">Fatura</th>
                  <th className="p-2">Birim</th>
                </tr>
              </thead>
              <tbody>
                {kalemLinks.map((k) => (
                  <tr key={k.id} className="border-t border-slate-100">
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => toggleKalemOnay(k.id)}
                        className="cursor-pointer"
                      >
                        {k.onaylandi ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <span className="w-5 h-5 inline-block rounded-full border-2 border-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="p-2 font-semibold">{k.urunAdi}</td>
                    <td className="p-2 text-right">{k.saMiktar ?? '—'}</td>
                    <td className="p-2 text-right">{k.irsaliyeMiktar ?? '—'}</td>
                    <td className="p-2 text-right">{k.faturaMiktar ?? '—'}</td>
                    <td className="p-2">{k.birim ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 flex flex-wrap gap-2 border-t">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 cursor-pointer"
            >
              ← Geri
            </button>
            <button
              type="button"
              onClick={confirmBinding}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-black cursor-pointer ${accentBtn}`}
            >
              <Link2 className="w-4 h-4" /> Bağlamayı Onayla
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

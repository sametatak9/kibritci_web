import React, { useEffect, useMemo, useState } from 'react';
import {
  Truck, Check, X, Pencil, RefreshCw, Camera, AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CariKart, CariKartIslem, Irsaliye, MicirStabilizeFis } from '../types/erp';
import { db } from '../lib/firebase';
import { openBase64InNewTab } from '../lib/fileViewerUtils';
import {
  ENTO_MADEN_UNVAN,
  findEntoMadenCari,
  malzemeTipiLabel,
  MicirMalzemeTipi,
} from '../lib/micirUtils';
import {
  approveMicirFis,
  isMicirFisPending,
  rejectMicirFis,
} from '../lib/micirOnayUtils';

interface MicirFisOnayPanelProps {
  currentUser: any;
  cariKartlar: CariKart[];
  setCariKartlar?: React.Dispatch<React.SetStateAction<CariKart[]>>;
  setIrsaliyeler?: React.Dispatch<React.SetStateAction<Irsaliye[]>>;
  setCariIslemGecmisi?: React.Dispatch<React.SetStateAction<CariKartIslem[]>>;
  addNotification?: (mesaj: string, meta?: Record<string, unknown>) => void | Promise<void>;
}

export const MicirFisOnayPanel: React.FC<MicirFisOnayPanelProps> = ({
  currentUser,
  cariKartlar,
  setCariKartlar,
  setIrsaliyeler,
  setCariIslemGecmisi,
  addNotification,
}) => {
  const [fisler, setFisler] = useState<MicirStabilizeFis[]>([]);
  const [editing, setEditing] = useState<MicirStabilizeFis | null>(null);
  const [tarih, setTarih] = useState('');
  const [irsaliyeNo, setIrsaliyeNo] = useState('');
  const [plaka, setPlaka] = useState('');
  const [tonaj, setTonaj] = useState('');
  const [malzemeTipi, setMalzemeTipi] = useState<MicirMalzemeTipi>('MICIR');
  const [saving, setSaving] = useState(false);

  const entoCari = useMemo(() => findEntoMadenCari(cariKartlar), [cariKartlar]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'micirStabilizeFisleri'), (snap) => {
      const list: MicirStabilizeFis[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<MicirStabilizeFis, 'id'>) }));
      list.sort((a, b) => String(b.olusturulma || '').localeCompare(String(a.olusturulma || '')));
      setFisler(list);
    });
    return () => unsub();
  }, []);

  const pending = useMemo(() => fisler.filter((f) => isMicirFisPending(f)), [fisler]);

  const openEdit = (f: MicirStabilizeFis) => {
    setEditing(f);
    setTarih(f.tarih);
    setIrsaliyeNo(f.irsaliyeNo);
    setPlaka(f.plaka);
    setTonaj(String(f.tonaj));
    setMalzemeTipi(f.malzemeTipi === 'STABILIZE' ? 'STABILIZE' : 'MICIR');
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ton = Number(tonaj);
    if (!irsaliyeNo.trim() || !plaka.trim() || !Number.isFinite(ton) || ton <= 0 || !tarih) {
      alert('Tarih, irsaliye no, plaka ve tonaj zorunlu.');
      return;
    }
    if (!window.confirm('Onaylanınca irsaliye sekmesine ve Ento Maden cari kart altına kayıt oluşacak. Devam?')) {
      return;
    }

    setSaving(true);
    try {
      const result = await approveMicirFis({
        fis: editing,
        correction: {
          tarih,
          irsaliyeNo: irsaliyeNo.trim().toUpperCase(),
          plaka: plaka.trim().toUpperCase(),
          tonaj: ton,
          malzemeTipi,
          fisGorselUrl: editing.fisGorselUrl,
          firmaUnvan: entoCari?.unvan || editing.firmaUnvan || ENTO_MADEN_UNVAN,
          cariKartId: entoCari?.id || editing.cariKartId,
        },
        onaylayan: currentUser?.email || 'yonetici',
        cariKartlar,
        setCariKartlar,
        setIrsaliyeler,
        setCariIslemGecmisi,
      });

      await addNotification?.(
        `Mıcır/Stabilize irsaliyesi onaylandı: ${result.fis.irsaliyeNo} · irsaliye + cari kaydı oluşturuldu`,
        {
          tip: 'MICIR_FIS_ONAYLANDI',
          micirFisId: result.fis.id,
          irsaliyeId: result.irsaliye.id,
          cariKartId: result.cariIslem.cariKartId,
        }
      );

      alert(
        `Onaylandı.\n\n1) İrsaliye: ${result.irsaliye.irsaliyeNo}\n2) Cari: ${result.fis.firmaUnvan}`
      );
      setEditing(null);
    } catch (err: any) {
      console.error(err);
      alert('Onay başarısız: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async (f: MicirStabilizeFis) => {
    const neden = window.prompt('Red nedeni (opsiyonel):') || '';
    if (!window.confirm(`${f.irsaliyeNo} nolu kayıt reddedilsin mi?`)) return;
    try {
      await rejectMicirFis({
        fis: f,
        onaylayan: currentUser?.email || 'yonetici',
        redNedeni: neden,
      });
      await addNotification?.(
        `Mıcır/Stabilize kaydı reddedildi: ${f.irsaliyeNo}${neden ? ` · ${neden}` : ''}`,
        { tip: 'MICIR_FIS_REDDEDILDI', micirFisId: f.id }
      );
      if (editing?.id === f.id) setEditing(null);
    } catch (err: any) {
      alert('Red başarısız: ' + (err?.message || ''));
    }
  };

  return (
    <div className="space-y-4">
      <div className="border bg-emerald-950 p-4.5 rounded-2xl border-emerald-800/80 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-emerald-200 font-bold block text-[11px] tracking-widest uppercase flex items-center gap-1.5">
              <Truck size={13} /> Kapı Mıcır &amp; Stabilize İrsaliye Onayı
            </span>
            <p className="text-emerald-100/80 leading-relaxed text-[11px]">
              Güvenlik kapıdan teslim aldığı irsaliyeyi buraya gönderir. Düzeltip kaydederseniz{' '}
              <strong>2 kayıt</strong> oluşur: irsaliye sekmesinde bir evrak +{' '}
              <strong>{ENTO_MADEN_UNVAN}</strong> cari kartının altında irsaliye geçmişi.
            </p>
          </div>
          <span className="shrink-0 text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full">
            {pending.length} bekleyen
          </span>
        </div>
      </div>

      {!entoCari && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <p>
            <strong>{ENTO_MADEN_UNVAN}</strong> cari kartı henüz yok. Onay sırasında otomatik
            oluşturulacak.
          </p>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-10 text-center border border-slate-200">
          <p className="text-sm font-bold text-slate-600">Onay bekleyen mıcır/stabilize kaydı yok.</p>
          <p className="text-xs text-slate-400 mt-1">
            Güvenlik kapıdan yeni giriş kaydı gönderince burada listelenir.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {pending.map((f) => (
              <div
                key={f.id}
                className={`bg-white border rounded-xl p-3 flex gap-3 ${
                  editing?.id === f.id ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'
                }`}
              >
                {f.fisGorselUrl ? (
                  <button
                    type="button"
                    onClick={() => openBase64InNewTab(f.fisGorselUrl!, `micir_${f.irsaliyeNo}.jpg`)}
                    className="shrink-0 cursor-pointer"
                  >
                    <img
                      src={f.fisGorselUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                    />
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-100 border flex items-center justify-center shrink-0">
                    <Camera size={16} className="text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {f.irsaliyeNo} · {f.plaka}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {f.tarih} · {malzemeTipiLabel(f.malzemeTipi)} · <strong>{f.tonaj}</strong> ton
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">{f.firmaUnvan}</p>
                  <p className="text-[9px] text-slate-400">Kaydeden: {f.kaydeden || '—'}</p>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => openEdit(f)}
                      className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-lg bg-emerald-600 text-white cursor-pointer"
                    >
                      <Pencil size={11} /> Düzelt / Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(f)}
                      className="inline-flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                    >
                      <X size={11} /> Reddet
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {!editing ? (
              <div className="h-full min-h-[240px] flex items-center justify-center text-slate-400 text-xs italic">
                Soldan bir kayıt seçip düzeltme / onay formunu açın.
              </div>
            ) : (
              <form onSubmit={handleApprove} className="space-y-3 text-xs">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700 border-b pb-2">
                  Kapı İrsaliye Düzelt &amp; Kaydet
                </h4>
                {editing.fisGorselUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      openBase64InNewTab(editing.fisGorselUrl!, `micir_${editing.irsaliyeNo}.jpg`)
                    }
                    className="w-full cursor-pointer"
                  >
                    <img
                      src={editing.fisGorselUrl}
                      alt="İrsaliye"
                      className="max-h-44 w-full object-contain rounded-xl border bg-slate-50"
                    />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">Tarih</label>
                    <input
                      type="date"
                      required
                      value={tarih}
                      onChange={(e) => setTarih(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">İrsaliye No</label>
                    <input
                      required
                      value={irsaliyeNo}
                      onChange={(e) => setIrsaliyeNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">Plaka</label>
                    <input
                      required
                      value={plaka}
                      onChange={(e) => setPlaka(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase">Tonaj</label>
                    <input
                      required
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={tonaj}
                      onChange={(e) => setTonaj(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase">Malzeme</label>
                    <select
                      value={malzemeTipi}
                      onChange={(e) => setMalzemeTipi(e.target.value as MicirMalzemeTipi)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="MICIR">Mıcır</option>
                      <option value="STABILIZE">Stabilize</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                  Kaydet → <strong>İrsaliye</strong> + <strong>Cari kart altına irsaliye geçmişi</strong>{' '}
                  oluşur ({entoCari?.unvan || ENTO_MADEN_UNVAN}).
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-3 rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                    ONAYLA &amp; KAYDET
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-[10px] cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MicirFisOnayPanel;

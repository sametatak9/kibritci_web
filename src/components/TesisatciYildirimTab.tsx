import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Camera, Check, Pencil, Trash2, RefreshCw, Truck, Download
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { CariKart, Fatura, YildirimTankerFis } from '../types/erp';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';
import { todayDateKey, formatDateLabelTr } from '../lib/dateKeyUtils';
import { downloadCsv } from '../lib/reportExport';
import {
  YILDIRIM_TANKER_UNVAN,
  findYildirimTankerCari,
  filterYildirimFislerByMonth,
  sumYildirimSular,
  isYildirimTankerFirma,
} from '../lib/yildirimTankerUtils';

interface TesisatciYildirimTabProps {
  cariKartlar?: CariKart[];
  faturalar?: Fatura[];
  currentUser: any;
  addNotification?: (mesaj: string, meta?: Record<string, unknown>) => void | Promise<void>;
  showStatus?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const TesisatciYildirimTab: React.FC<TesisatciYildirimTabProps> = ({
  cariKartlar = [],
  faturalar = [],
  currentUser,
  addNotification,
  showStatus,
}) => {
  const yildirimCari = useMemo(() => findYildirimTankerCari(cariKartlar), [cariKartlar]);
  const firmaUnvan = yildirimCari?.unvan || YILDIRIM_TANKER_UNVAN;

  const [islemTarihi, setIslemTarihi] = useState(todayDateKey());
  const [fisNo, setFisNo] = useState('');
  const [icmeSuyuAdet, setIcmeSuyuAdet] = useState('');
  const [sanayiSuyuAdet, setSanayiSuyuAdet] = useState('');
  const [fisGorselUrl, setFisGorselUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [fisler, setFisler] = useState<YildirimTankerFis[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [raporAy, setRaporAy] = useState(() => new Date().getMonth() + 1);
  const [raporYil, setRaporYil] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'yildirimTankerFisleri'), (snap) => {
      const list: YildirimTankerFis[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as Omit<YildirimTankerFis, 'id'>) }));
      list.sort(
        (a, b) =>
          String(b.tarih).localeCompare(String(a.tarih)) ||
          String(b.olusturulma).localeCompare(String(a.olusturulma))
      );
      setFisler(list);
    });
    return () => unsub();
  }, []);

  const gunlukListe = useMemo(
    () => fisler.filter((f) => f.tarih === islemTarihi),
    [fisler, islemTarihi]
  );

  const aylikFisler = useMemo(
    () => filterYildirimFislerByMonth(fisler, raporYil, raporAy),
    [fisler, raporYil, raporAy]
  );

  const aylikToplam = useMemo(() => sumYildirimSular(aylikFisler), [aylikFisler]);

  const resetForm = () => {
    setFisNo('');
    setIcmeSuyuAdet('');
    setSanayiSuyuAdet('');
    setFisGorselUrl('');
    setEditingId(null);
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      const raw = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = file.type.startsWith('image/')
        ? await compressImage(raw, 1280, 1280, 0.75)
        : raw;
      setFisGorselUrl(compressed);
    } catch {
      showStatus?.('error', 'Görsel yüklenemedi.');
    }
    e.target.value = '';
  };

  const handleKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    const icme = Number(icmeSuyuAdet);
    const sanayi = Number(sanayiSuyuAdet);
    if (!fisNo.trim()) {
      showStatus?.('error', 'Fiş no zorunlu.');
      return;
    }
    if (!Number.isFinite(icme) || icme < 0 || !Number.isFinite(sanayi) || sanayi < 0) {
      showStatus?.('error', 'İçme ve sanayi suyu adetleri geçerli sayı olmalı.');
      return;
    }
    if (icme + sanayi <= 0) {
      showStatus?.('error', 'En az bir su adedi girin.');
      return;
    }
    if (!fisGorselUrl && !editingId) {
      showStatus?.('error', 'Fiş görseli yükleyin.');
      return;
    }

    setSaving(true);
    try {
      const id = editingId || `ytfis_${Date.now()}`;
      const existing = editingId ? fisler.find((f) => f.id === editingId) : null;
      const guvenlikEvrakId = existing?.guvenlikEvrakId || `EVR-YT-${id}`;
      const fis: YildirimTankerFis = {
        id,
        tarih: islemTarihi,
        fisNo: fisNo.trim().toUpperCase(),
        icmeSuyuAdet: icme,
        sanayiSuyuAdet: sanayi,
        fisGorselUrl: fisGorselUrl || existing?.fisGorselUrl || '',
        firmaUnvan,
        cariKartId: yildirimCari?.id,
        irsaliyeId: existing?.irsaliyeId || `IR-YT-${id}`,
        guvenlikEvrakId,
        kaydeden: currentUser?.email || 'tesisatci',
        olusturulma: existing?.olusturulma || new Date().toISOString(),
        guncellenme: new Date().toISOString(),
      };

      await setDoc(doc(db, 'yildirimTankerFisleri', id), fis);

      const irsaliyeId = fis.irsaliyeId!;
      await setDoc(
        doc(db, 'irsaliyeler', irsaliyeId),
        {
          id: irsaliyeId,
          irsaliyeId,
          irsaliyeNo: fis.fisNo,
          firma: firmaUnvan,
          tarih: fis.tarih,
          onayDurumu: 'ONAY BEKLİYOR',
          fisEvrakUrl: fis.fisGorselUrl || '',
          kaynak: 'YILDIRIM_TANKER_FIS',
          fisNo: fis.fisNo,
          icmeSuyuAdet: fis.icmeSuyuAdet,
          sanayiSuyuAdet: fis.sanayiSuyuAdet,
          yildirimTankerFisId: id,
          kalemler: [
            {
              id: `k_icme_${id}`,
              urunAdi: 'İçme Suyu Tanker',
              miktar: fis.icmeSuyuAdet,
              birim: 'ADET',
            },
            {
              id: `k_sanayi_${id}`,
              urunAdi: 'Sanayi Suyu Tanker',
              miktar: fis.sanayiSuyuAdet,
              birim: 'ADET',
            },
          ].filter((k) => Number(k.miktar) > 0),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'guvenlikGelenEvraklar', guvenlikEvrakId),
        {
          id: guvenlikEvrakId,
          evrakNo: fis.fisNo,
          evrakTuru: 'İRSALİYE',
          firma: firmaUnvan,
          tarih: fis.tarih,
          saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          fotoUrl: fis.fisGorselUrl || '',
          fileName: `yildirim_${fis.fisNo}.jpg`,
          fileType: 'image/jpeg',
          durum: 'BEKLEMEDE',
          aciklama: `Tesisatçı Yıldırım Tanker fişi · İçme ${fis.icmeSuyuAdet} · Sanayi ${fis.sanayiSuyuAdet}`,
          kaydeden: currentUser?.email || 'tesisatci',
          kaynak: 'YILDIRIM_TANKER_FIS',
          yildirimTankerFisId: id,
          icmeSuyuAdet: fis.icmeSuyuAdet,
          sanayiSuyuAdet: fis.sanayiSuyuAdet,
          aiStatus: 'SKIPPED',
        },
        { merge: true }
      );

      if (addNotification) {
        await addNotification(
          `Yıldırım Tanker fişi ${editingId ? 'güncellendi' : 'kaydedildi'}: ${fis.fisNo} · içme ${fis.icmeSuyuAdet} · sanayi ${fis.sanayiSuyuAdet}`
        );
      }
      showStatus?.(
        'success',
        editingId
          ? 'Fiş güncellendi; liste ve cari/irsaliye güncellendi.'
          : 'Fiş kaydedildi; güvenlik / cari / irsaliye listesine eklendi.'
      );
      resetForm();
    } catch (err: any) {
      console.error(err);
      showStatus?.('error', 'Kayıt başarısız: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (f: YildirimTankerFis) => {
    setEditingId(f.id);
    setIslemTarihi(f.tarih);
    setFisNo(f.fisNo);
    setIcmeSuyuAdet(String(f.icmeSuyuAdet));
    setSanayiSuyuAdet(String(f.sanayiSuyuAdet));
    setFisGorselUrl(f.fisGorselUrl || '');
  };

  const handleSil = async (f: YildirimTankerFis) => {
    if (!window.confirm(`${f.fisNo} nolu Yıldırım Tanker fişi silinsin mi?`)) return;
    try {
      await deleteDoc(doc(db, 'yildirimTankerFisleri', f.id));
      if (f.irsaliyeId) {
        try {
          await deleteDoc(doc(db, 'irsaliyeler', f.irsaliyeId));
        } catch {
          /* ignore */
        }
      }
      const evrakId = f.guvenlikEvrakId || `EVR-YT-${f.id}`;
      try {
        await deleteDoc(doc(db, 'guvenlikGelenEvraklar', evrakId));
      } catch {
        /* ignore */
      }
      if (editingId === f.id) resetForm();
      showStatus?.('success', 'Fiş silindi.');
    } catch (err: any) {
      showStatus?.('error', 'Silinemedi: ' + (err?.message || ''));
    }
  };

  const handleRaporIndir = () => {
    const rows = [
      ['Tarih', 'Fiş No', 'İçme Suyu', 'Sanayi Suyu', 'Toplam', 'Firma', 'Kaydeden'],
      ...aylikFisler.map((f) => [
        f.tarih,
        f.fisNo,
        String(f.icmeSuyuAdet),
        String(f.sanayiSuyuAdet),
        String((Number(f.icmeSuyuAdet) || 0) + (Number(f.sanayiSuyuAdet) || 0)),
        f.firmaUnvan,
        f.kaydeden || '',
      ]),
      ['', 'TOPLAM', String(aylikToplam.icme), String(aylikToplam.sanayi), String(aylikToplam.toplam), '', ''],
    ];
    downloadCsv(rows, `yildirim_tanker_${raporYil}_${String(raporAy).padStart(2, '0')}.csv`);
    showStatus?.('success', 'Aylık rapor indirildi.');
  };

  void faturalar;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Truck size={14} className="text-sky-600" /> Yıldırım Tanker Fiş Kaydı
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Cari: <strong>{firmaUnvan}</strong>
              {!yildirimCari && (
                <span className="text-rose-600"> — cari kart bulunamadı, yine de bu unvanla kaydedilir</span>
              )}
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
            <Calendar size={12} />
            Tarih
            <input
              type="date"
              value={islemTarihi}
              onChange={(e) => setIslemTarihi(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold"
            />
          </label>
        </div>

        <form onSubmit={handleKaydet} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase">Fiş No *</label>
            <input
              required
              value={fisNo}
              onChange={(e) => setFisNo(e.target.value)}
              placeholder="Örn: YT-001"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase">Fiş Görseli *</label>
            <label className="flex items-center justify-center gap-2 w-full bg-sky-50 border border-dashed border-sky-300 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-sky-100">
              <Camera size={14} className="text-sky-600" />
              <span className="font-bold text-sky-700 text-[10px]">
                {fisGorselUrl ? 'Görsel seçildi — değiştir' : 'Fotoğraf / evrak yükle'}
              </span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFoto} />
            </label>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase">Tanker İçme Suyu Adet *</label>
            <input
              required
              type="number"
              min={0}
              step={1}
              value={icmeSuyuAdet}
              onChange={(e) => setIcmeSuyuAdet(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase">Tanker Sanayi Suyu Adet *</label>
            <input
              required
              type="number"
              min={0}
              step={1}
              value={sanayiSuyuAdet}
              onChange={(e) => setSanayiSuyuAdet(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
            />
          </div>

          {fisGorselUrl && (
            <div className="sm:col-span-2">
              <img
                src={fisGorselUrl}
                alt="Fiş"
                className="max-h-40 rounded-xl border border-slate-200 object-contain bg-slate-50"
              />
            </div>
          )}

          <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-w-[140px] bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] py-3 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              {editingId ? 'GÜNCELLE' : 'KAYDET'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-[10px] cursor-pointer"
              >
                İptal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-700">
          {formatDateLabelTr(islemTarihi)} — Kayıtlı Fişler ({gunlukListe.length})
        </h4>
        {gunlukListe.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">Bu tarihte fiş yok.</p>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {gunlukListe.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px]"
              >
                <div className="min-w-0 flex items-center gap-2">
                  {f.fisGorselUrl ? (
                    <img src={f.fisGorselUrl} alt="" className="w-10 h-10 rounded-lg object-cover border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{f.fisNo}</p>
                    <p className="text-[9px] text-slate-500">
                      İçme: <strong>{f.icmeSuyuAdet}</strong> · Sanayi: <strong>{f.sanayiSuyuAdet}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEdit(f)}
                    className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 cursor-pointer"
                    title="Düzenle"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSil(f)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800">
            Aylık Rapor — {firmaUnvan}
          </h4>
          <div className="flex gap-2 items-center">
            <select
              value={raporAy}
              onChange={(e) => setRaporAy(Number(e.target.value))}
              className="text-[10px] font-bold border rounded-lg px-2 py-1 bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {String(i + 1).padStart(2, '0')}
                </option>
              ))}
            </select>
            <select
              value={raporYil}
              onChange={(e) => setRaporYil(Number(e.target.value))}
              className="text-[10px] font-bold border rounded-lg px-2 py-1 bg-white"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleRaporIndir}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg cursor-pointer"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="bg-slate-50 border rounded-xl p-2">
            <span className="text-[9px] text-slate-500 block uppercase">İçme</span>
            <strong className="text-slate-900 text-sm">{aylikToplam.icme}</strong>
          </div>
          <div className="bg-slate-50 border rounded-xl p-2">
            <span className="text-[9px] text-slate-500 block uppercase">Sanayi</span>
            <strong className="text-slate-900 text-sm">{aylikToplam.sanayi}</strong>
          </div>
          <div className="bg-slate-50 border rounded-xl p-2">
            <span className="text-[9px] text-slate-500 block uppercase">Fiş adedi</span>
            <strong className="text-slate-900 text-sm">{aylikFisler.length}</strong>
          </div>
        </div>
        <div className="max-h-[200px] overflow-y-auto space-y-1">
          {aylikFisler
            .filter((f) => isYildirimTankerFirma(f.firmaUnvan) || f.firmaUnvan === firmaUnvan)
            .map((f) => (
              <div key={f.id} className="text-[10px] flex justify-between gap-2 border-b border-slate-100 py-1.5">
                <span className="font-mono text-slate-600">{f.tarih}</span>
                <span className="font-bold text-slate-800 truncate">{f.fisNo}</span>
                <span>İ:{f.icmeSuyuAdet}</span>
                <span>S:{f.sanayiSuyuAdet}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

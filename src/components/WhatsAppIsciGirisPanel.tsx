import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, UserPlus, Loader2 } from 'lucide-react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';
import { gorevOptionsFromPersoneller } from '../lib/catalogFieldUtils';
import { buildWhatsAppUrl, shareWhatsAppTextOrFiles } from '../lib/mobilOnayUtils';
import {
  dataUrlToFile,
  uploadPersonelKimlikFotolar,
} from '../lib/personelKimlikFotoStorage';
import { sgkDurumEtiketi } from '../lib/sgkGrupSablon';
import {
  buildKampAnaFirmaGirisTalepDoc,
  findOpenAnaFirmaGirisTalebi,
  kampAnaFirmaSgkWhatsAppText,
} from '../lib/kampAnaFirmaGiris';
import { CANONICAL_ANA_FIRMA_ADI } from '../lib/yoklamaUtils';
import type { Personel } from '../types/erp';
import { GorevFromDbField } from './GorevFromDbField';
import { KimlikFotoOnizleme } from './KimlikFotoOnizleme';

const MAX_KIMLIK_FOTO = 2;

type GirisTalep = {
  id: string;
  ad?: string;
  soyad?: string;
  gorev?: string;
  nitelik?: string;
  tcNo?: string;
  iseGirisTarihi?: string;
  durum?: string;
  tarih?: string;
  gonderenFormen?: string;
  kimlikFotoUrl?: string;
  kimlikFotoUrls?: string[];
  kaynak?: string;
  grupBildirildi?: boolean;
};

function wpMetin(t: {
  ad: string;
  soyad: string;
  gorev: string;
  tcNo?: string;
  nitelik?: string;
  girisTarihi?: string;
  gonderen?: string;
  kimlikFotoUrl?: string;
  kimlikFotoUrls?: string[];
}) {
  return kampAnaFirmaSgkWhatsAppText({
    ad: t.ad,
    soyad: t.soyad,
    tcNo: t.tcNo,
    gorev: t.gorev,
    nitelik: t.nitelik,
    girisTarihi: t.girisTarihi || new Date().toISOString().slice(0, 10),
    gonderen: t.gonderen,
    kimlikFotoUrl: t.kimlikFotoUrl,
    kimlikFotoUrls: t.kimlikFotoUrls,
  });
}

interface WhatsAppIsciGirisPanelProps {
  currentUser?: { email?: string };
  personeller?: Personel[];
}

export const WhatsAppIsciGirisPanel: React.FC<WhatsAppIsciGirisPanelProps> = ({
  currentUser,
  personeller = [],
}) => {
  const [liste, setListe] = useState<GirisTalep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yeniAd, setYeniAd] = useState('');
  const [yeniSoyad, setYeniSoyad] = useState('');
  const [yeniGorev, setYeniGorev] = useState('');
  const [yeniNitelik, setYeniNitelik] = useState('');
  const [yeniTcNo, setYeniTcNo] = useState('');
  const [yeniGirisTarihi, setYeniGirisTarihi] = useState(new Date().toISOString().slice(0, 10));
  const [fotolar, setFotolar] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sonTalep, setSonTalep] = useState<{
    id: string;
    ad: string;
    soyad: string;
    gorev: string;
    tcNo?: string;
    nitelik?: string;
    girisTarihi: string;
    kimlikFotoUrl?: string;
    kimlikFotoUrls?: string[];
  } | null>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'personelGirisTalepleri'),
      (snap) => {
        const rows: GirisTalep[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GirisTalep, 'id'>) }));
        rows.sort((a, b) => String(b.tarih || '').localeCompare(String(a.tarih || '')));
        setListe(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(err);
        setError('Giriş talepleri okunamadı. Oturum veya yetki kontrol edin.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const bekleyen = useMemo(
    () => liste.filter((r) => r.durum !== 'ONAYLANDI' && r.durum !== 'REDDEDİLDİ').length,
    [liste]
  );

  const gorevExtra = useMemo(() => gorevOptionsFromPersoneller(personeller), [personeller]);

  const onPickFiles = (files: File[]) => {
    const slots = MAX_KIMLIK_FOTO - fotolar.length;
    files.slice(0, slots).forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = ev.target?.result;
        if (typeof raw !== 'string') return;
        const compressed = await compressImage(raw);
        setFotolar((prev) => (prev.length >= MAX_KIMLIK_FOTO ? prev : [...prev, compressed]));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    if (!yeniAd.trim() || !yeniSoyad.trim() || !yeniGorev.trim()) {
      setStatus({ type: 'err', text: 'Ad, soyad ve görev (yoklama niteliği) zorunlu.' });
      return;
    }
    if (!yeniGirisTarihi) {
      setStatus({ type: 'err', text: 'Giriş tarihi zorunlu. SGK grubuna tarih yazılmadan kuyruk açılamaz.' });
      return;
    }
    if (fotolar.length === 0) {
      setStatus({ type: 'err', text: 'En az bir kimlik fotoğrafı (ön yüz) ekleyin. Gruba kimlik gitmeden giriş olmaz.' });
      return;
    }
    const mevcut = findOpenAnaFirmaGirisTalebi(liste, {
      ad: yeniAd.trim(),
      soyad: yeniSoyad.trim(),
      tcNo: yeniTcNo,
    });
    if (mevcut) {
      setStatus({
        type: 'err',
        text: `Bu kişi için zaten açık bir grup bildirimi var (${mevcut.ad || ''} ${mevcut.soyad || ''} · ${mevcut.durum}). Evrakı Grup Köprüsü’ne bırakın.`,
      });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const requestID = `GIRIS-WP-SGK-${Date.now()}`;
      const gonderen = currentUser?.email || 'Muhasebe';
      let kimlikler = fotolar;
      try {
        kimlikler = await uploadPersonelKimlikFotolar({ talepId: requestID, dataUrls: fotolar });
      } catch (uploadErr) {
        console.warn('Kimlik Storage yüklemesi atlandı, kuyruk yine yazılacak:', uploadErr);
      }
      await setDoc(
        doc(db, 'personelGirisTalepleri', requestID),
        buildKampAnaFirmaGirisTalepDoc(requestID, {
          ad: yeniAd.trim(),
          soyad: yeniSoyad.trim(),
          tcNo: yeniTcNo,
          gorev: yeniGorev.trim(),
          nitelik: yeniNitelik,
          girisTarihi: yeniGirisTarihi,
          gonderen,
          kimlikFotoUrl: kimlikler[0],
          kimlikFotoUrls: kimlikler,
          kaynakPanel: 'IRSALIYE_FATURA_WHATSAPP',
        })
      );
      setSonTalep({
        id: requestID,
        ad: yeniAd.trim(),
        soyad: yeniSoyad.trim(),
        gorev: yeniGorev.trim(),
        tcNo: yeniTcNo.replace(/\D/g, '') || undefined,
        nitelik: yeniNitelik.trim() || undefined,
        girisTarihi: yeniGirisTarihi,
        kimlikFotoUrl: kimlikler[0],
        kimlikFotoUrls: kimlikler,
      });
      setYeniAd('');
      setYeniSoyad('');
      setYeniGorev('');
      setYeniNitelik('');
      setYeniTcNo('');
      setYeniGirisTarihi(new Date().toISOString().slice(0, 10));
      setFotolar([]);
      setStatus({
        type: 'ok',
        text: 'Grup bildirimi kuyruğa yazıldı. Personel kartı açılmadı. Sabit metni SGK grubuna atın; evrak Grup Köprüsü’ne, kadro Onay’a.',
      });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'err', text: 'Kayıt yazılamadı. Bağlantıyı kontrol edin.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-grow p-4 sm:p-6 min-h-[calc(100vh-120px)] overflow-y-auto bg-slate-50/70">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-[#075E54] text-white">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} />
              <div>
                <h2 className="text-sm font-bold leading-tight">WhatsApp işçi girişi</h2>
                <p className="text-[10px] text-emerald-100">SGK grubu · {CANONICAL_ANA_FIRMA_ADI} kartı yazılmaz</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-white/15 px-2 py-1 rounded-full">
              {bekleyen} açık talep
            </span>
          </header>

          <div className="p-4 space-y-3 flex-1 bg-[#ECE5DD]">
            <p className="text-[11px] text-slate-600 bg-white/80 border border-emerald-100 rounded-xl px-3 py-2 leading-relaxed">
              Kimlik, görev ve giriş tarihi SGK WhatsApp grubuna gider. Evrak Grup Köprüsü’ne bırakılır;
              Ana Firma kadrosu yalnızca Onay → Personel oluşturma’da tek kontrolle açılır.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Ad</span>
                <input
                  value={yeniAd}
                  onChange={(e) => setYeniAd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  placeholder="Ahmet"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Soyad</span>
                <input
                  value={yeniSoyad}
                  onChange={(e) => setYeniSoyad(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  placeholder="Yılmaz"
                />
              </label>
            </div>
            <GorevFromDbField
              value={yeniGorev}
              onChange={setYeniGorev}
              extraOptions={gorevExtra}
              inputClassName="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">TC Kimlik</span>
                <input
                  value={yeniTcNo}
                  onChange={(e) => setYeniTcNo(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  inputMode="numeric"
                  maxLength={11}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                  placeholder="11 hane"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Giriş tarihi</span>
                <input
                  type="date"
                  value={yeniGirisTarihi}
                  onChange={(e) => setYeniGirisTarihi(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">SGK meslek (nitelik) — isteğe bağlı</span>
              <input
                value={yeniNitelik}
                onChange={(e) => setYeniNitelik(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                placeholder="SGK meslek kodu / niteliği"
              />
            </label>

            <KimlikFotoOnizleme
              urls={fotolar}
              max={MAX_KIMLIK_FOTO}
              onRemove={(idx) => setFotolar((prev) => prev.filter((_, i) => i !== idx))}
              onPick={onPickFiles}
            />

            {status && (
              <p className={`text-[11px] font-semibold ${status.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                {status.text}
              </p>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="w-full bg-[#25D366] hover:bg-[#1ebe5a] disabled:opacity-60 text-white font-black text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {saving ? 'Kaydediliyor…' : 'SGK grubuna bildir'}
            </button>

            {sonTalep && (
              <div className="rounded-2xl bg-white border border-emerald-200 p-3 space-y-2">
                <p className="text-[11px] font-bold text-emerald-800">
                  {sonTalep.ad} {sonTalep.soyad} kuyruğa yazıldı. Kart açılmadı. SGK grubuna:
                </p>
                {(sonTalep.kimlikFotoUrls || []).length > 0 && (
                  <div className="flex gap-2">
                    {(sonTalep.kimlikFotoUrls || []).map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Kimlik ${i + 1}`}
                        className="w-20 h-16 object-cover rounded-lg border border-emerald-200"
                      />
                    ))}
                  </div>
                )}
                <pre className="text-[10px] whitespace-pre-wrap bg-slate-50 rounded-xl p-2 font-mono text-slate-700">
                  {wpMetin({ ...sonTalep, gonderen: currentUser?.email })}
                </pre>
                <a
                  href={buildWhatsAppUrl(wpMetin({ ...sonTalep, gonderen: currentUser?.email }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    const files = (sonTalep.kimlikFotoUrls || [])
                      .map((u, i) => dataUrlToFile(u, `kimlik_${i + 1}.jpg`))
                      .filter((f): f is File => Boolean(f));
                    if (!files.length) return;
                    e.preventDefault();
                    void shareWhatsAppTextOrFiles(
                      wpMetin({ ...sonTalep, gonderen: currentUser?.email }),
                      files
                    );
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#075E54] text-white font-bold text-xs py-2.5 rounded-xl"
                >
                  <Send size={14} />
                  WhatsApp’tan gönder
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[420px]">
          <header className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Giriş defteri</h3>
            <p className="text-[11px] text-slate-500">Aynı koleksiyon: personelGirisTalepleri. Grup Köprüsü ve Onay havuzu bozulmaz.</p>
          </header>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && (
              <p className="text-center text-xs text-slate-400 py-10 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Talepler yükleniyor…
              </p>
            )}
            {error && !loading && (
              <p className="text-center text-xs text-rose-600 py-10">{error}</p>
            )}
            {!loading && !error && liste.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-10">Henüz giriş talebi yok.</p>
            )}
            {liste.map((item) => {
              const badge = sgkDurumEtiketi(item.durum, {
                sgkTalep: item.kaynak === 'SGK_GRUP' || item.grupBildirildi,
              });
              const wp = wpMetin({
                ad: item.ad || '—',
                soyad: item.soyad || '',
                gorev: item.gorev || '—',
                tcNo: item.tcNo,
                nitelik: item.nitelik,
                girisTarihi: item.iseGirisTarihi,
                gonderen: item.gonderenFormen,
                kimlikFotoUrl: item.kimlikFotoUrl,
                kimlikFotoUrls: item.kimlikFotoUrls,
              });
              return (
                <article key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {item.ad} {item.soyad}
                      </h4>
                      <p className="text-[11px] text-slate-500">{item.gorev || 'Görev yok'}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
                      {badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {item.tarih ? new Date(item.tarih).toLocaleString('tr-TR') : '—'} · {item.gonderenFormen?.split('@')[0] || '—'}
                  </p>
                  <a
                    href={buildWhatsAppUrl(wp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#075E54] hover:underline"
                  >
                    <MessageCircle size={12} /> Tekrar WhatsApp
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

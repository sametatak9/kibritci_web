import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Check, Copy, MessageCircle, Upload, Users } from 'lucide-react';
import type { CariKart, Personel } from '../types/erp';
import { db, cleanUndefined } from '../lib/firebase';
import { fetchApiJson } from '../lib/apiClient';
import { compressImage } from '../lib/imageCompress';
import { buildWhatsAppUrl } from '../lib/mobilOnayUtils';
import { muhasebeInputClass } from './evrakUi/MuhasebeBelgeForm';
import { getTaseronCariKartlar, isTaseronPersonelRecord } from '../lib/taseronUtils';
import {
  buildTaseronCikisTalepDoc,
  buildTaseronCikisWhatsAppText,
  buildTaseronGirisTalepDoc,
  buildTaseronGirisWhatsAppText,
  digitsTc,
  findOpenTaseronGrupTalep,
  inferTaseronYonFromText,
  isTaseronGrupTalep,
  namesMatchExact,
  normalizeTaseronGrupParse,
  parseTaseronGrupMessageMeta,
  parseTaseronGrupWhatsAppText,
  resolveTaseronGrupFirmaAdi,
  taseronGrupDurumEtiketi,
  taseronIsGorevOf,
  TASERON_GRUP_ADI,
  TASERON_GRUP_KAYNAK,
  type TaseronGrupParse,
  type TaseronGrupYon,
} from '../lib/taseronGrupSablon';
import { isPendingPersonelOnayDurum } from '../lib/sgkGrupSablon';

type Talep = Record<string, any>;

interface TaseronGrupKopruTabProps {
  personeller: Personel[];
  cariKartlar: CariKart[];
  currentUser?: { email?: string };
  addNotification?: (mesaj: string) => void;
}

const input = muhasebeInputClass;

async function fileToBase64(file: File): Promise<{ base64: string; mime: string; dataUrl: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Dosya okunamadı.'));
    r.readAsDataURL(file);
  });
  const compressed = file.type.startsWith('image/') ? await compressImage(dataUrl, 1400, 1400, 0.75) : dataUrl;
  return { base64: compressed.split(',')[1] || '', mime: file.type, dataUrl: compressed };
}

function emptyParse(): TaseronGrupParse {
  return {
    yon: 'giris',
    firmaAdi: '',
    isGorev: '',
    ad: '',
    soyad: '',
    tcNo: '',
    tarih: new Date().toISOString().slice(0, 10),
  };
}

export const TaseronGrupKopruTab: React.FC<TaseronGrupKopruTabProps> = ({
  personeller,
  cariKartlar,
  currentUser,
  addNotification,
}) => {
  const [girisTalepler, setGirisTalepler] = useState<Talep[]>([]);
  const [cikisTalepler, setCikisTalepler] = useState<Talep[]>([]);
  const [parsed, setParsed] = useState<TaseronGrupParse>(emptyParse());
  const [evrakUrl, setEvrakUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [wpPaste, setWpPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'personelGirisTalepleri'), (snap) => {
      setGirisTalepler(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(collection(db, 'personelCikisTalepleri'), (snap) => {
      setCikisTalepler(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  const gonderen = currentUser?.email || 'şantiye';
  const taseronCariler = useMemo(() => getTaseronCariKartlar(cariKartlar), [cariKartlar]);
  const bekleyenGiris = girisTalepler.filter((t) => isTaseronGrupTalep(t) && isPendingPersonelOnayDurum(t.durum));
  const bekleyenCikis = cikisTalepler.filter((t) => isTaseronGrupTalep(t) && isPendingPersonelOnayDurum(t.durum));

  const wpText = useMemo(() => {
    if (parsed.yon === 'cikis') {
      return buildTaseronCikisWhatsAppText({
        ad: parsed.ad,
        soyad: parsed.soyad,
        tcNo: parsed.tcNo,
        firmaAdi: parsed.firmaAdi,
        isGorev: parsed.isGorev,
        cikisTarihi: parsed.tarih,
        gonderen,
      });
    }
    return buildTaseronGirisWhatsAppText({
      ad: parsed.ad,
      soyad: parsed.soyad,
      tcNo: parsed.tcNo,
      firmaAdi: parsed.firmaAdi,
      isGorev: parsed.isGorev,
      girisTarihi: parsed.tarih,
      gonderen,
    });
  }, [parsed, gonderen]);

  const eslesenTaseron = useMemo(() => {
    const taseronlar = personeller.filter(isTaseronPersonelRecord);
    const tc = digitsTc(parsed.tcNo);
    if (tc.length === 11) {
      const byTc = taseronlar.find((p) => digitsTc(p.tcNo) === tc);
      if (byTc) return byTc;
    }
    return taseronlar.find((p) => namesMatchExact(p, parsed));
  }, [personeller, parsed.ad, parsed.soyad, parsed.tcNo]);

  const copyText = async () => {
    await navigator.clipboard.writeText(wpText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const applyParse = (partial: Partial<TaseronGrupParse>, fallbackYon?: TaseronGrupYon, nameOverride?: string) => {
    const usedName = nameOverride || fileName;
    const fromMsg = parseTaseronGrupMessageMeta({ fileName: usedName, caption: wpPaste });
    const next = normalizeTaseronGrupParse(
      {
        ...fromMsg,
        ...partial,
        yon: fromMsg.yon || partial.yon,
        firmaAdi: fromMsg.firmaAdi || partial.firmaAdi,
        ad: partial.ad || fromMsg.ad,
        soyad: partial.soyad || fromMsg.soyad,
        tcNo: partial.tcNo || fromMsg.tcNo,
      },
      { fileName: usedName, fallbackYon: fromMsg.yon || fallbackYon }
    );
    next.firmaAdi = resolveTaseronGrupFirmaAdi(next.firmaAdi, cariKartlar);
    setParsed(next);
    return next;
  };

  const applyWpPaste = () => {
    setErr(null);
    setOk(null);
    const extracted = parseTaseronGrupWhatsAppText(wpPaste);
    if (!extracted.ad && !extracted.firmaAdi && !extracted.yon) {
      setErr('Grup metninden kişi / firma / yön okunamadı. Etiketli satır (Ad Soyad, Firma, İşe giriş) veya sabit şablonu yapıştırın.');
      return;
    }
    const next = applyParse({ ...parsed, ...extracted }, extracted.yon || parsed.yon);
    setOk(
      `Grup metni okundu: ${next.ad || '—'} ${next.soyad || ''} · ${next.firmaAdi || 'firma yok'} · ${next.yon === 'cikis' ? 'ÇIKIŞ' : 'GİRİŞ'}. Kontrol edip kuyruğa yazın.`
    );
  };

  const parseFile = async (file: File) => {
    setErr(null);
    setOk(null);
    setBusy(true);
    setFileName(file.name);
    try {
      const { base64, mime, dataUrl } = await fileToBase64(file);
      setEvrakUrl(dataUrl);
      const yonGuess =
        parseTaseronGrupMessageMeta({ fileName: file.name, caption: wpPaste }).yon ||
        inferTaseronYonFromText(file.name) ||
        parsed.yon ||
        'giris';
      try {
        const res = await fetchApiJson<{ success: boolean; data?: Partial<TaseronGrupParse>; error?: string }>(
          '/api/parse-taseron-grup',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileBase64: base64, mimeType: mime, fileName: file.name }),
          }
        );
        if (!res.success || !res.data) throw new Error(res.error || 'Evrak okunamadı.');
        const next = applyParse(res.data, yonGuess, file.name);
        setOk(
          `Evrak okundu: ${next.ad} ${next.soyad} · ${next.firmaAdi || 'firma yok'} · ${next.yon === 'cikis' ? 'ÇIKIŞ' : 'GİRİŞ'}. Onaya yazmadan önce kontrol edin.`
        );
      } catch (parseErr: any) {
        setParsed((prev) => ({ ...prev, yon: yonGuess }));
        setErr(
          `${parseErr?.message || 'Yapay zeka evrakı okuyamadı.'} Alanları elle doldurup tek kuyruk kaydı açabilirsiniz.`
        );
      }
    } catch (e: any) {
      setEvrakUrl(null);
      setErr(e.message || 'Dosya okunamadı.');
    } finally {
      setBusy(false);
    }
  };

  const kuyrugaYaz = async () => {
    setErr(null);
    setOk(null);
    if (!parsed.ad.trim() || !parsed.soyad.trim()) {
      setErr('Ad ve soyad zorunlu. PDF’den gelmediyse grup metnini yapıştırın veya elle yazın — tek mesaj, tek kişi.');
      return;
    }
    if (!parsed.firmaAdi.trim()) {
      setErr('Firma adı zorunlu. Hangi taşeron şirket olduğu gruptaki mesajda / PDF’de okunmalı.');
      return;
    }
    if (!parsed.tarih) {
      setErr('Tarih zorunlu (işe giriş veya işten çıkış).');
      return;
    }
    if (parsed.yon === 'giris') {
      const mevcut = findOpenTaseronGrupTalep(bekleyenGiris, parsed);
      if (mevcut) {
        setErr(
          `Bu kişi için zaten açık bir taşeron giriş kuyruğu var (${mevcut.ad || ''} ${mevcut.soyad || ''}). Aynı mesaj ikinci kez yazılmaz.`
        );
        return;
      }
    } else {
      const mevcut = findOpenTaseronGrupTalep(bekleyenCikis, parsed);
      if (mevcut) {
        setErr(`Bu kişi için zaten açık bir taşeron çıkış kuyruğu var. İkinci talep açılmaz.`);
        return;
      }
    }

    setBusy(true);
    try {
      const firmaAdi = resolveTaseronGrupFirmaAdi(parsed.firmaAdi, cariKartlar);
      const payload = { ...parsed, firmaAdi };
      if (parsed.yon === 'giris') {
        const id = `GIRIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
        await setDoc(
          doc(db, 'personelGirisTalepleri', id),
          cleanUndefined(buildTaseronGirisTalepDoc({ id, parsed: payload, evrakUrl: evrakUrl || undefined, gonderen }))
        );
        setOk(
          `${parsed.ad} ${parsed.soyad} taşeron giriş kuyruğuna yazıldı (firma: ${firmaAdi}). Kadro yazılmadı — Onay → Personel oluşturma’da onaylanır.`
        );
        addNotification?.(`${parsed.ad} ${parsed.soyad} taşeron grup girişi Onay kuyruğuna düştü.`);
      } else {
        const id = `CIKIS-${TASERON_GRUP_KAYNAK}-${Date.now()}`;
        await setDoc(
          doc(db, 'personelCikisTalepleri', id),
          cleanUndefined(
            buildTaseronCikisTalepDoc({
              id,
              parsed: payload,
              evrakUrl: evrakUrl || undefined,
              gonderen,
              personelId: eslesenTaseron?.id,
            })
          )
        );
        setOk(
          `${parsed.ad} ${parsed.soyad} taşeron çıkış kuyruğuna yazıldı. Kart pasife alınmadı — Onay → Personel giriş-çıkış’ta resmileşir.`
        );
        addNotification?.(`${parsed.ad} ${parsed.soyad} taşeron grup çıkışı Onay kuyruğuna düştü.`);
      }
      setParsed(emptyParse());
      setEvrakUrl(null);
      setFileName('');
      setWpPaste('');
    } catch (e: any) {
      setErr(e.message || 'Kuyruk yazılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const patch = (key: keyof TaseronGrupParse, value: string) => {
    setParsed((prev) => ({
      ...prev,
      [key]: key === 'yon' ? (value as TaseronGrupYon) : key === 'firmaAdi' ? resolveTaseronGrupFirmaAdi(value, cariKartlar) || value : value,
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-[12px] text-teal-950 leading-relaxed">
        <strong>Taşeron grup:</strong> WhatsApp grubu ({TASERON_GRUP_ADI}) dinlenmez. Gruba düşen her PDF
        (işe giriş bildirgesi veya ayrılış) buraya bırakılır; alt yazıdaki firma (ör. Yurt mekanik giriş)
        okunur. <em>Tek mesaj = tek kuyruk kaydı</em>. Kadro bu ekrandan yazılmaz.
      </div>

      {err ? <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p> : null}
      {ok ? <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{ok}</p> : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            1 · Gruptaki mesajı bırak
          </h3>
          <p className="text-[11px] text-slate-500">
            {TASERON_GRUP_ADI}. PDF/foto veya grup metni; hangi firma ve ne iş yaptığı okunur.
          </p>
          <label className="block text-xs font-bold text-slate-600 cursor-pointer border border-dashed border-teal-300 rounded-xl p-4 text-center hover:bg-teal-50/50">
            <Upload className="w-4 h-4 mx-auto mb-1" />
            {busy ? 'Okunuyor…' : 'PDF / foto bırakın (bir mesaj, bir evrak)'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void parseFile(e.target.files[0])}
            />
            {fileName ? <span className="block mt-1 text-[10px] text-teal-800 font-medium">{fileName}</span> : null}
          </label>

          <label className="block text-[10px] font-bold uppercase text-slate-500">
            Grup metni / WhatsApp alt yazı (ör. Yurt mekanik giriş)
            <textarea
              className={`${input} min-h-[72px] font-normal normal-case`}
              value={wpPaste}
              onChange={(e) => setWpPaste(e.target.value)}
              placeholder="PDF’nin altındaki kısa yazı veya kopyalanan mesaj"
            />
          </label>
          <button
            type="button"
            onClick={applyWpPaste}
            className="text-xs font-bold px-3 py-2 rounded-lg border border-teal-200 bg-white hover:bg-teal-50 cursor-pointer"
          >
            Metni oku
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 col-span-2">
              Yön (giriş / çıkış) *
              <select className={input} value={parsed.yon} onChange={(e) => patch('yon', e.target.value)}>
                <option value="giris">İşe giriş</option>
                <option value="cikis">İşten çıkış</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Ad *
              <input className={input} value={parsed.ad} onChange={(e) => patch('ad', e.target.value)} />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Soyad *
              <input className={input} value={parsed.soyad} onChange={(e) => patch('soyad', e.target.value)} />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              TC (varsa)
              <input className={input} value={parsed.tcNo || ''} onChange={(e) => patch('tcNo', e.target.value)} inputMode="numeric" />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">
              Tarih *
              <input type="date" className={input} value={parsed.tarih} onChange={(e) => patch('tarih', e.target.value)} />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500 col-span-2">
              Firma *
              <input
                className={input}
                list="taseron-grup-firma"
                value={parsed.firmaAdi}
                onChange={(e) => patch('firmaAdi', e.target.value)}
                placeholder="PDF / gruptaki taşeron ünvanı"
              />
              <datalist id="taseron-grup-firma">
                {taseronCariler.map((c) => (
                  <option key={c.id} value={c.unvan} />
                ))}
              </datalist>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500 col-span-2">
              Yapılan iş (nitelik)
              <input
                className={input}
                value={parsed.isGorev}
                onChange={(e) => patch('isGorev', e.target.value)}
                placeholder="Örn. ALÇI SIVA — yoklama görevi TAŞERON PERSONEL kalır"
              />
            </label>
          </div>

          {parsed.yon === 'cikis' ? (
            <p className="text-[11px] text-slate-600">
              {eslesenTaseron
                ? `Mevcut taşeron kartı bulundu: ${eslesenTaseron.ad} ${eslesenTaseron.soyad} · ${eslesenTaseron.firmaAdi || 'firma yok'}. Onaylanınca pasife alınır; şimdi değil.`
                : 'Eşleşen taşeron kartı yok. Çıkış yine Onay kuyruğuna düşer; Ana Firma kartına dokunulmaz.'}
            </p>
          ) : null}

          <pre className="text-[10px] bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-wrap font-mono text-slate-700 max-h-40 overflow-auto">
            {wpText}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyText()}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Sabit metni kopyala
            </button>
            <a
              href={buildWhatsAppUrl(wpText)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp’ta aç
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void kuyrugaYaz()}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-teal-800 text-white hover:bg-teal-900 cursor-pointer disabled:opacity-50"
            >
              Onay kuyruğuna yaz (kadrosuz)
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">2 · Bekleyen taşeron grup kuyruğu</h3>
          <p className="text-[11px] text-slate-500">
            Kaynak: {TASERON_GRUP_KAYNAK}. Onay havuzu bunları ayrı rozetle gösterir. Haftalık liste yapıştırması burayı
            ezmez.
          </p>

          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Giriş ({bekleyenGiris.length})</p>
            <div className="max-h-40 overflow-auto border border-slate-100 rounded-xl">
              {bekleyenGiris.length === 0 ? (
                <p className="p-3 text-[11px] text-slate-500 text-center">Açık taşeron giriş kuyruğu yok.</p>
              ) : (
                bekleyenGiris.map((t) => (
                  <div key={t.id} className="px-3 py-2 text-[11px] border-b border-slate-50 flex justify-between gap-2">
                    <span className="font-semibold">
                      {t.ad} {t.soyad}
                    </span>
                    <span className="text-slate-500 truncate">
                      {taseronGrupDurumEtiketi(t.durum, 'giris')} · {t.firmaAdi || '—'} · {taseronIsGorevOf(t) || t.gorev}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Çıkış ({bekleyenCikis.length})</p>
            <div className="max-h-40 overflow-auto border border-slate-100 rounded-xl">
              {bekleyenCikis.length === 0 ? (
                <p className="p-3 text-[11px] text-slate-500 text-center">Açık taşeron çıkış kuyruğu yok.</p>
              ) : (
                bekleyenCikis.map((t) => (
                  <div key={t.id} className="px-3 py-2 text-[11px] border-b border-slate-50 flex justify-between gap-2">
                    <span className="font-semibold">{t.personelIsim || `${t.ad || ''} ${t.soyad || ''}`.trim()}</span>
                    <span className="text-slate-500 truncate">
                      {taseronGrupDurumEtiketi(t.durum, 'cikis')} · {t.firmaAdi || '—'} · {String(t.cikisTarihi || '').slice(0, 10)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TaseronGrupKopruTab;

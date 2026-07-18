import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Package, Plus, Search, Trash2, Pencil, Download,
  ClipboardList, X, RefreshCw, FileText, Truck, Receipt, Home, User
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { CariKart, StokKart } from '../types/erp';
import { db } from '../lib/firebase';
import { warnIfDuplicateCari, warnIfDuplicateStok } from '../lib/duplicateNameUtils';
import { exportHistoryReport } from '../lib/reportExport';

interface CariStokScreenProps {
  cariKartlar: CariKart[];
  setCariKartlar: React.Dispatch<React.SetStateAction<CariKart[]>>;
  stokKartlar: StokKart[];
  setStokKartlar: React.Dispatch<React.SetStateAction<StokKart[]>>;
}

type HistoryLog = {
  id: string;
  type: string;
  title: string;
  desc: string;
  date: string;
  badgeColor: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  'KART AÇILIŞI': <Building2 size={14} />,
  'SATIN ALMA': <ClipboardList size={14} />,
  'İRSALİYE': <Truck size={14} />,
  'İRSALİYE GİRİŞİ': <Truck size={14} />,
  'FATURA': <Receipt size={14} />,
  'LOJMAN KONAKLAMA': <Home size={14} />,
  'PERSONEL ZİMMET': <User size={14} />,
};

export const CariStokScreen: React.FC<CariStokScreenProps> = ({
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
}) => {
  const [csTab, setCsTab] = useState<'cari' | 'stok'>('cari');
  const [cariSearchQuery, setCariSearchQuery] = useState('');
  const [stokSearchQuery, setStokSearchQuery] = useState('');
  const [selectedCariId, setSelectedCariId] = useState<string | null>(null);
  const [selectedStokId, setSelectedStokId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [newCariUnvan, setNewCariUnvan] = useState('');
  const [newCariType, setNewCariType] = useState<CariKart['kartTipi']>('TEDARIKCI');
  const [newCariYetkili, setNewCariYetkili] = useState('');
  const [newCariTelefon, setNewCariTelefon] = useState('');
  const [newCariEposta, setNewCariEposta] = useState('');
  const [newCariVergiNo, setNewCariVergiNo] = useState('');
  const [newCariVergiDairesi, setNewCariVergiDairesi] = useState('');
  const [newCariAdres, setNewCariAdres] = useState('');
  const [newCariIban, setNewCariIban] = useState('');
  const [newCariNotlar, setNewCariNotlar] = useState('');
  const [editingCariId, setEditingCariId] = useState<string | null>(null);

  const [newStokAdi, setNewStokAdi] = useState('');
  const [newStokBirim, setNewStokBirim] = useState('TON');
  const [newStokKategori, setNewStokKategori] = useState('Kaba İnşaat İmalatı');
  const [newStokAciklama, setNewStokAciklama] = useState('');
  const [editingStokId, setEditingStokId] = useState<string | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyList, setHistoryList] = useState<HistoryLog[]>([]);
  const [historyFilter, setHistoryFilter] = useState('ALL');

  const filteredCariKartlar = useMemo(() => {
    const q = cariSearchQuery.trim().toLowerCase();
    if (!q) return cariKartlar;
    return cariKartlar.filter(
      (cr) =>
        String(cr.unvan || '').toLowerCase().includes(q) ||
        String(cr.kod || '').toLowerCase().includes(q) ||
        String(cr.kartTipi || '').toLowerCase().includes(q) ||
        String(cr.iban || '').toLowerCase().includes(q)
    );
  }, [cariKartlar, cariSearchQuery]);

  const filteredStokKartlar = useMemo(() => {
    const q = stokSearchQuery.trim().toLowerCase();
    if (!q) return stokKartlar;
    return stokKartlar.filter(
      (st) =>
        String(st.stokAdi || '').toLowerCase().includes(q) ||
        String(st.stokKodu || '').toLowerCase().includes(q) ||
        String(st.kategori || '').toLowerCase().includes(q) ||
        String(st.birim || '').toLowerCase().includes(q)
    );
  }, [stokKartlar, stokSearchQuery]);

  const selectedCari = useMemo(
    () => cariKartlar.find((c) => c.id === selectedCariId) || null,
    [cariKartlar, selectedCariId]
  );
  const selectedStok = useMemo(
    () => stokKartlar.find((s) => s.id === selectedStokId) || null,
    [stokKartlar, selectedStokId]
  );

  useEffect(() => {
    if (csTab === 'cari' && !selectedCariId && filteredCariKartlar[0]) {
      setSelectedCariId(filteredCariKartlar[0].id);
    }
    if (csTab === 'stok' && !selectedStokId && filteredStokKartlar[0]) {
      setSelectedStokId(filteredStokKartlar[0].id);
    }
  }, [csTab, filteredCariKartlar, filteredStokKartlar, selectedCariId, selectedStokId]);

  const loadHistoryData = async (type: 'cari' | 'stok', id: string, name: string, code: string) => {
    setHistoryLoading(true);
    setHistoryList([]);
    setHistoryFilter('ALL');
    try {
      const logs: HistoryLog[] = [];
      logs.push({
        id: 'init',
        type: 'KART AÇILIŞI',
        title: 'Kart Tanımlama ve Açılış Kaydı',
        desc: `"${name}" (${code || 'KODSUZ'}) kartı sisteme tanımlandı.`,
        date: 'İlk Kayıt',
        badgeColor: 'bg-emerald-100 text-emerald-800',
      });

      if (type === 'cari') {
        const purchasesSnap = await getDocs(collection(db, 'satinAlmaTalepleri'));
        purchasesSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.cariFirma?.toLowerCase() === name.toLowerCase()) {
            logs.push({
              id: docSnap.id,
              type: 'SATIN ALMA',
              title: `Satın Alma Talebi: ${data.saId || 'SA-KOD'}`,
              desc: `${data.aciklama || 'Açıklama yok'} (${data.kalemler?.length || 0} kalem). Onay: ${data.onayDurumu}`,
              date: data.tarih || '',
              badgeColor: 'bg-slate-100 text-slate-800',
            });
          }
        });

        const waybillsSnap = await getDocs(collection(db, 'irsaliyeler'));
        waybillsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const firmaMatch =
            String(data.firma || '').toLowerCase() === name.toLowerCase();
          const cariIdMatch = Boolean(data.cariKartId && data.cariKartId === id);
          if (firmaMatch || cariIdMatch) {
            logs.push({
              id: docSnap.id,
              type: 'İRSALİYE',
              title: `İrsaliye: ${data.irsaliyeNo || 'İRS-KOD'}`,
              desc: `Durum: ${data.onayDurumu}${data.kaynak ? ` · Kaynak: ${data.kaynak}` : ''}${
                data.plaka ? ` · ${data.plaka}` : ''
              }${data.cekimAdedi != null ? ` · ${data.cekimAdedi} çekim` : ''}`,
              date: data.tarih || '',
              badgeColor: 'bg-amber-100 text-amber-800',
            });
          }
        });

        const invoicesSnap = await getDocs(collection(db, 'faturalar'));
        invoicesSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.cariUnvan?.toLowerCase() === name.toLowerCase()) {
            logs.push({
              id: docSnap.id,
              type: 'FATURA',
              title: `Fatura: ${data.faturaNo || 'FAT-KOD'}`,
              desc: `Matrah: ₺${Number(data.toplamTutar || 0).toLocaleString('tr-TR')} · ${data.durum}`,
              date: data.tarih || '',
              badgeColor: 'bg-stone-200 text-stone-800',
            });
          }
        });

        const staysSnap = await getDocs(collection(db, 'kampKayitlari'));
        staysSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.calistigiFirma?.toLowerCase() === name.toLowerCase()) {
            logs.push({
              id: docSnap.id,
              type: 'LOJMAN KONAKLAMA',
              title: `Konaklama: ${data.personelIsim}`,
              desc: `${data.girisTarihi} · ${data.durum === 'AKTIF' ? 'Hâlâ konaklıyor' : 'Ayrıldı'}`,
              date: data.girisTarihi || '',
              badgeColor: 'bg-teal-100 text-teal-800',
            });
          }
        });
      } else {
        const purchasesSnap = await getDocs(collection(db, 'satinAlmaTalepleri'));
        purchasesSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const hasItem = data.kalemler?.some(
            (k: any) => k.urunAdi?.toLowerCase() === name.toLowerCase() || k.stokKartId === id
          );
          if (hasItem) {
            logs.push({
              id: docSnap.id,
              type: 'SATIN ALMA',
              title: `Satın Alma: ${data.saId || 'SA-KOD'}`,
              desc: `Firma: ${data.cariFirma}`,
              date: data.tarih || '',
              badgeColor: 'bg-slate-100 text-slate-800',
            });
          }
        });

        const waybillsSnap = await getDocs(collection(db, 'irsaliyeler'));
        waybillsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const hasItem = data.kalemler?.some(
            (k: any) => k.urunAdi?.toLowerCase() === name.toLowerCase() || k.stokKartId === id
          );
          if (hasItem) {
            logs.push({
              id: docSnap.id,
              type: 'İRSALİYE GİRİŞİ',
              title: `Depo girişi: ${data.irsaliyeNo || 'İRS-KOD'}`,
              desc: `Firma: ${data.firma}`,
              date: data.tarih || '',
              badgeColor: 'bg-amber-100 text-amber-800',
            });
          }
        });

        const zimmetsSnap = await getDocs(collection(db, 'personelZimmetleri'));
        zimmetsSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.stockId === id || data.urunAdi?.toLowerCase() === name.toLowerCase()) {
            logs.push({
              id: docSnap.id,
              type: 'PERSONEL ZİMMET',
              title: `Zimmet: ${data.personelName || 'Personel'}`,
              desc: `${data.miktar} ${data.birim} · ${data.durum || 'ZİMMETLİ'}`,
              date: data.tarih || '',
              badgeColor: 'bg-indigo-100 text-indigo-800',
            });
          }
        });
      }

      logs.sort((a, b) => {
        if (a.date === 'İlk Kayıt') return 1;
        if (b.date === 'İlk Kayıt') return -1;
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      setHistoryList(logs);
    } catch (e) {
      console.error('Geçmiş veri okuma hatası:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (csTab === 'cari' && selectedCari) {
      void loadHistoryData('cari', selectedCari.id, selectedCari.unvan, selectedCari.kod);
    } else if (csTab === 'stok' && selectedStok) {
      void loadHistoryData('stok', selectedStok.id, selectedStok.stokAdi, selectedStok.stokKodu);
    } else {
      setHistoryList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csTab, selectedCariId, selectedStokId]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return historyList;
    return historyList.filter((h) => h.type === historyFilter);
  }, [historyList, historyFilter]);

  const historyTypeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of historyList) map[h.type] = (map[h.type] || 0) + 1;
    return map;
  }, [historyList]);

  const resetCariForm = () => {
    setEditingCariId(null);
    setNewCariUnvan('');
    setNewCariYetkili('');
    setNewCariTelefon('');
    setNewCariEposta('');
    setNewCariVergiNo('');
    setNewCariVergiDairesi('');
    setNewCariAdres('');
    setNewCariIban('');
    setNewCariNotlar('');
    setNewCariType('TEDARIKCI');
  };

  const resetStokForm = () => {
    setEditingStokId(null);
    setNewStokAdi('');
    setNewStokAciklama('');
    setNewStokBirim('TON');
    setNewStokKategori('Kaba İnşaat İmalatı');
  };

  const handleCreateCari = () => {
    if (!newCariUnvan.trim()) return;
    if (editingCariId) {
      if (warnIfDuplicateCari(cariKartlar, newCariUnvan, editingCariId)) return;
      setCariKartlar((prev) =>
        prev.map((c) =>
          c.id === editingCariId
            ? {
                ...c,
                unvan: newCariUnvan,
                kartTipi: newCariType,
                yetkili: newCariYetkili,
                telefon: newCariTelefon,
                eposta: newCariEposta,
                vergiNo: newCariVergiNo,
                vergiDairesi: newCariVergiDairesi,
                adres: newCariAdres,
                iban: newCariIban,
                notlar: newCariNotlar,
              }
            : c
        )
      );
      setSelectedCariId(editingCariId);
      resetCariForm();
      setShowForm(false);
      return;
    }
    if (warnIfDuplicateCari(cariKartlar, newCariUnvan)) return;
    const newC: CariKart = {
      id: `c_${Date.now()}`,
      kartTipi: newCariType,
      kod: `CARI-${Math.floor(100 + Math.random() * 900)}`,
      unvan: newCariUnvan,
      yetkili: newCariYetkili || 'Yetkili Tanımsız',
      telefon: newCariTelefon,
      eposta: newCariEposta,
      vergiNo: newCariVergiNo,
      vergiDairesi: newCariVergiDairesi,
      adres: newCariAdres,
      iban: newCariIban,
      durum: 'AKTIF',
      notlar: newCariNotlar || 'Şantiye cari kartı.',
    };
    setCariKartlar((prev) => [...prev, newC]);
    setSelectedCariId(newC.id);
    resetCariForm();
    setShowForm(false);
  };

  const handleCreateStok = () => {
    if (!newStokAdi.trim()) return;
    if (editingStokId) {
      if (warnIfDuplicateStok(stokKartlar, newStokAdi, editingStokId)) return;
      setStokKartlar((prev) =>
        prev.map((s) =>
          s.id === editingStokId
            ? {
                ...s,
                stokAdi: newStokAdi,
                birim: newStokBirim,
                kategori: newStokKategori,
                aciklama: newStokAciklama,
              }
            : s
        )
      );
      setSelectedStokId(editingStokId);
      resetStokForm();
      setShowForm(false);
      return;
    }
    if (warnIfDuplicateStok(stokKartlar, newStokAdi)) return;
    const newS: StokKart = {
      id: `s_${Date.now()}`,
      stokKodu: `STK-${Math.random().toString(16).substring(2, 6).toUpperCase()}`,
      stokAdi: newStokAdi,
      kategori: newStokKategori,
      birim: newStokBirim,
      kritikSeviye: 0,
      durum: 'AKTIF',
      aciklama: newStokAciklama,
    };
    setStokKartlar((prev) => [...prev, newS]);
    setSelectedStokId(newS.id);
    resetStokForm();
    setShowForm(false);
  };

  const openEditCari = (cr: CariKart) => {
    setEditingCariId(cr.id);
    setNewCariUnvan(cr.unvan);
    setNewCariType(cr.kartTipi);
    setNewCariYetkili(cr.yetkili || '');
    setNewCariTelefon(cr.telefon || '');
    setNewCariEposta(cr.eposta || '');
    setNewCariVergiNo(cr.vergiNo || '');
    setNewCariVergiDairesi(cr.vergiDairesi || '');
    setNewCariAdres(cr.adres || '');
    setNewCariIban(cr.iban || '');
    setNewCariNotlar(cr.notlar || '');
    setShowForm(true);
  };

  const openEditStok = (st: StokKart) => {
    setEditingStokId(st.id);
    setNewStokAdi(st.stokAdi);
    setNewStokBirim(st.birim);
    setNewStokKategori(st.kategori || 'Kaba İnşaat İmalatı');
    setNewStokAciklama(st.aciklama || '');
    setShowForm(true);
  };

  const exportLogs = (format: 'csv' | 'html') => {
    const card = csTab === 'cari' ? selectedCari : selectedStok;
    if (!card) return;
    const name = csTab === 'cari' ? (card as CariKart).unvan : (card as StokKart).stokAdi;
    exportHistoryReport({
      title: 'Kart Geçmiş Hareket Raporu',
      fileBase: `Kibritci_${csTab === 'cari' ? 'Cari' : 'Stok'}_Gecmis_${card.id}`,
      meta: [
        `Kart Tipi: ${csTab === 'cari' ? 'Cari Firma' : 'Stok Malzeme'}`,
        `Kart Adı: ${name}`,
        `Kart ID: ${card.id}`,
        `Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}`,
      ],
      logs: historyList.map((log) => ({
        date: log.date,
        type: log.type,
        title: log.title,
        desc: log.desc,
      })),
      format,
    });
  };

  const accent = csTab === 'cari' ? 'amber' : 'teal';

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div
        className={`rounded-3xl p-5 sm:p-6 text-white shadow-md ${
          csTab === 'cari'
            ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900'
            : 'bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
              Finans &amp; Envanter
            </p>
            <h1 className="text-xl sm:text-2xl font-black mt-1">Cari ve Stok Kartları</h1>
            <p className="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              Soldan kartı seçin; sağda kimlik bilgileri ve o karta bağlı tüm alt işlemler
              (satın alma, irsaliye, fatura, zimmet…) kronolojik görünür.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (csTab === 'cari') resetCariForm();
              else resetStokForm();
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-white text-slate-900 font-black text-xs px-4 py-2.5 rounded-xl cursor-pointer hover:bg-amber-50"
          >
            <Plus size={14} /> Yeni {csTab === 'cari' ? 'Cari' : 'Stok'}
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCsTab('cari')}
            className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer ${
              csTab === 'cari'
                ? 'bg-amber-400 text-slate-900 border-amber-300'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
            }`}
          >
            <Building2 size={13} className="inline mr-1.5" />
            Cari ({cariKartlar.length})
          </button>
          <button
            type="button"
            onClick={() => setCsTab('stok')}
            className={`px-4 py-2 rounded-xl text-xs font-black border cursor-pointer ${
              csTab === 'stok'
                ? 'bg-teal-300 text-slate-900 border-teal-200'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
            }`}
          >
            <Package size={13} className="inline mr-1.5" />
            Stok ({stokKartlar.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[62vh]">
        {/* Liste */}
        <aside className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden max-h-[78vh]">
          <div className="p-3 border-b border-slate-100">
            <label className="relative block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={csTab === 'cari' ? cariSearchQuery : stokSearchQuery}
                onChange={(e) =>
                  csTab === 'cari'
                    ? setCariSearchQuery(e.target.value)
                    : setStokSearchQuery(e.target.value)
                }
                placeholder={csTab === 'cari' ? 'Ünvan, kod, IBAN…' : 'Ad, kod, kategori…'}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-slate-400"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {csTab === 'cari'
              ? filteredCariKartlar.map((cr) => {
                  const active = cr.id === selectedCariId;
                  return (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => setSelectedCariId(cr.id)}
                      className={`w-full text-left px-3 py-3 border-b border-slate-50 transition cursor-pointer ${
                        active
                          ? 'bg-amber-50 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono font-bold text-slate-500">{cr.kod}</p>
                          <p className="text-xs font-black text-slate-900 truncate mt-0.5">{cr.unvan}</p>
                          <p className="text-[10px] text-amber-800 font-bold mt-0.5">{cr.kartTipi}</p>
                        </div>
                        <span
                          className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full h-fit ${
                            cr.durum === 'AKTIF'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {cr.durum}
                        </span>
                      </div>
                    </button>
                  );
                })
              : filteredStokKartlar.map((st) => {
                  const active = st.id === selectedStokId;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStokId(st.id)}
                      className={`w-full text-left px-3 py-3 border-b border-slate-50 transition cursor-pointer ${
                        active
                          ? 'bg-teal-50 border-l-4 border-l-teal-500'
                          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono font-bold text-slate-500">{st.stokKodu}</p>
                          <p className="text-xs font-black text-slate-900 truncate mt-0.5">{st.stokAdi}</p>
                          <p className="text-[10px] text-teal-800 font-bold mt-0.5">
                            {st.birim} · {st.kategori}
                          </p>
                        </div>
                        <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full h-fit bg-emerald-100 text-emerald-800">
                          {st.durum}
                        </span>
                      </div>
                    </button>
                  );
                })}
            {(csTab === 'cari' ? filteredCariKartlar : filteredStokKartlar).length === 0 && (
              <p className="p-8 text-center text-xs text-slate-400">Kayıt bulunamadı.</p>
            )}
          </div>
        </aside>

        {/* Detay + alt işlemler */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-4">
          {csTab === 'cari' && !selectedCari && (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Soldan bir cari kart seçin.
            </div>
          )}
          {csTab === 'stok' && !selectedStok && (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Soldan bir stok kartı seçin.
            </div>
          )}

          {csTab === 'cari' && selectedCari && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div>
                  <p className="text-[10px] font-mono font-bold text-slate-500">{selectedCari.kod}</p>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">{selectedCari.unvan}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {[selectedCari.kartTipi, selectedCari.yetkili, selectedCari.telefon]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditCari(selectedCari)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 cursor-pointer"
                  >
                    <Pencil size={12} /> Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('Bu cari kartı silmek istediğinize emin misiniz?')) return;
                      setCariKartlar((prev) => prev.filter((c) => c.id !== selectedCari.id));
                      setSelectedCariId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                  >
                    <Trash2 size={12} /> Sil
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-400">IBAN</p>
                  <p className="font-mono font-bold text-slate-800 mt-1 break-all">
                    {selectedCari.iban || '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-400">Vergi</p>
                  <p className="font-bold text-slate-800 mt-1">
                    {selectedCari.vergiNo || '—'}
                    {selectedCari.vergiDairesi ? ` · ${selectedCari.vergiDairesi}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 sm:col-span-2">
                  <p className="text-[9px] font-black uppercase text-slate-400">Adres / Not</p>
                  <p className="font-medium text-slate-700 mt-1">
                    {selectedCari.adres || selectedCari.notlar || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {csTab === 'stok' && selectedStok && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap justify-between gap-3 items-start">
                <div>
                  <p className="text-[10px] font-mono font-bold text-slate-500">{selectedStok.stokKodu}</p>
                  <h2 className="text-lg font-black text-slate-900 mt-0.5">{selectedStok.stokAdi}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedStok.kategori} · Birim: {selectedStok.birim}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditStok(selectedStok)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-200 cursor-pointer"
                  >
                    <Pencil size={12} /> Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('Bu stok kartını silmek istediğinize emin misiniz?')) return;
                      setStokKartlar((prev) => prev.filter((s) => s.id !== selectedStok.id));
                      setSelectedStokId(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                  >
                    <Trash2 size={12} /> Sil
                  </button>
                </div>
              </div>
              {selectedStok.aciklama && (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  {selectedStok.aciklama}
                </p>
              )}
            </div>
          )}

          {(selectedCari || selectedStok) && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <ClipboardList size={14} className={accent === 'amber' ? 'text-amber-600' : 'text-teal-600'} />
                    Alt işlemler / hareket geçmişi
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {historyList.length} kayıt · seçili karta bağlı satın alma, irsaliye, fatura ve diğer hareketler
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportLogs('csv')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 text-white cursor-pointer"
                  >
                    <Download size={12} /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLogs('html')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 text-white cursor-pointer"
                  >
                    <FileText size={12} /> HTML
                  </button>
                </div>
              </div>

              <div className="px-5 py-3 border-b border-slate-50 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('ALL')}
                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg border cursor-pointer ${
                    historyFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Tümü ({historyList.length})
                </button>
                {Object.entries(historyTypeCounts).map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setHistoryFilter(type)}
                    className={`text-[10px] font-black px-2.5 py-1 rounded-lg border cursor-pointer ${
                      historyFilter === type
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {type} ({count})
                  </button>
                ))}
              </div>

              <div className="p-5 max-h-[48vh] overflow-y-auto space-y-2.5">
                {historyLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-xs font-bold">
                    <RefreshCw size={16} className="animate-spin" /> İşlem geçmişi yükleniyor…
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    Bu filtrede / kartta işlem kaydı yok.
                  </div>
                ) : (
                  filteredHistory.map((log, idx) => (
                    <div
                      key={`${log.id}-${idx}`}
                      className="flex gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/80 hover:border-slate-300 transition"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                        {TYPE_ICON[log.type] || <ClipboardList size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${log.badgeColor}`}
                          >
                            {log.type}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">{log.date}</span>
                        </div>
                        <p className="text-xs font-black text-slate-900 mt-1">{log.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{log.desc}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Form drawer */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`p-4 text-white flex justify-between items-center ${
                csTab === 'cari' ? 'bg-amber-600' : 'bg-teal-700'
              }`}
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                  {csTab === 'cari' ? 'Cari Kart' : 'Stok Kartı'}
                </p>
                <h3 className="text-sm font-black">
                  {csTab === 'cari'
                    ? editingCariId
                      ? 'Cari Düzenle'
                      : 'Yeni Cari'
                    : editingStokId
                      ? 'Stok Düzenle'
                      : 'Yeni Stok'}
                </h3>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {csTab === 'cari' ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Firma Ünvanı *</span>
                    <input
                      value={newCariUnvan}
                      onChange={(e) => setNewCariUnvan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Kart Tipi</span>
                    <select
                      value={newCariType}
                      onChange={(e) => setNewCariType(e.target.value as CariKart['kartTipi'])}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="TEDARIKCI">Tedarikçi</option>
                      <option value="TASERON">Taşeron</option>
                      <option value="ALICI">Alıcı</option>
                      <option value="SATICI">Satıcı</option>
                      <option value="PERSONEL">Personel</option>
                      <option value="ORTAKLAR">Ortaklar</option>
                      <option value="CARI">Diğer Cari</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Yetkili</span>
                    <input
                      value={newCariYetkili}
                      onChange={(e) => setNewCariYetkili(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-500">Telefon</span>
                      <input
                        value={newCariTelefon}
                        onChange={(e) => setNewCariTelefon(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-500">E-posta</span>
                      <input
                        value={newCariEposta}
                        onChange={(e) => setNewCariEposta(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-500">Vergi No</span>
                      <input
                        value={newCariVergiNo}
                        onChange={(e) => setNewCariVergiNo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-500">Vergi Dairesi</span>
                      <input
                        value={newCariVergiDairesi}
                        onChange={(e) => setNewCariVergiDairesi(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">IBAN</span>
                    <input
                      value={newCariIban}
                      onChange={(e) => setNewCariIban(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Adres</span>
                    <textarea
                      rows={2}
                      value={newCariAdres}
                      onChange={(e) => setNewCariAdres(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Notlar</span>
                    <input
                      value={newCariNotlar}
                      onChange={(e) => setNewCariNotlar(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Stok Adı *</span>
                    <input
                      value={newStokAdi}
                      onChange={(e) => setNewStokAdi(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Kategori</span>
                    <select
                      value={newStokKategori}
                      onChange={(e) => setNewStokKategori(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="Kaba İnşaat İmalatı">Kaba İnşaat İmalatı</option>
                      <option value="Dış Cephe İmalatı">Dış Cephe İmalatı</option>
                      <option value="İnce İşler İmalatı">İnce İşler İmalatı</option>
                      <option value="Elektrik Tesisat Malzemesi">Elektrik Tesisat Malzemesi</option>
                      <option value="Mekanik Tesisat Malzemesi">Mekanik Tesisat Malzemesi</option>
                      <option value="Diğer Malzeme">Diğer Malzeme</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Birim</span>
                    <select
                      value={newStokBirim}
                      onChange={(e) => setNewStokBirim(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    >
                      <option value="TON">TON</option>
                      <option value="M3">M3</option>
                      <option value="KG">KG</option>
                      <option value="ADET">ADET</option>
                      <option value="TORBA">TORBA</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-500">Açıklama</span>
                    <input
                      value={newStokAciklama}
                      onChange={(e) => setNewStokAciklama(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={csTab === 'cari' ? handleCreateCari : handleCreateStok}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-black cursor-pointer ${
                  csTab === 'cari' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-700 hover:bg-teal-800'
                }`}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CariStokScreen;

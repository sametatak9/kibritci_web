import React, { useState, useEffect } from 'react';
import { 
  Hammer, 
  AlertTriangle, 
  KeySquare, 
  Camera, 
  Trash2, 
  LogOut, 
  MapPin, 
  Building2, 
  CheckCircle2, 
  Plus, 
  FolderOpen, 
  UserCheck, 
  Calendar, 
  DollarSign, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { compressImage } from '../lib/imageCompress';
import { PARSEL_LIST, blokListForParsel } from '../data/parselBlokMap';
import { KibritciLogo } from './KibritciLogo';

interface ImalatTerminaliScreenProps {
  cariKartlar: any[];
  personeller: any[];
  sahaFaaliyetleri: any[];
  setSahaFaaliyetleri: any;
  saveSahaFaaliyetNow: any;
  hazirTutanaklar: any[];
  setHazirTutanaklar: any;
  currentUser?: any;
  onSignOut?: () => void;
  isStandalone?: boolean;
}

export const ImalatTerminaliScreen: React.FC<ImalatTerminaliScreenProps> = ({
  cariKartlar,
  personeller,
  sahaFaaliyetleri,
  setSahaFaaliyetleri,
  saveSahaFaaliyetNow,
  hazirTutanaklar,
  setHazirTutanaklar,
  currentUser,
  onSignOut,
  isStandalone = false
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'imalat' | 'hasar' | 'daire_teslim'>('imalat');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subcontractors from Cari Kartlar
  const taseronlar = cariKartlar.filter(c => c.kartTipi === 'TASERON');

  // helper function to show status messages
  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // =========================================================================
  // 1. İMALAT GİRİŞİ STATE & HANDLERS
  // =========================================================================
  const [imalatTarih, setImalatTarih] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [imalatParsel, setImalatParsel] = useState<string>(PARSEL_LIST[0] || '');
  const [imalatBlok, setImalatBlok] = useState<string>('');
  const [imalatAciklama, setImalatAciklama] = useState<string>('');
  const [imalatFotos, setImalatFotos] = useState<string[]>([]);
  const [isSavingImalat, setIsSavingImalat] = useState(false);

  // Update default block when parsel changes
  useEffect(() => {
    if (imalatParsel) {
      const bloks = blokListForParsel(imalatParsel);
      setImalatBlok(bloks[0] || '');
    }
  }, [imalatParsel]);

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'imalat' | 'hasar' | 'teslim' | 'iade') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const added: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(String(event.target?.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          const compressed = await compressImage(rawBase64);
          added.push(compressed);
        } catch {
          added.push(rawBase64);
        }
      }

      if (target === 'imalat') {
        setImalatFotos(prev => [...prev, ...added].slice(0, 5));
      } else if (target === 'hasar') {
        setTutanakFotos(prev => [...prev, ...added].slice(0, 3));
      } else if (target === 'teslim') {
        setNewDelivery(prev => ({ ...prev, teslimFoto: added[0] || '' }));
      } else if (target === 'iade') {
        setReturnAction(prev => ({ ...prev, iadeFoto: added[0] || '' }));
      }
      showStatus('success', 'Fotoğraf başarıyla yüklendi.');
    } catch (err) {
      showStatus('error', 'Fotoğraf yüklenirken hata oluştu.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveImalat = async () => {
    if (!imalatAciklama.trim()) {
      showStatus('error', 'Lütfen imalat açıklaması yazın.');
      return;
    }
    if (imalatFotos.length === 0) {
      showStatus('error', 'Lütfen en az 1 imalat fotoğrafı ekleyin.');
      return;
    }

    setIsSavingImalat(true);
    try {
      const newRecord = {
        id: `sf_${Date.now()}`,
        personelId: '',
        tarih: imalatTarih,
        isNiteligi: 'İmalat',
        parsel: imalatParsel,
        blok: imalatBlok,
        aciklama: imalatAciklama,
        fotoUrls: imalatFotos,
        fotoUrl: imalatFotos[0] || '',
        kaynakEkran: 'İMALAT_TERMİNALİ',
        kaydeden: currentUser?.email || 'anahtarci',
        kaydedenUid: currentUser?.uid || '',
      };

      await saveSahaFaaliyetNow(newRecord, 'formen_mobil');
      setImalatAciklama('');
      setImalatFotos([]);
      showStatus('success', 'İmalat kaydı başarıyla Daily Saha Faaliyetlerine eklendi.');
    } catch (err: any) {
      showStatus('error', err?.message || 'İmalat kaydı kaydedilemedi.');
    } finally {
      setIsSavingImalat(false);
    }
  };

  // =========================================================================
  // 2. YÖNETİCİYE HASAR RAPORU (TUTANAK) STATE & HANDLERS
  // =========================================================================
  const [tutanakSubject, setTutanakSubject] = useState<string>('Hasarlı Bölge Tespit Tutanağı');
  const [tutanakDate, setTutanakDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tutanakParsel, setTutanakParsel] = useState<string>(PARSEL_LIST[0] || '');
  const [tutanakBlok, setTutanakBlok] = useState<string>('');
  const [tutanakText, setTutanakText] = useState<string>('');
  const [tutanakFotos, setTutanakFotos] = useState<string[]>([]);
  const [isSavingTutanak, setIsSavingTutanak] = useState(false);

  useEffect(() => {
    if (tutanakParsel) {
      const bloks = blokListForParsel(tutanakParsel);
      setTutanakBlok(bloks[0] || '');
    }
  }, [tutanakParsel]);

  const handleSendTutanak = async () => {
    if (!tutanakSubject.trim()) {
      showStatus('error', 'Lütfen tutanak konusunu doldurun.');
      return;
    }
    if (!tutanakText.trim()) {
      showStatus('error', 'Lütfen hasar / tutanak detayını yazın.');
      return;
    }
    if (tutanakFotos.length === 0) {
      showStatus('error', 'Lütfen en az 1 adet hasar görseli ekleyin.');
      return;
    }

    setIsSavingTutanak(true);
    try {
      const id = `t_${Date.now()}`;
      const docNo = `TUT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newDoc = {
        id,
        tutanakTipi: 'HASAR',
        belgeNo: docNo,
        konu: tutanakSubject,
        tarih: tutanakDate,
        icerik: `${tutanakText}\n\nKonum: ${tutanakParsel} / ${tutanakBlok}`,
        durum: 'ONAY BEKLİYOR',
        aciklama: 'İmalat Terminalinden hasar tutanağı gönderildi.',
        kaydedenAnahtarci: currentUser?.email || 'anahtarci',
        foto1: tutanakFotos[0] || '',
        foto2: tutanakFotos[1] || '',
        foto3: tutanakFotos[2] || '',
        parsel: tutanakParsel,
        blok: tutanakBlok
      };

      await setDoc(doc(db, 'hazirTutanaklar', id), newDoc);
      setTutanakText('');
      setTutanakFotos([]);
      showStatus('success', 'Hasar raporu başarıyla oluşturuldu ve onay paneline gönderildi.');
    } catch (err: any) {
      showStatus('error', err?.message || 'Tutanak gönderilemedi.');
    } finally {
      setIsSavingTutanak(false);
    }
  };

  // =========================================================================
  // 3. DAİRE TESLİM VE İADE TAKİBİ STATE & HANDLERS
  // =========================================================================
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    parsel: PARSEL_LIST[0] || '',
    blok: '',
    daireNo: '',
    taseronId: '',
    taseronAdi: '',
    manualTaseron: '',
    muhatapPersonel: '',
    teslimTarihi: new Date().toISOString().split('T')[0],
    teslimFoto: ''
  });

  const [returnAction, setReturnAction] = useState<{
    delivery: any | null;
    iadeTarihi: string;
    iadeFoto: string;
    hasDamage: boolean;
    damageDescription: string;
    penaltyAmount: number;
  }>({
    delivery: null,
    iadeTarihi: new Date().toISOString().split('T')[0],
    iadeFoto: '',
    hasDamage: false,
    damageDescription: '',
    penaltyAmount: 0
  });

  const [isSavingDelivery, setIsSavingDelivery] = useState(false);
  const [isSavingReturn, setIsSavingReturn] = useState(false);

  useEffect(() => {
    if (newDelivery.parsel) {
      const bloks = blokListForParsel(newDelivery.parsel);
      setNewDelivery(prev => ({ ...prev, blok: bloks[0] || '' }));
    }
  }, [newDelivery.parsel]);

  // Subscribe to daire teslimatları collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'daireTeslimatleri'), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docItem) => {
        list.push({ id: docItem.id, ...docItem.data() });
      });
      list.sort((a, b) => new Date(b.teslimTarihi || 0).getTime() - new Date(a.teslimTarihi || 0).getTime());
      setDeliveries(list);
    });
    return () => unsub();
  }, []);

  const handleStartDelivery = async () => {
    const firmName = newDelivery.taseronId 
      ? taseronlar.find(t => t.id === newDelivery.taseronId)?.unvan || ''
      : newDelivery.manualTaseron;

    if (!newDelivery.daireNo.trim()) {
      showStatus('error', 'Lütfen daire numarasını girin.');
      return;
    }
    if (!firmName.trim()) {
      showStatus('error', 'Lütfen taşeron firmayı seçin veya girin.');
      return;
    }
    if (!newDelivery.muhatapPersonel.trim()) {
      showStatus('error', 'Lütfen muhatap personel ismini girin.');
      return;
    }
    if (!newDelivery.teslimFoto) {
      showStatus('error', 'Daire teslim anı fotoğrafı zorunludur.');
      return;
    }

    setIsSavingDelivery(true);
    try {
      const id = `dt_${Date.now()}`;
      const payload = {
        id,
        parsel: newDelivery.parsel,
        blok: newDelivery.blok,
        daireNo: newDelivery.daireNo.trim(),
        taseronId: newDelivery.taseronId || null,
        taseronAdi: firmName.trim(),
        muhatapPersonel: newDelivery.muhatapPersonel.trim(),
        teslimEden: currentUser?.displayName || currentUser?.email || 'Anahtarcı Personeli',
        teslimEdenEmail: currentUser?.email || '',
        teslimTarihi: newDelivery.teslimTarihi,
        teslimFoto: newDelivery.teslimFoto,
        durum: 'TESLİM EDİLDİ',
      };

      await setDoc(doc(db, 'daireTeslimatleri', id), payload);
      setShowNewDelivery(false);
      setNewDelivery({
        parsel: PARSEL_LIST[0] || '',
        blok: '',
        daireNo: '',
        taseronId: '',
        taseronAdi: '',
        manualTaseron: '',
        muhatapPersonel: '',
        teslimTarihi: new Date().toISOString().split('T')[0],
        teslimFoto: ''
      });
      showStatus('success', 'Anahtar teslim kaydı başarıyla oluşturuldu.');
    } catch (err: any) {
      showStatus('error', err?.message || 'Teslim kaydı oluşturulamadı.');
    } finally {
      setIsSavingDelivery(false);
    }
  };

  const handleCompleteReturn = async () => {
    const delivery = returnAction.delivery;
    if (!delivery) return;

    if (!returnAction.iadeFoto) {
      showStatus('error', 'Teslim alma / iade anı fotoğrafı zorunludur.');
      return;
    }

    if (returnAction.hasDamage && !returnAction.damageDescription.trim()) {
      showStatus('error', 'Hasar varsa lütfen detaylı hasar açıklaması girin.');
      return;
    }

    setIsSavingReturn(true);
    try {
      const updatedStatus = returnAction.hasDamage ? 'HASARLI İADE ALINDI' : 'SORUNSUZ İADE ALINDI';
      
      // Update delivery record in Firestore
      const deliveryRef = doc(db, 'daireTeslimatleri', delivery.id);
      await updateDoc(deliveryRef, {
        durum: updatedStatus,
        iadeTarihi: returnAction.iadeTarihi,
        iadeFoto: returnAction.iadeFoto,
        hasarAciklamasi: returnAction.hasDamage ? returnAction.damageDescription : null,
        cezaTutari: returnAction.hasDamage ? returnAction.penaltyAmount : 0
      });

      // If damaged, generate a CEZA tutanak in hazirTutanaklar
      if (returnAction.hasDamage) {
        const tutanakId = `t_${Date.now()}`;
        const docNo = `TUT-CEZA-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const cezaTutanak = {
          id: tutanakId,
          tutanakTipi: 'CEZA',
          belgeNo: docNo,
          konu: `${delivery.parsel} - ${delivery.blok} - Daire ${delivery.daireNo} Anahtar Teslim ve Hasar Ceza Tutanağı`,
          tarih: returnAction.iadeTarihi,
          icerik: `Şantiyemiz ${delivery.parsel} / ${delivery.blok} blok ${delivery.daireNo} numaralı daire, tamirat/onarım işlemleri yapılması maksadıyla ${delivery.teslimTarihi} tarihinde ${delivery.taseronAdi} firması personeli ${delivery.muhatapPersonel} isimli yetkiliye anahtar teslimiyle devredilmiştir.\n\nİşlemler tamamlandıktan sonra ${returnAction.iadeTarihi} tarihinde daire geri teslim alınırken yapılan kontrolde daireye hasar verildiği tespit edilmiştir.\n\nHasar Detayı: ${returnAction.damageDescription}\n\nİlgili taşeron firmaya ₺${returnAction.penaltyAmount.toLocaleString('tr-TR')} cezai işlem uygulanması ve hakedişinden kesilmesi kararlaştırılmıştır.`,
          taseronAdi: delivery.taseronAdi,
          cariKartId: delivery.taseronId || '',
          cezaTutari: returnAction.penaltyAmount,
          durum: 'ONAY BEKLİYOR',
          aciklama: 'Daire teslimatı hasarlı tamamlandığı için ceza tutanağı oluşturuldu.',
          kaydedenAnahtarci: currentUser?.email || 'anahtarci',
          foto1: delivery.teslimFoto, // initial state
          foto2: returnAction.iadeFoto, // final state
          parsel: delivery.parsel,
          blok: delivery.blok,
          muhatapPersonel: delivery.muhatapPersonel,
          teslimEden: delivery.teslimEden,
          teslimEdenEmail: delivery.teslimEdenEmail
        };

        await setDoc(doc(db, 'hazirTutanaklar', tutanakId), cezaTutanak);
        await updateDoc(deliveryRef, { cezaTutanakId: tutanakId });
      }

      setReturnAction({
        delivery: null,
        iadeTarihi: new Date().toISOString().split('T')[0],
        iadeFoto: '',
        hasDamage: false,
        damageDescription: '',
        penaltyAmount: 0
      });
      showStatus('success', 'Daire geri teslim kaydı başarıyla tamamlandı.');
    } catch (err: any) {
      showStatus('error', err?.message || 'İade işlemi kaydedilemedi.');
    } finally {
      setIsSavingReturn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      
      {/* 📱 Premium Header */}
      <header className="sticky top-0 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80 px-4 py-3 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="bg-[#2563EB]/15 p-2 rounded-2xl border border-[#2563EB]/25">
            <Hammer className="text-[#3B82F6] animate-pulse" size={20} />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5 font-sans">
              İMALAT TERMİNALİ
            </h1>
            <p className="text-[10px] text-slate-400">
              Anahtarcı & Usta Saha Bildirim Sistemi
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {currentUser && (
            <div className="bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-xl text-right hidden xs:block">
              <span className="text-[7px] text-slate-500 block font-bold uppercase">Personel</span>
              <span className="text-[10px] font-mono font-bold text-sky-400">{currentUser.email}</span>
            </div>
          )}
          {onSignOut && (
            <button 
              onClick={onSignOut}
              className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl transition cursor-pointer"
              title="Güvenli Çıkış"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      {/* 🔔 Real-time status notifications */}
      {statusMessage && (
        <div className="fixed top-16 left-4 right-4 z-40 animate-bounce">
          <div className={`p-3.5 rounded-2xl border flex items-center space-x-2.5 shadow-2xl text-xs font-bold ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-950/90 border-rose-500/30 text-rose-400'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* 🧭 Tab Navigation Bar */}
      <nav className="bg-slate-900 border-b border-slate-850/60 px-2 py-1.5 flex gap-1 justify-around">
        <button
          onClick={() => { setActiveSubTab('imalat'); setShowNewDelivery(false); setReturnAction(prev => ({ ...prev, delivery: null })); }}
          className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl text-[10px] font-extrabold tracking-wider transition ${
            activeSubTab === 'imalat' 
              ? 'bg-[#2563EB]/15 border border-[#2563EB]/35 text-[#3B82F6]' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Hammer size={16} className="mb-1" />
          İmalat Girişi
        </button>
        <button
          onClick={() => { setActiveSubTab('hasar'); setShowNewDelivery(false); setReturnAction(prev => ({ ...prev, delivery: null })); }}
          className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl text-[10px] font-extrabold tracking-wider transition ${
            activeSubTab === 'hasar' 
              ? 'bg-amber-500/10 border border-amber-500/25 text-amber-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle size={16} className="mb-1" />
          Yöneticiye Rapor
        </button>
        <button
          onClick={() => { setActiveSubTab('daire_teslim'); }}
          className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl text-[10px] font-extrabold tracking-wider transition ${
            activeSubTab === 'daire_teslim' 
              ? 'bg-sky-500/10 border border-sky-500/25 text-sky-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <KeySquare size={16} className="mb-1" />
          Daire Teslim / İade
        </button>
      </nav>

      {/* 📦 Main Screen Content */}
      <main className="flex-1 p-4 overflow-y-auto max-w-xl mx-auto w-full space-y-4">
        
        {/* ========================================================================= */}
        {/* TAB 1: İMALAT GİRİŞ PANELİ */}
        {/* ========================================================================= */}
        {activeSubTab === 'imalat' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <h2 className="text-xs font-black tracking-widest text-[#3B82F6] uppercase flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Hammer size={14} /> GÜNLÜK İMALAT BİLDİRİMİ
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase">TARİH</label>
                <input 
                  type="date"
                  value={imalatTarih}
                  onChange={(e) => setImalatTarih(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-[#2563EB] outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase">PARSEL</label>
                <select
                  value={imalatParsel}
                  onChange={(e) => setImalatParsel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-[#2563EB] outline-none font-bold text-white"
                >
                  {PARSEL_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">BLOK / ALAN</label>
              <select
                value={imalatBlok}
                onChange={(e) => setImalatBlok(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-[#2563EB] outline-none font-bold text-white"
              >
                {blokListForParsel(imalatParsel).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">YAPILAN İMALAT TANIMI / AÇIKLAMA</label>
              <textarea
                value={imalatAciklama}
                onChange={(e) => setImalatAciklama(e.target.value)}
                placeholder="Örn: 3. kat duvar örümü tamamlandı, sıva imalatı başlatıldı..."
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2.5 text-xs rounded-xl focus:border-[#2563EB] outline-none font-bold text-slate-200 h-24 placeholder:text-slate-655"
              />
            </div>

            {/* Photo upload section */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">İMALAT FOTOĞRAFLARI ({imalatFotos.length}/5)</label>
              
              <div className="grid grid-cols-5 gap-2">
                {imalatFotos.map((img, idx) => (
                  <div key={idx} className="relative aspect-square border border-slate-800 rounded-xl overflow-hidden bg-slate-950 group">
                    <img src={img} alt="Imalat" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setImalatFotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 p-1 bg-red-650 rounded-lg text-white"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {imalatFotos.length < 5 && (
                  <label className="aspect-square border border-dashed border-slate-700 hover:border-[#2563EB] rounded-xl flex flex-col items-center justify-center cursor-pointer bg-slate-950 transition">
                    <Camera size={20} className="text-slate-500" />
                    <span className="text-[8px] text-slate-500 font-bold mt-1">Ekle</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => handleFotoUpload(e, 'imalat')} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveImalat}
              disabled={isSavingImalat}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10 transition"
            >
              {isSavingImalat ? 'KAYDEDİLİYOR...' : 'İMALAT RAPORUNU KAYDET'}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: YÖNETİCİYE HASAR RAPORU */}
        {/* ========================================================================= */}
        {activeSubTab === 'hasar' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <h2 className="text-xs font-black tracking-widest text-amber-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <AlertTriangle size={14} /> HASAR VEYA OLAY RAPORU GÖNDER
            </h2>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">TUTANAK KONUSU</label>
              <input 
                type="text"
                value={tutanakSubject}
                onChange={(e) => setTutanakSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-amber-400 outline-none font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase">TARİH</label>
                <input 
                  type="date"
                  value={tutanakDate}
                  onChange={(e) => setTutanakDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-amber-400 outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold block uppercase">PARSEL</label>
                <select
                  value={tutanakParsel}
                  onChange={(e) => setTutanakParsel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-amber-400 outline-none font-bold text-white"
                >
                  {PARSEL_LIST.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">BLOK / ALAN</label>
              <select
                value={tutanakBlok}
                onChange={(e) => setTutanakBlok(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-amber-400 outline-none font-bold text-white"
              >
                {blokListForParsel(tutanakParsel).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">HASAR DETAYI VE OLAY AÇIKLAMASI</label>
              <textarea
                value={tutanakText}
                onChange={(e) => setTutanakText(e.target.value)}
                placeholder="Örn: 2. blok şaft boşluğunda asansör kasasının hasar aldığı tespit edilmiştir, tutanak tutulması gerekmektedir..."
                className="w-full bg-slate-950 border border-slate-850 px-3 py-2.5 text-xs rounded-xl focus:border-amber-400 outline-none font-bold text-slate-200 h-24 placeholder:text-slate-655"
              />
            </div>

            {/* Photo upload section */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-400 font-bold block uppercase">TUTANAK GÖRSELLERİ ({tutanakFotos.length}/3)</label>
              
              <div className="grid grid-cols-3 gap-2">
                {tutanakFotos.map((img, idx) => (
                  <div key={idx} className="relative aspect-square border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                    <img src={img} alt="Tutanak" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setTutanakFotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 p-1 bg-red-650 rounded-lg text-white"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {tutanakFotos.length < 3 && (
                  <label className="aspect-square border border-dashed border-slate-700 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-slate-950 transition">
                    <Camera size={20} className="text-slate-500" />
                    <span className="text-[8px] text-slate-500 font-bold mt-1">Ekle</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => handleFotoUpload(e, 'hasar')} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>

            <button
              onClick={handleSendTutanak}
              disabled={isSavingTutanak}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 transition"
            >
              <FileText size={14} /> {isSavingTutanak ? 'TUTANAK GÖNDERİLİYOR...' : 'YÖNETİME YOLLA'}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DAİRE ANAHTAR TESLİM / İADE TAKİBİ */}
        {/* ========================================================================= */}
        {activeSubTab === 'daire_teslim' && (
          <div className="space-y-4">
            
            {/* 🚪 Active deliveries and new button */}
            {!showNewDelivery && !returnAction.delivery && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black text-sky-400 tracking-wider block uppercase">
                    ANAHTAR TESLİM AKIŞI
                  </h3>
                  <button
                    onClick={() => setShowNewDelivery(true)}
                    className="flex items-center gap-1 bg-sky-500 hover:bg-sky-650 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-xl cursor-pointer transition shadow-md"
                  >
                    <Plus size={12} /> Yeni Teslimat Başlat
                  </button>
                </div>

                {deliveries.filter(d => d.durum === 'TESLİM EDİLDİ').length === 0 ? (
                  <div className="bg-slate-900 border border-slate-850 rounded-2xl p-6 text-center text-xs text-slate-500 italic">
                    Şu an taşeronda olan (teslim edilmiş) daire anahtarı bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {deliveries.filter(d => d.durum === 'TESLİM EDİLDİ').map((item) => (
                      <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-md animate-fadeIn">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/25 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              {item.durum}
                            </span>
                            <h4 className="text-white text-xs font-extrabold mt-1.5 flex items-center gap-1">
                              <MapPin size={12} className="text-slate-500" /> {item.parsel} - {item.blok} / Daire {item.daireNo}
                            </h4>
                          </div>
                          
                          {/* Mini Thumbnail */}
                          {item.teslimFoto && (
                            <div className="w-12 h-12 rounded-lg border border-slate-800 overflow-hidden shrink-0">
                              <img src={item.teslimFoto} alt="teslim" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-bold border-t border-slate-850 pt-2.5">
                          <div>
                            <span className="text-[8px] text-slate-500 block">Taşeron</span>
                            <span className="text-slate-200">{item.taseronAdi}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-500 block">Muhatap Personel</span>
                            <span className="text-slate-200">{item.muhatapPersonel}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-500 block">Teslim Tarihi</span>
                            <span className="font-mono text-slate-200">{item.teslimTarihi}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-slate-500 block">Teslim Eden</span>
                            <span className="text-slate-200">{item.teslimEden}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setReturnAction(prev => ({ ...prev, delivery: item }))}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer transition"
                        >
                          <CheckCircle2 size={13} /> Anahtarı Geri Teslim Al (İade)
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 📝 FORM 1: Yeni Anahtar Teslimi Başlat */}
            {showNewDelivery && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black text-sky-400 tracking-wider uppercase flex items-center gap-1.5">
                    <Plus size={14} /> YENİ ANAHTAR TESLİMATI
                  </h3>
                  <button 
                    onClick={() => setShowNewDelivery(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 font-bold cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase">PARSEL</label>
                    <select
                      value={newDelivery.parsel}
                      onChange={(e) => setNewDelivery(prev => ({ ...prev, parsel: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold text-white"
                    >
                      {PARSEL_LIST.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase">BLOK</label>
                    <select
                      value={newDelivery.blok}
                      onChange={(e) => setNewDelivery(prev => ({ ...prev, blok: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold text-white"
                    >
                      {blokListForParsel(newDelivery.parsel).map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase">DAİRE NO</label>
                    <input 
                      type="text"
                      placeholder="Örn: 5"
                      value={newDelivery.daireNo}
                      onChange={(e) => setNewDelivery(prev => ({ ...prev, daireNo: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-bold block uppercase">TESLİM TARİHİ</label>
                    <input 
                      type="date"
                      value={newDelivery.teslimTarihi}
                      onChange={(e) => setNewDelivery(prev => ({ ...prev, teslimTarihi: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase">TAŞERON FİRMA</label>
                  <select
                    value={newDelivery.taseronId}
                    onChange={(e) => setNewDelivery(prev => ({ ...prev, taseronId: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold text-white"
                  >
                    <option value="">-- ELLE GİRİŞ VEYA SEÇİN --</option>
                    {taseronlar.map((t) => (
                      <option key={t.id} value={t.id}>{t.unvan}</option>
                    ))}
                  </select>
                  {!newDelivery.taseronId && (
                    <input 
                      type="text"
                      placeholder="Taşeron firma adı girin..."
                      value={newDelivery.manualTaseron}
                      onChange={(e) => setNewDelivery(prev => ({ ...prev, manualTaseron: e.target.value }))}
                      className="w-full mt-2 bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase">MUHATAP TAŞERON PERSONEL</label>
                  <input 
                    type="text"
                    placeholder="Ad Soyad girin..."
                    value={newDelivery.muhatapPersonel}
                    onChange={(e) => setNewDelivery(prev => ({ ...prev, muhatapPersonel: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-sky-400 outline-none font-bold"
                  />
                </div>

                {/* Single Handoff Photo */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase">TESLİM ANINA AİT FOTOĞRAF (ZORUNLU)</label>
                  
                  {newDelivery.teslimFoto ? (
                    <div className="relative w-32 aspect-video border border-slate-850 rounded-2xl overflow-hidden bg-slate-950 group">
                      <img src={newDelivery.teslimFoto} alt="teslim foto" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setNewDelivery(prev => ({ ...prev, teslimFoto: '' }))}
                        className="absolute top-1 right-1 p-1.5 bg-red-600 rounded-xl text-white font-sans"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full aspect-video max-h-36 border border-dashed border-slate-700 hover:border-sky-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-950 transition">
                      <Camera size={26} className="text-slate-500" />
                      <span className="text-[10px] text-slate-500 font-black mt-2">Dairenin İlk Halinin Fotoğrafını Çek</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFotoUpload(e, 'teslim')} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                <button
                  onClick={handleStartDelivery}
                  disabled={isSavingDelivery}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-slate-950 font-black text-xs py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-500/10 transition"
                >
                  {isSavingDelivery ? 'KAYDEDİLİYOR...' : 'TESLİMATI BAŞLAT VE ANAHTARI VER'}
                </button>
              </div>
            )}

            {/* 🛠️ FORM 2: Anahtarı Geri Teslim Al (İade Alma) */}
            {returnAction.delivery && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h3 className="text-xs font-black text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> ANAHTAR GERİ TESLİM AL
                  </h3>
                  <button 
                    onClick={() => setReturnAction(prev => ({ ...prev, delivery: null }))}
                    className="text-xs text-slate-500 hover:text-slate-300 font-bold cursor-pointer font-sans"
                  >
                    Vazgeç
                  </button>
                </div>

                {/* Delivery Info Box */}
                <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl text-xs space-y-1">
                  <p className="text-white font-extrabold">{returnAction.delivery.parsel} - {returnAction.delivery.blok} / Daire {returnAction.delivery.daireNo}</p>
                  <p className="text-slate-400"><strong>Taşeron:</strong> {returnAction.delivery.taseronAdi}</p>
                  <p className="text-slate-400"><strong>Teslim Tarihi:</strong> {returnAction.delivery.teslimTarihi}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] text-slate-450 font-bold block uppercase">İADE / GERİ ALMA TARİHİ</label>
                    <input 
                      type="date"
                      value={returnAction.iadeTarihi}
                      onChange={(e) => setReturnAction(prev => ({ ...prev, iadeTarihi: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-emerald-400 outline-none font-bold text-white"
                    />
                  </div>
                </div>

                {/* Return Photo */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase">İADE ANINA AİT FOTOĞRAF (ZORUNLU)</label>
                  
                  {returnAction.iadeFoto ? (
                    <div className="relative w-32 aspect-video border border-slate-850 rounded-2xl overflow-hidden bg-slate-950 group">
                      <img src={returnAction.iadeFoto} alt="iade foto" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setReturnAction(prev => ({ ...prev, iadeFoto: '' }))}
                        className="absolute top-1 right-1 p-1.5 bg-red-600 rounded-xl text-white font-sans"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="w-full aspect-video max-h-36 border border-dashed border-slate-700 hover:border-emerald-400 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-950 transition">
                      <Camera size={26} className="text-slate-500" />
                      <span className="text-[10px] text-slate-500 font-black mt-2">Dairenin Son Halinin Fotoğrafını Çek</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFotoUpload(e, 'iade')} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>

                {/* Damage checkbox */}
                <div className="flex items-center space-x-2.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                  <input 
                    type="checkbox"
                    id="hasDamageCheckbox"
                    checked={returnAction.hasDamage}
                    onChange={(e) => setReturnAction(prev => ({ ...prev, hasDamage: e.target.checked }))}
                    className="w-4.5 h-4.5 rounded text-red-500 bg-slate-950 border-slate-805"
                  />
                  <label htmlFor="hasDamageCheckbox" className="text-xs font-black text-rose-450 cursor-pointer uppercase select-none">
                    Dairede hasar oluşmuş (Ceza Kes)
                  </label>
                </div>

                {/* Damage penalty form details */}
                {returnAction.hasDamage && (
                  <div className="space-y-3.5 border border-red-500/20 bg-red-500/5 p-4 rounded-2xl animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[10px] text-rose-400 font-bold block uppercase">HASAR DETAYI & OLAY AÇIKLAMASI</label>
                      <textarea
                        value={returnAction.damageDescription}
                        onChange={(e) => setReturnAction(prev => ({ ...prev, damageDescription: e.target.value }))}
                        placeholder="Örn: Çalışma sırasında banyo seramikleri kırılmış ve mutfak dolap kapakları çizilmiştir..."
                        className="w-full bg-slate-950 border border-slate-850 px-3 py-2 text-xs rounded-xl focus:border-red-400 outline-none font-bold text-slate-200 h-20 placeholder:text-slate-700"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-rose-400 font-bold block uppercase">KESİLECEK CEZA TUTARI (TL)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 text-slate-500" size={13} />
                        <input 
                          type="number"
                          placeholder="Örn: 2500"
                          value={returnAction.penaltyAmount || ''}
                          onChange={(e) => setReturnAction(prev => ({ ...prev, penaltyAmount: Number(e.target.value) }))}
                          className="w-full bg-slate-950 border border-slate-850 pl-8 pr-3 py-2 text-xs rounded-xl focus:border-red-400 outline-none font-bold text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCompleteReturn}
                  disabled={isSavingReturn}
                  className={`w-full font-black text-xs py-3 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg transition ${
                    returnAction.hasDamage 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10' 
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/10'
                  }`}
                >
                  {isSavingReturn ? 'KAYDEDİLİYOR...' : (
                    returnAction.hasDamage 
                      ? 'HASAR CEZA TUTANAĞINI YÖNETİME YOLLA' 
                      : 'ANAHTARI SORUNSUZ İADE AL'
                  )}
                </button>
              </div>
            )}

            {/* 📋 Historic closed deliveries list */}
            {!showNewDelivery && !returnAction.delivery && (
              <div className="space-y-2">
                <h4 className="text-[10px] text-slate-500 font-bold tracking-wider block uppercase mt-2">
                  GEÇMİŞ TESLİMATLAR
                </h4>

                {deliveries.filter(d => d.durum !== 'TESLİM EDİLDİ').slice(0, 10).map((item) => (
                  <div key={item.id} className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 flex justify-between items-center text-xs opacity-75 animate-fadeIn">
                    <div>
                      <h5 className="font-bold text-slate-300">{item.parsel} - {item.blok} / D. {item.daireNo}</h5>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.taseronAdi} ({item.iadeTarihi || item.teslimTarihi})</p>
                    </div>
                    <span className={`text-[8px] border px-2 py-0.5 rounded-md font-bold uppercase ${
                      item.durum === 'SORUNSUZ İADE ALINDI' 
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                        : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
                    }`}>
                      {item.durum === 'SORUNSUZ İADE ALINDI' ? 'Sorunsuz' : 'Hasarlı'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

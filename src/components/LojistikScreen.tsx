import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Plus, Trash2, Camera, CheckCircle, Search, AlertCircle, 
  FileText, Calendar, Printer, Phone, MapPin, Wallet, ClipboardList, Clock, Check, X
} from 'lucide-react';
import { AracBakim, Personel } from '../types/erp';
import { compressImage } from '../lib/imageCompress';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface LojistikScreenProps {
  irsaliyeler: any[];
  setIrsaliyeler: any;
  satinAlmaTalepleri: any[];
  araclar: AracBakim[];
  setAraclar: any;
  aracKmLoglari: any[];
  setAracKmLoglari: any;
  currentUser?: any;
  onSignOut?: () => void;
  isStandalone?: boolean;
}

export const LojistikScreen: React.FC<LojistikScreenProps> = ({
  araclar,
  setAraclar,
  currentUser,
  onSignOut,
  isStandalone = false
}) => {
  const [activeTab, setActiveTab] = useState<'günlük_rutin' | 'haftalık_km' | 'araç_kartı' | 'rotalar' | 'yol_harcaması' | 'mini_raporlar'>('günlük_rutin');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Synchronized Firestore Collections
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [gunlukRutinLoglar, setGunlukRutinLoglar] = useState<any[]>([]);
  const [haftalikKmLoglar, setHaftalikKmLoglar] = useState<any[]>([]);
  const [aracTalepleri, setAracTalepleri] = useState<any[]>([]);
  const [seyahatRotalari, setSeyahatRotalari] = useState<any[]>([]);
  const [yolHarcamalari, setYolHarcamalari] = useState<any[]>([]);

  // Local subscriptions to Firestore
  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'personeller'), (snap) => {
      const list: Personel[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Personel);
      });
      setPersoneller(list);
    });

    const unsubG = onSnapshot(collection(db, 'gunlukRutinKmLoglari'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.tarih || 0).getTime() - new Date(a.tarih || 0).getTime());
      setGunlukRutinLoglar(list);
    });

    const unsubH = onSnapshot(collection(db, 'haftalikKmGirisleri'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.pazartesiTarih || 0).getTime() - new Date(a.pazartesiTarih || 0).getTime());
      setHaftalikKmLoglar(list);
    });

    const unsubT = onSnapshot(collection(db, 'aracOnayTalepleri'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.talepTarihi || 0).getTime() - new Date(a.talepTarihi || 0).getTime());
      setAracTalepleri(list);
    });

    const unsubR = onSnapshot(collection(db, 'seyahatRotalari'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.tarih || 0).getTime() - new Date(a.tarih || 0).getTime());
      setSeyahatRotalari(list);
    });

    const unsubE = onSnapshot(collection(db, 'yolHarcamalari'), (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.tarih || 0).getTime() - new Date(a.tarih || 0).getTime());
      setYolHarcamalari(list);
    });

    return () => {
      unsubP();
      unsubG();
      unsubH();
      unsubT();
      unsubR();
      unsubE();
    };
  }, []);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const currentChauffeurName = currentUser?.displayName || currentUser?.ad || currentUser?.email || 'Şöför';

  // ==========================================
  // TAB 1: GÜNLÜK RUTIN (SABAH / AKŞAM KM)
  // ==========================================
  const [rutinTarih, setRutinTarih] = useState(new Date().toISOString().split('T')[0]);
  const [rutinKmInputs, setRutinKmInputs] = useState<{ [plaka: string]: { sabah: string, aksam: string } }>({});

  useEffect(() => {
    // Load existing values for chosen date
    const dayLog = gunlukRutinLoglar.find(l => l.tarih === rutinTarih);
    const initialInputs: typeof rutinKmInputs = {};
    araclar.forEach(a => {
      initialInputs[a.plaka] = {
        sabah: dayLog?.veri?.[a.plaka]?.sabah || '',
        aksam: dayLog?.veri?.[a.plaka]?.aksam || ''
      };
    });
    setRutinKmInputs(initialInputs);
  }, [rutinTarih, gunlukRutinLoglar, araclar]);

  const handleRutinInputChange = (plaka: string, key: 'sabah' | 'aksam', val: string) => {
    setRutinKmInputs(prev => ({
      ...prev,
      [plaka]: {
        ...prev[plaka],
        [key]: val
      }
    }));
  };

  const handleSaveGunlukRutin = async () => {
    try {
      const cleanedData: { [plaka: string]: { sabah: number | null, aksam: number | null } } = {};
      
      // Update local vehicle odometer state with latest night odoms
      const updatedAracList = [...araclar];

      Object.keys(rutinKmInputs).forEach(plaka => {
        const sVal = parseFloat(rutinKmInputs[plaka]?.sabah) || null;
        const aVal = parseFloat(rutinKmInputs[plaka]?.aksam) || null;
        cleanedData[plaka] = { sabah: sVal, aksam: aVal };

        // If evening odometer is entered, update active vehicle mileage
        if (aVal) {
          const index = updatedAracList.findIndex(ar => ar.plaka === plaka);
          if (index !== -1 && aVal > updatedAracList[index].mevcutKm) {
            updatedAracList[index].mevcutKm = aVal;
          }
        }
      });

      // Save to Daily Rutin KM Logs collection
      const docRef = doc(db, 'gunlukRutinKmLoglari', rutinTarih);
      await setDoc(docRef, {
        tarih: rutinTarih,
        veri: cleanedData,
        kaydeden: currentChauffeurName,
        guncellemeZamani: new Date().toISOString()
      });

      // Sync vehicle changes to Firestore
      for (const ar of updatedAracList) {
        await setDoc(doc(db, 'araclar', ar.id), ar);
      }

      showStatus('success', 'Günlük sabah/akşam kilometre sayaçları başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Kilometreler kaydedilirken bir hata ile karşılaşıldı.');
    }
  };

  // ==========================================
  // TAB 2: HAFTALIK KM GİRİŞİ (PZT / CMT)
  // ==========================================
  const [weeklyPlaka, setWeeklyPlaka] = useState('');
  const [pazartesiKm, setPazartesiKm] = useState('');
  const [cumartesiKm, setCumartesiKm] = useState('');
  const [pazartesiTarih, setPazartesiTarih] = useState('');
  const [cumartesiTarih, setCumartesiTarih] = useState('');

  // Auto-fill Monday KM based on chosen vehicle
  useEffect(() => {
    if (weeklyPlaka) {
      const v = araclar.find(a => a.plaka === weeklyPlaka);
      if (v) {
        setPazartesiKm(String(v.mevcutKm || ''));
      }
    }
  }, [weeklyPlaka, araclar]);

  const handleSaveWeeklyKm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyPlaka) {
      alert('Lütfen bir araç seçin!');
      return;
    }
    if (!pazartesiTarih) {
      alert('Lütfen Pazartesi tarihini belirtin!');
      return;
    }

    try {
      const pKm = parseFloat(pazartesiKm) || 0;
      const cKm = parseFloat(cumartesiKm) || null;
      const fark = cKm ? (cKm - pKm) : null;

      const logId = `haftalik_${weeklyPlaka}_${pazartesiTarih}`;
      await setDoc(doc(db, 'haftalikKmGirisleri', logId), {
        id: logId,
        plaka: weeklyPlaka,
        pazartesiTarih,
        cumartesiTarih: cumartesiTarih || '',
        pazartesiKm: pKm,
        cumartesiKm: cKm,
        fark,
        ekleyen: currentChauffeurName,
        tarih: new Date().toISOString()
      });

      // Update actual vehicle mileage if Saturday KM is higher
      if (cKm) {
        const v = araclar.find(a => a.plaka === weeklyPlaka);
        if (v && cKm > v.mevcutKm) {
          await setDoc(doc(db, 'araclar', v.id), {
            ...v,
            mevcutKm: cKm
          });
        }
      }

      showStatus('success', 'Haftalık KM verisi başarıyla işlendi!');
      setWeeklyPlaka('');
      setPazartesiKm('');
      setCumartesiKm('');
      setPazartesiTarih('');
      setCumartesiTarih('');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Haftalık veri kaydedilemedi.');
    }
  };

  // ==========================================
  // TAB 3: ARAÇ KARTI OLUŞTURMA & ONAY
  // ==========================================
  const [newPlaka, setNewPlaka] = useState('');
  const [newMarkaModel, setNewMarkaModel] = useState('');
  const [newMuayeneKm, setNewMuayeneKm] = useState('');
  const [newMuayeneTarihi, setNewMuayeneTarihi] = useState('');
  const [newYagBakimKm, setNewYagBakimKm] = useState('');
  const [newYagBakimTarihi, setNewYagBakimTarihi] = useState('');
  const [newYagBakimKmAraligi, setNewYagBakimKmAraligi] = useState('10000');

  const handleCreateVehicleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaka) {
      alert('Lütfen geçerli bir Plaka yazın!');
      return;
    }

    try {
      const talepId = `talep_${Date.now()}`;
      await setDoc(doc(db, 'aracOnayTalepleri', talepId), {
        id: talepId,
        plaka: newPlaka.toUpperCase().trim(),
        markaModel: newMarkaModel,
        muayeneKm: parseFloat(newMuayeneKm) || 0,
        muayeneTarihi: newMuayeneTarihi,
        sonYagBakimKm: parseFloat(newYagBakimKm) || 0,
        yagBakimTarihi: newYagBakimTarihi,
        yagBakimKmAraligi: parseFloat(newYagBakimKmAraligi) || 10000,
        durum: 'ONAY BEKLİYOR',
        gonderen: currentChauffeurName,
        talepTarihi: new Date().toISOString()
      });

      showStatus('success', 'Araç oluşturma/bakım talebi yöneticilerin onay havuzuna gönderildi!');
      setNewPlaka('');
      setNewMarkaModel('');
      setNewMuayeneKm('');
      setNewMuayeneTarihi('');
      setNewYagBakimKm('');
      setNewYagBakimTarihi('');
      setNewYagBakimKmAraligi('10000');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Talep gönderilirken hata oluştu.');
    }
  };

  // ==========================================
  // TAB 4: SEYAHAT ROTARI (ROTALAR)
  // ==========================================
  const [rotaIsmi, setRotaIsmi] = useState('');
  const [rotaArac, setRotaArac] = useState('');
  const [rotaYoneticiAd, setRotaYoneticiAd] = useState('');
  const [rotaYoneticiTel, setRotaYoneticiTel] = useState('');
  const [rotaTarih, setRotaTarih] = useState(new Date().toISOString().split('T')[0]);
  const [rotaNotlar, setRotaNotlar] = useState('');
  const [rotaSearch, setRotaSearch] = useState('');

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotaIsmi || !rotaArac) {
      alert('Lütfen Rota İsmi ve Araç Seçiniz!');
      return;
    }

    try {
      const rId = `rota_${Date.now()}`;
      await setDoc(doc(db, 'seyahatRotalari', rId), {
        id: rId,
        rotaIsmi,
        arac: rotaArac,
        yoneticiAd: rotaYoneticiAd,
        yoneticiTel: rotaYoneticiTel,
        tarih: rotaTarih,
        notlar: rotaNotlar,
        surucu: currentChauffeurName
      });

      showStatus('success', 'Seyahat rotası başarıyla kaydedildi!');
      setRotaIsmi('');
      setRotaArac('');
      setRotaYoneticiAd('');
      setRotaYoneticiTel('');
      setRotaNotlar('');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Rota kaydedilemedi.');
    }
  };

  // ==========================================
  // TAB 5: YOL HARCAMASI (FİŞ / FATURA YÜKLE)
  // ==========================================
  const [harcamaTutar, setHarcamaTutar] = useState('');
  const [harcamaAciklama, setHarcamaAciklama] = useState('');
  const [harcamaTarih, setHarcamaTarih] = useState(new Date().toISOString().split('T')[0]);
  const [faturaFotoBase64, setFaturaFotoBase64] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setFaturaFotoBase64(compressed);
    } catch (err) {
      console.error(err);
      alert('Görsel sıkıştırılamadı, lütfen tekrar deneyin.');
    } finally {
      setCompressing(false);
    }
  };

  const handleSaveYolHarcamasi = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(harcamaTutar) || 0;
    if (amount <= 0 || !harcamaAciklama) {
      alert('Lütfen geçerli bir Tutar ve Açıklama belirtin!');
      return;
    }

    try {
      const hId = `harcama_${Date.now()}`;
      await setDoc(doc(db, 'yolHarcamalari', hId), {
        id: hId,
        tarih: harcamaTarih,
        tutar: amount,
        aciklama: harcamaAciklama,
        faturaFotoUrl: faturaFotoBase64 || '',
        durum: 'ONAY BEKLİYOR',
        surucu: currentChauffeurName
      });

      showStatus('success', 'Yol harcaması ve evrak görseli başarıyla yöneticilere gönderildi!');
      setHarcamaTutar('');
      setHarcamaAciklama('');
      setFaturaFotoBase64(null);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Harcama kaydı gönderilemedi.');
    }
  };

  // ==========================================
  // REPORT PRINTING
  // ==========================================
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 p-4 lg:p-6 font-sans flex flex-col">
      
      {/* Upper Status Notifications */}
      {statusMessage && (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-lg border text-xs font-bold transition-all duration-300 flex items-center space-x-2 animate-bounce ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{statusMessage.type === 'success' ? '✅' : '❌'}</span>
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* Upper Dashboard Widget */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-3xl p-5 lg:p-6 text-white shadow-lg border border-blue-600">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/10 rounded-2xl">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-base tracking-tight">Şöför Mobil Paneli</h1>
                <p className="text-[11px] text-blue-100 mt-0.5">
                  Giriş Yapan Yetkili: <span className="font-bold">{currentChauffeurName}</span>
                </p>
              </div>
            </div>
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-blue-200 block">Sistem Vasıtaları</span>
                <span className="text-sm font-bold font-mono">{araclar.length}</span>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-blue-200 block">Bekleyen Onaylar</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  {aracTalepleri.filter(t => t.durum === 'ONAY BEKLİYOR').length + yolHarcamalari.filter(y => y.durum === 'ONAY BEKLİYOR').length}
                </span>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[10px] text-blue-200 block">Kayıtlı Rotalar</span>
                <span className="text-sm font-bold font-mono">{seyahatRotalari.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1.5 overflow-x-auto p-1 bg-white/80 backdrop-blur-xs rounded-2xl border border-slate-200 shrink-0 select-none scrollbar-none">
          <button 
            onClick={() => setActiveTab('günlük_rutin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'günlük_rutin' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            🗓️ Günlük Rutin
          </button>
          <button 
            onClick={() => setActiveTab('haftalık_km')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'haftalık_km' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            📊 Haftalık KM
          </button>
          <button 
            onClick={() => setActiveTab('araç_kartı')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'araç_kartı' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            🚗 Araç Kartı &amp; Onay
          </button>
          <button 
            onClick={() => setActiveTab('rotalar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'rotalar' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            📍 Seyahat Rotaları
          </button>
          <button 
            onClick={() => setActiveTab('yol_harcaması')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'yol_harcaması' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            💳 Fiş / Yol Harcaması
          </button>
          <button 
            onClick={() => setActiveTab('mini_raporlar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-150 shrink-0 cursor-pointer ${activeTab === 'mini_raporlar' ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            🖨️ Mini Raporlar
          </button>
        </div>

        {/* Dynamic Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Main Work Area (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* TAB 1: GÜNLÜK RUTİN */}
            {activeTab === 'günlük_rutin' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>🗓️ Günlük Sabah &amp; Akşam KM Rutini</span>
                    </h2>
                    <p className="text-[10px] text-slate-500">Tüm şirket araçlarının sabah kalkınca ve akşam dönüşte sayaçlarını işleyin.</p>
                  </div>
                  
                  {/* Date Picker */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-slate-400">Rutin Günü:</span>
                    <input 
                      type="date" 
                      value={rutinTarih} 
                      onChange={(e) => setRutinTarih(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-1 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Vehicles List Inputs */}
                {araclar.length === 0 ? (
                  <div className="p-10 text-center text-xs italic text-slate-400">Sisteme kayıtlı vasıta bulunmuyor.</div>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {araclar.map(arac => (
                      <div key={arac.id} className="border rounded-2xl p-4 hover:border-slate-300 transition bg-slate-50/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          
                          {/* Info Block */}
                          <div className="flex items-center space-x-3">
                            <span className="font-mono bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-xl border border-blue-100 shadow-3xs shrink-0">
                              {arac.plaka}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">{arac.markaModel}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">Güncel KM: {arac.mevcutKm} KM</span>
                            </div>
                          </div>

                          {/* Inputs */}
                          <div className="flex items-center space-x-2 shrink-0">
                            <div>
                              <span className="text-[9px] font-bold text-slate-450 uppercase block mb-0.5">☀️ Sabah KM</span>
                              <input 
                                type="number"
                                placeholder="Sayaç"
                                value={rutinKmInputs[arac.plaka]?.sabah || ''}
                                onChange={(e) => handleRutinInputChange(arac.plaka, 'sabah', e.target.value)}
                                className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-450 uppercase block mb-0.5">🌙 Akşam KM</span>
                              <input 
                                type="number"
                                placeholder="Sayaç"
                                value={rutinKmInputs[arac.plaka]?.aksam || ''}
                                onChange={(e) => handleRutinInputChange(arac.plaka, 'aksam', e.target.value)}
                                className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                              />
                            </div>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t flex justify-end">
                  <button
                    onClick={handleSaveGunlukRutin}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-2xl text-xs transition flex items-center space-x-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Günlük Rutini Kaydet</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: HAFTALIK KM GİRİŞİ */}
            {activeTab === 'haftalık_km' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>📊 Haftalık Kilometre Takibi</span>
                  </h2>
                  <p className="text-[10px] text-slate-500">Pazartesi ilk kilometreleri ve Cumartesi son kilometreleri kaydedip raporlayın.</p>
                </div>

                <form onSubmit={handleSaveWeeklyKm} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Vehicle selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Araç Seçimi</label>
                    <select
                      value={weeklyPlaka}
                      onChange={(e) => setWeeklyPlaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="">-- Plaka Seçin --</option>
                      {araclar.map(a => (
                        <option key={a.id} value={a.plaka}>{a.plaka} - {a.markaModel}</option>
                      ))}
                    </select>
                  </div>

                  {/* Empty Spacer */}
                  <div className="hidden md:block"></div>

                  {/* Monday inputs */}
                  <div className="bg-amber-50/40 p-3.5 rounded-2xl border border-amber-100/60 space-y-3">
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-wide block">🗓️ Pazartesi Girişi (İlk KM)</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">Pazartesi Tarihi</label>
                      <input 
                        type="date"
                        value={pazartesiTarih}
                        onChange={(e) => setPazartesiTarih(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">İlk Sayaç Değeri (KM)</label>
                      <input 
                        type="number"
                        placeholder="Örn: 154200"
                        value={pazartesiKm}
                        onChange={(e) => setPazartesiKm(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Saturday inputs */}
                  <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100/60 space-y-3">
                    <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wide block">🗓️ Cumartesi Girişi (Son KM)</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">Cumartesi Tarihi (Opsiyonel)</label>
                      <input 
                        type="date"
                        value={cumartesiTarih}
                        onChange={(e) => setCumartesiTarih(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500">Son Sayaç Değeri (KM - Opsiyonel)</label>
                      <input 
                        type="number"
                        placeholder="Örn: 155150"
                        value={cumartesiKm}
                        onChange={(e) => setCumartesiKm(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-end pt-2 border-t">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-2xl text-xs transition flex items-center space-x-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                    >
                      <span>Haftalık Takip Girişini Kaydet</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 3: ARAÇ KARTI VE ONAY TALEBİ */}
            {activeTab === 'araç_kartı' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>🚗 Yeni Araç Kartı &amp; Bakım Limiti Tanımlama</span>
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Oluşturduğunuz araç kartları ve yaptığınız değişiklikler yöneticilerin onayına sunulur, onaylanırsa sisteme işlenir.
                  </p>
                </div>

                <form onSubmit={handleCreateVehicleRequest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Araç Plakası</label>
                    <input 
                      type="text" 
                      placeholder="Örn: 34KBR999"
                      value={newPlaka}
                      onChange={(e) => setNewPlaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Marka ve Model</label>
                    <input 
                      type="text" 
                      placeholder="Örn: Ford Transit 2023"
                      value={newMarkaModel}
                      onChange={(e) => setNewMarkaModel(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Muayene / Mevcut KM</label>
                    <input 
                      type="number" 
                      placeholder="Örn: 104500"
                      value={newMuayeneKm}
                      onChange={(e) => setNewMuayeneKm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Muayene Geçerlilik Tarihi</label>
                    <input 
                      type="date" 
                      value={newMuayeneTarihi}
                      onChange={(e) => setNewMuayeneTarihi(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Son Yağ Bakım KM</label>
                    <input 
                      type="number" 
                      placeholder="Örn: 95000"
                      value={newYagBakimKm}
                      onChange={(e) => setNewYagBakimKm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Son Yağ Bakım Tarihi</label>
                    <input 
                      type="date" 
                      value={newYagBakimTarihi}
                      onChange={(e) => setNewYagBakimTarihi(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Yağ Bakım KM Aralığı</label>
                    <select
                      value={newYagBakimKmAraligi}
                      onChange={(e) => setNewYagBakimKmAraligi(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    >
                      <option value="10000">10.000 KM</option>
                      <option value="15000">15.000 KM</option>
                      <option value="20000">20.000 KM</option>
                      <option value="30000">30.000 KM</option>
                    </select>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-end pt-2 border-t">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-2xl text-xs transition flex items-center space-x-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                    >
                      <span>Kart Onay Talebi Gönder</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 4: SEYAHAT ROTARI */}
            {activeTab === 'rotalar' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>📍 Seyahat Rotası &amp; Rotalandırma</span>
                  </h2>
                  <p className="text-[10px] text-slate-500">Rotalarınızı kaydedip, yönetici iletişim numaralarını gelecek seyahatler için saklayın.</p>
                </div>

                <form onSubmit={handleSaveRoute} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Rota İsmi</label>
                    <input 
                      type="text" 
                      placeholder="Örn: Şantiye - Merkez Ofis - Liman"
                      value={rotaIsmi}
                      onChange={(e) => setRotaIsmi(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Kullanılan Vasıta</label>
                    <select
                      value={rotaArac}
                      onChange={(e) => setRotaArac(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                    >
                      <option value="">-- Araç Seçin --</option>
                      {araclar.map(a => (
                        <option key={a.id} value={a.plaka}>{a.plaka} - {a.markaModel}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Bölge Sorumlusu Adı</label>
                    <input 
                      type="text" 
                      placeholder="Örn: Ahmet Bey (Saha Şefi)"
                      value={rotaYoneticiAd}
                      onChange={(e) => setRotaYoneticiAd(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Sorumlu İletişim Numarası</label>
                    <input 
                      type="tel" 
                      placeholder="Örn: +90 555..."
                      value={rotaYoneticiTel}
                      onChange={(e) => setRotaYoneticiTel(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Seyahat Tarihi</label>
                    <input 
                      type="date" 
                      value={rotaTarih}
                      onChange={(e) => setRotaTarih(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Rota / Seyahat Notları</label>
                    <textarea 
                      rows={2}
                      placeholder="Gözlemlerinizi veya teslimat detaylarını yazabilirsiniz..."
                      value={rotaNotlar}
                      onChange={(e) => setRotaNotlar(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-end pt-2 border-t">
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-2xl text-xs transition flex items-center space-x-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                    >
                      <span>Rotayı ve İletişimi Kaydet</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 5: YOL HARCAMASI */}
            {activeTab === 'yol_harcaması' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>💳 Yol Harcaması (Fiş / Fatura) Girişi</span>
                  </h2>
                  <p className="text-[10px] text-slate-500">Yaptığınız yol harcamalarını (yakıt, otoban vs.) fiş görseli ile yükleyin, onay sonrası şöför ödemelerinize işlensin.</p>
                </div>

                <form onSubmit={handleSaveYolHarcamasi} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Tutar (TL)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        placeholder="Örn: 1450.50"
                        value={harcamaTutar}
                        onChange={(e) => setHarcamaTutar(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Harcama Tarihi</label>
                      <input 
                        type="date" 
                        value={harcamaTarih}
                        onChange={(e) => setHarcamaTarih(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Harcama Açıklaması</label>
                    <input 
                      type="text" 
                      placeholder="Örn: Yakıt Alımı - BP Bolu İstasyonu"
                      value={harcamaAciklama}
                      onChange={(e) => setHarcamaAciklama(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                    />
                  </div>

                  {/* Receipt Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1.5">
                      <span>📷 Fiş / Fatura Görseli Yükle (Kamera veya Dosya)</span>
                    </label>
                    
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-100 hover:bg-slate-250 border border-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs transition flex items-center space-x-1.5 shrink-0 cursor-pointer"
                        disabled={compressing}
                      >
                        <Camera className="h-4 w-4" />
                        <span>{compressing ? 'Sıkıştırılıyor...' : 'Görsel Seç / Foto Çek'}</span>
                      </button>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden"
                      />

                      {faturaFotoBase64 && (
                        <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1.5 rounded-xl border border-emerald-200 text-[10px]">
                          <span>✅ Evrak Görseli Eklendi</span>
                          <button 
                            type="button" 
                            onClick={() => setFaturaFotoBase64(null)} 
                            className="text-rose-500 font-extrabold cursor-pointer hover:text-rose-700"
                          >
                            ✖ SİL
                          </button>
                        </div>
                      )}
                    </div>

                    {faturaFotoBase64 && (
                      <div className="border border-slate-200 p-2.5 rounded-2xl bg-slate-50 flex items-center justify-center max-w-sm">
                        <img 
                          src={faturaFotoBase64} 
                          alt="Harcama Fişi" 
                          className="max-h-48 object-contain rounded" 
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <button
                      type="submit"
                      disabled={compressing}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-2xl text-xs transition flex items-center space-x-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                    >
                      <span>Harcama Talebini Gönder</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* TAB 6: PRINTABLE MINI REPORTS */}
            {activeTab === 'mini_raporlar' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-xs">
                
                {/* Print Control Bar (Hidden on actual print) */}
                <div className="flex items-center justify-between border-b pb-3 print:hidden">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>🖨️ Yazıcı Uyumlu Mini Raporlar</span>
                    </h2>
                    <p className="text-[10px] text-slate-500">Kâğıt tasarrufu sağlayan, daraltılmış ve temiz yazıcı tasarımlı şöför raporları.</p>
                  </div>
                  <button
                    onClick={handlePrint}
                    className="bg-slate-900 hover:bg-black text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Raporu Yazdır</span>
                  </button>
                </div>

                {/* ACTUAL PRINTABLE CORE FRAME */}
                <div className="p-4 bg-white border border-slate-350/50 rounded-2xl font-mono text-slate-950 max-h-[60vh] overflow-y-auto print:max-h-none print:p-0 print:border-0 print:rounded-none">
                  
                  {/* Print Header */}
                  <div className="text-center space-y-1.5 pb-4 border-b-2 border-slate-950">
                    <h3 className="text-xs font-black tracking-wide uppercase">KİBRİTÇİ İNŞAAT A.Ş.</h3>
                    <h4 className="text-[11px] font-bold">ŞÖFÖR VE SEVKİYAT GÜNLÜK FAALİYET MUTABAKATI</h4>
                    <div className="flex justify-between text-[9px] pt-1 px-1">
                      <span>Sürücü: {currentChauffeurName}</span>
                      <span>Raporlama Tarihi: {new Date().toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>

                  {/* Section 1: Daily KM Checks */}
                  <div className="pt-3 space-y-1.5 pb-3 border-b border-dashed border-slate-950">
                    <span className="text-[10px] font-black border-b border-slate-950 block pb-0.5">1. GÜNLÜK SABAH/AKŞAM KİLOMETRE DETAYLARI</span>
                    {gunlukRutinLoglar.slice(0, 5).map((log, idx) => (
                      <div key={idx} className="text-[9px] space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>📅 Tarih: {log.tarih}</span>
                          <span>Kaydeden: {log.kaydeden}</span>
                        </div>
                        <table className="w-full text-left font-mono border-t border-slate-200">
                          <thead>
                            <tr className="text-slate-500">
                              <th>Plaka</th>
                              <th className="text-right">Sabah KM</th>
                              <th className="text-right">Akşam KM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.keys(log.veri || {}).map(plaka => (
                              <tr key={plaka} className="border-t border-slate-100">
                                <td>{plaka}</td>
                                <td className="text-right font-bold text-slate-800">{log.veri[plaka]?.sabah || '-'}</td>
                                <td className="text-right font-bold text-slate-800">{log.veri[plaka]?.aksam || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  {/* Section 2: Weekly KM Tracker */}
                  <div className="pt-3 space-y-1.5 pb-3 border-b border-dashed border-slate-950">
                    <span className="text-[10px] font-black border-b border-slate-950 block pb-0.5">2. HAFTALIK KM SAYACI RAPORLARI</span>
                    {haftalikKmLoglar.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic">Kayıtlı haftalık log bulunmuyor.</p>
                    ) : (
                      <table className="w-full text-left font-mono text-[9px]">
                        <thead>
                          <tr className="font-bold border-b text-slate-500">
                            <th>Plaka</th>
                            <th>Pazartesi (İlk)</th>
                            <th>Cumartesi (Son)</th>
                            <th className="text-right">Fark (KM)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {haftalikKmLoglar.slice(0, 10).map((log, idx) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td className="font-bold text-slate-800">{log.plaka}</td>
                              <td>{log.pazartesiKm} KM <span className="text-[8px] text-slate-400">({log.pazartesiTarih})</span></td>
                              <td>{log.cumartesiKm ? `${log.cumartesiKm} KM` : '-'} <span className="text-[8px] text-slate-400">({log.cumartesiTarih})</span></td>
                              <td className="text-right font-black text-rose-600">{log.fark !== null && log.fark !== undefined ? `${log.fark} KM` : 'Harcama Sürüyor'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Section 3: Travel Logs database */}
                  <div className="pt-3 space-y-1.5 pb-3 border-b border-dashed border-slate-950">
                    <span className="text-[10px] font-black border-b border-slate-950 block pb-0.5">3. SEYAHAT VE ROTA ARŞİVİ</span>
                    {seyahatRotalari.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic">Kayıtlı seyahat rotası bulunmuyor.</p>
                    ) : (
                      <table className="w-full text-left font-mono text-[9px]">
                        <thead>
                          <tr className="font-bold border-b text-slate-500">
                            <th>Tarih</th>
                            <th>Rota</th>
                            <th>Vasıta</th>
                            <th>Muhatap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seyahatRotalari.slice(0, 10).map((rota, idx) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td>{rota.tarih}</td>
                              <td className="font-bold text-slate-800">{rota.rotaIsmi}</td>
                              <td>{rota.arac}</td>
                              <td>{rota.yoneticiAd} ({rota.yoneticiTel})</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Section 4: Chauffeur Dues / Expenses */}
                  <div className="pt-3 space-y-1.5">
                    <span className="text-[10px] font-black border-b border-slate-950 block pb-0.5">4. SEFER VE YOL HARCAMA MUTABAKATI</span>
                    {yolHarcamalari.length === 0 ? (
                      <p className="text-[9px] text-slate-500 italic">Kayıtlı yol harcaması bulunmuyor.</p>
                    ) : (
                      <table className="w-full text-left font-mono text-[9px]">
                        <thead>
                          <tr className="font-bold border-b text-slate-500">
                            <th>Tarih</th>
                            <th>Açıklama</th>
                            <th>Durum</th>
                            <th className="text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yolHarcamalari.slice(0, 15).map((exp, idx) => (
                            <tr key={idx} className="border-b border-slate-100">
                              <td>{exp.tarih}</td>
                              <td>{exp.aciklama}</td>
                              <td className={exp.durum === 'ONAYLANDI' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{exp.durum}</td>
                              <td className="text-right font-black font-mono text-rose-600">{exp.tutar} TL</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Print Footer signatures space */}
                  <div className="pt-8 grid grid-cols-2 gap-4 text-center text-[10px] font-bold border-t mt-6">
                    <div>
                      <span>Teslim Eden Şöför</span>
                      <div className="h-10"></div>
                      <span className="block border-t border-slate-950 pt-1 text-[9px]">{currentChauffeurName}</span>
                    </div>
                    <div>
                      <span>Onaylayan Muhasebe / Şantiye Şefi</span>
                      <div className="h-10"></div>
                      <span className="block border-t border-slate-950 pt-1 text-[9px]">İmza / Kaşe</span>
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Right Reference Lists Column */}
          <div className="space-y-5">
            
            {/* 1. SEKTÖR ARAÇ VERİ TABANI */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 shadow-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">🛞 Şirket Araç Filosu ({araclar.length})</span>
              
              {araclar.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Hiç araç kaydı bulunmuyor.</p>
              ) : (
                <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                  {araclar.map(a => (
                    <div key={a.id} className="bg-slate-50 hover:bg-slate-100 transition p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-white border px-1.5 py-0.5 rounded shadow-3xs">{a.plaka}</span>
                        <span className="text-xs font-bold text-slate-800 ml-2">{a.markaModel}</span>
                      </div>
                      <div className="text-right text-[10px] font-mono font-bold text-blue-600">
                        {a.mevcutKm} KM
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. SEYAHAT ROTALARI HISTORY */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 shadow-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">🗺️ Kayıtlı Rota Geçmişi ({seyahatRotalari.length})</span>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Rota / Bölge Ara..."
                  value={rotaSearch}
                  onChange={(e) => setRotaSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-[11px] focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                />
              </div>

              {seyahatRotalari.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Hiç kayıtlı seyahat rotası bulunmuyor.</p>
              ) : (
                <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                  {seyahatRotalari.filter(r => r.rotaIsmi?.toLowerCase().includes(rotaSearch.toLowerCase())).map(r => (
                    <div key={r.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-slate-800">{r.rotaIsmi}</span>
                        <span className="text-slate-400 font-mono text-[9px]">{r.tarih}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500">
                        <span>🚗 Vasıta: <span className="font-bold text-slate-600">{r.arac}</span></span>
                        <span>👤 {r.yoneticiAd} ({r.yoneticiTel})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. SUBMITTED VEHICLE REQUESTS STATUS */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3.5 shadow-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">🕒 Araç Kartı Onay Durumları ({aracTalepleri.length})</span>
              
              {aracTalepleri.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Gönderilen onay talebi bulunmuyor.</p>
              ) : (
                <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                  {aracTalepleri.map(t => (
                    <div key={t.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[9px] font-bold text-slate-700 bg-white border px-1.5 py-0.5 rounded shadow-3xs">{t.plaka}</span>
                        <span className="text-xs font-bold text-slate-800 ml-2 block sm:inline mt-1 sm:mt-0">{t.markaModel}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        t.durum === 'ONAY BEKLİYOR' ? 'bg-amber-100 text-amber-800' :
                        t.durum === 'ONAYLANDI' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {t.durum === 'ONAY BEKLİYOR' ? 'BEKLEMEDE' : t.durum}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

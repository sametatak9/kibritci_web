import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldAlert, FileText, Users, Truck, UserCheck, Search, PlusCircle, Trash2, 
  Check, X, FileUp, Camera, Printer, Clock, AlertTriangle, Key, Download, ArrowRight, RefreshCw, Barcode,
  Archive, Calendar, Lock, ClipboardList, MessageCircle, Droplets, Fuel
} from 'lucide-react';
import { Personel, Irsaliye, IrsaliyeItem, Fatura } from '../types/erp';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';
import { fetchApiJson } from '../lib/apiClient';
import { collection, doc, setDoc, onSnapshot, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { CorporateReportLayout } from './CorporateReportLayout';
import { KibritciLogo } from './KibritciLogo';
import { openBase64InNewTab } from '../lib/fileViewerUtils';
import { isTaseronPersonel } from '../lib/yoklamaUtils';
import {
  buildAracLoglariWhatsAppText,
  buildPersonelLoglariWhatsAppText,
  buildSuTankeriLoglariWhatsAppText,
  buildZiyaretciWhatsAppText,
  buildNobetGunlukRaporHtml,
  canAccessGuvenlikScreen,
  canTakeAkvizyonYoklama,
  filterGuvenlikLogsByTarih,
  filterNobetAracZiyaretLoglari,
  filterNobetEvrakLoglari,
  filterNobetPersonelLoglari,
  firmaEtiketi,
  isAkvizyonPersonel,
  isPersonelActiveOnDate,
  openWhatsAppText,
  buildAkvizyonYoklamaReportHtml,
  NobetVardiyaTipi,
} from '../lib/guvenlikHelpers';
import { GuvenlikTabDateBar } from './GuvenlikTabDateBar';
import { normalizeDateKey, todayDateKey, formatDateLabelTr } from '../lib/dateKeyUtils';

interface GuvenlikScreenProps {
  personeller: Personel[];
  currentUser: any;
  onSignOut?: () => void;
  userYetki?: string;
  isStandalone?: boolean;
  addNotification?: (mesaj: string) => void;
}

export const GuvenlikScreen: React.FC<GuvenlikScreenProps> = ({
  personeller,
  currentUser,
  onSignOut,
  userYetki,
  isStandalone = false,
  addNotification
}) => {
  const [activeTab, setActiveTab] = useState<'irsaliye' | 'personel' | 'arac' | 'su_tankeri' | 'vidanjor' | 'petrol_tankeri' | 'ziyaretci' | 'nobet_arsivi' | 'akvizyon_yoklama'>('irsaliye');
  const [viewMode, setViewMode] = useState<'web' | 'mobile'>('web');
  const [selectedPersonelLogIds, setSelectedPersonelLogIds] = useState<string[]>([]);
  const [selectedAracLogIds, setSelectedAracLogIds] = useState<string[]>([]);
  const [selectedSuTankeriLogIds, setSelectedSuTankeriLogIds] = useState<string[]>([]);
  
  // ─────────────────────────────────────────────────────────────
  // 📄 1. RE-DESIGNED EVRAK GİRİŞ STATE
  // ─────────────────────────────────────────────────────────────
  const [uploadQueue, setUploadQueue] = useState<any[]>([]);
  const [loadingIrsaliye, setLoadingIrsaliye] = useState(false);
  const [gelenEvraklar, setGelenEvraklar] = useState<any[]>([]);

  // Search & Filter States
  const [docSearch, setDocSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'HEPSİ' | 'BEKLEMEDE' | 'ONAYLANDI' | 'REDDEDİLDİ'>('HEPSİ');
  const [typeFilter, setTypeFilter] = useState<'HEPSİ' | 'FATURA' | 'İRSALİYE' | 'MAKBUZ' | 'GENEL_EVRAK'>('HEPSİ');

  // Edit Mode States
  const [editingEvrak, setEditingEvrak] = useState<any | null>(null);
  const [editEvrakTuru, setEditEvrakTuru] = useState<'FATURA' | 'İRSALİYE' | 'MAKBUZ' | 'GENEL_EVRAK'>('İRSALİYE');
  const [editAciklama, setEditAciklama] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawBase64 = reader.result as string;
        let displayBase64 = rawBase64;
        
        if (file.type.startsWith('image/')) {
          try {
            displayBase64 = await compressImage(rawBase64);
          } catch (err) {
            console.error('Image compression failed, using original', err);
          }
        }
        
        setUploadQueue(prev => [...prev, {
          id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          fileName: file.name,
          fileType: file.type,
          dataUrl: displayBase64,
          evrakTuru: 'İRSALİYE',
          aciklama: ''
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Clear input
    e.target.value = '';
  };

  // ─────────────────────────────────────────────────────────────
  // 👥 2. PERSONEL GİRİŞ-ÇIKIŞ STATE & LISTS
  // ─────────────────────────────────────────────────────────────
  const [personelSearch, setPersonelSearch] = useState('');

  const [personelLoglar, setPersonelLoglar] = useState<any[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 🚛 3. ARAÇ GİRİŞ-ÇIKIŞ STATE & LISTS
  // ─────────────────────────────────────────────────────────────
  const [plaka, setPlaka] = useState('');
  const [aracTipi, setAracTipi] = useState('Hazır Beton Mikseri');
  const [aracFirma, setAracFirma] = useState('');
  const [yukDurumu, setYukDurumu] = useState('Dolu');
  const [surucuAdi, setSurucuAdi] = useState('');
  const [aracAciklama, setAracAciklama] = useState('');
  const [iceridekiAraclar, setIceridekiAraclar] = useState<any[]>([]);
  const [aracGecmisLoglar, setAracGecmisLoglar] = useState<any[]>([]);

  // ─────────────────────────────────────────────────────────────
  // 💧 TANKER/KONTROL GİRİŞ-ÇIKIŞ (Su Tankeri, Vidanjör, Petrol Tankeri)
  // ─────────────────────────────────────────────────────────────
  const [stPlaka, setStPlaka] = useState('');
  const [stFirma, setStFirma] = useState('');
  const [stSurucu, setStSurucu] = useState('');
  const [stMiktar, setStMiktar] = useState('');
  const [stAciklama, setStAciklama] = useState('');
  const [tankerFotoUrl, setTankerFotoUrl] = useState('');
  const [tankerFileName, setTankerFileName] = useState('');
  
  const [iceridekiSuTankerleri, setIceridekiSuTankerleri] = useState<any[]>([]);
  const [suTankeriGecmisLoglar, setSuTankeriGecmisLoglar] = useState<any[]>([]);
  const [iceridekiVidanjorler, setIceridekiVidanjorler] = useState<any[]>([]);
  const [vidanjorGecmisLoglar, setVidanjorGecmisLoglar] = useState<any[]>([]);
  const [iceridekiPetrolTankerleri, setIceridekiPetrolTankerleri] = useState<any[]>([]);
  const [petrolTankeriGecmisLoglar, setPetrolTankeriGecmisLoglar] = useState<any[]>([]);

  // ─────────────────────────────────────────────────────────────
  // 🎫 4. ZİYARETÇİ STATE & BADGE
  // ─────────────────────────────────────────────────────────────
  const [ziyaretciAd, setZiyaretciAd] = useState('');
  const [ziyaretciTc, setZiyaretciTc] = useState('');
  const [ziyaretciFirma, setZiyaretciFirma] = useState('');
  const [ziyaretSebebi, setZiyaretSebebi] = useState('');
  const [ziyaretEdilen, setZiyaretEdilen] = useState('');
  const [aktifZiyaretciler, setAktifZiyaretciler] = useState<any[]>([]);
  const [ziyaretciGecmisLoglar, setZiyaretciGecmisLoglar] = useState<any[]>([]);
  const [activeBadgeGuest, setActiveBadgeGuest] = useState<any | null>(null);

  // ─────────────────────────────────────────────────────────────
  // 🗃️ 5. NÖBET ARŞİVİ STATE
  // ─────────────────────────────────────────────────────────────
  const [nobetArsivleri, setNobetArsivleri] = useState<any[]>([]);
  const [selectedArchive, setSelectedArchive] = useState<any | null>(null);
  const [nobetSearch, setNobetSearch] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const [selectedVardiya, setSelectedVardiya] = useState<NobetVardiyaTipi>('TUM_GUN');

  // Akvizyon States
  const [akvizyonYoklamaMap, setAkvizyonYoklamaMap] = useState<Record<string, 'Geldi' | 'Gelmedi'>>({});
  const [akvizyonArchives, setAkvizyonArchives] = useState<any[]>([]);
  const [selectedAkvizyonArchive, setSelectedAkvizyonArchive] = useState<any | null>(null);
  const [selectedAkvizyonPersonel, setSelectedAkvizyonPersonel] = useState<Personel | null>(null);
  const [loadingAkvizyonYoklama, setLoadingAkvizyonYoklama] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [islemTarihi, setIslemTarihi] = useState(new Date().toISOString().split('T')[0]);
  const getIslemZamani = () => { 
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${islemTarihi}T${hours}:${minutes}:${seconds}.000Z`; 
  };

  const filteredPersonel = useMemo(() => {
    const q = personelSearch.toLowerCase();
    return (personeller || []).filter(p => {
      if (!isPersonelActiveOnDate(p, islemTarihi)) return false;
      return (
        (p.ad || '').toLowerCase().includes(q) ||
        (p.soyad || '').toLowerCase().includes(q) ||
        (p.tcNo || '').includes(q) ||
        (p.gorev || '').toLowerCase().includes(q) ||
        (p.firmaAdi || '').toLowerCase().includes(q) ||
        ((p as any).calistigiFirma || '').toLowerCase().includes(q)
      );
    });
  }, [personeller, personelSearch, islemTarihi]);

  const akvizyonPersoneller = useMemo(() => {
    return (personeller || []).filter(
      (p) => isAkvizyonPersonel(p) && isPersonelActiveOnDate(p, islemTarihi)
    );
  }, [personeller, islemTarihi]);

  const canSaveAkvizyonYoklama = canTakeAkvizyonYoklama(userYetki, currentUser?.email);

  const handleSaveAkvizyonYoklama = async () => {
    if (!canSaveAkvizyonYoklama) {
      alert('Hata: Akvizyon yoklama kaydı yalnızca Güvenlik, Kurucu ve Yönetici yetkileriyle yapılabilir.');
      return;
    }
    setLoadingAkvizyonYoklama(true);
    try {
      const finalMap = { ...akvizyonYoklamaMap };
      akvizyonPersoneller.forEach(p => {
        if (!finalMap[p.id]) {
          finalMap[p.id] = 'Gelmedi';
        }
      });

      await setDoc(doc(db, 'akvizyonYoklamalari', islemTarihi), {
        tarih: islemTarihi,
        kayitZamani: getIslemZamani(),
        kaydeden: currentUser?.email,
        yoklama: finalMap
      });

      if (addNotification) {
        addNotification(`Akvizyon Taşeron firmasının ${islemTarihi} tarihli yoklaması kaydedildi.`);
      }
      showStatus('success', 'Akvizyon yoklama verisi kaydedildi ve arşivlendi!');
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Yoklama kaydedilemedi: ' + err.message);
    } finally {
      setLoadingAkvizyonYoklama(false);
    }
  };

  useEffect(() => {
    const existing = akvizyonArchives.find(a => a.tarih === islemTarihi);
    if (existing && existing.yoklama) {
      setAkvizyonYoklamaMap(existing.yoklama);
    } else {
      setAkvizyonYoklamaMap({});
    }
  }, [islemTarihi, akvizyonArchives]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  // ─────────────────────────────────────────────────────────────
  // 🔌 REALTIME FIRESTORE LISTENER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Personel giriş çıkış logları
    const pLogColl = collection(db, 'guvenlikGirisCikisLoglari');
    const unsubPLog = onSnapshot(pLogColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.zaman).getTime() - new Date(a.zaman).getTime());
      setPersonelLoglar(list);
    });

    // 2. İçerideki ve geçmiş araçlar
    const aracColl = collection(db, 'guvenlikAracLoglari');
    const unsubArac = onSnapshot(aracColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.girisZamani).getTime() - new Date(a.girisZamani).getTime());
      
      setIceridekiAraclar(list.filter(x => x.durum === 'İÇERİDE'));
      setAracGecmisLoglar(list.filter(x => x.durum === 'ÇIKTI'));
    });

    // 2b. Unified tanker logları (Su, Vidanjör, Petrol Tankeri)
    const stColl = collection(db, 'guvenlikTankerLoglari');
    const unsubSt = onSnapshot(stColl, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.girisZamani).getTime() - new Date(a.girisZamani).getTime());
      
      // Su Tankeri
      const suList = list.filter(x => x.tip === 'SU_TANKERI');
      setIceridekiSuTankerleri(suList.filter(x => x.durum === 'İÇERİDE'));
      setSuTankeriGecmisLoglar(suList.filter(x => x.durum === 'ÇIKTI'));

      // Vidanjör
      const vidList = list.filter(x => x.tip === 'VIDANJOR');
      setIceridekiVidanjorler(vidList.filter(x => x.durum === 'İÇERİDE'));
      setVidanjorGecmisLoglar(vidList.filter(x => x.durum === 'ÇIKTI'));

      // Petrol Tankeri
      const petList = list.filter(x => x.tip === 'PETROL_TANKERI');
      setIceridekiPetrolTankerleri(petList.filter(x => x.durum === 'İÇERİDE'));
      setPetrolTankeriGecmisLoglar(petList.filter(x => x.durum === 'ÇIKTI'));
    });

    // 3. Aktif ve geçmiş ziyaretçiler
    const vizColl = collection(db, 'guvenlikZiyaretciLoglari');
    const unsubViz = onSnapshot(vizColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.girisZamani).getTime() - new Date(a.girisZamani).getTime());

      setAktifZiyaretciler(list.filter(x => x.durum === 'İÇERİDE'));
      setZiyaretciGecmisLoglar(list.filter(x => x.durum === 'ÇIKTI'));
    });

    // 4. Gelen Evraklar (Security uploaded document logs)
    const evrakColl = collection(db, 'guvenlikGelenEvraklar');
    const unsubEvrak = onSnapshot(evrakColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
      setGelenEvraklar(list);
    });

    // 5. Nöbet Arşivleri
    const nobetColl = collection(db, 'guvenlikNobetArsivleri');
    const unsubNobet = onSnapshot(nobetColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.kayitZamani).getTime() - new Date(a.kayitZamani).getTime());
      setNobetArsivleri(list);
    });

    // 6. Akvizyon Yoklama Arşivleri
    const akvizyonColl = collection(db, 'akvizyonYoklamalari');
    const unsubAkvizyon = onSnapshot(akvizyonColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => b.tarih.localeCompare(a.tarih));
      setAkvizyonArchives(list);
    });

    return () => {
      unsubPLog();
      unsubArac();
      unsubSt();
      unsubViz();
      unsubEvrak();
      unsubNobet();
      unsubAkvizyon();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 💾 EVRAK GÖNDERİM EVENTLERİ
  // ─────────────────────────────────────────────────────────────
  const handleSendQueueToManager = async () => {
    if (uploadQueue.length === 0) {
      alert("Gönderilecek evrak bulunmuyor. Lütfen önce dosya yükleyin!");
      return;
    }

    setLoadingIrsaliye(true);
    try {
      for (const item of uploadQueue) {
        const uniqueId = `EVR-${islemTarihi.replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const newEvrak = {
          id: uniqueId,
          evrakNo: "",
          evrakTuru: item.evrakTuru, // 'İRSALİYE' | 'FATURA' | 'MAKBUZ' | 'GENEL_EVRAK'
          firma: "",
          tarih: islemTarihi,
          saat: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          fotoUrl: item.dataUrl || "",
          fileName: item.fileName,
          fileType: item.fileType,
          durum: 'BEKLEMEDE',
          aciklama: item.aciklama || `Güvenlik kapısı evrak teslim alımı (${item.evrakTuru})`,
          kaydeden: currentUser?.email || 'nobetci_guvenlik'
        };
        await setDoc(doc(db, 'guvenlikGelenEvraklar', uniqueId), newEvrak);
      }

      if (addNotification) {
        addNotification(`Güvenlik kapısından ${uploadQueue.length} adet yeni evrak yöneticiye gönderildi.`);
      }

      setUploadQueue([]);
      showStatus('success', 'Evraklar başarıyla kaydedildi ve yöneticiye gönderildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Veritabanına kaydedilirken bir hata oluştu!');
    } finally {
      setLoadingIrsaliye(false);
    }
  };

  const handleUpdateGelenEvrak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvrak) return;

    try {
      await setDoc(doc(db, 'guvenlikGelenEvraklar', editingEvrak.id), {
        ...editingEvrak,
        evrakTuru: editEvrakTuru,
        aciklama: editAciklama
      }, { merge: true });

      showStatus('success', 'Evrak bilgileri güncellendi.');
      setEditingEvrak(null);
    } catch (err) {
      console.error(err);
      alert('Güncellenemedi.');
    }
  };

  const handleNobetRaporuAl = async () => {
    try {
      showStatus('success', 'Rapor oluşturuluyor, lütfen bekleyin...');
      
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const { generateGuvenlikReportHtml } = await import('../lib/guvenlikReportHtml');

      const todayStr = islemTarihi;
      const baseDate = new Date(todayStr);
      baseDate.setDate(baseDate.getDate() + 1);
      const nextDayStr = baseDate.toISOString().split('T')[0];

      const startLimit = selectedVardiya === 'GUNDUZ' ? `${todayStr}T08:00:00.000Z` : `${todayStr}T20:00:00.000Z`;
      const endLimit = selectedVardiya === 'GUNDUZ' ? `${todayStr}T20:00:00.000Z` : `${nextDayStr}T08:00:00.000Z`;

      const filterByTime = (timeStr: string) => {
        if (!timeStr) return false;
        return timeStr >= startLimit && timeStr < endLimit;
      };

      const todayLogs = personelLoglar.filter(l => filterByTime(l.zaman));
      const todayAraclar = [...iceridekiAraclar, ...aracGecmisLoglar].filter(a => {
        const inTime = a.girisZamani;
        const outTime = a.cikisZamani || getIslemZamani();
        return inTime < endLimit && outTime >= startLimit;
      });
      const todayZiyaretciler = [...aktifZiyaretciler, ...ziyaretciGecmisLoglar].filter(z => {
        const inTime = z.girisZamani;
        const outTime = z.cikisZamani || getIslemZamani();
        return inTime < endLimit && outTime >= startLimit;
      });
      const todayEvraklar = gelenEvraklar.filter(e => {
        if (!e.tarih || !e.saat) return false;
        const evrakTime = `${e.tarih}T${e.saat}:00.000Z`;
        return evrakTime >= startLimit && evrakTime < endLimit;
      });

      const htmlContent = generateGuvenlikReportHtml(
        islemTarihi,
        todayLogs,
        todayAraclar,
        todayZiyaretciler,
        todayEvraklar,
        selectedVardiya
      );

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1000px'; 
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      const shiftSuffix = selectedVardiya ? `_${selectedVardiya}` : '';
      pdf.save(`Kibritci_Guvenlik_Raporu_${islemTarihi}${shiftSuffix}.pdf`);
      showStatus('success', 'Rapor başarıyla indirildi.');
    } catch (error) {
      console.error("PDF oluşturma hatası:", error);
      showStatus('error', 'Rapor oluşturulurken bir hata oluştu.');
    }
  };

  const handleArchivedNobetRaporuAl = async (archive: any) => {
    try {
      showStatus('success', 'Arşiv raporu oluşturuluyor, lütfen bekleyin...');
      
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const { generateGuvenlikReportHtml } = await import('../lib/guvenlikReportHtml');

      const htmlContent = generateGuvenlikReportHtml(
        archive.tarih,
        archive.personelLoglari || [],
        archive.aracLoglari || [],
        archive.ziyaretciLoglari || [],
        archive.evrakLoglari || [],
        archive.vardiya || 'TAM_GUN'
      );

      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1000px'; 
      document.body.appendChild(container);

      const canvas = await html2canvas(container, { scale: 2, useCORS: true });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      const shiftSuffix = archive.vardiya ? `_${archive.vardiya}` : '';
      pdf.save(`Kibritci_Guvenlik_Raporu_${archive.tarih}${shiftSuffix}.pdf`);
      showStatus('success', 'Arşiv raporu başarıyla indirildi.');
    } catch (error) {
      console.error("PDF oluşturma hatası:", error);
      showStatus('error', 'Rapor oluşturulurken bir hata oluştu.');
    }
  };

  const handleArchiveNobetGunu = async (notes: string) => {
    setIsArchiving(true);
    try {
      const todayStr = islemTarihi;
      const filteredLogs = filterNobetPersonelLoglari(personelLoglar, todayStr, selectedVardiya);
      const filteredAraclar = filterNobetAracZiyaretLoglari(
        tumAracLoglar,
        todayStr,
        selectedVardiya,
        getIslemZamani()
      );
      const filteredSuTanker = filterNobetAracZiyaretLoglari(
        tumSuTankeriLoglar,
        todayStr,
        selectedVardiya,
        getIslemZamani()
      );
      const filteredZiyaretciler = filterNobetAracZiyaretLoglari(
        tumZiyaretciLoglar,
        todayStr,
        selectedVardiya,
        getIslemZamani()
      );
      const filteredEvraklar = filterNobetEvrakLoglari(gelenEvraklar, todayStr, selectedVardiya);
      const akvizyonSnap = akvizyonArchives.find((a) => a.tarih === todayStr);

      const archivePayload = {
        tarih: todayStr,
        vardiya: selectedVardiya,
        kayitZamani: getIslemZamani(),
        kaydeden: currentUser?.email || 'Nöbetçi Güvenlik',
        notlar: notes,
        personelLoglari: filteredLogs,
        aracLoglari: filteredAraclar,
        suTankeriLoglari: filteredSuTanker,
        ziyaretciLoglari: filteredZiyaretciler,
        evrakLoglari: filteredEvraklar,
        akvizyonYoklama: akvizyonSnap?.yoklama || null,
        ozet: {
          personel: filteredLogs.length,
          arac: filteredAraclar.length,
          suTankeri: filteredSuTanker.length,
          ziyaretci: filteredZiyaretciler.length,
          evrak: filteredEvraklar.length,
        },
      };

      const raporHtml = buildNobetGunlukRaporHtml(archivePayload);
      const archiveRef = doc(collection(db, 'guvenlikNobetArsivleri'));
      const archiveId = archiveRef.id;

      await setDoc(archiveRef, {
        id: archiveId,
        ...archivePayload,
        raporHtml,
      });

      if (addNotification) {
        const shiftText =
          selectedVardiya === 'TUM_GUN'
            ? 'Günlük Tam Rapor'
            : selectedVardiya === 'GUNDUZ'
              ? 'Gündüz Vardiyası'
              : 'Gece Vardiyası';
        addNotification(`${todayStr} güvenlik nöbeti (${shiftText}) arşivlendi.`);
      }
      showStatus('success', '🎉 Nöbet raporu arşive kaydedildi! Alttaki listeden görüntüleyebilirsiniz. Günlük loglar silinmedi.');
      setActiveTab('nobet_arsivi');
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Nöbet günü arşivlenirken hata oluştu: ' + err.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeletePersonelLog = async (id: string) => {
    if (!window.confirm('Bu personel kapı kaydı silinsin mi?')) return;
    try {
      await deleteDoc(doc(db, 'guvenlikGirisCikisLoglari', id));
      setSelectedPersonelLogIds((prev) => prev.filter((x) => x !== id));
      showStatus('success', 'Personel log kaydı silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Silinemedi.');
    }
  };

  const handleDeleteAracLog = async (id: string) => {
    if (!window.confirm('Bu araç kaydı silinsin mi?')) return;
    try {
      await deleteDoc(doc(db, 'guvenlikAracLoglari', id));
      setSelectedAracLogIds((prev) => prev.filter((x) => x !== id));
      showStatus('success', 'Araç log kaydı silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Silinemedi.');
    }
  };

  const handleDeleteSuTankeriLog = async (id: string) => {
    if (!window.confirm('Bu su tankeri kaydı silinsin mi?')) return;
    try {
      await deleteDoc(doc(db, 'guvenlikSuTankeriLoglari', id));
      setSelectedSuTankeriLogIds((prev) => prev.filter((x) => x !== id));
      showStatus('success', 'Su tankeri kaydı silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Silinemedi.');
    }
  };

  const handleDeleteZiyaretciLog = async (id: string) => {
    if (!window.confirm('Bu ziyaretçi kaydı silinsin mi?')) return;
    try {
      await deleteDoc(doc(db, 'guvenlikZiyaretciLoglari', id));
      showStatus('success', 'Ziyaretçi kaydı silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Silinemedi.');
    }
  };

  const handleGosterSeciliGun = (tabLabel: string, count: number) => {
    showStatus(
      'success',
      `${formatDateLabelTr(islemTarihi)} — ${tabLabel}: ${count} kayıt listeleniyor. Loglar silinmedi.`
    );
  };

  const handleBulkDeletePersonelLogs = async () => {
    if (selectedPersonelLogIds.length === 0) return;
    if (!window.confirm(`${selectedPersonelLogIds.length} personel log kaydı silinsin mi?`)) return;
    try {
      await Promise.all(
        selectedPersonelLogIds.map((id) => deleteDoc(doc(db, 'guvenlikGirisCikisLoglari', id)))
      );
      setSelectedPersonelLogIds([]);
      showStatus('success', 'Seçili personel logları silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Toplu silme başarısız.');
    }
  };

  const handleBulkDeleteAracLogs = async () => {
    if (selectedAracLogIds.length === 0) return;
    if (!window.confirm(`${selectedAracLogIds.length} araç log kaydı silinsin mi?`)) return;
    try {
      await Promise.all(selectedAracLogIds.map((id) => deleteDoc(doc(db, 'guvenlikAracLoglari', id))));
      setSelectedAracLogIds([]);
      showStatus('success', 'Seçili araç logları silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Toplu silme başarısız.');
    }
  };

  const handleBulkDeleteSuTankeriLogs = async () => {
    if (selectedSuTankeriLogIds.length === 0) return;
    if (!window.confirm(`${selectedSuTankeriLogIds.length} su tankeri log kaydı silinsin mi?`)) return;
    try {
      await Promise.all(
        selectedSuTankeriLogIds.map((id) => deleteDoc(doc(db, 'guvenlikSuTankeriLoglari', id)))
      );
      setSelectedSuTankeriLogIds([]);
      showStatus('success', 'Seçili su tankeri logları silindi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Toplu silme başarısız.');
    }
  };

  const handleGuncelleSeciliPersonelTarih = async () => {
    if (selectedPersonelLogIds.length === 0) return;
    if (
      !window.confirm(
        `Seçili ${selectedPersonelLogIds.length} personel kaydının işlem tarihi ${formatDateLabelTr(islemTarihi)} olarak güncellensin mi?`
      )
    )
      return;
    try {
      await Promise.all(
        selectedPersonelLogIds.map((id) => {
          const log = personelLoglar.find((l) => l.id === id);
          if (!log) return Promise.resolve();
          const timePart = String(log.zaman || getIslemZamani()).slice(11);
          return setDoc(
            doc(db, 'guvenlikGirisCikisLoglari', id),
            { islemTarihi, zaman: `${islemTarihi}T${timePart || '12:00:00.000Z'}` },
            { merge: true }
          );
        })
      );
      showStatus('success', 'Seçili personel kayıtları seçili tarihe güncellendi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Güncelleme başarısız.');
    }
  };

  const handleGuncelleSeciliAracTarih = async () => {
    if (selectedAracLogIds.length === 0) return;
    if (
      !window.confirm(
        `Seçili ${selectedAracLogIds.length} araç kaydının işlem tarihi ${formatDateLabelTr(islemTarihi)} olarak güncellensin mi?`
      )
    )
      return;
    try {
      await Promise.all(
        selectedAracLogIds.map((id) => {
          const log = tumAracLoglar.find((l) => l.id === id);
          if (!log) return Promise.resolve();
          const timePart = String(log.girisZamani || getIslemZamani()).slice(11);
          return setDoc(
            doc(db, 'guvenlikAracLoglari', id),
            { islemTarihi, girisZamani: `${islemTarihi}T${timePart || '12:00:00.000Z'}` },
            { merge: true }
          );
        })
      );
      showStatus('success', 'Seçili araç kayıtları seçili tarihe güncellendi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Güncelleme başarısız.');
    }
  };

  const handleGuncelleSeciliSuTankeriTarih = async () => {
    if (selectedSuTankeriLogIds.length === 0) return;
    if (
      !window.confirm(
        `Seçili ${selectedSuTankeriLogIds.length} su tankeri kaydının işlem tarihi ${formatDateLabelTr(islemTarihi)} olarak güncellensin mi?`
      )
    )
      return;
    try {
      await Promise.all(
        selectedSuTankeriLogIds.map((id) => {
          const log = tumSuTankeriLoglar.find((l) => l.id === id);
          if (!log) return Promise.resolve();
          const timePart = String(log.girisZamani || getIslemZamani()).slice(11);
          return setDoc(
            doc(db, 'guvenlikSuTankeriLoglari', id),
            { islemTarihi, girisZamani: `${islemTarihi}T${timePart || '12:00:00.000Z'}` },
            { merge: true }
          );
        })
      );
      showStatus('success', 'Seçili su tankeri kayıtları seçili tarihe güncellendi.');
    } catch (e) {
      console.error(e);
      showStatus('error', 'Güncelleme başarısız.');
    }
  };

  const handleIndirNobetRaporHtml = (archive: any) => {
    const html = archive.raporHtml || buildNobetGunlukRaporHtml(archive);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guvenlik_nobet_${archive.tarih}_${archive.vardiya || 'TUM'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteEvrak = async (evrakId: string) => {
    if (!window.confirm('Bu evrak kaydını tamamen silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, 'guvenlikGelenEvraklar', evrakId));
      if (addNotification) addNotification('Evrak kaydı silindi.');
    } catch (e) {
      console.error(e);
      alert('Silinemedi.');
    }
  };



  // ─────────────────────────────────────────────────────────────
  // 👥 PERSONEL GİRİŞ-ÇIKIŞ EVENTİ
  // ─────────────────────────────────────────────────────────────
  const handlePersonelGirisCikis = async (personel: Personel, tip: 'GİRİŞ' | 'ÇIKIŞ') => {
    setLoadingLog(true);
    try {
      const logId = `plog_${Date.now()}`;
      const logData = {
        id: logId,
        personelId: personel.id,
        ad: personel.ad,
        soyad: personel.soyad,
        tcNo: personel.tcNo,
        gorev: personel.gorev,
        tip,
        zaman: getIslemZamani(),
        islemTarihi,
        kaydeden: currentUser?.email || 'kapici_kibritci',
        firmaTipi: isTaseronPersonel(personel) ? 'TASERON' : 'ANA',
        firmaAdi: firmaEtiketi(personel),
      };

      await setDoc(doc(db, 'guvenlikGirisCikisLoglari', logId), logData);
      if (addNotification) {
        addNotification(`${personel.ad} ${personel.soyad} için şantiyeye ${tip} kaydı yapıldı.`);
      }
      showStatus('success', `${personel.ad} ${personel.soyad} için ${tip} kaydı başarıyla girildi!`);
    } catch (e) {
      console.error(e);
      showStatus('error', 'Giriş çıkış kaydı oluşturulamadı.');
    } finally {
      setLoadingLog(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🚛 ARAÇ GİRİŞ-ÇIKIŞ EVENTLERİ
  // ─────────────────────────────────────────────────────────────
  const handleAracGiris = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plaka || !aracFirma) {
      alert("Lütfen Plaka ve Firma belirtin!");
      return;
    }

    try {
      const logId = `arac_${Date.now()}`;
      const logData = {
        id: logId,
        plaka: plaka.toUpperCase().trim(),
        aracTipi,
        firma: aracFirma,
        yukDurumu,
        surucuAdi,
        aciklama: aracAciklama,
        durum: 'İÇERİDE',
        girisZamani: getIslemZamani(),
        islemTarihi,
        cikisZamani: null,
        kaydeden: currentUser?.email || 'guvenlik_gate'
      };

      await setDoc(doc(db, 'guvenlikAracLoglari', logId), logData);
      if (addNotification) {
        addNotification(`${plaka.toUpperCase().trim()} plakalı araç (${aracFirma}) şantiyeye giriş yaptı.`);
      }
      setPlaka('');
      setAracFirma('');
      setSurucuAdi('');
      setAracAciklama('');
      showStatus('success', 'Araç giriş kaydı yapıldı, şantiyede aktif olarak işaretlendi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Kayıt başarısız!');
    }
  };

  const handleAracCikis = async (id: string) => {
    try {
      const matchedArac = iceridekiAraclar.find(a => a.id === id);
      const vehiclePlaka = matchedArac ? matchedArac.plaka : id;
      await setDoc(doc(db, 'guvenlikAracLoglari', id), {
        durum: 'ÇIKTI',
        cikisZamani: getIslemZamani()
      }, { merge: true });
      if (addNotification) {
        addNotification(`${vehiclePlaka} plakalı araç şantiyeden çıkış yaptı.`);
      }
      showStatus('success', 'Araç çıkışı başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Hata oluştu!');
    }
  };

  const handleTankerGiris = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stPlaka.trim() || !stFirma.trim()) {
      alert('Lütfen plaka ve firmasını girin!');
      return;
    }

    const currentTip = 
      activeTab === 'vidanjor' ? 'VIDANJOR' : 
      activeTab === 'petrol_tankeri' ? 'PETROL_TANKERI' : 
      'SU_TANKERI';

    const currentLabel = 
      activeTab === 'vidanjor' ? 'Vidanjör' : 
      activeTab === 'petrol_tankeri' ? 'Petrol Tankeri' : 
      'Su Tankeri';

    try {
      const logId = `tk_${Date.now()}`;
      const logData = {
        id: logId,
        tip: currentTip,
        plaka: stPlaka.toUpperCase().trim(),
        firma: stFirma.trim(),
        surucuAdi: stSurucu.trim(),
        miktar: stMiktar.trim() || 'Belirtilmedi',
        aciklama: stAciklama.trim(),
        fotoUrl: tankerFotoUrl || null,
        fileName: tankerFileName || null,
        durum: 'İÇERİDE',
        girisZamani: getIslemZamani(),
        islemTarihi,
        cikisZamani: null,
        kaydeden: currentUser?.email || 'guvenlik_gate',
      };

      await setDoc(doc(db, 'guvenlikTankerLoglari', logId), logData);
      if (addNotification) {
        addNotification(`${currentLabel} ${logData.plaka} (${logData.firma}) şantiyeye giriş yaptı.`);
      }
      setStPlaka('');
      setStFirma('');
      setStSurucu('');
      setStMiktar('');
      setStAciklama('');
      setTankerFotoUrl('');
      setTankerFileName('');
      showStatus('success', `${currentLabel} giriş kaydı yapıldı!`);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Kayıt başarısız!');
    }
  };

  const handleTankerCikis = async (id: string) => {
    try {
      const matched = 
        iceridekiSuTankerleri.find((a) => a.id === id) ||
        iceridekiVidanjorler.find((a) => a.id === id) ||
        iceridekiPetrolTankerleri.find((a) => a.id === id);
      
      const plakaLabel = matched ? matched.plaka : id;
      const typeLabel = matched && matched.tip === 'VIDANJOR' ? 'vidanjör' : 
                        matched && matched.tip === 'PETROL_TANKERI' ? 'petrol tankeri' : 
                        'su tankeri';

      await setDoc(
        doc(db, 'guvenlikTankerLoglari', id),
        { durum: 'ÇIKTI', cikisZamani: getIslemZamani() },
        { merge: true }
      );
      if (addNotification) {
        addNotification(`${plakaLabel} plakalı ${typeLabel} şantiyeden çıkış yaptı.`);
      }
      showStatus('success', 'Çıkış başarıyla kaydedildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Hata oluştu!');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🎫 ZİYARETÇİ KAYIT & KART EVENTLERİ
  // ─────────────────────────────────────────────────────────────
  const handleZiyaretciGiris = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ziyaretciAd || !ziyaretEdilen) {
      alert("Lütfen Ziyaretçi Adı ve Ziyaret Edilen yetkiliyi girin!");
      return;
    }

    try {
      const id = `guest_${Date.now()}`;
      const logData = {
        id,
        adSoyad: ziyaretciAd,
        tcNo: ziyaretciTc || 'Belirtilmedi',
        firma: ziyaretciFirma || 'Bireysel',
        ziyaretSebebi,
        ziyaretEdilen,
        durum: 'İÇERİDE',
        girisZamani: getIslemZamani(),
        islemTarihi,
        cikisZamani: null,
        kartNo: `ZK-${Math.floor(1000 + Math.random() * 9000)}`
      };

      await setDoc(doc(db, 'guvenlikZiyaretciLoglari', id), logData);
      if (addNotification) {
        addNotification(`Ziyaretçi ${ziyaretciAd} (${logData.firma}) şantiyeye giriş yaptı.`);
      }
      
      // Display Visitor Badge Modal
      setActiveBadgeGuest(logData);

      setZiyaretciAd('');
      setZiyaretciTc('');
      setZiyaretciFirma('');
      setZiyaretSebebi('');
      setZiyaretEdilen('');
      showStatus('success', 'Ziyaretçi giriş kaydı tamamlandı! Giriş kartı hazırlandı.');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Hata!');
    }
  };

  const handleZiyaretciCikis = async (id: string) => {
    try {
      const matchedGuest = aktifZiyaretciler.find(z => z.id === id);
      const guestName = matchedGuest ? matchedGuest.adSoyad : id;
      await setDoc(doc(db, 'guvenlikZiyaretciLoglari', id), {
        durum: 'ÇIKTI',
        cikisZamani: getIslemZamani()
      }, { merge: true });
      if (addNotification) {
        addNotification(`Ziyaretçi ${guestName} şantiyeden çıkış yaptı.`);
      }
      showStatus('success', 'Ziyaretçi çıkış işlemi tamamlandı!');
    } catch (err) {
      console.error(err);
    }
  };

  const isSeciliGunBugun = islemTarihi === todayDateKey();
  const seciliTarihLabel = formatDateLabelTr(islemTarihi);

  const tumAracLoglar = useMemo(
    () => [...iceridekiAraclar, ...aracGecmisLoglar],
    [iceridekiAraclar, aracGecmisLoglar]
  );
  const tumSuTankeriLoglar = useMemo(
    () => [...iceridekiSuTankerleri, ...suTankeriGecmisLoglar],
    [iceridekiSuTankerleri, suTankeriGecmisLoglar]
  );
  const tumZiyaretciLoglar = useMemo(
    () => [...aktifZiyaretciler, ...ziyaretciGecmisLoglar],
    [aktifZiyaretciler, ziyaretciGecmisLoglar]
  );

  const seciliGunPersonelLoglar = useMemo(
    () => filterGuvenlikLogsByTarih(personelLoglar, islemTarihi),
    [personelLoglar, islemTarihi]
  );
  const seciliGunAracLoglar = useMemo(
    () => filterGuvenlikLogsByTarih(tumAracLoglar, islemTarihi),
    [tumAracLoglar, islemTarihi]
  );
  const seciliGunSuTankeriLoglar = useMemo(
    () => filterGuvenlikLogsByTarih(tumSuTankeriLoglar, islemTarihi),
    [tumSuTankeriLoglar, islemTarihi]
  );
  const seciliGunZiyaretciLoglar = useMemo(
    () => filterGuvenlikLogsByTarih(tumZiyaretciLoglar, islemTarihi),
    [tumZiyaretciLoglar, islemTarihi]
  );
  const seciliGunEvraklar = useMemo(
    () => gelenEvraklar.filter((e) => normalizeDateKey(e.tarih) === normalizeDateKey(islemTarihi)),
    [gelenEvraklar, islemTarihi]
  );
  const seciliGunNobetArsivleri = useMemo(
    () => nobetArsivleri.filter((a) => normalizeDateKey(a.tarih) === normalizeDateKey(islemTarihi)),
    [nobetArsivleri, islemTarihi]
  );

  const bugunkuPersonelLoglar = seciliGunPersonelLoglar;
  const bugunkuAracLoglar = seciliGunAracLoglar;
  const bugunkuSuTankeriLoglar = seciliGunSuTankeriLoglar;

  const togglePersonelLogSelect = (id: string) => {
    setSelectedPersonelLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAracLogSelect = (id: string) => {
    setSelectedAracLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSuTankeriLogSelect = (id: string) => {
    setSelectedSuTankeriLogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSendSelectedPersonelLogsWp = () => {
    const selected = bugunkuPersonelLoglar.filter((l) => selectedPersonelLogIds.includes(l.id));
    if (selected.length === 0) {
      alert('WhatsApp için en az bir personel logu seçin.');
      return;
    }
    openWhatsAppText(buildPersonelLoglariWhatsAppText(selected, islemTarihi));
  };

  const handleSendSelectedAracLogsWp = () => {
    const selected = bugunkuAracLoglar.filter((l) => selectedAracLogIds.includes(l.id));
    if (selected.length === 0) {
      alert('WhatsApp için en az bir araç logu seçin.');
      return;
    }
    openWhatsAppText(buildAracLoglariWhatsAppText(selected, islemTarihi));
  };

  const handleSendSelectedSuTankeriLogsWp = () => {
    const selected = bugunkuSuTankeriLoglar.filter((l) => selectedSuTankeriLogIds.includes(l.id));
    if (selected.length === 0) {
      alert('WhatsApp için en az bir su tankeri logu seçin.');
      return;
    }
    openWhatsAppText(buildSuTankeriLoglariWhatsAppText(selected, islemTarihi));
  };

  const handleSuTankeriGunlukRaporWp = () => {
    if (bugunkuSuTankeriLoglar.length === 0) {
      alert('Bugün için su tankeri kaydı yok.');
      return;
    }
    openWhatsAppText(buildSuTankeriLoglariWhatsAppText(bugunkuSuTankeriLoglar, islemTarihi));
  };

  const handleZiyaretciWhatsApp = (z: any) => {
    openWhatsAppText(buildZiyaretciWhatsAppText(z));
  };

  const handleAkvizyonRaporIndir = () => {
    const rows = akvizyonPersoneller.map((p) => {
      const raw = akvizyonYoklamaMap[p.id];
      const durum = raw === 'Geldi' ? 'VAR' : raw === 'Gelmedi' ? 'YOK' : 'BELİRTİLMEDİ';
      return { ad: p.ad, soyad: p.soyad, gorev: p.gorev || '', durum };
    });
    const html = buildAkvizyonYoklamaReportHtml(islemTarihi, rows);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `akvizyon_yoklama_${islemTarihi}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('success', 'Akvizyon yoklama raporu indirildi.');
  };

  const handleAkvizyonWpRapor = () => {
    const lines = [
      '📋 *Akvizyon (Taşeron) Günlük Yoklama*',
      `Tarih: ${islemTarihi}`,
      `Personel: ${akvizyonPersoneller.length}`,
      '',
      ...akvizyonPersoneller.map((p, i) => {
        const durum = akvizyonYoklamaMap[p.id] || 'Girilmedi';
        return `${i + 1}. ${p.ad} ${p.soyad} — *${durum}*`;
      }),
      '',
      '_Ana firma puantajından bağımsızdır._',
    ];
    openWhatsAppText(lines.join('\n'));
  };

  // 🔒 Authorization lock check
  const isAuthorized = canAccessGuvenlikScreen(userYetki, currentUser?.email);
  if (userYetki && !isAuthorized) {
    return (
      <div className="flex-1 min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center select-none text-slate-800">
        <div className="w-20 h-20 bg-rose-100 border border-rose-200 text-rose-600 rounded-3xl flex items-center justify-center mb-6">
          <Lock size={40} className="stroke-[2]" />
        </div>
        <h1 className="text-xl font-black text-slate-900 tracking-widest uppercase mb-2">🚧 YETKİSİZ ERİŞİM ENGELLENDİ</h1>
        <p className="text-sm text-slate-600 max-w-md leading-relaxed font-sans mb-6">
          Şantiye güvenliği ve veri bütünlüğü nedeniyle Güvenlik Kapısı Ekranı sadece yetkili <span className="text-amber-600 font-bold">GÜVENLİK</span>, <span className="text-amber-600 font-bold">KURUCU</span> ve <span className="text-amber-600 font-bold">YÖNETİCİ</span> personeline açıktır.
        </p>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col space-y-2 text-xs font-mono w-full max-w-xs text-left mb-6 shadow-sm">
          <div className="flex justify-between"><span className="text-slate-400">Kullanıcı:</span> <span className="text-slate-700 font-bold">{currentUser?.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Mevcut Rolünüz:</span> <span className="text-rose-600 font-bold uppercase">{userYetki || 'Belirtilmedi'}</span></div>
        </div>
        {onSignOut && (
          <button 
            onClick={onSignOut}
            className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl px-5 py-2.5 text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Sistemden Güvenli Çıkış Yap
          </button>
        )}
      </div>
    );
  }

  const mainLayout = (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 select-none">
      {/* 📱💻 Görünüm Simülatörü Kontrolü */}
      {!isStandalone && (
        <div className="bg-white border-b border-slate-200 p-2.5 px-6 flex justify-between items-center text-xs text-slate-700 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase text-slate-500">Görünüm Modu:</span>
            <span className="text-[10px] bg-slate-100 text-amber-600 font-bold px-2 py-0.5 rounded-lg border border-slate-200 uppercase">
              {viewMode === 'mobile' ? '📱 MOBİL SÜMÜLATÖR' : '💻 GENİŞ EKRAN'}
            </span>
          </div>
          <button
            onClick={() => setViewMode(viewMode === 'web' ? 'mobile' : 'web')}
            className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[10px] font-black px-3 py-1.5 rounded-lg transition cursor-pointer"
          >
            {viewMode === 'web' ? '📱 MOBİL SÜRÜMÜ TEST ET' : '💻 GENİŞ EKRANA GEÇ'}
          </button>
        </div>
      )}
      
      {/* 🛡️ Header section */}
      <div className="bg-white p-5 px-6 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center shrink-0">
        <div className="flex items-center space-x-3.5">
          <KibritciLogo size="sm" className="h-9" />
          <div>
            <h1 className="text-sm font-black text-slate-850 tracking-widest uppercase">🚧 ŞANTİYE GÜVENLİK KAPISI</h1>
            <p className="text-[10px] text-slate-550 font-mono uppercase tracking-wider">İrsaliye Kayıt, Araç Kantarı, Misafir Defteri ve Personel Giriş Kapısı</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 px-4 flex items-center space-x-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Giriş Noktası:</span>
            <span className="bg-amber-500 text-slate-950 text-[9px] font-mono font-black py-1 px-2 rounded-lg uppercase tracking-widest">
              NÖBETÇİ GÜVENLİK AMİRLİĞİ
            </span>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="bg-rose-950/40 text-rose-400 hover:bg-rose-900 hover:text-white border border-rose-900/30 text-[10px] font-bold px-3 py-2 rounded-xl transition cursor-pointer"
            >
              Güvenli Çıkış
            </button>
          )}
        </div>
      </div>

      {/* State message banner */}
      {statusMsg && (
        <div className={`p-4 text-xs text-center font-bold tracking-wide shrink-0 transition-all ${
          statusMsg.type === 'success' ? 'bg-emerald-950/80 text-emerald-400 border-b border-emerald-800' : 'bg-rose-950/80 text-rose-400 border-b border-rose-800'
        }`}>
          {statusMsg.type === 'success' ? '✓' : '⚠️'} {statusMsg.text}
        </div>
      )}

      {/* Layout Grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        
        {/* Left Side Tab Controls */}
        <div className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col p-4 space-y-4 shrink-0 lg:overflow-y-auto">
          
          <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="w-full lg:w-auto px-2.5 pt-1 text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Nöbetçi Menüsü</span>
            
            <button 
              onClick={() => setActiveTab('irsaliye')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'irsaliye' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><FileText size={13} /> <span>1. Evrak Girişi</span></span>
            </button>

            <button 
              onClick={() => setActiveTab('personel')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'personel' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Users size={13} /> <span>2. Personel Kapı</span></span>
            </button>

            <button 
              onClick={() => setActiveTab('arac')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'arac' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Truck size={13} /> <span>3. Araç Giriş-Çıkış</span></span>
              {iceridekiAraclar.length > 0 && (
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.2 ml-1 hidden lg:inline">{iceridekiAraclar.length}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('su_tankeri')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'su_tankeri' ? 'bg-sky-600 text-white shadow-md shadow-sky-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Droplets size={13} /> <span>4. Su Tankeri</span></span>
              {iceridekiSuTankerleri.length > 0 && (
                <span className="text-[9px] font-mono bg-sky-500/20 text-sky-600 rounded-full px-1.5 py-0.2 ml-1 hidden lg:inline">{iceridekiSuTankerleri.length}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('vidanjor')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'vidanjor' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Droplets size={13} className="rotate-180" /> <span>5. Vidanjör</span></span>
              {iceridekiVidanjorler.length > 0 && (
                <span className="text-[9px] font-mono bg-indigo-500/20 text-indigo-400 rounded-full px-1.5 py-0.2 ml-1 hidden lg:inline">{iceridekiVidanjorler.length}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('petrol_tankeri')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'petrol_tankeri' ? 'bg-rose-600 text-white shadow-md shadow-rose-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Fuel size={13} /> <span>6. Petrol Tankeri</span></span>
              {iceridekiPetrolTankerleri.length > 0 && (
                <span className="text-[9px] font-mono bg-rose-500/20 text-rose-400 rounded-full px-1.5 py-0.2 ml-1 hidden lg:inline">{iceridekiPetrolTankerleri.length}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('ziyaretci')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'ziyaretci' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><UserCheck size={13} /> <span>7. Ziyaretçi Defteri</span></span>
              {aktifZiyaretciler.length > 0 && (
                <span className="text-[9px] font-mono bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.2 ml-1 hidden lg:inline">{aktifZiyaretciler.length}</span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('nobet_arsivi')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'nobet_arsivi' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><Archive size={13} /> <span>8. Nöbet Kapat &amp; Arşiv</span></span>
            </button>

            <button 
              onClick={() => setActiveTab('akvizyon_yoklama')}
              className={`flex-1 lg:flex-none flex items-center justify-between text-xs px-3 py-2.5 rounded-lg font-bold transition cursor-pointer min-w-[120px] ${activeTab === 'akvizyon_yoklama' ? 'bg-amber-600 text-slate-950 shadow-md shadow-amber-500/15' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="flex items-center space-x-2"><ClipboardList size={13} /> <span>9. Akvizyon Yoklama</span></span>
            </button>
          </div>

          {/* Gate Status & Alerts */}
          <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl space-y-2 text-xs hidden lg:block">
            <span className="font-bold text-[9px] block uppercase text-amber-500 tracking-widest">NÖBET DEFTERİ NOTU</span>
            <p className="text-[11px] text-slate-450 leading-relaxed italic">
              "Kıymetli Nöbetçi Personel; Şantiyeye gelen her çimento mikseri, hafriyat kamyonu ve ziyaretçinin giriş-çıkış saatini saniyesiyle sisteme kaydedin. Evraksız hiçbir tedarikçi aracını şantiyeye sokmayın."
            </p>
          </div>

        </div>

        {/* Right workspace details area */}
        <div className="flex-1 bg-slate-50 p-6 overflow-y-auto space-y-6">
          
          {activeTab === 'irsaliye' && (
            <div className="space-y-6">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Evrak Girişi"
                logCount={seciliGunEvraklar.length}
                archivedCount={seciliGunNobetArsivleri.length}
                onGoster={() => handleGosterSeciliGun('Evrak Girişi', seciliGunEvraklar.length)}
                onKaydet={handleSendQueueToManager}
                kaydetLabel="Kuyruğu Kaydet"
                kaydetDisabled={uploadQueue.length === 0}
                kaydetLoading={loadingIrsaliye}
                onGuncelle={() => {
                  if (!editingEvrak && seciliGunEvraklar[0]) {
                    const e = seciliGunEvraklar[0];
                    setEditingEvrak(e);
                    setEditEvrakTuru(e.evrakTuru || 'İRSALİYE');
                    setEditAciklama(e.aciklama || '');
                    showStatus('success', 'İlk kayıt düzenleme için açıldı. Listeden Düzenle ile de seçebilirsiniz.');
                  } else if (editingEvrak) {
                    showStatus('success', 'Düzenleme formu açık — Değişiklikleri Kaydet ile güncelleyin.');
                  } else {
                    showStatus('error', 'Güncellenecek evrak yok. Önce listeden Düzenle seçin.');
                  }
                }}
                guncelleDisabled={seciliGunEvraklar.length === 0}
                onSil={() => {
                  if (seciliGunEvraklar.length === 0) return;
                  handleDeleteEvrak(seciliGunEvraklar[0].id);
                }}
                silDisabled={seciliGunEvraklar.length === 0}
              />
              
              {/* 1. YENİ EVRAK YÜKLEME ALANI */}
              <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                <span className="font-display font-black text-xs text-slate-800 uppercase tracking-widest block border-b pb-2">
                  📄 YÖNETİCİ ONAYINA EVRAK GÖNDER (ÇOKLU YÜKLEME)
                </span>
                
                <div className="relative border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center bg-indigo-50/30 hover:bg-indigo-50/70 transition duration-300 cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2 py-2 transform group-hover:scale-105 transition duration-300">
                    <div className="bg-indigo-600 w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 shadow-md">
                      <FileUp size={24} className="text-white" />
                    </div>
                    <span className="text-[13px] font-bold text-slate-850 block">Dosyaları Seçin veya Sürükleyin</span>
                    <span className="text-[10px] text-slate-500 block">
                      Birden fazla fotoğraf (PNG, JPG), PDF veya Word dosyası seçebilirsiniz
                    </span>
                  </div>
                </div>

                {/* Yükleme Kuyruğu (Upload Queue) */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[10px] text-indigo-600 uppercase tracking-wider">
                        Kuyruktaki Evraklar ({uploadQueue.length})
                      </span>
                      <button
                        onClick={() => setUploadQueue([])}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold"
                      >
                        Tümünü Temizle
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uploadQueue.map((item, index) => (
                        <div key={item.id} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex flex-col justify-between gap-3 shadow-sm relative">
                          <div className="flex gap-3">
                            {/* File Preview */}
                            <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {item.fileType.startsWith('image/') ? (
                                <img src={item.dataUrl} alt="preview" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-2xl">📄</div>
                              )}
                            </div>
                            
                            {/* Details Fields */}
                            <div className="flex-grow space-y-2 text-xs">
                              <div className="font-semibold text-slate-700 truncate max-w-[200px]" title={item.fileName}>
                                {item.fileName}
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-500 uppercase block">Evrak Türü</label>
                                <select
                                  value={item.evrakTuru}
                                  onChange={(e) => {
                                    const next = [...uploadQueue];
                                    next[index].evrakTuru = e.target.value;
                                    setUploadQueue(next);
                                  }}
                                  className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs"
                                >
                                  <option value="İRSALİYE">📄 İRSALİYE</option>
                                  <option value="FATURA">💰 FATURA</option>
                                  <option value="MAKBUZ">🎫 MAKBUZ</option>
                                  <option value="GENEL_EVRAK">📦 GENEL EVRAK</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 text-xs">
                            <label className="text-[8px] font-black text-slate-500 uppercase block">Açıklama (Zorunlu) *</label>
                            <input
                              type="text"
                              required
                              placeholder="Evrak hakkında kısa bilgi girin..."
                              value={item.aciklama}
                              onChange={(e) => {
                                const next = [...uploadQueue];
                                next[index].aciklama = e.target.value;
                                setUploadQueue(next);
                              }}
                              className="w-full bg-white border border-slate-200 p-1.5 rounded-lg text-xs"
                            />
                          </div>

                          <button
                            onClick={() => setUploadQueue(prev => prev.filter(x => x.id !== item.id))}
                            className="absolute top-2 right-2 text-rose-500 hover:bg-rose-50 p-1 rounded-full"
                            title="Listeden Kaldır"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleSendQueueToManager}
                        disabled={loadingIrsaliye || uploadQueue.some(x => !x.aciklama.trim())}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                      >
                        {loadingIrsaliye ? (
                          <span>Gönderiliyor...</span>
                        ) : (
                          <>
                            <span>🚀 YÖNETİCİ ONAYINA GÖNDER</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. ARŞİV & GÖNDERİLEN EVRAKLAR LİSTESİ */}
              <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-2 gap-3">
                  <div>
                    <span className="font-display font-black text-xs text-slate-800 uppercase tracking-widest block">
                      🗂️ GÖNDERİLEN EVRAK HAREKETLERİ LİSTESİ
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                      Onaylanan, reddedilen veya bekleyen tüm kayıtlar.
                    </span>
                  </div>

                  {/* Arama ve Filtreler */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                      <input
                        type="text"
                        placeholder="Evrak / Firma / Açıklama Ara..."
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none"
                      />
                    </div>
                    
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value as any)}
                      className="border border-slate-200 py-1.5 px-2 rounded-lg text-xs bg-white"
                    >
                      <option value="HEPSİ">Tüm Türler</option>
                      <option value="İRSALİYE">İrsaliye</option>
                      <option value="FATURA">Fatura</option>
                      <option value="MAKBUZ">Makbuz</option>
                      <option value="GENEL_EVRAK">Genel Evrak</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="border border-slate-200 py-1.5 px-2 rounded-lg text-xs bg-white"
                    >
                      <option value="HEPSİ">Tüm Durumlar</option>
                      <option value="BEKLEMEDE">Beklemede</option>
                      <option value="ONAYLANDI">Onaylandı</option>
                      <option value="REDDEDİLDİ">Reddedildi</option>
                    </select>
                  </div>
                </div>

                {/* Evrak Log Tablosu — seçili güne göre */}
                {seciliGunEvraklar.filter(e => {
                  // Apply search
                  const q = docSearch.toLowerCase();
                  const matchesSearch = 
                    (e.fileName || '').toLowerCase().includes(q) ||
                    (e.aciklama || '').toLowerCase().includes(q) ||
                    (e.evrakNo || '').toLowerCase().includes(q) ||
                    (e.firma || '').toLowerCase().includes(q) ||
                    (e.kaydeden || '').toLowerCase().includes(q);

                  // Apply type filter
                  const matchesType = typeFilter === 'HEPSİ' || e.evrakTuru === typeFilter;

                  // Apply status filter
                  const matchesStatus = statusFilter === 'HEPSİ' || e.durum === statusFilter;

                  return matchesSearch && matchesType && matchesStatus;
                }).length === 0 ? (
                  <div className="text-center py-10 text-[11px] text-slate-400 font-bold">
                    {seciliTarihLabel} için aranan kriterlere uygun evrak kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                          <th className="p-3">Evrak Bilgisi / Dosya</th>
                          <th className="p-3">Tür</th>
                          <th className="p-3">Açıklama</th>
                          <th className="p-3">Tarih / Saat</th>
                          <th className="p-3">Durum</th>
                          <th className="p-3 text-center">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {seciliGunEvraklar
                          .filter(e => {
                            const q = docSearch.toLowerCase();
                            const matchesSearch = 
                              (e.fileName || '').toLowerCase().includes(q) ||
                              (e.aciklama || '').toLowerCase().includes(q) ||
                              (e.evrakNo || '').toLowerCase().includes(q) ||
                              (e.firma || '').toLowerCase().includes(q) ||
                              (e.kaydeden || '').toLowerCase().includes(q);
                            const matchesType = typeFilter === 'HEPSİ' || e.evrakTuru === typeFilter;
                            const matchesStatus = statusFilter === 'HEPSİ' || e.durum === statusFilter;
                            return matchesSearch && matchesType && matchesStatus;
                          })
                          .map(e => (
                            <tr key={e.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-3 font-medium">
                                <div className="text-slate-800 font-bold truncate max-w-[180px]">{e.fileName || 'Belge'}</div>
                                <div className="text-[10px] text-indigo-500 font-mono mt-0.5">{e.id}</div>
                                {e.fotoUrl && (
                                  <a
                                    href="#"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      openBase64InNewTab(e.fotoUrl, e.fileName || 'Belge');
                                    }}
                                    className="text-[9px] text-indigo-600 hover:underline flex items-center gap-0.5 mt-1"
                                  >
                                    <span>👁️ Evrakı Görüntüle</span>
                                  </a>
                                )}
                              </td>
                              <td className="p-3">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                  e.evrakTuru === 'FATURA' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  e.evrakTuru === 'İRSALİYE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  e.evrakTuru === 'MAKBUZ' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-slate-50 text-slate-700 border-slate-200'
                                }`}>
                                  {e.evrakTuru}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 max-w-[200px] truncate" title={e.aciklama}>
                                {e.aciklama || '-'}
                              </td>
                              <td className="p-3 text-slate-500 font-mono text-[10px]">
                                <div>{e.tarih}</div>
                                <div className="text-[9px] mt-0.5">{e.saat}</div>
                              </td>
                              <td className="p-3">
                                <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                  e.durum === 'ONAYLANDI' ? 'bg-emerald-100 text-emerald-800' :
                                  e.durum === 'REDDEDİLDİ' ? 'bg-rose-100 text-rose-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {e.durum}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center items-center gap-1.5">
                                  {e.durum === 'BEKLEMEDE' && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingEvrak(e);
                                          setEditEvrakTuru(e.evrakTuru);
                                          setEditAciklama(e.aciklama || '');
                                        }}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                                      >
                                        ✏️ Değiştir
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEvrak(e.id)}
                                        className="bg-rose-50 hover:bg-rose-105 text-rose-600 text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                                      >
                                        🗑️ Sil
                                      </button>
                                    </>
                                  )}
                                  {e.durum !== 'BEKLEMEDE' && (
                                    <span className="text-[10px] text-slate-400 italic">Değiştirilemez</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* DÜZENLEME MODAL (Editing Modal Overlay) */}
              {editingEvrak && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-display font-black text-sm text-slate-800 uppercase tracking-wider">
                        ✏️ EVRAK BİLGİLERİNİ DÜZENLE
                      </h3>
                      <button
                        onClick={() => setEditingEvrak(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleUpdateGelenEvrak} className="space-y-4 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Evrak Türü</label>
                        <select
                          value={editEvrakTuru}
                          onChange={(e) => setEditEvrakTuru(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-xs"
                        >
                          <option value="İRSALİYE">📄 İRSALİYE</option>
                          <option value="FATURA">💰 FATURA</option>
                          <option value="MAKBUZ">🎫 MAKBUZ</option>
                          <option value="GENEL_EVRAK">📦 GENEL EVRAK</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Açıklama</label>
                        <input
                          type="text"
                          required
                          value={editAciklama}
                          onChange={(e) => setEditAciklama(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-medium text-slate-800"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingEvrak(null)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl transition"
                        >
                          İptal
                        </button>
                        <button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-xl transition"
                        >
                          Değişiklikleri Kaydet
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}


          {/* ─────────────────────────────────────────────────────────────
              TAB 2: PERSONEL GİRİŞ ÇIKIŞ TAKİBİ
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'personel' && (
            <div className="space-y-6">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Personel Kapı"
                logCount={seciliGunPersonelLoglar.length}
                archivedCount={seciliGunNobetArsivleri.length}
                onGoster={() => handleGosterSeciliGun('Personel Kapı', seciliGunPersonelLoglar.length)}
                onKaydet={() =>
                  showStatus(
                    'success',
                    `${seciliTarihLabel} için personel giriş/çıkışları anında kaydedilir. Bu güne ${seciliGunPersonelLoglar.length} kayıt bağlı.`
                  )
                }
                kaydetLabel="Tarihe Bağla"
                onGuncelle={handleGuncelleSeciliPersonelTarih}
                guncelleDisabled={selectedPersonelLogIds.length === 0}
                onSil={handleBulkDeletePersonelLogs}
                silDisabled={selectedPersonelLogIds.length === 0}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Personnel Search & Grid */}
                <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="font-display font-black text-xs text-slate-800 uppercase tracking-widest block">👥 ŞANTİYE PERSONEL GİRİŞ PANELİ</span>
                    <span className="bg-slate-900 text-white text-[9px] font-mono font-bold py-0.5 px-2 rounded">{seciliTarihLabel}</span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 text-slate-500" size={14} />
                    <input 
                      type="text"
                      placeholder="Personel Adı, Soyadı, TC, Görev veya Firma Ara..."
                      value={personelSearch}
                      onChange={(e) => setPersonelSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 pl-10 rounded-xl text-xs placeholder-slate-650"
                    />
                  </div>

                  {/* Grid of employees */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredPersonel.map((item) => {
                      const taseron = isTaseronPersonel(item);
                      return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 flex flex-col justify-between space-y-3 transition ${
                          taseron
                            ? 'bg-amber-50 border border-amber-200 hover:border-amber-400'
                            : 'bg-slate-50 border border-slate-200/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          {item.fotografUrl ? (
                            <img src={item.fotografUrl} alt={item.ad} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold shrink-0 text-xs ${
                              taseron ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500'
                            }`}>
                              {item.ad[0]}{item.soyad[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-805 text-xs truncate">{item.ad} {item.soyad}</h4>
                            <span className="text-[9px] text-slate-500 block truncate font-mono mt-0.5">💼 {item.gorev}</span>
                            <span className={`inline-block mt-1 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              taseron ? 'bg-amber-200/80 text-amber-900' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {firmaEtiketi(item)}
                            </span>
                            <span className="text-[8px] text-slate-600 block font-mono mt-0.2">TC: {item.tcNo.replace(/(\d{3})\d{5}(\d{3})/, '$1*****$2')}</span>
                          </div>
                        </div>

                        {/* Gate actions */}
                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-950">
                          <button
                            onClick={() => handlePersonelGirisCikis(item, 'GİRİŞ')}
                            className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-slate-950 text-[9px] font-black py-1.5 rounded-xl border border-emerald-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <Check size={10} />
                            <span>KAPI GİRİŞ</span>
                          </button>
                          <button
                            onClick={() => handlePersonelGirisCikis(item, 'ÇIKIŞ')}
                            className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-[9px] font-black py-1.5 rounded-xl border border-rose-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <X size={10} />
                            <span>KAPI ÇIKIŞ</span>
                          </button>
                        </div>
                      </div>
                      );
                    })}

                    {filteredPersonel.length === 0 && (
                      <div className="col-span-2 text-center p-6 text-slate-500 italic text-xs space-y-1">
                        <p>Arama kriterlerine uygun aktif personel bulunamadı.</p>
                        <p className="text-[10px] text-slate-400 not-italic">İşe giriş / işten çıkış tarihleri seçili güne uygun olmayan personel listelenmez.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live gate logs history */}
                <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-2">
                    <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block">📋 {seciliTarihLabel} GİRİŞ-ÇIKIŞ LOGLARI</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSendSelectedPersonelLogsWp}
                        disabled={selectedPersonelLogIds.length === 0}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[9px] font-black rounded-lg cursor-pointer"
                      >
                        <MessageCircle size={11} />
                        WP Gönder
                      </button>
                      <Clock size={14} className="text-amber-500 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {bugunkuPersonelLoglar.slice(0, 40).map((log) => {
                      const isGiris = log.tip === 'GİRİŞ';
                      const checked = selectedPersonelLogIds.includes(log.id);
                      return (
                        <div key={log.id} className="bg-slate-50 border border-slate-855 rounded-xl p-2.5 flex justify-between items-center text-[11px] gap-2">
                          <label className="flex items-start gap-2 min-w-0 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePersonelLogSelect(log.id)}
                              className="mt-0.5 accent-emerald-600"
                            />
                            <div className="space-y-0.5 min-w-0">
                              <span className="font-bold text-slate-805 block truncate">{log.ad} {log.soyad}</span>
                              <span className="text-[9px] text-slate-500 font-mono uppercase block truncate">{log.gorev}</span>
                              {log.firmaAdi && (
                                <span className={`inline-block text-[8px] font-bold px-1 py-0.5 rounded ${
                                  log.firmaTipi === 'TASERON' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {log.firmaAdi}
                                </span>
                              )}
                            </div>
                          </label>
                          
                          <div className="text-right shrink-0 space-y-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase font-mono tracking-wide ${
                              isGiris ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/10' : 'bg-rose-950 text-rose-400 border border-rose-500/10'
                            }`}>
                              {log.tip}
                            </span>
                            <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                              {new Date(log.zaman).toLocaleTimeString('tr-TR')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeletePersonelLog(log.id)}
                              className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {bugunkuPersonelLoglar.length === 0 && (
                      <div className="text-center p-10 text-slate-500 italic text-[11px]">
                        {seciliTarihLabel} için henüz personel giriş/çıkış kaydı yok. Tarih seçip Göster ile kontrol edin.
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: ARAÇ GİRİŞ-ÇIKIŞ TAKİBİ
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'arac' && (
            <div className="space-y-6">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Araç Giriş-Çıkış"
                logCount={seciliGunAracLoglar.length}
                archivedCount={seciliGunNobetArsivleri.length}
                onGoster={() => handleGosterSeciliGun('Araç Giriş-Çıkış', seciliGunAracLoglar.length)}
                onKaydet={() =>
                  showStatus(
                    'success',
                    `${seciliTarihLabel} için araç girişleri anında kaydedilir. Bu güne ${seciliGunAracLoglar.length} kayıt bağlı.`
                  )
                }
                kaydetLabel="Tarihe Bağla"
                onGuncelle={handleGuncelleSeciliAracTarih}
                guncelleDisabled={selectedAracLogIds.length === 0}
                onSil={handleBulkDeleteAracLogs}
                silDisabled={selectedAracLogIds.length === 0}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Vehicle In Form */}
                <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">🚚 ARAÇ ŞANTİYE GİRİŞ GİRİŞİ</span>
                  
                  <form onSubmit={handleAracGiris} className="space-y-3.5 text-xs text-slate-700">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Araç Plakası *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Örn: 34 ABC 123"
                        value={plaka}
                        onChange={(e) => setPlaka(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold font-mono text-xs uppercase"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Araç Tipi / Cinsi *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Örn: Hazır Beton Mikseri"
                        value={aracTipi}
                        onChange={(e) => setAracTipi(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Firma / Kurum *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Örn: Kibritçi Çimento A.Ş."
                        value={aracFirma}
                        onChange={(e) => setAracFirma(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Yük Durumu</label>
                        <select 
                          value={yukDurumu}
                          onChange={(e) => setYukDurumu(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2 rounded-xl text-xs font-bold"
                        >
                          <option value="Dolu">Dolu</option>
                          <option value="Boş">Boş</option>
                          <option value="Kısmi">Kısmi Yüklü</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Sürücü Adı Soyadı</label>
                        <input 
                          type="text"
                          placeholder="Örn: Ahmet Yılmaz"
                          value={surucuAdi}
                          onChange={(e) => setSurucuAdi(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2 rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Açıklama / Sevk Nedeni</label>
                      <input 
                        type="text"
                        placeholder="Beton döküm faaliyeti için döküm sahasına sevk."
                        value={aracAciklama}
                        onChange={(e) => setAracAciklama(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-black text-xs py-3 rounded-xl cursor-pointer border-b-2 border-amber-800 transition"
                    >
                      KAYDET &amp; ŞANTİYEYE GÖNDER
                    </button>
                  </form>
                </div>

                {/* Vehicles Currently Inside */}
                <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block border-b border-slate-200 pb-2">🚧 AKTİF OLARAK ŞANTİYE İÇİNDEKİ ARAÇLAR</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {iceridekiAraclar.map((item) => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden">
                        
                        <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                          <span className="font-mono text-xs font-black text-white bg-white px-2 py-0.5 border border-slate-200 rounded">{item.plaka}</span>
                          <span className="text-[9px] text-amber-400 font-bold uppercase">{item.aracTipi}</span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-500 font-semibold">
                          <p>🏢 Tedarikçi: <span className="text-slate-150 font-bold">{item.firma}</span></p>
                          <p>👤 Sürücü: <span className="text-slate-150 font-bold">{item.surucuAdi || 'Belirtilmedi'}</span></p>
                          <p>⚖️ Yük / Sevk Nedeni: <span className="text-amber-500 font-bold">{item.yukDurumu} ({item.aciklama || 'Genel'})</span></p>
                          <p className="text-[9px] text-slate-500 pt-1">Giriş Saati: {new Date(item.girisZamani).toLocaleString('tr-TR')}</p>
                        </div>

                        <button
                          onClick={() => handleAracCikis(item.id)}
                          className="w-full bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl border border-rose-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                        >
                          <X size={11} />
                          <span>ŞANTİYEDEN ÇIKIŞ YAPTI OLARAK İŞARETLE</span>
                        </button>
                      </div>
                    ))}

                    {iceridekiAraclar.length === 0 && (
                      <div className="col-span-2 bg-slate-900/40 p-10 rounded-2xl border border-slate-200 text-center text-slate-500 italic text-xs">
                        Şantiyede aktif olarak bulunan hiçbir iş makinesi veya tedarikçi araç kaydı bulunmuyor.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Bugünkü Araç Logları + WP */}
              <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-2">
                  <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block">🚛 {seciliTarihLabel} ARAÇ LOGLARI</span>
                  <button
                    type="button"
                    onClick={handleSendSelectedAracLogsWp}
                    disabled={selectedAracLogIds.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[9px] font-black rounded-lg cursor-pointer"
                  >
                    <MessageCircle size={11} />
                    WP Gönder
                  </button>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {bugunkuAracLoglar.map((log) => {
                    const checked = selectedAracLogIds.includes(log.id);
                    return (
                      <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex justify-between items-center text-[11px] gap-2">
                        <label className="flex items-start gap-2 min-w-0 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAracLogSelect(log.id)}
                            className="mt-0.5 accent-emerald-600"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-slate-800 font-mono block">{log.plaka}</span>
                            <span className="text-[9px] text-slate-500 block truncate">{log.aracTipi} · {log.firma}</span>
                            <span className="text-[9px] text-slate-400 block">Sürücü: {log.surucuAdi || '—'}</span>
                          </div>
                        </label>
                        <div className="text-right shrink-0 space-y-1">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            log.durum === 'İÇERİDE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {log.durum}
                          </span>
                          <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                            {log.girisZamani ? new Date(log.girisZamani).toLocaleTimeString('tr-TR') : '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAracLog(log.id)}
                            className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {bugunkuAracLoglar.length === 0 && (
                    <div className="text-center p-8 text-slate-500 italic text-[11px]">
                      {seciliTarihLabel} için henüz araç giriş/çıkış kaydı yok.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB: TANKER / KONTROL (SU TANKERİ, VİDANJÖR, PETROL TANKERİ)
              ───────────────────────────────────────────────────────────── */}
          {(activeTab === 'su_tankeri' || activeTab === 'vidanjor' || activeTab === 'petrol_tankeri') && (() => {
            const currentBg = 
              activeTab === 'vidanjor' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/15' : 
              activeTab === 'petrol_tankeri' ? 'bg-rose-600 text-white shadow-md shadow-rose-500/15' : 
              'bg-sky-600 text-white shadow-md shadow-sky-500/15';

            const currentLabel = 
              activeTab === 'vidanjor' ? 'Vidanjör' : 
              activeTab === 'petrol_tankeri' ? 'Petrol Tankeri' : 
              'Su Tankeri';

            const currentIcon = 
              activeTab === 'vidanjor' ? <Droplets size={13} className="rotate-180" /> : 
              activeTab === 'petrol_tankeri' ? <Fuel size={13} /> : 
              <Droplets size={13} />;

            const currentTextClass = 
              activeTab === 'vidanjor' ? 'text-indigo-800 border-indigo-200 bg-indigo-50' : 
              activeTab === 'petrol_tankeri' ? 'text-rose-800 border-rose-200 bg-rose-50' : 
              'text-sky-800 border-sky-200 bg-sky-50';

            const currentButtonClass = 
              activeTab === 'vidanjor' ? 'bg-indigo-600 hover:bg-indigo-700 border-indigo-800' : 
              activeTab === 'petrol_tankeri' ? 'bg-rose-600 hover:bg-rose-700 border-rose-800' : 
              'bg-sky-600 hover:bg-sky-700 border-sky-800';

            const insideList = 
              activeTab === 'vidanjor' ? iceridekiVidanjorler : 
              activeTab === 'petrol_tankeri' ? iceridekiPetrolTankerleri : 
              iceridekiSuTankerleri;

            const pastList = 
              activeTab === 'vidanjor' ? vidanjorGecmisLoglar : 
              activeTab === 'petrol_tankeri' ? petrolTankeriGecmisLoglar : 
              suTankeriGecmisLoglar;

            const historyList = [...insideList, ...pastList]
              .filter(item => item.girisZamani && item.girisZamani.startsWith(islemTarihi));

            return (
              <div className="space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-4 border border-slate-200 rounded-3xl gap-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <span className="font-display font-black text-sm text-slate-800 uppercase tracking-widest flex items-center space-x-2">
                      {currentIcon}
                      <span>{currentLabel} Kontrol Paneli</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">İşlem Tarihi:</label>
                    <input 
                      type="date" 
                      value={islemTarihi} 
                      onChange={(e) => setIslemTarihi(e.target.value)} 
                      className="bg-transparent text-xs font-bold text-slate-800 outline-none" 
                    />
                  </div>
                </div>

                <div className={`${currentTextClass} border rounded-2xl p-4 text-xs font-semibold`}>
                  {currentLabel} girişlerini bu sekmeden takip edebilirsiniz. Günlük loglar seçilen işleme tarihine göre listelenir.
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Yeni Giriş Formu */}
                  <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                    <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">
                      {currentIcon} YENİ {currentLabel.toUpperCase()} GİRİŞ KAYDI
                    </span>

                    <form onSubmit={handleTankerGiris} className="space-y-3.5 text-xs text-slate-700">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Plaka *</label>
                        <input
                          type="text"
                          required
                          placeholder="Örn: 34 XYZ 456"
                          value={stPlaka}
                          onChange={(e) => setStPlaka(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold font-mono text-xs uppercase"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Tedarikçi / Firma *</label>
                        <input
                          type="text"
                          required
                          placeholder="Örn: ABC Lojistik"
                          value={stFirma}
                          onChange={(e) => setStFirma(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Sürücü Adı Soyadı</label>
                        <input
                          type="text"
                          placeholder="Örn: Ahmet Yılmaz"
                          value={stSurucu}
                          onChange={(e) => setStSurucu(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Miktar (m³ / Litre)</label>
                        <input
                          type="text"
                          placeholder="Örn: 15 m³ veya 10000 Lt"
                          value={stMiktar}
                          onChange={(e) => setStMiktar(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Açıklama</label>
                        <input
                          type="text"
                          placeholder="Genel şantiye ihtiyacı vb..."
                          value={stAciklama}
                          onChange={(e) => setStAciklama(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                        />
                      </div>

                      {/* Document Upload Area */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Fotoğraf / Belge Yükle</label>
                        {tankerFotoUrl ? (
                          <div className="relative border border-slate-200 rounded-2xl p-2 bg-slate-50 flex items-center justify-between">
                            <span className="text-[10px] text-slate-600 font-bold font-mono truncate max-w-[180px]">
                              {tankerFileName || 'Belge Yüklendi'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTankerFotoUrl('');
                                setTankerFileName('');
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 font-bold text-xs cursor-pointer border-0 bg-transparent"
                            >
                              Kaldır
                            </button>
                          </div>
                        ) : (
                          <div className="relative border border-dashed border-slate-350 rounded-2xl p-4 text-center bg-slate-50 hover:bg-slate-100/60 transition cursor-pointer group">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              capture="environment"
                              onChange={(e) => {
                                if (!e.target.files || !e.target.files[0]) return;
                                const file = e.target.files[0];
                                setTankerFileName(file.name);
                                const reader = new FileReader();
                                reader.onload = async () => {
                                  const rawBase64 = reader.result as string;
                                  let compressed = rawBase64;
                                  if (file.type.startsWith('image/')) {
                                    try {
                                      compressed = await compressImage(rawBase64);
                                    } catch (err) {
                                      console.error('Image compression failed', err);
                                    }
                                  }
                                  setTankerFotoUrl(compressed);
                                };
                                reader.readAsDataURL(file);
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="space-y-1 py-1">
                              <Camera size={18} className="text-slate-400 mx-auto" />
                              <span className="text-[10px] font-bold text-slate-500 block">Belge / Fotoğraf Çek veya Yükle</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className={`w-full ${currentButtonClass} text-white font-black text-xs py-3 rounded-xl cursor-pointer border-b-2 transition`}
                      >
                        KAYDET &amp; ŞANTİYEYE GÖNDER
                      </button>
                    </form>
                  </div>

                  {/* Tarihli Tanker Hareketleri Listesi */}
                  <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                    <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block border-b border-slate-200 pb-2">
                      🚧 TARİHLİ {currentLabel.toUpperCase()} HAREKET LİSTESİ
                    </span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                      {historyList.map((item) => (
                        <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5 relative overflow-hidden flex flex-col justify-between">
                          
                          <div>
                            <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                              <span className="font-mono text-xs font-black text-white bg-white px-2 py-0.5 border border-slate-200 rounded">{item.plaka}</span>
                              <div className="flex items-center space-x-1">
                                {item.fotoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => openBase64InNewTab(item.fotoUrl, item.fileName || 'Belge')}
                                    className="text-indigo-600 hover:text-indigo-500 p-1 hover:bg-indigo-50/20 rounded transition cursor-pointer bg-transparent border-0"
                                    title="Belgeyi Görüntüle"
                                  >
                                    <FileText size={12} />
                                  </button>
                                )}
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${currentBg}`}>
                                  {currentLabel}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1 text-[11px] text-slate-500 font-semibold mt-2.5">
                              <p>🏢 Tedarikçi / Firma: <span className="text-slate-800 font-bold">{item.firma}</span></p>
                              <p>👤 Sürücü: <span className="text-slate-800 font-bold">{item.surucuAdi || 'Belirtilmedi'}</span></p>
                              <p>⚖️ Miktar / Açıklama: <span className="text-amber-500 font-bold">{item.miktar ? `${item.miktar} m³ / Lt` : '—'} ({item.aciklama || 'Belirtilmedi'})</span></p>
                              <p className="text-[9px] text-slate-500 pt-1">Giriş Saati: {new Date(item.girisZamani).toLocaleString('tr-TR')}</p>
                              {item.cikisZamani && (
                                <p className="text-[9px] text-rose-500">Çıkış Saati: {new Date(item.cikisZamani).toLocaleString('tr-TR')}</p>
                              )}
                            </div>
                          </div>

                          <div className="pt-2">
                            {item.durum === 'ÇIKTI' ? (
                              <div className="w-full bg-slate-100 text-slate-500 text-center font-extrabold text-[10px] py-2 rounded-xl border border-slate-200">
                                Çıkış Yapıldı
                              </div>
                            ) : (
                              <button
                                onClick={() => handleTankerCikis(item.id)}
                                className="w-full bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white font-extrabold text-[10px] py-1.5 px-3 rounded-xl border border-rose-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                              >
                                <X size={11} />
                                <span>ŞANTİYEDEN ÇIKIŞ YAPTI OLARAK İŞARETLE</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {historyList.length === 0 && (
                        <div className="col-span-2 bg-slate-900/40 p-10 rounded-2xl border border-slate-200 text-center text-slate-500 italic text-xs">
                          Seçilen tarihte şantiyeye giriş yapmış {currentLabel.toLowerCase()} kaydı bulunmuyor.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ─────────────────────────────────────────────────────────────
              TAB 5: ZİYARETÇİ DEFTERİ
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'ziyaretci' && (
            <div className="space-y-6">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Ziyaretçi Defteri"
                logCount={seciliGunZiyaretciLoglar.length}
                archivedCount={seciliGunNobetArsivleri.length}
                onGoster={() => handleGosterSeciliGun('Ziyaretçi Defteri', seciliGunZiyaretciLoglar.length)}
                onKaydet={() =>
                  showStatus(
                    'success',
                    `${seciliTarihLabel} için ziyaretçi girişleri anında kaydedilir. Bu güne ${seciliGunZiyaretciLoglar.length} kayıt bağlı.`
                  )
                }
                kaydetLabel="Tarihe Bağla"
                onSil={() => {
                  if (seciliGunZiyaretciLoglar.length === 0) return;
                  handleDeleteZiyaretciLog(seciliGunZiyaretciLoglar[0].id);
                }}
                silDisabled={seciliGunZiyaretciLoglar.length === 0}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Guest Form */}
                <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">🎫 YENİ MİSAFİR GİRİŞ KAYDI</span>
                  
                  <form onSubmit={handleZiyaretciGiris} className="space-y-3.5 text-xs text-slate-700">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Ziyaretçi Adı Soyadı *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Örn: Ahmet Karaca"
                        value={ziyaretciAd}
                        onChange={(e) => setZiyaretciAd(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl font-bold text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Kimlik No / TC Kodu (Son 4 Hane)</label>
                      <input 
                        type="text"
                        maxLength={11}
                        placeholder="Örn: 2478"
                        value={ziyaretciTc}
                        onChange={(e) => setZiyaretciTc(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Firma / Kurum / Ünvan</label>
                      <input 
                        type="text"
                        placeholder="Örn: Yapı Denetim Sorumlusu"
                        value={ziyaretciFirma}
                        onChange={(e) => setZiyaretciFirma(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Ziyaret Nedeni</label>
                      <input 
                        type="text"
                        placeholder="Örn: Beton Demir Kalıp Kontrolü"
                        value={ziyaretSebebi}
                        onChange={(e) => setZiyaretSebebi(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Görüşülecek Şantiye Yetkilisi *</label>
                      <input 
                        type="text"
                        required
                        placeholder="Örn: Samet Atak veya Şantiye Şefi (Elle yazın)"
                        value={ziyaretEdilen}
                        onChange={(e) => setZiyaretEdilen(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 p-2.5 rounded-xl text-xs font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-slate-950 font-black text-xs py-3 rounded-xl cursor-pointer border-b-2 border-amber-800 transition"
                    >
                      ✓ GİRİŞ KAYDI YAP &amp; KART YAZDIR
                    </button>
                  </form>
                </div>

                {/* Active Visitors */}
                <div className="lg:col-span-2 bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                  <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block border-b border-slate-200 pb-2">🚧 ŞANTİYEDEKİ MİSAFİRLER / GÖREV ALANLAR</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {aktifZiyaretciler.map((item) => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3 flex flex-col justify-between relative overflow-hidden">
                        
                        <div className="flex justify-between items-center border-b border-slate-950 pb-1.5">
                          <span className="font-mono text-xs font-black text-white bg-white px-2 py-0.5 border border-slate-200 rounded">{item.kartNo}</span>
                          <span className="bg-amber-500/15 text-amber-400 text-[8px] font-mono font-black py-0.5 px-2 rounded-lg uppercase tracking-wider">MİSAFİR</span>
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-500 font-semibold">
                          <p>👤 Adı Soyadı: <span className="text-slate-800 font-bold">{item.adSoyad}</span></p>
                          <p>🏢 Kurum: <span className="text-slate-150">{item.firma}</span></p>
                          <p>🤝 Görüşülen Yetkili: <span className="text-slate-600 font-bold">{item.ziyaretEdilen}</span></p>
                          <p>💼 Neden: <span className="text-slate-805">{item.ziyaretSebebi || 'Genel Görüşme'}</span></p>
                          <p className="text-[9px] text-slate-500 pt-1">Giriş Saati: {new Date(item.girisZamani).toLocaleString('tr-TR')}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-950/60">
                          <button
                            onClick={() => setActiveBadgeGuest(item)}
                            className="bg-slate-800 hover:bg-slate-750 text-slate-700 text-[9px] font-extrabold py-1.5 rounded-xl border border-slate-700 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <Printer size={11} />
                            <span>KART</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleZiyaretciWhatsApp(item)}
                            className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-600 hover:text-white text-[9px] font-extrabold py-1.5 rounded-xl border border-emerald-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <MessageCircle size={11} />
                            <span>WP</span>
                          </button>
                          
                          <button
                            onClick={() => handleZiyaretciCikis(item.id)}
                            className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white text-[9px] font-extrabold py-1.5 rounded-xl border border-rose-500/20 transition cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <X size={11} />
                            <span>ÇIKIŞ</span>
                          </button>
                        </div>
                      </div>
                    ))}

                    {aktifZiyaretciler.length === 0 && (
                      <div className="col-span-2 bg-slate-900/40 p-10 rounded-2xl border border-slate-200 text-center text-slate-500 italic text-xs">
                        Şantiyede aktif olarak bulunan hiçbir ziyaretçi kaydı bulunmuyor.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4">
                <span className="font-display font-black text-xs text-amber-500 uppercase tracking-widest block border-b border-slate-200 pb-2">
                  🎫 {seciliTarihLabel} ZİYARETÇİ LOGLARI ({seciliGunZiyaretciLoglar.length})
                </span>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {seciliGunZiyaretciLoglar.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex justify-between items-center text-[11px] gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-bold text-slate-800 block truncate">{log.adSoyad}</span>
                        <span className="text-[9px] text-slate-500 block truncate">
                          {log.firma} · {log.ziyaretEdilen}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">{log.kartNo}</span>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            log.durum === 'İÇERİDE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {log.durum}
                        </span>
                        <span className="text-[9px] text-slate-500 block font-mono">
                          {log.girisZamani ? new Date(log.girisZamani).toLocaleTimeString('tr-TR') : '—'}
                        </span>
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleZiyaretciWhatsApp(log)}
                            className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            WP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteZiyaretciLog(log.id)}
                            className="text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            Sil
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {seciliGunZiyaretciLoglar.length === 0 && (
                    <div className="text-center p-8 text-slate-500 italic text-[11px]">
                      {seciliTarihLabel} için ziyaretçi kaydı yok. Tarih seçip Göster ile kontrol edin.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 5: NÖBET GÜNÜ KAPAT & ARŞİV
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'nobet_arsivi' && (
            <div className="space-y-6">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Nöbet Kapat & Arşiv"
                logCount={
                  seciliGunPersonelLoglar.length +
                  seciliGunAracLoglar.length +
                  seciliGunSuTankeriLoglar.length +
                  seciliGunZiyaretciLoglar.length +
                  seciliGunEvraklar.length
                }
                archivedCount={seciliGunNobetArsivleri.length}
                onGoster={() =>
                  handleGosterSeciliGun(
                    'Nöbet günü',
                    seciliGunPersonelLoglar.length +
                      seciliGunAracLoglar.length +
                      seciliGunSuTankeriLoglar.length +
                      seciliGunZiyaretciLoglar.length +
                      seciliGunEvraklar.length
                  )
                }
                onKaydet={() => {
                  const txt =
                    (document.getElementById('nobetNotlar') as HTMLTextAreaElement)?.value || '';
                  handleArchiveNobetGunu(txt);
                }}
                kaydetLabel="Nöbeti Arşivle"
                kaydetLoading={isArchiving}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sol Panel: Aktif Günü Arşivle */}
                <div className="bg-white p-6 border border-slate-200 rounded-3xl space-y-5">
                  <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">
                    🔒 {seciliTarihLabel} NÖBET VARDİYASINI ARŞİVLE
                  </span>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Nöbet kapatınca seçili günün tüm giriş-çıkış ve evrak logları <strong>toplu rapora</strong> dönüşüp
                    arşive kaydedilir. Canlı loglar <strong className="text-emerald-700">silinmez</strong>; sekmelerden
                    tarihe göre yeniden görüntülenir.
                  </p>

                  {/* Vardiya Seçimi */}
                  <div className="space-y-1.5 text-xs text-slate-705">
                    <label className="text-[9px] font-bold text-slate-500 uppercase block font-sans">Arşivlenecek Vardiya *</label>
                    <select
                      value={selectedVardiya}
                      onChange={(e) => setSelectedVardiya(e.target.value as NobetVardiyaTipi)}
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-xs text-slate-850"
                    >
                      <option value="TUM_GUN">📅 Tam Gün (24 Saat — tüm günlük loglar)</option>
                      <option value="GUNDUZ">☀️ Gündüz Vardiyası (08:00 - 20:00)</option>
                      <option value="GECE">🌙 Gece Vardiyası (20:00 - 08:00)</option>
                    </select>
                  </div>

                  {/* Vardiyaya Göre Dinamik İstatistikler */}
                  {(() => {
                    const sLogs = filterNobetPersonelLoglari(personelLoglar, islemTarihi, selectedVardiya).length;
                    const sAraclar = filterNobetAracZiyaretLoglari(
                      tumAracLoglar,
                      islemTarihi,
                      selectedVardiya,
                      getIslemZamani()
                    ).length;
                    const sSu = filterNobetAracZiyaretLoglari(
                      tumSuTankeriLoglar,
                      islemTarihi,
                      selectedVardiya,
                      getIslemZamani()
                    ).length;
                    const sGuests = filterNobetAracZiyaretLoglari(
                      tumZiyaretciLoglar,
                      islemTarihi,
                      selectedVardiya,
                      getIslemZamani()
                    ).length;
                    const sEvrak = filterNobetEvrakLoglari(gelenEvraklar, islemTarihi, selectedVardiya).length;

                    return (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block font-sans">
                          Vardiya İstatistikleri Özeti — {seciliTarihLabel}
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/40">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase font-sans">Personel</span>
                            <span className="text-sm font-black text-slate-805 font-mono">{sLogs} Hareket</span>
                          </div>

                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/40">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase font-sans">Araç</span>
                            <span className="text-sm font-black text-slate-805 font-mono">{sAraclar} Giriş</span>
                          </div>

                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/40">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase font-sans">Su Tankeri</span>
                            <span className="text-sm font-black text-slate-805 font-mono">{sSu} Sefer</span>
                          </div>

                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/40">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase font-sans">Misafir</span>
                            <span className="text-sm font-black text-slate-805 font-mono">{sGuests} Kayıt</span>
                          </div>

                          <div className="bg-white/60 p-2.5 rounded-xl border border-slate-200/40 col-span-2">
                            <span className="text-[9px] font-bold text-slate-500 block uppercase font-sans">Evrak</span>
                            <span className="text-sm font-black text-slate-805 font-mono">{sEvrak} Belge</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Notlar */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-bold uppercase text-[9px] font-sans">GÜN SONU / VARDİYA DEVİR NOTLARI</label>
                    <textarea
                      placeholder="Örn: Nöbette herhangi bir olumsuz durum yaşanmadı. Vardiya eksiksiz devredildi."
                      id="nobetNotlar"
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-805 p-3 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const txt = (document.getElementById('nobetNotlar') as HTMLTextAreaElement)?.value || '';
                      handleArchiveNobetGunu(txt);
                      if ((document.getElementById('nobetNotlar') as HTMLTextAreaElement)) {
                        (document.getElementById('nobetNotlar') as HTMLTextAreaElement).value = '';
                      }
                    }}
                    disabled={isArchiving}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-black text-xs py-3.5 rounded-2xl flex items-center justify-center space-x-2 border-b-2 border-amber-700 cursor-pointer transition uppercase tracking-wider"
                  >
                    <Archive size={14} />
                    <span>{isArchiving ? 'Arşivleniyor...' : 'Nöbeti Kapat & Raporu Arşivle'}</span>
                  </button>

                  <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    ✓ Arşivleme sonrası günlük loglar sekmelerde kalır. Alttaki listeden raporları açabilirsiniz.
                  </p>

                </div>

                {/* Sağ Panel: Arşiv Arama ve Listeleme */}
                <div className="lg:col-span-2 bg-white p-6 border border-slate-200 rounded-3xl space-y-4">
                  
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-3 gap-3">
                    <div>
                      <span className="font-display font-black text-xs text-slate-800 uppercase tracking-widest block">
                        📂 GEÇMİŞ GÜNLERİN GÜVENLİK ARŞİVLERİ
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono">Nöbet kapatınca oluşan raporlar burada listelenir — günlük loglar silinmez</p>
                    </div>

                    {/* Arama Barı */}
                    <div className="relative w-full sm:w-64 shrink-0">
                      <Search className="absolute left-3 top-3 text-slate-500" size={13} />
                      <input 
                        type="text"
                        placeholder="Tarih veya açıklama ara..."
                        value={nobetSearch}
                        onChange={(e) => setNobetSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-805 pl-8.5 pr-4 py-2 rounded-xl text-xs outline-none focus:border-amber-500 font-bold"
                      />
                    </div>
                  </div>

                  {/* Arşiv Kart Listesi */}
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {nobetArsivleri
                      .filter(x => {
                        const q = nobetSearch.toLowerCase();
                        return (x.tarih || '').toLowerCase().includes(q) || (x.notlar || '').toLowerCase().includes(q) || (x.kaydeden || '').toLowerCase().includes(q);
                      })
                      .map((archive) => (
                        <div 
                          key={archive.id}
                          className="bg-slate-50 hover:bg-slate-850 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center space-x-2">
                              <Calendar size={13} className="text-amber-500" />
                              <span className="text-sm font-black text-slate-800 font-mono">{archive.tarih}</span>
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                                archive.vardiya === 'GUNDUZ' ? 'bg-amber-100 text-amber-805 border border-amber-200' :
                                archive.vardiya === 'GECE' ? 'bg-indigo-105 text-indigo-850 border border-indigo-200' :
                                'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {archive.vardiya === 'GUNDUZ' ? '☀️ Gündüz' : archive.vardiya === 'GECE' ? '🌙 Gece' : 'Tüm Gün'}
                              </span>
                              <span className="bg-white text-slate-500 text-[9px] px-2 py-0.5 rounded-lg border border-slate-200">
                                {new Date(archive.kayitZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 font-sans leading-relaxed">
                              {archive.notlar}
                            </p>
                            <span className="text-[10px] font-mono text-slate-500 block uppercase">
                              Arşivleyen: {archive.kaydeden}
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            {/* Küçük istatistik barları */}
                            <div className="flex items-center space-x-1 bg-white/50 p-2 rounded-xl border border-slate-200/40 text-[9px] font-mono font-bold text-slate-450">
                              <span>P: <strong className="text-slate-805">{archive.personelLoglari?.length || 0}</strong></span>
                              <span className="text-slate-700">|</span>
                              <span>A: <strong className="text-slate-805">{archive.aracLoglari?.length || 0}</strong></span>
                              <span className="text-slate-700">|</span>
                              <span>Z: <strong className="text-slate-805">{archive.ziyaretciLoglari?.length || 0}</strong></span>
                              {archive.evrakLoglari && (
                                <>
                                  <span className="text-slate-700">|</span>
                                  <span>E: <strong className="text-slate-805">{archive.evrakLoglari?.length || 0}</strong></span>
                                </>
                              )}
                            </div>

                            <button
                              onClick={() => setSelectedArchive(archive)}
                              className="bg-amber-600/10 hover:bg-amber-600 border border-amber-500/20 text-amber-700 hover:text-slate-950 text-[10px] font-black px-3.5 py-2 rounded-xl transition cursor-pointer"
                            >
                              Arşivi İncele
                            </button>
                            <button
                              type="button"
                              onClick={() => handleIndirNobetRaporHtml(archive)}
                              className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-3 py-2 rounded-xl transition cursor-pointer"
                            >
                              HTML Rapor
                            </button>
                          </div>
                        </div>
                      ))}

                    {nobetArsivleri.length === 0 && (
                      <div className="bg-slate-900/40 p-12 rounded-2xl border border-slate-200 text-center text-slate-500 italic text-xs">
                        Henüz sisteme kaydedilmiş hiçbir Nöbet Günü Arşivi bulunmuyor.
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 6: AKVİZYON TAŞERON YOKLAMA TAKİBİ
              ───────────────────────────────────────────────────────────── */}
          {activeTab === 'akvizyon_yoklama' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <GuvenlikTabDateBar
                islemTarihi={islemTarihi}
                onTarihChange={setIslemTarihi}
                tabLabel="Akvizyon Yoklama"
                logCount={Object.keys(akvizyonYoklamaMap).length}
                archivedCount={akvizyonArchives.filter((a) => a.tarih === islemTarihi).length}
                onGoster={() =>
                  handleGosterSeciliGun('Akvizyon Yoklama', Object.keys(akvizyonYoklamaMap).length)
                }
                onKaydet={handleSaveAkvizyonYoklama}
                kaydetLabel="Yoklamayı Kaydet"
                kaydetDisabled={!canSaveAkvizyonYoklama || akvizyonPersoneller.length === 0}
                kaydetLoading={loadingAkvizyonYoklama}
              />
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sol Panel: Yoklama Alım Formu */}
                <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                  <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">
                    📋 AKVİZYON TAŞERON YOKLAMA FORMU
                  </span>

                  {/* Tarih ve Yetki Uyarı Alanı */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Yoklama Tarihi:</span>
                      <span className="font-mono font-black text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20 text-xs">
                        {seciliTarihLabel}
                      </span>
                    </div>

                    {!canSaveAkvizyonYoklama && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start space-x-2 text-amber-800 text-[11px] leading-relaxed">
                        <Lock size={16} className="shrink-0 mt-0.5 animate-pulse" />
                        <p>
                          <strong>Görüntüleme Modu:</strong> Yoklama alma/kaydetme yetkisi <strong className="font-extrabold text-amber-950">Güvenlik, Kurucu ve Yönetici</strong> yetkilerine aittir. Diğer hesaplar sadece geçmiş kayıtları inceleyebilir.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleAkvizyonRaporIndir}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-xl cursor-pointer"
                      >
                        <Download size={12} /> Rapor İndir
                      </button>
                      <button
                        type="button"
                        onClick={handleAkvizyonWpRapor}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-xl cursor-pointer"
                      >
                        <MessageCircle size={12} /> WP Rapor
                      </button>
                    </div>
                  </div>

                  {/* Yoklama Listesi */}
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {akvizyonPersoneller.map((item) => {
                      const status = akvizyonYoklamaMap[item.id] || 'Girilmedi';
                      return (
                        <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex justify-between items-center gap-2 hover:border-slate-350 transition">
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-805 text-xs truncate">{item.ad} {item.soyad}</h4>
                            <span className="text-[9px] text-slate-500 block truncate font-mono mt-0.5">💼 {item.gorev}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={!canSaveAkvizyonYoklama}
                              onClick={() => setAkvizyonYoklamaMap(prev => ({ ...prev, [item.id]: 'Geldi' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[9px] transition cursor-pointer ${
                                status === 'Geldi' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              GELDİ
                            </button>
                            <button
                              type="button"
                              disabled={!canSaveAkvizyonYoklama}
                              onClick={() => setAkvizyonYoklamaMap(prev => ({ ...prev, [item.id]: 'Gelmedi' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-[9px] transition cursor-pointer ${
                                status === 'Gelmedi' ? 'bg-rose-600 text-white shadow-sm font-black' : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              GELMEDİ
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {akvizyonPersoneller.length === 0 && (
                      <div className="text-center p-6 text-slate-500 italic text-xs">
                        Akvizyon firmasına kayıtlı taşeron personel bulunamadı.
                      </div>
                    )}
                  </div>

                  {canSaveAkvizyonYoklama && akvizyonPersoneller.length > 0 && (
                    <button
                      onClick={handleSaveAkvizyonYoklama}
                      disabled={loadingAkvizyonYoklama}
                      className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 font-black text-xs py-3 rounded-2xl flex items-center justify-center space-x-1.5 border-b-2 border-amber-700 transition cursor-pointer shadow-md shadow-amber-500/10"
                    >
                      <Check size={13} />
                      <span>{loadingAkvizyonYoklama ? 'Kaydediliyor...' : 'YOKLAMAYI ARŞİVE KAYDET'}</span>
                    </button>
                  )}
                </div>

                {/* Sağ Panel: Geçmiş Arşivler & Personel Bazlı Arama */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Akvizyon Arşivi Listesi */}
                  <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                    <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">
                      📂 GEÇMİŞ AKVİZYON YOKLAMA ARŞİVLERİ
                    </span>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {akvizyonArchives.map((archive) => {
                        const presentCount = Object.values(archive.yoklama || {}).filter(v => v === 'Geldi').length;
                        const absentCount = Object.values(archive.yoklama || {}).filter(v => v === 'Gelmedi').length;
                        
                        return (
                          <div key={archive.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex justify-between items-center gap-4 hover:border-slate-350 transition">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <Calendar size={12} className="text-amber-500" />
                                <span className="font-bold text-xs text-slate-805 font-mono">{archive.tarih}</span>
                                <span className="text-[9px] text-slate-400 font-mono">Kaydeden: {archive.kaydeden}</span>
                              </div>
                              <div className="flex space-x-2 text-[9px] text-slate-500 font-mono font-bold">
                                <span>Geldi: <strong className="text-emerald-600">{presentCount}</strong></span>
                                <span>|</span>
                                <span>Gelmedi: <strong className="text-rose-600">{absentCount}</strong></span>
                              </div>
                            </div>

                            <button
                              onClick={() => setSelectedAkvizyonArchive(archive)}
                              className="bg-amber-600/10 hover:bg-amber-600 border border-amber-500/20 text-amber-400 hover:text-slate-950 text-[10px] font-black px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                            >
                              Detayları İncele
                            </button>
                          </div>
                        );
                      })}

                      {akvizyonArchives.length === 0 && (
                        <div className="text-center p-6 text-slate-500 italic text-xs">
                          Arşivlenmiş Akvizyon yoklama kaydı bulunmuyor.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personel Bazlı Yoklama Takip Havuzu */}
                  <div className="bg-white p-5 border border-slate-200 rounded-3xl space-y-4 shadow-sm">
                    <span className="font-display font-black text-xs text-slate-805 uppercase tracking-widest block border-b border-slate-200 pb-2">
                      👤 PERSONEL BAZLI YOKLAMA SİCİL GEÇMİŞİ
                    </span>

                    <div className="space-y-3.5">
                      <select 
                        value={selectedAkvizyonPersonel?.id || ''} 
                        onChange={(e) => {
                          const found = akvizyonPersoneller.find(p => p.id === e.target.value);
                          setSelectedAkvizyonPersonel(found || null);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-850"
                      >
                        <option value="">-- Geçmişini İncelemek İstediğiniz Personeli Seçin --</option>
                        {akvizyonPersoneller.map(p => (
                          <option key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</option>
                        ))}
                      </select>

                      {selectedAkvizyonPersonel && (() => {
                        const history = akvizyonArchives.map(a => {
                          const status = a.yoklama?.[selectedAkvizyonPersonel.id] || 'Girilmedi';
                          return { tarih: a.tarih, status, kaydeden: a.kaydeden };
                        }).filter(h => h.status !== 'Girilmedi');

                        const cameDays = history.filter(h => h.status === 'Geldi').length;
                        const totalDays = history.length;
                        const attendanceRate = totalDays > 0 ? Math.round((cameDays / totalDays) * 100) : 0;

                        return (
                          <div className="space-y-3 text-xs">
                            {/* İstatistik Özet Kartı */}
                            <div className="grid grid-cols-3 gap-2.5 text-slate-750 font-semibold font-mono text-center">
                              <div className="bg-slate-50 border border-slate-200/50 p-2 rounded-xl">
                                <span className="text-[9px] text-slate-500 block uppercase font-sans">GELDİĞİ GÜN</span>
                                <strong className="text-emerald-600 text-sm">{cameDays} Gün</strong>
                              </div>
                              <div className="bg-slate-50 border border-slate-200/50 p-2 rounded-xl">
                                <span className="text-[9px] text-slate-500 block uppercase font-sans">GELMEDİĞİ GÜN</span>
                                <strong className="text-rose-600 text-sm">{totalDays - cameDays} Gün</strong>
                              </div>
                              <div className="bg-slate-50 border border-slate-200/50 p-2 rounded-xl">
                                <span className="text-[9px] text-slate-500 block uppercase font-sans">DEVAMLILIK ORANI</span>
                                <strong className="text-indigo-500 text-sm">%{attendanceRate}</strong>
                              </div>
                            </div>

                            {/* Tarih Bazlı Ayrıntılı Liste */}
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                              {history.map((h, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 p-2 px-3.5 rounded-xl flex justify-between items-center">
                                  <span className="font-mono text-[11px] font-bold text-slate-805">{h.tarih}</span>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[9px] text-slate-400 font-mono">Kaydeden: {h.kaydeden}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                      h.status === 'Geldi' ? 'bg-emerald-100 text-emerald-850 font-extrabold' : 'bg-rose-100 text-rose-850 font-extrabold'
                                    }`}>
                                      {h.status.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {history.length === 0 && (
                                <div className="text-center py-4 text-slate-500 italic text-[11px]">
                                  Bu personel için henüz yoklama geçmişi bulunmuyor.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}
        </div>
      </div>

      {/* 📂 GÜVENLİK ARŞİVİ DETAY GÖRÜNTÜLEYİCİ MODAL */}
      {selectedArchive && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="bg-slate-50 p-5 px-6 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                  <Archive size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest">NÖBET DEFTERİ GÜVENLİK KAYITLARI DETAYI</h3>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">Tarih: <strong className="text-amber-400">{selectedArchive.tarih}</strong> | Arşivleyen: {selectedArchive.kaydeden}</p>
                </div>
              </div>

              <button 
                onClick={() => setSelectedArchive(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white rounded-xl p-2 cursor-pointer transition"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Scrollable Workspace */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Not */}
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl">
                <span className="font-bold text-[9px] block uppercase text-amber-500 tracking-wider mb-1">NÖBET AMİRİ DEVİR NOTU</span>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  "{selectedArchive.notlar || 'Açıklama belirtilmemiş.'}"
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Personel Giriş Çıkış Kayıtları */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1.5">
                    👥 PERSONEL GİRİŞ-ÇIKIŞ LOGLARI ({selectedArchive.personelLoglari?.length || 0})
                  </span>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {selectedArchive.personelLoglari?.map((log: any, idx: number) => (
                      <div key={log.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-805">{log.ad} {log.soyad}</span>
                          <span className="text-[9px] text-slate-500 block uppercase">{log.gorev}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded ${log.tip === 'GİRİŞ' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                            {log.tip}
                          </span>
                          <span className="text-[9px] text-slate-500 block font-mono mt-0.5">{new Date(log.zaman).toLocaleTimeString('tr-TR')}</span>
                        </div>
                      </div>
                    ))}
                    {(!selectedArchive.personelLoglari || selectedArchive.personelLoglari.length === 0) && (
                      <p className="text-[11px] text-slate-500 italic">Bugün hiçbir personel giriş-çıkış işlemi kaydedilmedi.</p>
                    )}
                  </div>
                </div>

                {/* 2. Araç Giriş Çıkış Kayıtları */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1.5">
                    🚛 ARAÇ HAREKET KAYITLARI ({selectedArchive.aracLoglari?.length || 0})
                  </span>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {selectedArchive.aracLoglari?.map((arac: any, idx: number) => (
                      <div key={arac.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-black text-amber-400 uppercase">{arac.plaka}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${arac.durum === 'İÇERİDE' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'}`}>
                            {arac.durum}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-350">{arac.surucuAdi} | {arac.firma} ({arac.aracTipi})</p>
                        <div className="flex justify-between text-[9px] text-slate-550 font-mono">
                          <span>Giriş: {arac.girisZamani ? new Date(arac.girisZamani).toLocaleTimeString('tr-TR') : '-'}</span>
                          <span>Çıkış: {arac.cikisZamani ? new Date(arac.cikisZamani).toLocaleTimeString('tr-TR') : '-'}</span>
                        </div>
                      </div>
                    ))}
                    {(!selectedArchive.aracLoglari || selectedArchive.aracLoglari.length === 0) && (
                      <p className="text-[11px] text-slate-500 italic">Bugün hiçbir araç giriş-çıkış işlemi kaydedilmedi.</p>
                    )}
                  </div>
                </div>

                {/* 3. Ziyaretçi Defteri Kayıtları */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1.5">
                    🎫 ZİYARETÇİ DEFTERİ KAYITLARI ({selectedArchive.ziyaretciLoglari?.length || 0})
                  </span>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {selectedArchive.ziyaretciLoglari?.map((guest: any, idx: number) => (
                      <div key={guest.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-805">{guest.adSoyad}</span>
                          <span className="font-mono text-[9px] text-amber-500">{guest.kartNo}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Görüşülen Yetkili: <strong className="text-slate-600">{guest.ziyaretEdilen}</strong></p>
                        <p className="text-[10px] text-slate-500">{guest.firma} | {guest.ziyaretSebebi}</p>
                        <div className="flex justify-between text-[9px] text-slate-550 font-mono pt-1">
                          <span>Giriş: {guest.girisZamani ? new Date(guest.girisZamani).toLocaleTimeString('tr-TR') : '-'}</span>
                          <span>Çıkış: {guest.cikisZamani ? new Date(guest.cikisZamani).toLocaleTimeString('tr-TR') : '-'}</span>
                        </div>
                      </div>
                    ))}
                    {(!selectedArchive.ziyaretciLoglari || selectedArchive.ziyaretciLoglari.length === 0) && (
                      <p className="text-[11px] text-slate-500 italic">Bugün hiçbir ziyaretçi kaydı bulunmuyor.</p>
                    )}
                  </div>
                </div>

                {/* 4. Teslim Alınan Evrak Kayıtları */}
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="font-bold text-[10px] text-slate-500 uppercase tracking-widest block border-b border-slate-200 pb-1.5">
                    📦 TESLİM ALINAN EVRAKLAR &amp; TESLİMATLAR ({selectedArchive.evrakLoglari?.length || 0})
                  </span>

                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {selectedArchive.evrakLoglari?.map((evr: any, idx: number) => (
                      <div key={evr.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-amber-400 uppercase font-mono">{evr.evrakNo}</span>
                          <span className="bg-slate-50 text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded">
                            {evr.evrakTuru}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-350">{evr.firma}</p>
                        {evr.kalemler && evr.kalemler.length > 0 && (
                          <div className="bg-slate-50 p-1 px-2 rounded text-[10px] text-slate-500 font-mono">
                            {evr.kalemler.map((k: any) => `${k.urunAdi} (${k.miktar} ${k.birim})`).join(', ')}
                          </div>
                        )}
                        <span className="text-[9px] font-mono text-slate-550 block mt-1">Giriş Saati: {evr.saat}</span>
                      </div>
                    ))}
                    {(!selectedArchive.evrakLoglari || selectedArchive.evrakLoglari.length === 0) && (
                      <p className="text-[11px] text-slate-500 italic">Bugün hiçbir evrak/teslimat kaydı bulunmuyor.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => handleArchivedNobetRaporuAl(selectedArchive)}
                className="bg-indigo-650 hover:bg-indigo-750 text-white font-extrabold px-5 py-2 rounded-xl text-xs flex items-center space-x-1.5 cursor-pointer transition shadow-md shadow-indigo-600/10"
              >
                <Download size={13} />
                <span>PDF Rapor İndir</span>
              </button>
              <button
                onClick={() => setSelectedArchive(null)}
                className="bg-slate-850 hover:bg-slate-750 text-white font-bold px-6 py-2 rounded-xl text-xs cursor-pointer border border-slate-700"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 📂 AKVİZYON YOKLAMA DETAY MODAL */}
      {selectedAkvizyonArchive && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in duration-150">
            
            <div className="bg-slate-50 p-5 px-6 border-b border-slate-200 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <ClipboardList className="text-amber-500" size={18} />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-850">Akvizyon Yoklama Detayı</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Tarih: {selectedAkvizyonArchive.tarih} | Kaydeden: {selectedAkvizyonArchive.kaydeden}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAkvizyonArchive(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-500 hover:text-slate-700 rounded-xl p-1.5 cursor-pointer transition"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-2">
                <span className="font-bold text-[9px] block uppercase text-amber-500 tracking-wider">Yoklama Sonuçları</span>
                <div className="divide-y divide-slate-200 text-slate-700">
                  {akvizyonPersoneller.map(p => {
                    const status = selectedAkvizyonArchive.yoklama?.[p.id] || 'Girilmedi';
                    return (
                      <div key={p.id} className="py-2.5 flex justify-between items-center">
                        <div>
                          <strong className="text-slate-805 block text-xs">{p.ad} {p.soyad}</strong>
                          <span className="text-[9px] text-slate-500 font-mono uppercase">{p.gorev}</span>
                        </div>
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg ${
                          status === 'Geldi' ? 'bg-emerald-100 text-emerald-850' : 'bg-rose-100 text-rose-850'
                        }`}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedAkvizyonArchive(null)}
                className="bg-slate-805 hover:bg-slate-750 text-white font-bold px-6 py-2 rounded-xl text-xs cursor-pointer"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 💳 VISITOR BADGE MODAL / GİRİŞ KARTI */}
      {activeBadgeGuest && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-slate-900 rounded-3xl w-80 overflow-hidden shadow-2xl border border-slate-200 flex flex-col p-5 animate-in zoom-in duration-150 print:shadow-none">
            <CorporateReportLayout orientation="portrait" docCode={`KART: ${activeBadgeGuest.kartNo}`}>
            <p className="text-[10px] text-slate-500 font-mono text-center mb-3">ŞANTİYE RESMİ GÜVENLİK GİRİŞ KARTI</p>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border">
                <span className="text-[9px] font-bold text-slate-500 uppercase">KART NO:</span>
                <span className="font-mono font-black text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">{activeBadgeGuest.kartNo}</span>
              </div>

              <div className="space-y-1.5 border-b pb-3">
                <p className="flex justify-between">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">ZİYARETÇİ:</span>
                  <span className="font-black text-slate-800 text-[11px] uppercase">{activeBadgeGuest.adSoyad}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">TC/KİMLİK:</span>
                  <span className="font-mono text-slate-700">{activeBadgeGuest.tcNo}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">FİRMA:</span>
                  <span className="font-bold text-slate-700">{activeBadgeGuest.firma}</span>
                </p>
              </div>

              <div className="space-y-1.5 pt-1 text-[11px]">
                <p className="flex justify-between">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">GÖRÜŞÜLECEK:</span>
                  <span className="font-bold text-slate-800">{activeBadgeGuest.ziyaretEdilen}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">GİRİŞ SAATİ:</span>
                  <span className="font-mono text-slate-600">{new Date(activeBadgeGuest.girisZamani).toLocaleTimeString('tr-TR')}</span>
                </p>
              </div>
            </div>

            {/* Fake Barcode visualization */}
            <div className="flex flex-col items-center justify-center py-2 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <Barcode size={32} className="text-slate-750 stroke-[1.2]" />
              <span className="text-[8px] font-mono tracking-[4px] text-slate-500 uppercase">{activeBadgeGuest.kartNo}</span>
            </div>

            </CorporateReportLayout>

            {/* Actions */}
            <div className="flex space-x-2 pt-2 text-xs print:hidden">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-slate-50 hover:bg-slate-800 active:scale-95 text-white font-black py-2 rounded-xl border-b-2 border-slate-950 cursor-pointer flex items-center justify-center space-x-1"
              >
                <Printer size={12} />
                <span>Yazdır</span>
              </button>

              <button
                type="button"
                onClick={() => handleZiyaretciWhatsApp(activeBadgeGuest)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl cursor-pointer flex items-center justify-center space-x-1"
              >
                <MessageCircle size={12} />
                <span>WP</span>
              </button>
              
              <button
                onClick={() => setActiveBadgeGuest(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-4 py-2 rounded-xl border"
              >
                Kapat
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );

  if (!isStandalone && viewMode === 'mobile') {
    return (
      <div className="flex-1 bg-white flex justify-center py-6 px-4 overflow-hidden min-h-screen">
        <div className="w-full max-w-[420px] h-[720px] max-h-[82vh] bg-slate-50 rounded-[3rem] border-[10px] border-slate-200 shadow-2xl overflow-hidden flex flex-col relative">
          {/* Notch / Dynamic Island */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800 mr-2"></div>
            <div className="w-10 h-0.5 bg-slate-50 rounded"></div>
          </div>
          <div className="flex-grow flex flex-col overflow-hidden pt-4">
            {mainLayout}
          </div>
        </div>
      </div>
    );
  }

  return mainLayout;
};

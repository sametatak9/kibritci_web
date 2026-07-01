import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Tent, Plus, Trash2, Camera, Check, RefreshCw, Eye, 
  Search, UserPlus, ClipboardList, Package, Layers, MapPin, Sparkles, CheckCircle, Clock, X, ArrowRight, ShieldCheck, DoorOpen, LogOut, Image as ImageIcon, MessageSquare, Calendar
} from 'lucide-react';
import { KampOdasi, KampKaydi, Personel, StokKart, KampYerleske, KampKat, CariKart, AylikYoklamaMap } from '../types/erp';
import { db, saveDocument } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';
import { createKampYerleske, createKampKat, katsForYerleske, createKampOdasi, deleteKampOdasi, hasLegacySeedRooms, purgeLegacyKampData, purgeAllKampData } from '../lib/kampYapisi';
import { assignKampResident, evictKampResident, suggestPersonelKaydi } from '../lib/kampPlacementUtils';
import { isProductionLive } from '../lib/productionDataGuard';
import { buildKampciGunlukOzet } from '../lib/gunlukAkisUtils';
import { buildWhatsAppUrl } from '../lib/mobilOnayUtils';
import { KampHaftalikYoklamaTab } from './KampHaftalikYoklamaTab';
import { collection, onSnapshot, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';

interface KampciScreenProps {
  kampOdalari: KampOdasi[];
  setKampOdalari: React.Dispatch<React.SetStateAction<KampOdasi[]>>;
  kampKayitlari: KampKaydi[];
  setKampKayitlari: React.Dispatch<React.SetStateAction<KampKaydi[]>>;
  kampYerleskeleri?: KampYerleske[];
  kampKatlari?: KampKat[];
  personeller: Personel[];
  cariKartlar?: CariKart[];
  yoklamalar?: AylikYoklamaMap;
  setYoklamalar?: (updater: AylikYoklamaMap | ((y: AylikYoklamaMap) => AylikYoklamaMap)) => void;
  stokKartlar?: StokKart[];
  currentUser: any;
  onSignOut?: () => void;
  isStandalone?: boolean;
  addNotification?: (mesaj: string) => void;
}

export const KampciScreen: React.FC<KampciScreenProps> = ({
  kampOdalari,
  setKampOdalari,
  kampKayitlari,
  setKampKayitlari,
  kampYerleskeleri = [],
  kampKatlari = [],
  personeller,
  cariKartlar = [],
  yoklamalar = {},
  setYoklamalar,
  stokKartlar = [],
  currentUser,
  onSignOut,
  isStandalone = false,
  addNotification
}) => {
  // Tabs: 'rooms' | 'placement' | 'warehouse' | 'activities' | 'haftalik_yoklama' | ...
  const [activeSubTab, setActiveSubTab] = useState<'rooms' | 'placement' | 'warehouse' | 'activities' | 'gunluk_akis' | 'personel_giris' | 'haftalik_yoklama'>('placement');
  const [sendingKampAkis, setSendingKampAkis] = useState(false);
  const [viewMode, setViewMode] = useState<'web' | 'mobile'>('web');

  // ─────────────────────────────────────────────────────────────
  // STATUS / ALERTS STATE
  // ─────────────────────────────────────────────────────────────
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const statusHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (type: 'success' | 'error' | 'info', text: string, autoHideMs = 4000) => {
    if (statusHideTimer.current) clearTimeout(statusHideTimer.current);
    setStatusMessage({ type, text });
    if (type !== 'info' && autoHideMs > 0) {
      statusHideTimer.current = setTimeout(() => setStatusMessage(null), autoHideMs);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🏕️ 1. YERLEŞKE / KAT / ODA — App seviyesinde Firestore dinleyicisi ile senkron
  // ─────────────────────────────────────────────────────────────
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [selectedYerleskeId, setSelectedYerleskeId] = useState('');
  const [selectedKatId, setSelectedKatId] = useState('');
  const [newYerleskeAd, setNewYerleskeAd] = useState('');
  const [newKatAd, setNewKatAd] = useState('');
  const [odaNo, setOdaNo] = useState('');
  const [kapasite, setKapasite] = useState<number>(4);
  const [firmaTipi, setFirmaTipi] = useState<'ANA_FIRMA' | 'TASERON'>('ANA_FIRMA');
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [loadingYapı, setLoadingYapı] = useState(false);
  const [clearingLegacy, setClearingLegacy] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const legacySeedRooms = hasLegacySeedRooms(kampOdalari);

  useEffect(() => {
    if (!clearingAll && !clearingLegacy) return;
    const safety = setTimeout(() => {
      setClearingAll(false);
      setClearingLegacy(false);
      showStatus('error', 'İşlem çok uzun sürdü. Sayfayı yenileyip tekrar deneyin.');
    }, 95_000);
    return () => clearTimeout(safety);
  }, [clearingAll, clearingLegacy]);

  const yerleskeler = kampYerleskeleri;
  const katlar = kampKatlari;

  const taseronCariler = cariKartlar.filter((c) => c.kartTipi === 'TASERON' && c.durum === 'AKTIF');
  const [placementFirmaTipi, setPlacementFirmaTipi] = useState<'ANA_FIRMA' | 'TASERON'>('ANA_FIRMA');

  const selectedYerleske = yerleskeler.find(y => y.id === selectedYerleskeId);
  const selectedKat = katlar.find(k => k.id === selectedKatId);
  const yerleskeKatlari = selectedYerleskeId ? katsForYerleske(katlar, selectedYerleskeId) : [];

  // ─────────────────────────────────────────────────────────────
  // 👥 2. YERLEŞİM (CHECK-IN / OUT) STATE
  // ─────────────────────────────────────────────────────────────
  const [placementYerleskeId, setPlacementYerleskeId] = useState('');
  const [placementKatId, setPlacementKatId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const placementYerleskeOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const room of kampOdalari) {
      const key = room.yerleskeId || room.yerleskeAdi;
      if (key) seen.set(key, room.yerleskeAdi);
    }
    return [...seen.entries()]
      .map(([id, ad]) => ({ id, ad }))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }, [kampOdalari]);

  const placementKatOptions = useMemo(() => {
    if (!placementYerleskeId) return [] as KampKat[];
    const yerleske = placementYerleskeOptions.find(y => y.id === placementYerleskeId);
    const yerleskeAd = yerleske?.ad || '';
    const yerleskeRecord = yerleskeler.find(y => y.id === placementYerleskeId || y.ad === yerleskeAd);

    if (yerleskeRecord) {
      const kats = katsForYerleske(katlar, yerleskeRecord.id).filter(k =>
        kampOdalari.some(r =>
          (r.yerleskeId === yerleskeRecord.id || r.yerleskeAdi === yerleskeRecord.ad) &&
          (r.katId === k.id || r.kogusNo === k.ad)
        )
      );
      if (kats.length > 0) {
        return kats.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));
      }
    }

    const seen = new Map<string, string>();
    kampOdalari
      .filter(r => r.yerleskeId === placementYerleskeId || r.yerleskeAdi === yerleskeAd)
      .forEach(r => {
        const key = r.katId || r.kogusNo;
        if (key) seen.set(key, r.kogusNo);
      });

    return [...seen.entries()]
      .map(([id, ad]) => ({
        id,
        ad,
        yerleskeId: placementYerleskeId,
        yerleskeAdi: yerleskeAd,
        sira: 0,
        olusturmaTarihi: '',
      }))
      .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  }, [placementYerleskeId, kampOdalari, katlar, yerleskeler, placementYerleskeOptions]);

  const placementOdaOptions = useMemo(() => {
    if (!placementYerleskeId || !placementKatId) return [];
    const yerleske = placementYerleskeOptions.find(y => y.id === placementYerleskeId);
    const kat = placementKatOptions.find(k => k.id === placementKatId);
    if (!yerleske || !kat) return [];

    return kampOdalari
      .filter(r => {
        const yerleskeMatch = r.yerleskeId === placementYerleskeId || r.yerleskeAdi === yerleske.ad;
        const katMatch = r.katId === placementKatId || r.kogusNo === kat.ad;
        return yerleskeMatch && katMatch;
      })
      .sort((a, b) => a.odaNo.localeCompare(b.odaNo, 'tr', { numeric: true }));
  }, [placementYerleskeId, placementKatId, kampOdalari, placementYerleskeOptions, placementKatOptions]);
  const [placementType, setPlacementType] = useState<'DB' | 'MANUAL'>('DB');
  const [selectedPersonelId, setSelectedPersonelId] = useState('');
  const [manualPersonelIsim, setManualPersonelIsim] = useState('');
  const [searchPersonelQuery, setSearchPersonelQuery] = useState('');
  const [firmaType, setFirmaType] = useState<'DB' | 'MANUAL'>('DB');
  const [selectedFirma, setSelectedFirma] = useState('');
  const [manualFirma, setManualFirma] = useState('');
  const [loadingPlacement, setLoadingPlacement] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 📦 3. DEPO SAYIMI (WAREHOUSE AUDIT) STATE
  // ─────────────────────────────────────────────────────────────
  const [searchRoomQuery, setSearchRoomQuery] = useState('');
  const [depoSavimlari, setDepoSayimlari] = useState<any[]>([]);
  const [loadingSayim, setLoadingSayim] = useState(false);
  const [sayimNotlar, setSayimNotlar] = useState('');

  // Fixed core inventory items to count easily
  const initialSayimMiktarlari: Record<string, number> = {
    'Nevresim Takımı': 0,
    'Battaniye': 0,
    'Yastık': 0,
    'Sünger Yatak': 0,
    'Sıvı Sabun (Litre)': 0,
    'Çamaşır Deterjanı (Kg)': 0,
    'Tuvalet Kağıdı (Rulo)': 0,
    'LED Ampul': 0,
  };
  const [sayimMiktarlari, setSayimMiktarlari] = useState<Record<string, number>>(initialSayimMiktarlari);

  // Sync sayimMiktarlari with real stock cards
  useEffect(() => {
    if (stokKartlar && stokKartlar.length > 0) {
      const dynamicMiktarlar: Record<string, number> = {};
      stokKartlar.forEach(item => {
        const ad = item.stokAdi || item.urunAdi || 'Stok';
        dynamicMiktarlar[ad] = 0;
      });
      setSayimMiktarlari(dynamicMiktarlar);
    }
  }, [stokKartlar]);

  // ─────────────────────────────────────────────────────────────
  // 🧹 4. GÜNLÜK FAALİYETLER STATE
  // ─────────────────────────────────────────────────────────────
  const [gunlukFaaliyetler, setGunlukFaaliyetler] = useState<any[]>([]);
  const [faaliyetTipi, setFaaliyetTipi] = useState<'TEMİZLİK' | 'YEMEK' | 'GÜVENLİK' | 'BAKIM' | 'DİĞER'>('TEMİZLİK');
  const [faaliyetYerleske, setFaaliyetYerleske] = useState('');
  const [faaliyetAciklama, setFaaliyetAciklama] = useState('');
  const [faaliyetFoto, setFaaliyetFoto] = useState<string | null>(null);
  const [loadingFaaliyet, setLoadingFaaliyet] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // 🚪 PERSONEL GİRİŞE YOLLA (Formen ile aynı onay akışı)
  // ─────────────────────────────────────────────────────────────
  const [yeniAd, setYeniAd] = useState('');
  const [yeniSoyad, setYeniSoyad] = useState('');
  const [yeniGorev, setYeniGorev] = useState('');
  const [yeniKimlikFoto, setYeniKimlikFoto] = useState<string | null>(null);
  const [sonGirisTalebi, setSonGirisTalebi] = useState<{ id: string; ad: string; soyad: string; gorev: string } | null>(null);
  const [girisTalepleriList, setGirisTalepleriList] = useState<any[]>([]);

  // Real-time Firestore subscriptions for custom collections
  useEffect(() => {
    // 1. Warehouse counts
    const countsColl = collection(db, 'kampDepoSayimlari');
    const unsubCounts = onSnapshot(countsColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date desc
      list.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
      setDepoSayimlari(list);
    });

    // 2. Daily activities
    const actsColl = collection(db, 'kampGunlukFaaliyetleri');
    const unsubActs = onSnapshot(actsColl, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date desc
      list.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
      setGunlukFaaliyetler(list);
    });

    // 3. Personel giriş talepleri
    const girisColl = collection(db, 'personelGirisTalepleri');
    const unsubGiris = onSnapshot(girisColl, (snap) => {
      const list: any[] = [];
      const email = currentUser?.email?.toLowerCase() || '';
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        const sender = String(data.gonderenKampci || data.gonderenFormen || '').toLowerCase();
        if (sender === email && (data.kaynakPanel === 'KAMPÇI' || data.gonderenKampci)) {
          list.push(data);
        }
      });
      list.sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime());
      setGirisTalepleriList(list);
    });

    return () => {
      unsubCounts();
      unsubActs();
      unsubGiris();
    };
  }, [currentUser?.email]);

  useEffect(() => {
    if (yerleskeler.length > 0 && !selectedYerleskeId) {
      setSelectedYerleskeId(yerleskeler[0].id);
    }
    if (yerleskeler.length > 0 && !faaliyetYerleske) {
      setFaaliyetYerleske(yerleskeler[0].ad);
    }
  }, [yerleskeler, selectedYerleskeId, faaliyetYerleske]);

  useEffect(() => {
    const kats = selectedYerleskeId ? katsForYerleske(katlar, selectedYerleskeId) : [];
    if (kats.length > 0 && !kats.some(k => k.id === selectedKatId)) {
      setSelectedKatId(kats[0].id);
    }
    if (kats.length === 0) setSelectedKatId('');
  }, [selectedYerleskeId, katlar, selectedKatId]);

  const handleCreateYerleske = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newYerleskeAd.trim()) return;
    setLoadingYapı(true);
    try {
      const y = await createKampYerleske(newYerleskeAd, currentUser?.email);
      setSelectedYerleskeId(y.id);
      setNewYerleskeAd('');
      setSetupStep(2);
      showStatus('success', `Yerleşke "${y.ad}" oluşturuldu. Şimdi kat ekleyin.`);
    } catch (err) {
      showStatus('error', 'Yerleşke oluşturulamadı.');
    } finally {
      setLoadingYapı(false);
    }
  };

  const handleCreateKat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYerleske || !newKatAd.trim()) return;
    setLoadingYapı(true);
    try {
      const k = await createKampKat(selectedYerleske, newKatAd, yerleskeKatlari.length + 1);
      setSelectedKatId(k.id);
      setNewKatAd('');
      setSetupStep(3);
      showStatus('success', `Kat "${k.ad}" eklendi. Oda tanımlayabilirsiniz.`);
    } catch (err) {
      showStatus('error', 'Kat oluşturulamadı.');
    } finally {
      setLoadingYapı(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🏕️ ACTIONS: ROOM MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!odaNo || !selectedYerleske || !selectedKat) {
      showStatus('error', 'Önce yerleşke ve kat seçin, oda numarası girin.');
      return;
    }

    setLoadingRoom(true);
    try {
      const savedOdaNo = odaNo;
      await createKampOdasi({
        yerleskeAdi: selectedYerleske.ad,
        kogusNo: selectedKat.ad,
        odaNo: savedOdaNo,
        kapasite: Number(kapasite),
        firmaTipi,
        yerleskeId: selectedYerleske.id,
        katId: selectedKat.id,
        olusturan: currentUser?.email,
      });
      if (addNotification) {
        addNotification(`${selectedYerleske.ad} / ${selectedKat.ad} - Oda ${savedOdaNo} açıldı.`);
      }
      setOdaNo('');
      showStatus('success', `Oda ${savedOdaNo} başarıyla açıldı.`);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Oda oluşturulurken hata oluştu!');
    } finally {
      setLoadingRoom(false);
    }
  };

  const handleClearLegacyRooms = async () => {
    if (
      !window.confirm(
        'Örnek/demo odalar kalıcı silinecek ve Firestore\'a boş hali kaydedilecek. Devam edilsin mi?'
      )
    ) {
      return;
    }
    setClearingLegacy(true);
    showStatus('info', 'Örnek odalar siliniyor, lütfen bekleyin…', 0);
    try {
      const result = await purgeLegacyKampData(currentUser?.email);
      if (result.roomIds.length === 0 && legacySeedRooms) {
        showStatus('error', 'Örnek oda eşleşmedi. Tüm kampı sıfırlamayı deneyin.');
      } else {
        const msg = `✅ ${result.roomIds.length} örnek oda silindi. Sayfa yenilense bile geri gelmez.`;
        showStatus('success', msg, 8000);
        window.alert(msg);
      }
    } catch (err) {
      console.error(err);
      showStatus('error', err instanceof Error ? err.message : 'Örnek odalar silinemedi.');
    } finally {
      setClearingLegacy(false);
    }
  };

  const handlePurgeAllKamp = async () => {
    const msg = 'Tüm kamp verisi (yerleşke, kat, oda, konaklama) kalıcı silinecek.';
    if (isProductionLive()) {
      const typed = window.prompt(`${msg}\n\nCanlı sistem. Silmek için SIFIRLA yazın:`);
      if (typed?.trim() !== 'SIFIRLA') return;
    } else if (!window.confirm(`${msg} Devam edilsin mi?`)) {
      return;
    }
    setClearingAll(true);
    showStatus('info', 'Kamp verisi sıfırlanıyor, lütfen bekleyin…', 0);
    try {
      const counts = await purgeAllKampData();
      setSelectedYerleskeId('');
      setSelectedKatId('');
      setPlacementYerleskeId('');
      setPlacementKatId('');
      setSelectedRoomId('');
      const msg =
        `✅ Kamp başarıyla sıfırlandı!\n\n` +
        `${counts.yerleskeler} yerleşke, ${counts.katlar} kat, ${counts.odalar} oda, ${counts.kayitlar} konaklama kaydı silindi.`;
      showStatus('success', '✅ Kamp verisi başarıyla sıfırlandı.', 8000);
      window.alert(msg);
    } catch (err) {
      console.error(err);
      showStatus('error', err instanceof Error ? err.message : 'Kamp verisi sıfırlanamadı.');
    } finally {
      setClearingAll(false);
    }
  };

  const handleDeleteRoom = async (id: string, name: string) => {
    if (!window.confirm(`${name} numaralı odayı silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteKampOdasi(id);
      if (addNotification) {
        addNotification(`${name} nolu oda silindi.`);
      }
      showStatus('success', 'Oda silindi.');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Oda silinemedi.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 👥 ACTIONS: PERSONNEL PLACEMENT
  // ─────────────────────────────────────────────────────────────
  const handlePlacementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placementYerleskeId || !placementKatId || !selectedRoomId) {
      showStatus('error', 'Lütfen sırayla yerleşke, kat ve oda seçin!');
      return;
    }

    let personelIsim = '';
    let personelId: string | undefined = undefined;

    if (placementType === 'DB') {
      if (!selectedPersonelId) {
        showStatus('error', 'Lütfen veritabanından bir personel seçin!');
        return;
      }
      const matched = personeller.find(p => p.id === selectedPersonelId);
      if (matched) {
        personelIsim = `${matched.ad} ${matched.soyad}`;
        personelId = matched.id;
      }
    } else {
      if (!manualPersonelIsim.trim()) {
        showStatus('error', 'Lütfen personel adını soyadını yazın!');
        return;
      }
      personelIsim = manualPersonelIsim.trim();
    }

    let resolvedFirma = '';
    if (placementFirmaTipi === 'ANA_FIRMA') {
      resolvedFirma = 'Ana Firma';
    } else if (firmaType === 'DB') {
      resolvedFirma = selectedFirma || '';
    } else {
      resolvedFirma = manualFirma.trim();
    }

    const targetRoom = kampOdalari.find(r => r.id === selectedRoomId);
    if (!targetRoom) {
      showStatus('error', 'Oda bulunamadı!');
      return;
    }

    if (placementFirmaTipi === 'TASERON' && !resolvedFirma) {
      showStatus('error', 'Taşeron personel için firma bilgisi zorunludur.');
      return;
    }

    setLoadingPlacement(true);
    try {
      await assignKampResident({
        roomId: selectedRoomId,
        personelIsim,
        personelId,
        calistigiFirma: resolvedFirma || undefined,
        firmaTipi: placementFirmaTipi,
        kampOdalari,
        kampKayitlari,
      });

      if (addNotification) {
        addNotification(`${personelIsim} (${resolvedFirma}) ${targetRoom.odaNo} nolu odaya yerleştirildi.`);
      }

      if (placementType === 'MANUAL' && placementFirmaTipi === 'TASERON') {
        suggestPersonelKaydi(personelIsim, resolvedFirma);
      }

      setSelectedPersonelId('');
      setManualPersonelIsim('');
      setSelectedFirma('');
      setManualFirma('');
      showStatus('success', `${personelIsim} başarıyla ${targetRoom.odaNo} no'lu odaya yerleştirildi.`);
    } catch (err) {
      console.error(err);
      showStatus('error', err instanceof Error ? err.message : 'Yerleşim yapılırken hata oluştu!');
    } finally {
      setLoadingPlacement(false);
    }
  };

  const handleCheckOut = async (reg: KampKaydi) => {
    if (!window.confirm(`${reg.personelIsim} isimli personeli odadan çıkarmak (Check-out) istediğinize emin misiniz?`)) return;

    try {
      const targetRoom = kampOdalari.find(r => r.id === reg.odaId || r.id === reg.roomId);
      await evictKampResident(reg, kampOdalari, kampKayitlari);
      if (addNotification) {
        const roomNo = targetRoom ? targetRoom.odaNo : 'oda';
        addNotification(`${reg.personelIsim} ${roomNo} nolu odadan çıkış yaptı.`);
      }
      showStatus('success', `${reg.personelIsim} odadan çıkarıldı.`);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Check-out işlemi başarısız!');
    }
  };

  const handleEvacuateRoom = async (roomId: string) => {
    const targetRoom = kampOdalari.find(r => r.id === roomId);
    if (!targetRoom) return;

    const occupants = kampKayitlari.filter(
      k => (k.odaId === roomId || k.roomId === roomId) && k.durum === 'AKTIF'
    );

    if (occupants.length === 0) {
      showStatus('error', 'Bu oda zaten boş!');
      return;
    }

    if (!window.confirm(`${targetRoom.odaNo} numaralı odadaki TÜM personelleri (${occupants.length} kişi) tahliye etmek istediğinize emin misiniz?`)) return;

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const reg of occupants) {
        const updatedReg: KampKaydi = {
          ...reg,
          durum: 'PASIF',
          cikisTarihi: todayStr
        };
        await saveDocument('kampKayitlari', updatedReg);
      }
      if (addNotification) {
        addNotification(`${targetRoom.odaNo} nolu odadaki tüm personeller (${occupants.length} kişi) tahliye edildi.`);
      }

      const updatedRoom: KampOdasi = {
        ...targetRoom,
        durum: 'BOŞ'
      };
      await saveDocument('kampOdalari', updatedRoom);

      showStatus('success', `${targetRoom.odaNo} numaralı odadaki tüm personeller tahliye edildi.`);
    } catch (err) {
      console.error(err);
      showStatus('error', 'Oda tahliye edilirken hata oluştu.');
    }
  };

  const handleSelectRoomForPlacement = (roomId: string) => {
    setSelectedRoomId(roomId);
    setActiveSubTab('placement');
    showStatus('success', 'Oda seçildi. Şimdi personeli seçerek kampa yerleştirebilirsiniz.');
  };

  // ─────────────────────────────────────────────────────────────
  // 📦 ACTIONS: WAREHOUSE AUDIT (DEPO SAYIMI)
  // ─────────────────────────────────────────────────────────────
  const handleQuantityChange = (item: string, val: string) => {
    const num = val === '' ? 0 : Number(val);
    setSayimMiktarlari(prev => ({ ...prev, [item]: num }));
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingSayim(true);

    try {
      const sayimId = `sayim_${Date.now()}`;
      const list = Object.entries(sayimMiktarlari).map(([urunAdi, miktar]) => ({
        urunAdi,
        miktar,
        birim: urunAdi.includes('Litre') ? 'Litre' : urunAdi.includes('Kg') ? 'Kg' : urunAdi.includes('Rulo') ? 'Rulo' : 'Adet'
      }));

      const auditData = {
        id: sayimId,
        tarih: new Date().toISOString().slice(0, 10),
        sayimYapan: currentUser?.email || 'kampci_amiri',
        kaydeden: currentUser?.email || 'kampci_amiri',
        kalemler: list,
        durum: 'ONAY BEKLİYOR',
        onaylayanIdariIsler: null,
        onaylayanMuhasebe: null,
        notlar: sayimNotlar || 'Aylık rutin kamp amirliği sayımı.'
      };

      await saveDocument('kampDepoSayimlari', auditData);
      if (addNotification) {
        addNotification(`Yeni kamp depo sayım raporu (${auditData.tarih}) oluşturuldu.`);
      }
      
      // Reset
      setSayimMiktarlari(initialSayimMiktarlari);
      setSayimNotlar('');
      showStatus('success', 'Kamp deposu sayımı kaydedildi ve İdari İşler & Muhasebe onay havuzuna gönderildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Depo sayımı kaydedilemedi.');
    } finally {
      setLoadingSayim(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🧹 ACTIONS: DAILY ROUTINE ACTIVITIES (GÜNLÜK FAALİYET)
  // ─────────────────────────────────────────────────────────────
  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faaliyetAciklama.trim()) {
      showStatus('error', 'Lütfen faaliyet açıklamasını doldurun!');
      return;
    }

    setLoadingFaaliyet(true);
    try {
      const actId = `act_${Date.now()}`;
      const actData = {
        id: actId,
        tarih: new Date().toISOString().slice(0, 10),
        kaydeden: currentUser?.email || 'kamp_sorumlusu',
        faaliyetTipi,
        yerleskeAdi: faaliyetYerleske,
        aciklama: faaliyetAciklama.trim(),
        fotoUrl: faaliyetFoto || null,
        durum: 'ONAY BEKLİYOR',
        onaylayanIdariIsler: null,
        onaylayanMuhasebe: null
      };

      await saveDocument('kampGunlukFaaliyetleri', actData);
      if (addNotification) {
        addNotification(`Kamp günlük faaliyet raporu (${faaliyetTipi}) sisteme girildi.`);
      }

      // Reset
      setFaaliyetAciklama('');
      setFaaliyetFoto(null);
      showStatus('success', 'Günlük faaliyet başarıyla kaydedildi, Onay Havuzuna iletildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Günlük faaliyet kaydedilirken hata oluştu.');
    } finally {
      setLoadingFaaliyet(false);
    }
  };

  const handleSubmitKampGirisTalebi = async () => {
    if (!yeniAd.trim() || !yeniSoyad.trim() || !yeniGorev.trim()) {
      showStatus('error', 'Ad, soyad ve görev alanlarını doldurunuz.');
      return;
    }
    if (!yeniKimlikFoto) {
      showStatus('error', 'Kimlik fotoğrafı zorunludur.');
      return;
    }
    try {
      const requestID = `GIRIS-KAMP-${Date.now()}`;
      const email = currentUser?.email || 'kampci';
      await setDoc(doc(db, 'personelGirisTalepleri', requestID), {
        ad: yeniAd.trim(),
        soyad: yeniSoyad.trim(),
        gorev: yeniGorev.trim(),
        kimlikFotoUrl: yeniKimlikFoto,
        durum: 'BEKLEMEDE',
        tarih: new Date().toISOString(),
        gonderenFormen: email,
        gonderenKampci: email,
        kaynakPanel: 'KAMPÇI',
      });
      setSonGirisTalebi({ id: requestID, ad: yeniAd.trim(), soyad: yeniSoyad.trim(), gorev: yeniGorev.trim() });
      setYeniAd('');
      setYeniSoyad('');
      setYeniGorev('');
      setYeniKimlikFoto(null);
      showStatus('success', 'Giriş talebi oluşturuldu — yönetim onay havuzuna iletildi.');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Giriş talebi kaydedilemedi.');
    }
  };

  const handleSendKampGunlukAkis = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const email = currentUser?.email?.trim().toLowerCase() || 'kampci';
    if (!window.confirm(`${today} kamp günlük akış raporunu yönetime göndermek istiyor musunuz?`)) return;
    setSendingKampAkis(true);
    try {
      const ozetMetin = buildKampciGunlukOzet({
        tarih: today,
        email,
        yerlesimCount: kampKayitlari.filter((k) => k.girisTarihi?.startsWith(today)).length,
        sayimCount: depoSavimlari.filter((s) => s.tarih === today).length,
        faaliyetCount: gunlukFaaliyetler.filter((f) => f.tarih === today).length,
      });
      await saveDocument('mobilGunlukAkisRaporlari', {
        id: `kamp_akis_${today}_${email.replace(/[@.]/g, '-')}`,
        tip: 'KAMPÇI',
        tarih: today,
        gonderenEmail: email,
        ozetMetin,
        kampIslemSayisi:
          kampKayitlari.filter((k) => k.girisTarihi?.startsWith(today)).length +
          depoSavimlari.filter((s) => s.tarih === today).length +
          gunlukFaaliyetler.filter((f) => f.tarih === today).length,
        durum: 'ONAY BEKLİYOR',
        olusturulma: new Date().toISOString(),
      });
      showStatus('success', 'Kamp günlük akış raporu yönetim onayına gönderildi!');
    } catch (err) {
      console.error(err);
      showStatus('error', 'Rapor gönderilemedi.');
    } finally {
      setSendingKampAkis(false);
    }
  };

  // Filtered personnel list for DB selection
  const filteredPersonel = personeller.filter(p => {
    const statusLower = String(p.durum || '').toLowerCase();
    const isPasif = statusLower === 'pasif' || p.durum === false || statusLower === 'false';
    if (isPasif) return false;
    const nameStr = `${p.ad || ''} ${p.soyad || ''}`.toLowerCase();
    const queryStr = searchPersonelQuery.toLowerCase();
    return nameStr.includes(queryStr) || (p.gorev || '').toLowerCase().includes(queryStr);
  });

  const content = (
    <>
      
      {/* ⛺ Header Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500">
              <Tent size={20} />
            </span>
            <span className="text-[10px] font-bold text-blue-400 tracking-wider uppercase">Lojman &amp; Kamp İşlemleri</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 mt-1">⛺ KAMP AMİRLİĞİ MOBİL PANELİ</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Oda açılışı, personel yerleşimleri, depo sayımları ve günlük kamp faaliyet raporları</p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-right">
            <span className="text-[8px] text-slate-500 block font-bold uppercase">Giriş Yapan Yetkili</span>
            <span className="text-xs font-bold text-emerald-400 font-mono">{currentUser?.email || 'kampci@kibritci.com'}</span>
          </div>
          {onSignOut && (
            <button 
              onClick={onSignOut}
              className="p-2.5 bg-rose-650/10 border border-rose-550/20 text-rose-400 hover:bg-rose-550/20 rounded-xl transition cursor-pointer"
              title="Çıkış Yap"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 🔔 Real-time status toast inside screen */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-center space-x-3 shadow-lg max-w-xl ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            : statusMessage.type === 'info'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-600'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
        }`}>
          {statusMessage.type === 'info' ? (
            <RefreshCw size={16} className="animate-spin shrink-0" />
          ) : (
            <CheckCircle size={16} className="shrink-0" />
          )}
          <span className="text-xs font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* 🧭 Panel Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveSubTab('placement')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'placement' 
              ? 'bg-blue-650 border-blue-600 text-white shadow-md shadow-blue-500/10' 
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <UserPlus size={14} />
          <span>👤 Kampa Personel Yerleşim</span>
        </button>

        <button
          onClick={() => setActiveSubTab('personel_giris')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'personel_giris'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <DoorOpen size={14} />
          <span>🚪 Girişe Yolla</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rooms')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'rooms' 
              ? 'bg-blue-650 border-blue-600 text-white shadow-md shadow-blue-500/10' 
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Layers size={14} />
          <span>🏢 Oda &amp; Kat Açma</span>
        </button>

        <button
          onClick={() => setActiveSubTab('warehouse')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'warehouse' 
              ? 'bg-blue-650 border-blue-600 text-white shadow-md shadow-blue-500/10' 
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Package size={14} />
          <span>📦 Depo &amp; Stok Sayımı</span>
        </button>

        <button
          onClick={() => setActiveSubTab('activities')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'activities' 
              ? 'bg-blue-650 border-blue-600 text-white shadow-md shadow-blue-500/10' 
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ClipboardList size={14} />
          <span>🧹 Günlük Faaliyetler</span>
        </button>

        <button
          onClick={() => setActiveSubTab('haftalik_yoklama')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'haftalik_yoklama'
              ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-500/20'
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Calendar size={14} />
          <span>📅 Haftalık Yoklama</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gunluk_akis')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-2 border cursor-pointer ${
            activeSubTab === 'gunluk_akis'
              ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-white border-slate-200/80 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={14} />
          <span>📋 Günlük Akış</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          🏕️ TAB 1: USER PLACEMENT (CHECK-IN)
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'placement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Check-In Form (Left Panel) */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Lojmana Personel Yerleştir</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">🔑 Check-In Giriş İşlemi</h3>
            </div>

            <form onSubmit={handlePlacementSubmit} className="space-y-4">
              {/* Target Room Selection — yerleşke → kat → oda */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Yerleşim Yapılacak Oda *</label>
                <div className="grid grid-cols-1 gap-1.5">
                  <select
                    value={placementYerleskeId}
                    onChange={(e) => {
                      setPlacementYerleskeId(e.target.value);
                      setPlacementKatId('');
                      setSelectedRoomId('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-800 rounded-lg px-2.5 py-2 outline-none"
                  >
                    <option value="">1. Yerleşke seçin</option>
                    {placementYerleskeOptions.map(y => (
                      <option key={y.id} value={y.id}>{y.ad}</option>
                    ))}
                  </select>
                  <select
                    value={placementKatId}
                    disabled={!placementYerleskeId}
                    onChange={(e) => {
                      setPlacementKatId(e.target.value);
                      setSelectedRoomId('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-800 rounded-lg px-2.5 py-2 outline-none disabled:opacity-50"
                  >
                    <option value="">2. Kat seçin</option>
                    {placementKatOptions.map(k => (
                      <option key={k.id} value={k.id}>{k.ad}</option>
                    ))}
                  </select>
                  <select
                    required
                    value={selectedRoomId}
                    disabled={!placementKatId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-800 rounded-lg px-2.5 py-2 outline-none disabled:opacity-50"
                  >
                    <option value="">3. Oda seçin</option>
                    {placementOdaOptions.map(r => {
                      const currentCount = kampKayitlari.filter(k => (k.odaId === r.id || k.roomId === r.id) && k.durum === 'AKTIF').length;
                      return (
                        <option key={r.id} value={r.id}>
                          Oda {r.odaNo} ({currentCount}/{r.kapasite} yatak)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Source Type Toggle */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Giriş Türü</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPlacementType('DB')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold text-center transition ${
                      placementType === 'DB' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kayıtlı Personel
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacementType('MANUAL')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold text-center transition ${
                      placementType === 'MANUAL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Elle Giriş (Misafir/Taşeron)
                  </button>
                </div>
              </div>

              {/* STAGE 1: PERSONEL SEÇ VEYA İSİM GİR */}
              <div className="border-t border-slate-850 pt-3 space-y-3">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">ADIM 1: Personel Bilgisi</span>
                
                {placementType === 'DB' ? (
                  <div className="space-y-3 animate-in fade-in duration-100">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Personel Filtrele / Ara</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Personel adı veya görevi..."
                          value={searchPersonelQuery}
                          onChange={(e) => setSearchPersonelQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 pl-9 pr-3 py-2.5 rounded-xl outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Kayıtlı Personel Listesinden Seçin *</label>
                      <select
                        required={placementType === 'DB'}
                        value={selectedPersonelId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSelectedPersonelId(pid);
                          const matched = personeller.find(p => p.id === pid);
                          if (matched) {
                            if (matched.calistigiFirma) {
                              setFirmaType('MANUAL');
                              setManualFirma(matched.calistigiFirma);
                            } else if (matched.firma) {
                              setFirmaType('MANUAL');
                              setManualFirma(matched.firma);
                            }
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none"
                      >
                        <option value="">-- Personel Seçin --</option>
                        {filteredPersonel.slice(0, 30).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.ad} {p.soyad} ({p.gorev})
                          </option>
                        ))}
                      </select>
                      {filteredPersonel.length > 30 && (
                        <span className="text-[9px] text-slate-500 italic block mt-1">+ {filteredPersonel.length - 30} personel daha filtrelendi. Kelime arayarak daraltın.</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-in fade-in duration-100">
                    <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Personel Adı Soyadı *</label>
                    <input
                      type="text"
                      required={placementType === 'MANUAL'}
                      placeholder="Örn: Ahmet Yılmaz"
                      value={manualPersonelIsim}
                      onChange={(e) => setManualPersonelIsim(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                )}
              </div>

              {/* STAGE 2: FİRMA SEÇ VEYA İSMİNİ YAZ */}
              <div className="border-t border-slate-850 pt-3 space-y-3">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">ADIM 2: Firma Bilgisi</span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlacementFirmaTipi('ANA_FIRMA')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold ${placementFirmaTipi === 'ANA_FIRMA' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Ana Firma
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacementFirmaTipi('TASERON')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold ${placementFirmaTipi === 'TASERON' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    Taşeron
                  </button>
                </div>

                {placementFirmaTipi === 'TASERON' && (
                <>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setFirmaType('DB')}
                    className={`py-1 rounded-md text-[9px] font-bold text-center transition ${
                      firmaType === 'DB' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kayıtlı Firmalar
                  </button>
                  <button
                    type="button"
                    onClick={() => setFirmaType('MANUAL')}
                    className={`py-1 rounded-md text-[9px] font-bold text-center transition ${
                      firmaType === 'MANUAL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Yeni Firma Yaz
                  </button>
                </div>

                {firmaType === 'DB' ? (
                  <div className="space-y-1.5 animate-in fade-in duration-100">
                    <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Kayıtlı Firmalardan Seçin *</label>
                    <select
                      required={firmaType === 'DB'}
                      value={selectedFirma}
                      onChange={(e) => setSelectedFirma(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none"
                    >
                      <option value="">-- Taşeron / Firma Seçin --</option>
                      {taseronCariler.map((c) => (
                        <option key={c.id} value={c.unvan}>{c.unvan}</option>
                      ))}
                      {cariKartlar.filter((c) => c.kartTipi !== 'TASERON' && c.durum === 'AKTIF').map((c) => (
                        <option key={c.id} value={c.unvan}>{c.unvan}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-in fade-in duration-100">
                    <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Firma Adını Yazın *</label>
                    <input
                      type="text"
                      required={firmaType === 'MANUAL'}
                      placeholder="Örn: Özdemir Hafriyat Ltd. Şti."
                      value={manualFirma}
                      onChange={(e) => setManualFirma(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl outline-none"
                    />
                  </div>
                )}
                </>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loadingPlacement}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/10"
              >
                {loadingPlacement ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={14} />}
                <span>Check-In Yerleşimini Kaydet</span>
              </button>
            </form>
          </div>

          {/* Rooms and Occupants Directory (Right Panel - taking 2 cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 pb-3 gap-2">
              <div>
                <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Mevcut Kamp Odaları &amp; Doluluk Durumu</span>
                <h3 className="font-bold text-sm text-slate-800 mt-0.5">🏡 Lojman Odaları Listesi</h3>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Blok veya oda ara..."
                  value={searchRoomQuery}
                  onChange={(e) => setSearchRoomQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-[10px] text-slate-800 pl-7 pr-2.5 py-1.5 rounded-lg outline-none w-44"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kampOdalari.filter(room => {
                const q = searchRoomQuery.toLowerCase();
                return (
                  (room.yerleskeAdi || '').toLowerCase().includes(q) ||
                  (room.kogusNo || '').toLowerCase().includes(q) ||
                  (room.odaNo || '').toLowerCase().includes(q)
                );
              }).map(room => {
                const occupants = kampKayitlari.filter(
                  k => (k.odaId === room.id || k.roomId === room.id) && k.durum === 'AKTIF'
                );

                return (
                  <div key={room.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-2 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono text-[10px] text-slate-500 block">{room.yerleskeAdi}</span>
                            <span className="font-black text-xs text-slate-800 block mt-0.5">{room.kogusNo} / Oda {room.odaNo}</span>
                          </div>
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                            room.durum === 'BOŞ' 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                              : room.durum === 'DOLU' 
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {room.durum || 'BOŞ'}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200/40 space-y-1.5">
                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                            <span>Kalan Personeller</span>
                            <span>{occupants.length} / {room.kapasite} Yatak</span>
                          </div>

                          {occupants.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic">Odada kalan kimse bulunmuyor.</p>
                          ) : (
                            <div className="space-y-1">
                              {occupants.map(occ => (
                                <div key={occ.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-850">
                                  <div className="flex items-center space-x-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    <span className="text-[10px] font-bold text-slate-700">{occ.personelIsim}</span>
                                  </div>
                                  <button
                                    onClick={() => handleCheckOut(occ)}
                                    className="text-[9px] font-bold text-rose-400 hover:text-rose-350 cursor-pointer p-0.5 hover:bg-rose-500/10 rounded transition"
                                    title="Odadan Çıkar"
                                  >
                                    Çıkış Yap
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 🚀 QUICK ACTIONS FOR ROOMS */}
                      <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2 mt-auto">
                        <button
                          onClick={() => handleSelectRoomForPlacement(room.id)}
                          className="flex-grow bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-600 rounded-lg py-1.5 text-[9px] font-black uppercase tracking-wider cursor-pointer transition text-center"
                        >
                          Odaya Yerleştir
                        </button>
                        {occupants.length > 0 && (
                          <button
                            onClick={() => handleEvacuateRoom(room.id)}
                            className="bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-rose-600 rounded-lg py-1.5 px-2.5 text-[9px] font-black uppercase tracking-wider cursor-pointer transition text-center"
                          >
                            Tahliye Et
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          🏕️ TAB 2: ROOM CREATOR
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Room Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-600 uppercase tracking-wider">Kamp Yapısı Kurulumu</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">Yerleşke → Kat → Oda</h3>
              <p className="text-[10px] text-slate-500 mt-1">Kamp Yönetimi ile senkron; sıfırdan kendi yapınızı kurun.</p>
            </div>

            {legacySeedRooms && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-amber-900 font-bold">Demo örnek odalar yüklü. Kendi kampınızı kurmak için temizleyin.</p>
                <button
                  type="button"
                  onClick={handleClearLegacyRooms}
                  disabled={clearingLegacy}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {clearingLegacy ? 'Siliniyor ve kaydediliyor…' : 'Örnek Odaları Sil ve Kaydet'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePurgeAllKamp}
              disabled={clearingAll || clearingLegacy}
              className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold py-2 rounded-lg cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {clearingAll && <RefreshCw size={12} className="animate-spin" />}
              <span>⚠️ Tüm Kamp Verisini Sıfırla</span>
            </button>

            <div className="flex gap-1 text-[9px] font-bold">
              {[1, 2, 3].map(step => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setSetupStep(step as 1 | 2 | 3)}
                  className={`flex-1 py-1.5 rounded-lg border ${setupStep === step ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  {step}. {step === 1 ? 'Yerleşke' : step === 2 ? 'Kat' : 'Oda'}
                </button>
              ))}
            </div>

            {setupStep === 1 && (
              <form onSubmit={handleCreateYerleske} className="space-y-3">
                {yerleskeler.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Mevcut Yerleşkeler</label>
                    <select
                      value={selectedYerleskeId}
                      onChange={(e) => { setSelectedYerleskeId(e.target.value); setSetupStep(2); }}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl p-3"
                    >
                      {yerleskeler.map(y => (
                        <option key={y.id} value={y.id}>{y.ad}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Yeni Yerleşke Adı *</label>
                  <input
                    type="text"
                    value={newYerleskeAd}
                    onChange={(e) => setNewYerleskeAd(e.target.value)}
                    placeholder="Örn: Şantiye Merkez Kampı"
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl"
                  />
                </div>
                <button type="submit" disabled={loadingYapı} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer">
                  {loadingYapı ? 'Kaydediliyor...' : '1. Yerleşkeyi Oluştur'}
                </button>
              </form>
            )}

            {setupStep === 2 && (
              <form onSubmit={handleCreateKat} className="space-y-3">
                {!selectedYerleske ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">Önce 1. adımda yerleşke oluşturun.</p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-slate-700">Yerleşke: {selectedYerleske.ad}</p>
                    {yerleskeKatlari.length > 0 && (
                      <select
                        value={selectedKatId}
                        onChange={(e) => { setSelectedKatId(e.target.value); setSetupStep(3); }}
                        className="w-full bg-slate-50 border border-slate-200 text-xs p-3 rounded-xl text-slate-800"
                      >
                        {yerleskeKatlari.map(k => (
                          <option key={k.id} value={k.id}>{k.ad}</option>
                        ))}
                      </select>
                    )}
                    <input
                      type="text"
                      value={newKatAd}
                      onChange={(e) => setNewKatAd(e.target.value)}
                      placeholder="Kat / blok adı (Örn: A Blok Zemin)"
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl"
                    />
                    <button type="submit" disabled={loadingYapı} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer">
                      {loadingYapı ? 'Kaydediliyor...' : '2. Kat Ekle'}
                    </button>
                  </>
                )}
              </form>
            )}

            {setupStep === 3 && (
              <form onSubmit={handleCreateRoom} className="space-y-3">
                {!selectedYerleske || !selectedKat ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">Önce yerleşke ve kat tanımlayın.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">
                      <span className="font-bold">{selectedYerleske.ad}</span> / <span className="font-bold">{selectedKat.ad}</span>
                    </p>
                    <input
                      type="text"
                      required
                      placeholder="Oda no (Örn: 104)"
                      value={odaNo}
                      onChange={(e) => setOdaNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl"
                    />
                    <input
                      type="number"
                      required
                      min={1}
                      max={20}
                      value={kapasite}
                      onChange={(e) => setKapasite(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl"
                    />
                    <select
                      value={firmaTipi}
                      onChange={(e) => setFirmaTipi(e.target.value as 'ANA_FIRMA' | 'TASERON')}
                      className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl"
                    >
                      <option value="ANA_FIRMA">Ana Firma</option>
                      <option value="TASERON">Taşeron</option>
                    </select>
                    <button type="submit" disabled={loadingRoom} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2">
                      {loadingRoom ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={14} />}
                      3. Odayı Aç & Kaydet
                    </button>
                  </>
                )}
              </form>
            )}
          </div>

          {/* Rooms Table List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Şantiye Kamp Altyapısı</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">📋 Tanımlı Odaların Listesi</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider">
                    <th className="pb-3">Yerleşke</th>
                    <th className="pb-3">Blok / Kat</th>
                    <th className="pb-3">Oda No</th>
                    <th className="pb-3">Kapasite</th>
                    <th className="pb-3">Firma Tipi</th>
                    <th className="pb-3 text-right">Eylemler</th>
                  </tr>
                </thead>
                <tbody>
                  {kampOdalari.map(r => (
                    <tr key={r.id} className="border-b border-slate-200/50 hover:bg-slate-900/30 transition">
                      <td className="py-3 font-mono text-slate-500">{r.yerleskeAdi}</td>
                      <td className="py-3 font-bold text-slate-800">{r.kogusNo}</td>
                      <td className="py-3 font-bold text-amber-400">{r.odaNo}</td>
                      <td className="py-3 font-bold font-mono">{r.kapasite} Yatak</td>
                      <td className="py-3 text-[10px]">
                        <span className={`px-2 py-0.5 rounded font-bold border ${
                          r.firmaTipi === 'ANA_FIRMA' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        }`}>
                          {r.firmaTipi === 'ANA_FIRMA' ? 'Ana Firma' : 'Taşeron'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteRoom(r.id, r.odaNo)}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {kampOdalari.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 italic">Kayıtlı kamp odası bulunmuyor.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          📦 TAB 3: WAREHOUSE AUDIT (DEPO SAYIMI)
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'warehouse' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Audit Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Aylık / Haftalık Kamp Depo Sayımı</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">📦 Yeni Depo Sayımı Gir</h3>
            </div>

            <form onSubmit={handleSaveAudit} className="space-y-4">
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-900/40">
                <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Depo Malzeme Kalemleri Sayım Listesi</span>
                
                <div className="space-y-3 divide-y divide-slate-800/40">
                  {Object.entries(sayimMiktarlari).map(([item, val]) => (
                    <div key={item} className="flex justify-between items-center pt-2.5 first:pt-0">
                      <span className="text-[11px] font-bold text-slate-700">{item}</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={val}
                        onChange={(e) => handleQuantityChange(item, e.target.value)}
                        className="w-20 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-right text-emerald-400 font-bold font-mono outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Sayım Notları / Açıklama</label>
                <textarea
                  placeholder="Sayım hakkında eklemek istediğiniz bir durum var mı?"
                  value={sayimNotlar}
                  onChange={(e) => setSayimNotlar(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-2.5 rounded-xl outline-none h-16 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loadingSayim}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/10"
              >
                {loadingSayim ? <RefreshCw size={13} className="animate-spin" /> : <ClipboardList size={14} />}
                <span>Sayımı Kaydet &amp; Onaya Gönder</span>
              </button>
            </form>
          </div>

          {/* Past Audits List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Kayıtlı Depo Sayım Arşivi</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">📋 Sayım Kayıtları ve Onay Durumları</h3>
            </div>

            <div className="space-y-4">
              {depoSavimlari.map(sayim => {
                const approvedByBoth = sayim.onaylayanIdariIsler && sayim.onaylayanMuhasebe;
                const rejected = sayim.durum === 'REDDEDİLDİ';

                return (
                  <div key={sayim.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 hover:border-slate-700 transition">
                    <div className="flex justify-between items-start border-b border-slate-200/60 pb-2">
                      <div>
                        <span className="text-[10px] text-slate-500 font-mono font-bold block">{sayim.tarih}</span>
                        <span className="text-xs font-bold text-slate-800 block mt-0.5">Sorumlu: {sayim.sayimYapan}</span>
                      </div>
                      
                      <div className="text-right">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border block ${
                          approvedByBoth 
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                            : rejected 
                              ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                              : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                        }`}>
                          {approvedByBoth 
                            ? 'ONAYLANDI' 
                            : rejected 
                              ? 'REDDEDİLDİ' 
                              : 'ONAY BEKLİYOR'}
                        </span>
                        
                        <div className="flex gap-1.5 mt-1.5">
                          <span className={`text-[8px] font-mono font-semibold px-1 rounded ${sayim.onaylayanIdariIsler ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-slate-600'}`}>
                            İdari: {sayim.onaylayanIdariIsler ? '✓' : '⌛'}
                          </span>
                          <span className={`text-[8px] font-mono font-semibold px-1 rounded ${sayim.onaylayanMuhasebe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-slate-600'}`}>
                            Muhasebe: {sayim.onaylayanMuhasebe ? '✓' : '⌛'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Counts Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                      {sayim.kalemler?.map((k: any, idx: number) => (
                        <div key={idx} className="bg-white p-2 rounded-lg border border-slate-850/60 text-center">
                          <span className="text-[9px] text-slate-500 block truncate">{k.urunAdi}</span>
                          <span className="font-black text-xs text-amber-400 block mt-0.5 font-mono">{k.miktar} {k.birim}</span>
                        </div>
                      ))}
                    </div>

                    {sayim.notlar && (
                      <p className="text-[10px] text-slate-500 italic bg-white/40 p-2 rounded-lg border border-slate-850/30">
                        {sayim.notlar}
                      </p>
                    )}
                  </div>
                );
              })}

              {depoSavimlari.length === 0 && (
                <div className="text-center p-12 text-slate-500 italic">Depo sayım kaydı bulunmamaktadır.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          🧹 TAB 4: DAILY ROUTINES / ACTIVITIES
          ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'activities' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Activity Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Günlük Rutin &amp; İş Bildirimi</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">🧹 Yeni Faaliyet Raporu</h3>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Faaliyet Kategorisi *</label>
                <select
                  required
                  value={faaliyetTipi}
                  onChange={(e) => setFaaliyetTipi(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none"
                >
                  <option value="TEMİZLİK">🧹 TEMİZLİK (Koğuş, Banyo, Çamaşır)</option>
                  <option value="YEMEK">🍲 YEMEK (Yemekhane, Aşevi)</option>
                  <option value="GÜVENLİK">👮 GÜVENLİK (Kamp kapısı, Nöbet)</option>
                  <option value="BAKIM">🔧 BAKIM (Tesisat, Elektrik, Arıza)</option>
                  <option value="DİĞER">📝 DİĞER (Sosyal alanlar, Genel)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Kamp Yerleşkesi *</label>
                {yerleskeler.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl">
                    Önce &quot;Odalar&quot; sekmesinden yerleşke tanımlayın.
                  </p>
                ) : (
                  <select
                    required
                    value={faaliyetYerleske}
                    onChange={(e) => setFaaliyetYerleske(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none"
                  >
                    {yerleskeler.map(y => (
                      <option key={y.id} value={y.ad}>{y.ad}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">Yapılan İşin Detayı *</label>
                <textarea
                  required
                  placeholder="Yapılan rutin işlerin ayrıntısını yazınız..."
                  value={faaliyetAciklama}
                  onChange={(e) => setFaaliyetAciklama(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 rounded-xl outline-none h-24 resize-none"
                />
              </div>

              {/* Photo Upload Attachment */}
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[9px] font-extrabold text-slate-500 uppercase block tracking-wider">📷 Çalışma Görseli / Fotoğraf Ekle</span>
                <div className="flex items-center gap-3">
                  <label className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-300 font-bold text-[10px] py-2 px-4 rounded-lg flex items-center justify-center space-x-2 cursor-pointer transition shrink-0">
                    <Camera size={13} className="text-amber-500" />
                    <span>{faaliyetFoto ? '✓ Görsel Seçildi' : 'Fotoğraf Çek / Seç'}</span>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const r = new FileReader();
                          r.onload = async (ev) => {
                            if (ev.target?.result) {
                              const rawBase64 = ev.target.result as string;
                              const compressed = await compressImage(rawBase64);
                              setFaaliyetFoto(compressed);
                            }
                          };
                          r.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {faaliyetFoto && (
                    <button
                      type="button"
                      onClick={() => setFaaliyetFoto(null)}
                      className="text-[9px] font-bold text-rose-400 hover:underline cursor-pointer"
                    >
                      Kaldır
                    </button>
                  )}
                </div>

                {faaliyetFoto && (
                  <div className="mt-2 border border-slate-850 rounded bg-white p-1">
                    <img src={faaliyetFoto} alt="Activity Preview" className="max-h-24 mx-auto object-contain rounded" />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loadingFaaliyet}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/10"
              >
                {loadingFaaliyet ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={14} />}
                <span>Faaliyeti Kaydet &amp; Onaya Gönder</span>
              </button>
            </form>
          </div>

          {/* Activity List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-blue-400 uppercase tracking-wider">Günlük Kamp Faaliyetleri</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">📋 Son Raporlanan Aktiviteler</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gunlukFaaliyetler.map(act => {
                const approvedByBoth = act.onaylayanIdariIsler && act.onaylayanMuhasebe;
                const rejected = act.durum === 'REDDEDİLDİ';

                return (
                  <div key={act.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                            act.faaliyetTipi === 'TEMİZLİK' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            act.faaliyetTipi === 'YEMEK' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                            act.faaliyetTipi === 'GÜVENLİK' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            act.faaliyetTipi === 'BAKIM' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                            'bg-slate-500/10 border-slate-500/20 text-slate-500'
                          }`}>
                            {act.faaliyetTipi}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 font-bold block mt-1">{act.tarih}</span>
                        </div>

                        <div className="text-right">
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                            approvedByBoth 
                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                              : rejected 
                                ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                                : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                          }`}>
                            {approvedByBoth ? 'ONAYLANDI' : rejected ? 'REDDEDİLDİ' : 'ONAY BEKLİYOR'}
                          </span>
                          
                          <div className="flex gap-1 justify-end mt-1">
                            <span className={`text-[7px] font-mono px-1 rounded ${act.onaylayanIdariIsler ? 'bg-emerald-500/25 text-emerald-400' : 'bg-white text-slate-650'}`}>
                              İd: {act.onaylayanIdariIsler ? '✓' : '⌛'}
                            </span>
                            <span className={`text-[7px] font-mono px-1 rounded ${act.onaylayanMuhasebe ? 'bg-emerald-500/25 text-emerald-400' : 'bg-white text-slate-650'}`}>
                              Mu: {act.onaylayanMuhasebe ? '✓' : '⌛'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 mt-1 line-clamp-3 leading-relaxed">
                        {act.aciklama}
                      </p>

                      {act.fotoUrl && (
                        <div className="border border-slate-200 rounded bg-white p-1 max-h-24 overflow-hidden flex items-center justify-center">
                          <img src={act.fotoUrl} alt="Activity" className="max-h-20 object-contain rounded" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {gunlukFaaliyetler.length === 0 && (
                <div className="col-span-2 text-center p-12 text-slate-500 italic">Günlük faaliyet raporu bulunmamaktadır.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'personel_giris' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div>
              <span className="font-extrabold text-[10px] text-emerald-500 uppercase tracking-wider">Personel İşe Giriş</span>
              <h3 className="font-bold text-sm text-slate-800 mt-0.5">🚪 Girişe Yolla</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Kamp alanına veya lojmana gelen yeni personelin kimlik fotoğrafını çekip bilgilerini girin.
              Talep <strong>Onay Havuzu → Formen Belgeleri</strong> üzerinden yönetici onayına gider.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">Ad</label>
                <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none" placeholder="Ad" />
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">Soyad</label>
                <input value={yeniSoyad} onChange={(e) => setYeniSoyad(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none" placeholder="Soyad" />
              </div>
            </div>
            <div>
              <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">Görev / Branş</label>
              <input value={yeniGorev} onChange={(e) => setYeniGorev(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl p-3 outline-none" placeholder="Örn: Kamp Görevlisi, Aşçı" />
            </div>
            <div>
              <label className="text-[9px] font-extrabold text-slate-500 uppercase block mb-1">Kimlik Fotoğrafı</label>
              <div className="flex gap-3">
                <label className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer w-24 h-20 shrink-0 text-slate-500">
                  <Camera size={20} />
                  <span className="text-[8px] font-bold mt-1">Çek</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = async (ev) => {
                      if (ev.target?.result) setYeniKimlikFoto(await compressImage(ev.target.result as string));
                    };
                    r.readAsDataURL(file);
                  }} />
                </label>
                <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 h-20 overflow-hidden flex items-center justify-center">
                  {yeniKimlikFoto ? (
                    <img src={yeniKimlikFoto} alt="Kimlik" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Fotoğraf yok</span>
                  )}
                </div>
              </div>
            </div>

            <button type="button" onClick={handleSubmitKampGirisTalebi} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2">
              <UserPlus size={14} />
              GİRİŞİNİ YAP VE GÖNDER
            </button>

            {sonGirisTalebi && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                <p className="text-xs text-emerald-800 font-bold">✅ Kayıt oluşturuldu — WhatsApp ile yönetime iletebilirsiniz</p>
                <a
                  href={buildWhatsAppUrl(
                    `*KİBRİTÇİ ERP - KAMP PERSONEL İŞE GİRİŞ*\n*Ad Soyad:* ${sonGirisTalebi.ad} ${sonGirisTalebi.soyad}\n*Görev:* ${sonGirisTalebi.gorev}\n*Tarih:* ${new Date().toLocaleDateString('tr-TR')}\n*Gönderen Kampçı:* ${currentUser?.email || '-'}\n*Kayıt Linki:* ${window.location.origin}/?view_giris=${sonGirisTalebi.id}`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, 'personelGirisTalepleri', sonGirisTalebi.id), { durum: 'WP_GÖNDERİLDİ' }, { merge: true });
                    } catch (e) { console.warn(e); }
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageSquare size={14} />
                  WhatsApp&apos;tan Gönder
                </a>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-800">📋 Giriş Talepleri Takibi</h3>
            {girisTalepleriList.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center">Henüz giriş talebi yok.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {girisTalepleriList.map((item) => (
                  <div key={item.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-bold text-sm text-slate-800">{item.ad} {item.soyad}</span>
                        <span className="text-[10px] text-slate-500 block">{item.gorev}</span>
                      </div>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                        item.durum === 'ONAYLANDI' ? 'bg-emerald-100 text-emerald-800' :
                        item.durum === 'WP_GÖNDERİLDİ' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>{item.durum || 'BEKLEMEDE'}</span>
                    </div>
                    {item.durum === 'ONAYLANDI' && (
                      <a
                        href={buildWhatsAppUrl(
                          `*KİBRİTÇİ - GİRİŞ İZNİ ONAYLANDI*\n👤 ${item.ad} ${item.soyad}\n💼 ${item.gorev}\n✅ Kapı/güvenliğe bildirin.\n${window.location.origin}/?view_giris=${item.id}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-[10px] font-bold text-emerald-700 hover:underline"
                      >
                        Kapıya WhatsApp ile bildir →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'haftalik_yoklama' && setYoklamalar && (
        <KampHaftalikYoklamaTab
          kampOdalari={kampOdalari}
          kampKayitlari={kampKayitlari}
          yoklamalar={yoklamalar}
          setYoklamalar={setYoklamalar}
          personeller={personeller}
          currentUser={currentUser}
          addNotification={addNotification}
        />
      )}

      {activeSubTab === 'gunluk_akis' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Sparkles className="text-amber-600" size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Günlük Akış Raporu</h3>
              <p className="text-xs text-slate-500">Bugünkü yerleşim, depo sayımı ve faaliyet kayıtlarının özeti</p>
            </div>
          </div>

          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const yerlesimToday = kampKayitlari.filter((k) => k.girisTarihi?.startsWith(today));
            const sayimToday = depoSavimlari.filter((s) => s.tarih === today);
            const faaliyetToday = gunlukFaaliyetler.filter((f) => f.tarih === today);
            return (
              <>
                <ul className="text-sm text-slate-700 space-y-2 bg-slate-50 rounded-xl p-4">
                  <li>📅 Tarih: <strong>{today.split('-').reverse().join('.')}</strong></li>
                  <li>👤 Kampçı: <strong>{currentUser?.email || '—'}</strong></li>
                  <li>🏕️ Yerleşim işlemi: <strong>{yerlesimToday.length}</strong></li>
                  <li>📦 Depo sayım kaydı: <strong>{sayimToday.length}</strong></li>
                  <li>🧹 Günlük faaliyet: <strong>{faaliyetToday.length}</strong></li>
                </ul>

                <pre className="text-xs whitespace-pre-wrap bg-slate-900 text-slate-100 rounded-xl p-4 font-mono leading-relaxed">
                  {buildKampciGunlukOzet({
                    tarih: today,
                    email: currentUser?.email || 'kampci',
                    yerlesimCount: yerlesimToday.length,
                    sayimCount: sayimToday.length,
                    faaliyetCount: faaliyetToday.length,
                  })}
                </pre>

                <button
                  type="button"
                  onClick={handleSendKampGunlukAkis}
                  disabled={sendingKampAkis}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {sendingKampAkis ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Gönderiliyor…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      Gün Sonu Raporunu Yönetime Gönder
                    </>
                  )}
                </button>
              </>
            );
          })()}
        </div>
      )}

    </>
  );

  if (isStandalone) {
    return (
      <div className="w-full h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans p-4 space-y-6">
        {content}
      </div>
    );
  }

  if (!isStandalone && viewMode === 'mobile') {
    return (
      <div className="flex-grow min-h-full bg-white flex justify-center py-6 px-4">
        <div className="w-full max-w-[420px] h-[720px] max-h-[82vh] bg-slate-50 rounded-[3rem] border-[10px] border-slate-200 shadow-2xl overflow-hidden flex flex-col relative">
          {/* Notch / Dynamic Island */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800 mr-2"></div>
            <div className="w-10 h-0.5 bg-slate-50 rounded"></div>
          </div>
          <div className="flex-grow overflow-y-auto pt-6 pb-4 flex flex-col">
            {/* View switcher control at the top of phone */}
            <div className="px-5 py-3 border-b border-slate-200/60 flex justify-between items-center bg-white/80 sticky top-0 z-40 backdrop-blur-md">
              <span className="text-[10px] font-black tracking-wider text-slate-500 uppercase">📱 Mobil Sürüm</span>
              <button 
                onClick={() => setViewMode('web')}
                className="text-[9px] bg-blue-600/20 border border-blue-500/30 text-blue-400 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-500/30 transition cursor-pointer"
              >
                💻 Web Sürüme Geç
              </button>
            </div>
            <div className="flex-grow p-4 space-y-5">
              {content}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow h-full overflow-y-auto bg-slate-50 text-slate-800 font-sans p-4 md:p-6 space-y-6">
      {/* View switcher control at the top of Web view */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3.5 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-blue-600/10 rounded-lg text-blue-500">
            <Tent size={18} />
          </span>
          <span className="text-xs font-bold text-slate-600">Görünüm Sürümü:</span>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase font-black">💻 Web Sürüm</span>
        </div>
        <button
          onClick={() => setViewMode('mobile')}
          className="text-xs bg-blue-650 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition shadow-md shadow-blue-500/10"
        >
          📱 Mobil Sürüm Test Et
        </button>
      </div>
      {content}
    </div>
  );
};

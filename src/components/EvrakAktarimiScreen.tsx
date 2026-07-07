import React, { useState } from 'react';
import { 
  FileText, Upload, Check, RefreshCw, AlertCircle, Calendar, 
  ArrowRight, Landmark, FileSpreadsheet, Layers, ShoppingBag, DollarSign, Users, ClipboardCheck
} from 'lucide-react';
import { saveDocument } from '../lib/firebase';
import { CariKart, CariKartIslem, StokKart, Personel, AylikYoklamaMap, SahaFaaliyeti, Fatura } from '../types/erp';
import { findPersonelByName, setYoklamaDay } from '../lib/yoklamaUtils';
import { fetchApiJson } from '../lib/apiClient';
import {
  splitPdfFileToPageBase64,
  autoEnsureCari,
  autoEnsureStok,
  findCariMatch,
  findStokMatch,
  normalizeMatchText,
  resolveCariForBatchImport,
  buildCariFaturaHistory,
  BatchImportRow,
} from '../lib/evrakBatchImportUtils';

interface EvrakAktarimiScreenProps {
  cariKartlar: CariKart[];
  setCariKartlar?: React.Dispatch<React.SetStateAction<CariKart[]>>;
  stokKartlar: StokKart[];
  setStokKartlar?: React.Dispatch<React.SetStateAction<StokKart[]>>;
  setCariIslemGecmisi?: React.Dispatch<React.SetStateAction<CariKartIslem[]>>;
  faturalar?: Fatura[];
  currentUser: any;
  setFaturalar: React.Dispatch<React.SetStateAction<any[]>>;
  setIrsaliyeler: React.Dispatch<React.SetStateAction<any[]>>;
  setKasaHareketleri: React.Dispatch<React.SetStateAction<any[]>>;
  yoklamalar: AylikYoklamaMap;
  setYoklamalar: (updater: AylikYoklamaMap | ((y: AylikYoklamaMap) => AylikYoklamaMap)) => void;
  sahaFaaliyetleri: SahaFaaliyeti[];
  setSahaFaaliyetleri: (updater: SahaFaaliyeti[] | ((s: SahaFaaliyeti[]) => SahaFaaliyeti[])) => void;
  personeller: Personel[];
}

export const EvrakAktarimiScreen: React.FC<EvrakAktarimiScreenProps> = ({
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
  setCariIslemGecmisi,
  faturalar = [],
  currentUser,
  setFaturalar,
  setIrsaliyeler,
  setKasaHareketleri,
  yoklamalar,
  setYoklamalar,
  sahaFaaliyetleri,
  setSahaFaaliyetleri,
  personeller
}) => {
  const [docType, setDocType] = useState<'fatura' | 'irsaliye' | 'makbuz' | 'hakedis' | 'yoklama' | 'saha_faaliyet' | 'auto'>('auto');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingStep, setLoadingStep] = useState('');
  const [detectedTypeMsg, setDetectedTypeMsg] = useState<string | null>(null);

  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchImportRow[]>([]);
  const [batchProgress, setBatchProgress] = useState('');

  const getDonemFromDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Haziran 2026';
      const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return 'Haziran 2026';
    }
  };

  const handleDocTypeChange = (newType: 'fatura' | 'irsaliye' | 'makbuz' | 'hakedis' | 'yoklama' | 'saha_faaliyet') => {
    if (!parsedData) return;

    const oldData = parsedData;
    let newData: any = { ...oldData };

    // Common fields extraction with fallback
    const commonDate = oldData.tarih || new Date().toISOString().slice(0, 10);
    const commonFirma = oldData.firma || oldData.cariUnvan || '';
    const commonNo = oldData.faturaNo || oldData.irsaliyeNo || oldData.referansId || '';
    const commonTotal = Number(oldData.genelToplam) || Number(oldData.toplamTutar) || Number(oldData.tutar) || 0;
    const commonKdv = Number(oldData.kdvTutar) || 0;
    const commonMatrah = Number(oldData.toplamTutar) || (commonTotal - commonKdv) || commonTotal;
    const commonAciklama = oldData.aciklama || oldData.isNiteligi || '';

    if (newType === 'fatura') {
      newData.faturaNo = commonNo || `FT-${Date.now().toString().slice(-6)}`;
      newData.tarih = commonDate;
      newData.cariUnvan = commonFirma || 'Bilinmeyen Cari';
      newData.toplamTutar = commonMatrah;
      newData.kdvTutar = commonKdv;
      newData.genelToplam = commonTotal;
      
      const oldKalemler = oldData.kalemler || [];
      newData.kalemler = oldKalemler.map((k: any) => ({
        urunAdi: k.urunAdi || 'Tanımlanmamış Ürün',
        miktar: Number(k.miktar) || 1,
        birim: k.birim || 'ADET',
        birimFiyat: Number(k.birimFiyat) || 0,
        kdvOran: Number(k.kdvOran) || 20,
        toplam: Number(k.toplam) || (Number(k.miktar) || 1) * (Number(k.birimFiyat) || 0)
      }));
      if (newData.kalemler.length === 0) {
        newData.kalemler = [{ urunAdi: 'Tanımlanmamış Ürün', miktar: 1, birim: 'ADET', birimFiyat: commonMatrah, kdvOran: 20, toplam: commonMatrah }];
      }
    } 
    else if (newType === 'irsaliye') {
      newData.irsaliyeNo = commonNo || `IR-${Date.now().toString().slice(-6)}`;
      newData.tarih = commonDate;
      newData.firma = commonFirma || 'Bilinmeyen Firma';
      
      const oldKalemler = oldData.kalemler || [];
      newData.kalemler = oldKalemler.map((k: any) => ({
        urunAdi: k.urunAdi || 'İsimsiz Malzeme',
        miktar: Number(k.miktar) || 0,
        birim: k.birim || 'ADET'
      }));
      if (newData.kalemler.length === 0) {
        newData.kalemler = [{ urunAdi: 'İsimsiz Malzeme', miktar: 1, birim: 'ADET' }];
      }
    } 
    else if (newType === 'makbuz') {
      newData.referansId = commonNo || `REF-${Date.now()}`;
      newData.tarih = commonDate;
      newData.aciklama = commonAciklama || 'Makbuz / Dekont Girişi';
      newData.tutar = commonTotal;
      newData.firma = commonFirma || 'Bilinmeyen Cari/Firma';
      newData.hareketTipi = oldData.hareketTipi || 'ÇIKIŞ';
    } 
    else if (newType === 'hakedis') {
      newData.faturaNo = commonNo || `HK-${Date.now().toString().slice(-6)}`;
      newData.donem = oldData.donem || getDonemFromDate(commonDate);
      newData.tarih = commonDate;
      newData.cariUnvan = commonFirma || 'Taşeron Firma';
      newData.toplamTutar = commonMatrah || commonTotal;
      newData.kdvTutar = commonKdv;
      newData.genelToplam = commonTotal;
      newData.aciklama = commonAciklama || 'Yapılan İş Bedeli';
    } 
    else if (newType === 'yoklama') {
      newData.tarih = commonDate;
      let kayitlar = oldData.yoklamaKayitlari || [];
      if (kayitlar.length === 0 && oldData.aktifPersonelListesi) {
        kayitlar = oldData.aktifPersonelListesi.map((name: string) => ({
          adSoyad: name,
          durum: 'Geldi',
          gunNo: new Date(commonDate).getDate() || new Date().getDate(),
          mesaiSaati: 0
        }));
      }
      newData.yoklamaKayitlari = kayitlar;
      if (newData.yoklamaKayitlari.length === 0) {
        newData.yoklamaKayitlari = [{ adSoyad: 'Yeni Personel', durum: 'Geldi', gunNo: new Date().getDate(), mesaiSaati: 0 }];
      }
    } 
    else if (newType === 'saha_faaliyet') {
      newData.tarih = commonDate;
      newData.isNiteligi = oldData.isNiteligi || commonAciklama || 'Şantiye Saha İşleri';
      newData.parsel = oldData.parsel || 'Parsel A';
      newData.blok = oldData.blok || 'Blok B';
      newData.aciklama = commonAciklama || oldData.aciklama || 'Günlük saha faaliyeti yapay zeka tarafından işlendi.';
      
      let personelListesi = oldData.aktifPersonelListesi || [];
      if (personelListesi.length === 0 && oldData.yoklamaKayitlari) {
        personelListesi = oldData.yoklamaKayitlari.map((k: any) => k.adSoyad);
      }
      newData.aktifPersonelListesi = personelListesi;
    }

    setDocType(newType);
    setParsedData(newData);
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatus({ type, text });
    setTimeout(() => setStatus(null), 6000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setParsedData(null);
      setDetectedTypeMsg(null);
      setDocType('auto');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setParsedData(null);
      setDetectedTypeMsg(null);
      setDocType('auto');
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result?.toString().split(',')[1] || '';
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleStartParsing = async () => {
    if (!selectedFile) return;
    setParsing(true);
    setDetectedTypeMsg(null);
    setLoadingStep('Dosya ikili veri çözümlenmesine hazırlanıyor...');

    try {
      const fileBase64 = await fileToBase64(selectedFile);
      setLoadingStep('Yapay zeka dökümanı inceliyor (Gemini 2.5 Flash)...');
      
      const result = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
        '/api/parse-legacy-document',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64,
            mimeType: selectedFile.type || 'application/pdf',
            docType
          })
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Döküman yapay zeka tarafından ayrıştırılamadı.');
      }

      const data = result.data;
      if (docType === 'auto') {
        const type = data.detectedType;
        if (type) {
          setDocType(type);
          setParsedData(data);
          const typeLabels: Record<string, string> = {
            fatura: 'Fatura (Invoice)',
            irsaliye: 'Sevk İrsaliyesi (Waybill)',
            makbuz: 'Makbuz / Dekont',
            hakedis: 'Taşeron Hakediş Kapağı',
            yoklama: 'Puantaj & Yoklama Çizelgesi',
            saha_faaliyet: 'Saha Günlük Faaliyet Raporu'
          };
          setDetectedTypeMsg(`🤖 Yapay zeka bu evrakın bir "${typeLabels[type] || type.toUpperCase()}" olduğunu akıllıca tespit etti ve doğrulama formunu adapte etti!`);
          showStatus('success', 'Yapay zeka evrak türünü algıladı ve başarıyla ayrıştırdı!');
        } else {
          setParsedData(data);
          setDocType('fatura');
          showStatus('success', 'Belge çözümlendi.');
        }
      } else {
        setParsedData(data);
        showStatus('success', 'Döküman başarıyla ayrıştırıldı! Lütfen alanları gözden geçirin.');
      }
    } catch (err: any) {
      console.error(err);
      showStatus('error', `Ayrıştırma Hatası: ${err.message || 'Lütfen tekrar deneyin.'}`);
    } finally {
      setParsing(false);
      setLoadingStep('');
    }
  };

  const ensureCariAndStokFromImport = (supplierName: string, items: { urunAdi: string, birim?: string }[]) => {
    if (!supplierName) return;
    
    // 1. Ensure Cari Kart
    const normalizedSupplier = supplierName.trim();
    const existingCari = (cariKartlar || []).find(
      c => c.unvan && c.unvan.toLowerCase().trim() === normalizedSupplier.toLowerCase()
    );

    let updatedCariKartlar = [...(cariKartlar || [])];
    if (!existingCari) {
      const confirmCreate = window.confirm(`AI tarafından çözümlenen "${supplierName}" firması sistemde kayıtlı değildir. Bu firma için yeni bir Cari Kartı (Tedarikçi) oluşturmak ister misiniz?`);
      if (confirmCreate) {
        const newCariId = `ck_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const randomCode = `CAR-${Math.floor(100 + Math.random() * 905)}`;
        const newCari = {
          id: newCariId,
          kartTipi: 'TEDARIKCI' as const,
          kod: randomCode,
          unvan: normalizedSupplier,
          yetkili: "Evrak Aktarımı",
          telefon: "",
          eposta: "",
          vergiNo: "",
          vergiDairesi: "",
          adres: "AI evrak aktarımından otomatik oluşturuldu.",
          iban: "",
          durum: 'AKTIF' as const,
          notlar: "AI evrak aktarımından otomatik oluşturuldu."
        };
        updatedCariKartlar = [newCari, ...updatedCariKartlar];
        if (setCariKartlar) {
          setCariKartlar(updatedCariKartlar);
        }
      }
    }

    // 2. Ensure Stok Kartlar
    let updatedStokKartlar = [...(stokKartlar || [])];
    let addedAnyStok = false;

    items.forEach((item, idx) => {
      const normalizedProduct = item.urunAdi.trim();
      const existingStok = (stokKartlar || []).find(
        s => (s.stokAdi && s.stokAdi.toLowerCase().trim() === normalizedProduct.toLowerCase()) || 
             (s.urunAdi && s.urunAdi.toLowerCase().trim() === normalizedProduct.toLowerCase())
      );

      if (!existingStok) {
        const confirmCreate = window.confirm(`AI tarafından çözümlenen "${item.urunAdi}" malzemesi sistemde kayıtlı değildir. Bu malzeme için yeni bir Stok Kartı oluşturmak ister misiniz?`);
        if (confirmCreate) {
          const newStokId = `sk_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`;
          const randomCode = `STK-${Math.floor(1000 + Math.random() * 9000)}`;
          const newStok = {
            id: newStokId,
            stokKodu: randomCode,
            stokAdi: normalizedProduct,
            kategori: "İnşaat Malzemesi",
            birim: item.birim || "ADET",
            kritikSeviye: 5,
            durum: 'AKTIF' as const,
            aciklama: "AI evrak aktarımından otomatik oluşturuldu."
          };
          updatedStokKartlar = [newStok, ...updatedStokKartlar];
          addedAnyStok = true;
        }
      }
    });

    if (addedAnyStok && setStokKartlar) {
      setStokKartlar(updatedStokKartlar);
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const importParsedPage = async (
    data: any,
    pageNo: number,
    sourceTag: string,
    workingCari: CariKart[],
    workingStok: StokKart[],
    createDecisions: Map<string, boolean>
  ): Promise<{ evrakNo: string; firma: string; type: string; cariler: CariKart[]; stoklar: StokKart[]; reusedCari: boolean }> => {
    let cariler = [...workingCari];
    let stoklar = [...workingStok];
    const type = String(data.detectedType || 'fatura').toLowerCase() as typeof docType;
    const firma = String(data.cariUnvan || data.firma || '').trim();
    const kalemler = Array.isArray(data.kalemler) ? data.kalemler : [];
    let matchedCari: CariKart | null = null;
    let createdCari = false;

    if (firma) {
      const resolved = resolveCariForBatchImport(firma, cariler, sourceTag, createDecisions);
      cariler = resolved.cariler;
      matchedCari = resolved.cari;
      createdCari = resolved.created;
      if (resolved.cari && resolved.created) {
        await saveDocument('cariKartlar', resolved.cari);
      }
    }

    for (const k of kalemler) {
      const before = findStokMatch(k.urunAdi || '', workingStok);
      const ensured = autoEnsureStok(k.urunAdi || '', k.birim || 'ADET', stoklar, sourceTag);
      stoklar = ensured.stoklar;
      if (ensured.stok && !before) {
        await saveDocument('stokKartlar', ensured.stok);
      }
    }

    if (setCariKartlar) setCariKartlar(cariler);
    if (setStokKartlar) setStokKartlar(stoklar);

    const systemId = `BATCH-${type}-${Date.now()}-P${pageNo}`;
    const tarih = data.tarih || new Date().toISOString().slice(0, 10);
    const cariUnvan = matchedCari?.unvan || firma || 'Bilinmeyen Cari';

    if (type === 'irsaliye') {
      const doc = {
        id: systemId,
        irsaliyeId: `IR-${Date.now().toString().slice(-4)}`,
        irsaliyeNo: data.irsaliyeNo || `IR-P${pageNo}`,
        firma: firma || 'Bilinmeyen Firma',
        tarih,
        onayDurumu: '2. ONAY TAMAMLANDI' as const,
        kalemler: kalemler.map((k: any, idx: number) => ({
          id: `k_${pageNo}_${idx}`,
          urunAdi: k.urunAdi || 'Malzeme',
          miktar: Number(k.miktar) || 0,
          birim: k.birim || 'ADET',
          stokKartId: findStokMatch(k.urunAdi || '', stoklar)?.id,
        })),
        eImzalar: [],
        notlar: sourceTag,
      };
      await saveDocument('irsaliyeler', doc);
      setIrsaliyeler((prev) => [doc, ...prev]);
      return { evrakNo: doc.irsaliyeNo, firma: doc.firma, type: 'irsaliye', cariler, stoklar, reusedCari: Boolean(matchedCari) };
    }

    const faturaDoc = {
      id: systemId,
      faturaNo: data.faturaNo || data.irsaliyeNo || `FT-P${pageNo}`,
      tarih,
      cariKartId: matchedCari?.id || '',
      cariUnvan,
      toplamTutar: Number(data.toplamTutar) || Number(data.genelToplam) || 0,
      kdvTutar: Number(data.kdvTutar) || 0,
      genelToplam: Number(data.genelToplam || data.toplamTutar || data.tutar) || 0,
      durum: 'ONAYLANDI' as const,
      bagliIrsaliyeler: [],
      notlar: `Toplu PDF aktarım ${sourceTag}`,
      kalemler: (kalemler.length ? kalemler : [{ urunAdi: data.aciklama || 'Evrak kalemi', miktar: 1, birim: 'ADET', birimFiyat: 0, kdvOran: 20, toplam: 0 }]).map(
        (k: any, idx: number) => ({
          id: `k_${pageNo}_${idx}`,
          urunAdi: k.urunAdi || 'Ürün',
          miktar: Number(k.miktar) || 1,
          birim: k.birim || 'ADET',
          birimFiyat: Number(k.birimFiyat) || 0,
          kdvOran: Number(k.kdvOran) || 20,
          toplam: Number(k.toplam) || 0,
          stokKartId: findStokMatch(k.urunAdi || '', stoklar)?.id,
        })
      ),
    };
    await saveDocument('faturalar', faturaDoc);
    setFaturalar((prev) => [faturaDoc, ...prev]);

    if (matchedCari?.id && setCariIslemGecmisi) {
      const history = buildCariFaturaHistory(
        matchedCari.id,
        faturaDoc.id,
        faturaDoc.faturaNo,
        cariUnvan,
        tarih,
        sourceTag,
        createdCari
      );
      setCariIslemGecmisi((prev) => [history, ...prev]);
      await saveDocument('cariIslemGecmisi', history).catch(() => undefined);
    }

    return {
      evrakNo: faturaDoc.faturaNo,
      firma: faturaDoc.cariUnvan,
      type: type === 'hakedis' ? 'hakedis' : 'fatura',
      cariler,
      stoklar,
      reusedCari: Boolean(matchedCari) && !createdCari,
    };
  };

  const handleBatchPdfImport = async () => {
    if (!batchFile || batchRunning) return;
    if (!batchFile.type.includes('pdf')) {
      showStatus('error', 'Toplu aktarım için PDF dosyası seçin.');
      return;
    }
    setBatchRunning(true);
    setBatchRows([]);
    setBatchProgress('PDF sayfalara ayrılıyor...');

    try {
      const pages = await splitPdfFileToPageBase64(batchFile);
      const rows: BatchImportRow[] = pages.map((_, i) => ({ pageNo: i + 1, status: 'pending' }));
      setBatchRows(rows);

      let workingCari = [...(cariKartlar || [])];
      let workingStok = [...(stokKartlar || [])];
      const sourceBase = batchFile.name;
      const createDecisions = new Map<string, boolean>();
      const existingTags = new Set(
        (faturalar || [])
          .map((f) => String(f.notlar || ''))
          .flatMap((note) => {
            const matches = note.match(/\[BatchPDF:[^\]]+\]/g);
            return matches || [];
          })
      );

      for (let i = 0; i < pages.length; i++) {
        const pageNo = i + 1;
        const sourceTag = `[BatchPDF:${sourceBase}#P${pageNo}]`;
        if (existingTags.has(sourceTag)) {
          setBatchRows((prev) =>
            prev.map((r) =>
              r.pageNo === pageNo
                ? { ...r, status: 'skipped', message: 'Daha önce aktarılmış' }
                : r
            )
          );
          continue;
        }

        setBatchProgress(`Sayfa ${pageNo}/${pages.length} yapay zeka ile okunuyor...`);
        setBatchRows((prev) =>
          prev.map((r) => (r.pageNo === pageNo ? { ...r, status: 'parsing' } : r))
        );

        let parsed: any = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const result = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
              '/api/parse-legacy-document',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileBase64: pages[i],
                  mimeType: 'application/pdf',
                  docType: 'auto',
                }),
              }
            );
            if (!result.success || !result.data) throw new Error(result.error || 'Parse hatası');
            parsed = result.data;
            break;
          } catch (err: any) {
            const is429 = /429|quota|RESOURCE_EXHAUSTED/i.test(String(err?.message || err));
            if (attempt === 4 || !is429) throw err;
            setBatchProgress(`Sayfa ${pageNo}: kota limiti, ${50 * attempt} sn bekleniyor...`);
            await sleep(50000 * attempt);
          }
        }

        const imported = await importParsedPage(parsed, pageNo, sourceTag, workingCari, workingStok, createDecisions);
        workingCari = imported.cariler;
        workingStok = imported.stoklar;

        setBatchRows((prev) =>
          prev.map((r) =>
            r.pageNo === pageNo
              ? {
                  ...r,
                  status: 'ok',
                  detectedType: imported.type,
                  evrakNo: imported.evrakNo,
                  firma: `${imported.firma}${imported.reusedCari ? ' (mevcut cari)' : ''}`,
                }
              : r
          )
        );

        if (i < pages.length - 1) await sleep(3000);
      }

      setBatchProgress('');
      showStatus('success', `Toplu aktarım tamamlandı: ${pages.length} sayfa işlendi.`);
    } catch (err: any) {
      console.error(err);
      setBatchProgress('');
      showStatus('error', `Toplu aktarım hatası: ${err.message || 'Bilinmeyen hata'}`);
      setBatchRows((prev) =>
        prev.map((r) => (r.status === 'parsing' ? { ...r, status: 'error', message: err.message } : r))
      );
    } finally {
      setBatchRunning(false);
    }
  };

  // Import parsed data to Firestore and state
  const handleImportToSystem = async () => {
    if (!parsedData) return;
    setImporting(true);

    try {
      // Prompt user to verify and create Cari / Stok cards before importing
      if (docType === 'fatura') {
        ensureCariAndStokFromImport(parsedData.cariUnvan || '', parsedData.kalemler || []);
      } else if (docType === 'irsaliye') {
        ensureCariAndStokFromImport(parsedData.firma || '', parsedData.kalemler || []);
      } else if (docType === 'hakedis') {
        ensureCariAndStokFromImport(parsedData.cariUnvan || '', []);
      } else if (docType === 'makbuz') {
        ensureCariAndStokFromImport(parsedData.firma || '', []);
      }
      const systemId = `${docType.toUpperCase()}-${Date.now()}`;
      
      if (docType === 'fatura') {
        const matchedCari = cariKartlar.find(c => 
          c.unvan.toLowerCase().includes(parsedData.cariUnvan?.toLowerCase() || '') ||
          (parsedData.cariUnvan?.toLowerCase() || '').includes(c.unvan.toLowerCase())
        );

        const newFatura = {
          id: systemId,
          faturaNo: parsedData.faturaNo || `FT-${Date.now().toString().slice(-6)}`,
          tarih: parsedData.tarih || new Date().toISOString().slice(0,10),
          cariKartId: matchedCari?.id || 'CARI-DIŞ-SERVIS',
          cariUnvan: parsedData.cariUnvan || 'Bilinmeyen Cari',
          toplamTutar: Number(parsedData.toplamTutar) || 0,
          kdvTutar: Number(parsedData.kdvTutar) || 0,
          genelToplam: Number(parsedData.genelToplam) || 0,
          durum: 'ONAYLANDI' as const,
          bagliIrsaliyeler: [],
          notlar: 'Yapay Zeka Eski Evrak Aktarım Modülü ile yüklendi.',
          kalemler: (parsedData.kalemler || []).map((k: any, idx: number) => ({
            id: `k_${idx}_${Date.now()}`,
            urunAdi: k.urunAdi || 'Tanımlanmamış Ürün',
            miktar: Number(k.miktar) || 1,
            birim: k.birim || 'ADET',
            birimFiyat: Number(k.birimFiyat) || 0,
            kdvOran: Number(k.kdvOran) || 20,
            toplam: Number(k.toplam) || 0
          }))
        };

        await saveDocument('faturalar', newFatura);
        setFaturalar(prev => [newFatura, ...prev]);
        showStatus('success', `🎉 ${newFatura.faturaNo} fatura belgesi başarıyla sisteme aktarıldı!`);

      } else if (docType === 'irsaliye') {
        const newIrsaliye = {
          id: systemId,
          irsaliyeId: `IR-${Date.now().toString().slice(-4)}`,
          irsaliyeNo: parsedData.irsaliyeNo || `IR-${Date.now().toString().slice(-6)}`,
          firma: parsedData.firma || 'Bilinmeyen Firma',
          tarih: parsedData.tarih || new Date().toISOString().slice(0,10),
          onayDurumu: '2. ONAY TAMAMLANDI' as const,
          kalemler: (parsedData.kalemler || []).map((k: any, idx: number) => ({
            id: `k_${idx}_${Date.now()}`,
            urunAdi: k.urunAdi || 'İsimsiz Malzeme',
            miktar: Number(k.miktar) || 0,
            birim: k.birim || 'ADET'
          }))
        };

        await saveDocument('irsaliyeler', newIrsaliye);
        setIrsaliyeler(prev => [newIrsaliye, ...prev]);
        showStatus('success', `🎉 ${newIrsaliye.irsaliyeNo} irsaliye belgesi başarıyla sisteme aktarıldı!`);

      } else if (docType === 'makbuz') {
        const newKasaHareketi = {
          id: systemId,
          tarih: parsedData.tarih || new Date().toISOString().slice(0,10),
          hareketTipi: (parsedData.hareketTipi === 'GİRİŞ' ? 'GİRİŞ' : 'ÇIKIŞ') as 'GİRİŞ' | 'ÇIKIŞ',
          tutar: Number(parsedData.tutar) || 0,
          aciklama: `${parsedData.aciklama || 'Makbuz Girişi'} | Muhatap: ${parsedData.firma || 'Dış Firma'} (AI Aktarım)`,
          referansTipi: 'DİĞER' as const,
          referansId: parsedData.referansId || `REF-${Date.now()}`
        };

        await saveDocument('kasaHareketleri', newKasaHareketi);
        setKasaHareketleri(prev => [newKasaHareketi, ...prev]);
        showStatus('success', `🎉 ₺${newKasaHareketi.tutar} tutarındaki makbuz hareketi kasa defterine işlendi!`);

      } else if (docType === 'hakedis') {
        const matchedCari = cariKartlar.find(c => 
          c.unvan.toLowerCase().includes(parsedData.cariUnvan?.toLowerCase() || '')
        );

        const newHakedisFatura = {
          id: systemId,
          faturaNo: parsedData.faturaNo || `HK-${Date.now().toString().slice(-6)}`,
          tarih: parsedData.tarih || new Date().toISOString().slice(0,10),
          cariKartId: matchedCari?.id || 'CARI-TAŞERON',
          cariUnvan: parsedData.cariUnvan || 'Taşeron Firma',
          toplamTutar: Number(parsedData.toplamTutar) || 0,
          kdvTutar: Number(parsedData.kdvTutar) || 0,
          genelToplam: Number(parsedData.genelToplam) || 0,
          durum: 'ONAYLANDI' as const,
          bagliIrsaliyeler: [],
          notlar: `Taşeron Hakedişi (${parsedData.donem || 'Belirtilmedi'}) | Açıklama: ${parsedData.aciklama || ''} (AI Aktarım)`,
          kalemler: [
            {
              id: `k_hakedis_${Date.now()}`,
              urunAdi: `HAKEDİŞ: ${parsedData.aciklama || 'Yapılan İş Bedeli'} (${parsedData.donem || 'Dönemli'})`,
              miktar: 1,
              birim: 'ADET',
              birimFiyat: Number(parsedData.toplamTutar) || 0,
              kdvOran: 20,
              toplam: Number(parsedData.toplamTutar) || 0
            }
          ]
        };

        await saveDocument('faturalar', newHakedisFatura);
        setFaturalar(prev => [newHakedisFatura, ...prev]);
        showStatus('success', `🎉 ${parsedData.donem} dönemli hakediş faturası başarıyla şantiye hakediş defterine kaydedildi!`);
      
      } else if (docType === 'yoklama') {
        const newYoklamalar = { ...yoklamalar };
        let matchedCount = 0;
        const unmatched: string[] = [];

        let importYear = new Date().getFullYear();
        let importMonth = new Date().getMonth() + 1;
        if (parsedData.tarih) {
          const parts = parsedData.tarih.split('-');
          if (parts.length >= 2) {
            importYear = Number(parts[0]) || importYear;
            importMonth = Number(parts[1]) || importMonth;
          } else {
            const monthNames = ['ocak', 'şubat', 'subat', 'mart', 'nisan', 'mayıs', 'mayis', 'haziran', 'temmuz', 'ağustos', 'agustos', 'eylül', 'eylul', 'ekim', 'kasım', 'kasim', 'aralık', 'aralik'];
            const lower = parsedData.tarih.toLowerCase();
            monthNames.forEach((name, idx) => {
              if (lower.includes(name)) importMonth = (idx % 12) + 1;
            });
            const yearMatch = parsedData.tarih.match(/20\d{2}/);
            if (yearMatch) importYear = Number(yearMatch[0]);
          }
        }

        (parsedData.yoklamaKayitlari || []).forEach((item: any) => {
          const matchedPerson = findPersonelByName(personeller, item.adSoyad || '');
          if (!matchedPerson) {
            unmatched.push(item.adSoyad || 'Bilinmeyen');
            return;
          }

          let dayNo = Number(item.gunNo);
          if (!dayNo && parsedData.tarih) {
            const parts = parsedData.tarih.split('-');
            if (parts.length === 3) dayNo = Number(parts[2]);
          }
          if (!dayNo) dayNo = new Date().getDate();

          const validDurum = ['Geldi', 'Yok', 'İzinli', 'Raporlu', 'Pazar', 'Tatil'].includes(item.durum)
            ? item.durum
            : 'Geldi';

          newYoklamalar[matchedPerson.id] = setYoklamaDay(newYoklamalar[matchedPerson.id], importYear, importMonth, dayNo, {
            durum: validDurum as any,
            mesaiSaati: Number(item.mesaiSaati) || 0
          });
          matchedCount++;
        });

        setYoklamalar(newYoklamalar);
        const unmatchedMsg = unmatched.length > 0 ? ` Eşleşmeyen: ${unmatched.join(', ')}` : '';
        showStatus('success', `🎉 Toplam ${matchedCount} personelin yoklama/puantaj verisi (${importMonth}/${importYear}) sisteme aktarıldı!${unmatchedMsg}`);

      } else if (docType === 'saha_faaliyet') {
        const mappedList = (parsedData.aktifPersonelListesi || []).map((name: string) => {
          const matched = personeller.find(p => `${p.ad} ${p.soyad}`.toLowerCase().trim() === name.toLowerCase().trim());
          return matched ? `${matched.ad} ${matched.soyad}` : name;
        });

        const newSahaFaaliyet = {
          id: `sf_${Date.now()}`,
          personelId: currentUser?.uid || 'system_ai',
          tarih: parsedData.tarih || new Date().toISOString().slice(0, 10),
          isNiteligi: parsedData.isNiteligi || 'Şantiye Saha İşleri',
          parsel: parsedData.parsel || 'Parsel A',
          blok: parsedData.blok || 'Blok B',
          aciklama: parsedData.aciklama || 'Günlük saha faaliyeti yapay zeka tarafından işlendi.',
          aktifPersonelListesi: mappedList
        };

        await saveDocument('sahaFaaliyetleri', newSahaFaaliyet);
        setSahaFaaliyetleri(prev => [newSahaFaaliyet, ...prev]);
        showStatus('success', `🎉 Günlük Saha Faaliyet Raporu başarıyla İdari İşler / Günlük Loglar sekmesine kaydedildi!`);
      }

      // Reset
      setSelectedFile(null);
      setParsedData(null);
      setDetectedTypeMsg(null);
      setDocType('auto');
    } catch (err: any) {
      console.error(err);
      showStatus('error', `Sisteme Kaydetme Hatası: ${err.message || 'Lütfen alanları kontrol edin.'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex-grow p-6 bg-slate-50 text-slate-700 select-none overflow-y-auto min-h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest block">YAPAY ZEKA ENTEGRASYONU</span>
            <h1 className="font-display font-black text-xl text-slate-850 tracking-tight uppercase leading-none">Eski Evrakları Programa Aktar</h1>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
              2 yıldır devam eden şantiyenin geçmiş verilerini sisteme aktarmak için fatura, irsaliye, makbuz, hakediş, yoklama/puantaj ve saha faaliyet raporu belgelerini yükleyin. Yapay zeka otomatik olarak algılar ve ilgili modüle kaydeder.
            </p>
          </div>
          <div className="w-12 h-12 bg-white border border-blue-100 rounded-2xl flex items-center justify-center text-blue-500 shrink-0 shadow-xs">
            <Layers size={22} className="animate-pulse" />
          </div>
        </div>

        {/* Toplu PDF aktarım */}
        <div className="bg-white border border-amber-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <span className="text-[10px] font-black tracking-widest text-amber-700 uppercase block">TOPLU PDF AKTARIM (12 SAYFA GİBİ)</span>
          <p className="text-xs text-slate-500 leading-relaxed">
            Çok sayfalı taranmış PDF&apos;yi sayfa sayfa ayırır; her sayfayı ayrı fatura evrakı olarak okur. Kayıtlı cari varsa aynı kartın altına devam eder; yoksa bir kez sorar. Stok kartları da eşleştirilir.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <label className="flex-1 text-xs border border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={batchRunning}
                onChange={(e) => {
                  setBatchFile(e.target.files?.[0] || null);
                  setBatchRows([]);
                }}
              />
              {batchFile ? batchFile.name : 'PDF seçin (örn. 157-46 dograma hesap)'}
            </label>
            <button
              type="button"
              disabled={!batchFile || batchRunning}
              onClick={handleBatchPdfImport}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              {batchRunning ? <RefreshCw size={14} className="animate-spin" /> : <Layers size={14} />}
              Tüm Sayfaları Tara ve Aktar
            </button>
          </div>
          {batchProgress && (
            <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{batchProgress}</p>
          )}
          {batchRows.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl text-[10px]">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Sayfa</th>
                    <th className="text-left p-2">Durum</th>
                    <th className="text-left p-2">Tür</th>
                    <th className="text-left p-2">Firma / No</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((r) => (
                    <tr key={r.pageNo} className="border-t border-slate-100">
                      <td className="p-2 font-mono">{r.pageNo}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2">{r.detectedType || '—'}</td>
                      <td className="p-2 truncate max-w-[200px]">{r.firma || r.evrakNo || r.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form elements */}
        {status && (
          <div className={`p-4 rounded-xl text-xs font-bold tracking-wide flex items-center gap-3 border ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <AlertCircle size={15} />
            <span>{status.text}</span>
          </div>
        )}

        {detectedTypeMsg && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center gap-3">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <span>{detectedTypeMsg}</span>
          </div>
        )}

        <div className="space-y-6">
          
          {/* Step 1: Evrak Dosyası Yükleme Alanı */}
          {!parsedData && !parsing ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">1. EVRAK DOSYASI YÜKLE</span>
              
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-3 transition ${
                  dragActive ? 'border-blue-500 bg-blue-500/5' : 'border-slate-200 hover:border-slate-400 bg-slate-50'
                }`}
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-450 border border-slate-150 shadow-2xs">
                  <Upload size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-705">
                    Sürükleyip Bırakın veya <label className="text-blue-600 hover:text-blue-550 cursor-pointer underline">Göz Atın<input type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" className="hidden" /></label>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG, JPEG (Maks. 10MB)</p>
                </div>
              </div>
            </div>
          ) : (
            selectedFile && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 flex justify-between items-center text-xs shadow-sm">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center text-blue-500 shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!parsing && (
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setParsedData(null);
                      setDetectedTypeMsg(null);
                      setDocType('auto');
                    }}
                    className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-4 py-2 rounded-xl font-bold transition duration-150 cursor-pointer"
                  >
                    Dosyayı Değiştir / Temizle
                  </button>
                )}
              </div>
            )
          )}

          {/* Step 2: Hangi Evrak Olduğunu Sorma ve Format Seçimi */}
          {selectedFile && !parsedData && !parsing && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm animate-fade-in">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-widest text-blue-600 uppercase block">2. EVRAK TÜRÜ VE FORMAT SEÇİMİ</span>
                <h3 className="text-sm font-extrabold text-slate-800">Bu evrak hangi şantiye kategorisine aittir?</h3>
                <p className="text-xs text-slate-500">Yapay zekanın evrakı doğru kurallarla çözmesi için formatı seçin.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: 'auto', label: '🤖 OTOMATİK TESPİT (AI)', icon: Layers, desc: 'Dosyayı inceleyip kategoriyi kendi algılar' },
                  { key: 'fatura', label: 'FATURA (Invoice)', icon: Landmark, desc: 'Malzeme satıcı faturaları ve nakit fişleri' },
                  { key: 'irsaliye', label: 'İRSALİYE (Waybill)', icon: ShoppingBag, desc: 'Şantiyeye giren malzeme sevk fişleri' },
                  { key: 'makbuz', label: 'MAKBUZ / DEKONT', icon: DollarSign, desc: 'Banka transfer dekontları, tediye makbuzları' },
                  { key: 'hakedis', label: 'HAKEDİŞ RAPORU', icon: FileSpreadsheet, desc: 'Taşeron hakediş kapak dökümleri' },
                  { key: 'yoklama', label: 'PUANTAJ / YOKLAMA', icon: Users, desc: 'Günlük veya aylık personel puantajları' },
                  { key: 'saha_faaliyet', label: 'SAHA FAALİYET RAPORU', icon: ClipboardCheck, desc: 'Günlük saha imalat raporu logları' }
                ].map(type => {
                  const Icon = type.icon;
                  const isSelected = docType === type.key;
                  return (
                    <button
                      key={type.key}
                      onClick={() => setDocType(type.key as any)}
                      className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex gap-3 items-start ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/10 font-bold shadow-xs' 
                          : 'bg-slate-50 border-slate-200 hover:border-slate-350 text-slate-650'
                      }`}
                    >
                      <Icon size={18} className={`shrink-0 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                      <div>
                        <h4 className="text-xs font-bold leading-none">{type.label}</h4>
                        <p className="text-[9px] text-slate-500 mt-1 leading-tight">{type.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleStartParsing}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-slate-800 font-black text-xs px-6 py-3.5 rounded-2xl transition tracking-wide flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                >
                  <RefreshCw size={12} className="animate-spin-slow" />
                  <span>YAPAY ZEKA İLE AYRIŞTIRMAYA BAŞLA</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Çözümleme Loading Animasyonu */}
          {parsing && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
              <div className="flex justify-center text-blue-550">
                <RefreshCw size={26} className="animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-blue-600">Yapay Zeka Evrakı Çözümlüyor...</p>
                <p className="text-xs text-slate-500 font-mono italic">"{loadingStep}"</p>
              </div>
            </div>
          )}

            {/* AI Review Form */}
            {parsedData && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">3. YAPAY ZEKA DOĞRULAMA FORMU</span>
                  <span className="bg-blue-50 text-blue-700 font-bold font-mono text-[9px] px-2 py-0.5 rounded border border-blue-100">GEMINI OKUMA SONUCU</span>
                </div>

                {/* Manual Document Type Override Dropdown */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800">Evrak Türünü Elle Değiştir</span>
                    <p className="text-[10px] text-slate-500">AI ayrıştırma sonucunun kaydedileceği modülü değiştirebilirsiniz. Veriler anında yeni formata uyarlanır.</p>
                  </div>
                  <select
                    value={docType}
                    onChange={(e) => handleDocTypeChange(e.target.value as any)}
                    className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-700 font-extrabold outline-none cursor-pointer hover:border-slate-350 transition-all text-xs"
                  >
                    <option value="fatura">FATURA (Invoice)</option>
                    <option value="irsaliye">İRSALİYE (Waybill)</option>
                    <option value="makbuz">MAKBUZ / DEKONT</option>
                    <option value="hakedis">HAKEDİŞ RAPORU</option>
                    <option value="yoklama">PUANTAJ / YOKLAMA</option>
                    <option value="saha_faaliyet">SAHA FAALİYET RAPORU</option>
                  </select>
                </div>

                {/* 1. Review Form: Fatura */}
                {docType === 'fatura' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Fatura No</label>
                        <input 
                          type="text" 
                          value={parsedData.faturaNo || ''} 
                          onChange={e => setParsedData({ ...parsedData, faturaNo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Tarih</label>
                        <input 
                          type="date" 
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Satıcı Cari Ünvan</label>
                      <input 
                        type="text" 
                        value={parsedData.cariUnvan || ''} 
                        onChange={e => setParsedData({ ...parsedData, cariUnvan: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Matrah (KDV Hariç)</label>
                        <input 
                          type="number" 
                          value={parsedData.toplamTutar || 0} 
                          onChange={e => setParsedData({ ...parsedData, toplamTutar: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Toplam KDV</label>
                        <input 
                          type="number" 
                          value={parsedData.kdvTutar || 0} 
                          onChange={e => setParsedData({ ...parsedData, kdvTutar: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Genel Toplam (KDV Dahil)</label>
                        <input 
                          type="number" 
                          value={parsedData.genelToplam || 0} 
                          onChange={e => setParsedData({ ...parsedData, genelToplam: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 font-bold text-amber-600 font-mono"
                        />
                      </div>
                    </div>

                    {/* Fatura Kalemleri */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                      <div className="bg-slate-100 px-3 py-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">Fatura Malzeme Kalemleri</div>
                      <div className="p-2 space-y-2 max-h-36 overflow-y-auto bg-slate-50">
                        {(parsedData.kalemler || []).map((kalem: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center text-xs">
                            <input 
                              type="text" 
                              value={kalem.urunAdi || ''} 
                              placeholder="Ürün"
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].urunAdi = e.target.value;
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="flex-1 bg-white border border-slate-200 p-1 px-2 rounded text-slate-800 text-xs"
                            />
                            <input 
                              type="number" 
                              value={kalem.miktar || 0} 
                              placeholder="Mkt"
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].miktar = Number(e.target.value);
                                newKalemler[idx].toplam = Number(e.target.value) * (newKalemler[idx].birimFiyat || 0);
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="w-12 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs font-mono"
                            />
                            <input 
                              type="text" 
                              value={kalem.birim || ''} 
                              placeholder="Brm"
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].birim = e.target.value;
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="w-12 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs"
                            />
                            <input 
                              type="number" 
                              value={kalem.birimFiyat || 0} 
                              placeholder="Fiyat"
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].birimFiyat = Number(e.target.value);
                                newKalemler[idx].toplam = Number(e.target.value) * (newKalemler[idx].miktar || 0);
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="w-16 bg-white border border-slate-200 p-1 rounded text-right text-slate-800 text-xs font-mono text-amber-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Review Form: Irsaliye */}
                {docType === 'irsaliye' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">İrsaliye No</label>
                        <input 
                          type="text" 
                          value={parsedData.irsaliyeNo || ''} 
                          onChange={e => setParsedData({ ...parsedData, irsaliyeNo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Tarih</label>
                        <input 
                          type="date" 
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Sevk Eden Firma</label>
                      <input 
                        type="text" 
                        value={parsedData.firma || ''} 
                        onChange={e => setParsedData({ ...parsedData, firma: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>

                    {/* Irsaliye Kalemleri */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                      <div className="bg-slate-100 px-3 py-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">Sevk Edilen Malzemeler</div>
                      <div className="p-2 space-y-2 max-h-40 overflow-y-auto bg-slate-50">
                        {(parsedData.kalemler || []).map((kalem: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center text-xs">
                            <input 
                              type="text" 
                              value={kalem.urunAdi || ''} 
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].urunAdi = e.target.value;
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="flex-1 bg-white border border-slate-200 p-1 px-2 rounded text-slate-800 text-xs"
                            />
                            <input 
                              type="number" 
                              value={kalem.miktar || 0} 
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].miktar = Number(e.target.value);
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="w-16 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs font-mono"
                            />
                            <input 
                              type="text" 
                              value={kalem.birim || ''} 
                              onChange={e => {
                                const newKalemler = [...parsedData.kalemler];
                                newKalemler[idx].birim = e.target.value;
                                setParsedData({ ...parsedData, kalemler: newKalemler });
                              }}
                              className="w-16 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Review Form: Makbuz / Dekont */}
                {docType === 'makbuz' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Referans / Makbuz No</label>
                        <input 
                          type="text" 
                          value={parsedData.referansId || ''} 
                          onChange={e => setParsedData({ ...parsedData, referansId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">İşlem Tarihi</label>
                        <input 
                          type="date" 
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Ödeme Tipi</label>
                        <select 
                          value={parsedData.hareketTipi || 'ÇIKIŞ'} 
                          onChange={e => setParsedData({ ...parsedData, hareketTipi: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="ÇIKIŞ">Gider / Ödeme (Çıkış)</option>
                          <option value="GİRİŞ">Gelir / Tahsilat (Giriş)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">İşlem Tutarı (TL)</label>
                        <input 
                          type="number" 
                          value={parsedData.tutar || 0} 
                          onChange={e => setParsedData({ ...parsedData, tutar: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none font-bold text-amber-600 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Alıcı / Ödeyen Cari Unvan</label>
                      <input 
                        type="text" 
                        value={parsedData.firma || ''} 
                        onChange={e => setParsedData({ ...parsedData, firma: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Açıklama</label>
                      <input 
                        type="text" 
                        value={parsedData.aciklama || ''} 
                        onChange={e => setParsedData({ ...parsedData, aciklama: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Review Form: Hakedis */}
                {docType === 'hakedis' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş / Belge No</label>
                        <input 
                          type="text" 
                          value={parsedData.faturaNo || ''} 
                          onChange={e => setParsedData({ ...parsedData, faturaNo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş Tarihi</label>
                        <input 
                          type="date" 
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş Dönemi</label>
                        <input 
                          type="text" 
                          value={parsedData.donem || ''} 
                          placeholder="Örn: Haziran 2026"
                          onChange={e => setParsedData({ ...parsedData, donem: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Taşeron Firma (Yüklenici)</label>
                        <input 
                          type="text" 
                          value={parsedData.cariUnvan || ''} 
                          onChange={e => setParsedData({ ...parsedData, cariUnvan: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş Matrahı</label>
                        <input 
                          type="number" 
                          value={parsedData.toplamTutar || 0} 
                          onChange={e => setParsedData({ ...parsedData, toplamTutar: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş KDV</label>
                        <input 
                          type="number" 
                          value={parsedData.kdvTutar || 0} 
                          onChange={e => setParsedData({ ...parsedData, kdvTutar: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Hakediş Genel Toplamı</label>
                        <input 
                          type="number" 
                          value={parsedData.genelToplam || 0} 
                          onChange={e => setParsedData({ ...parsedData, genelToplam: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 font-bold text-emerald-600 font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">İş Tanımı / Açıklama</label>
                      <input 
                        type="text" 
                        value={parsedData.aciklama || ''} 
                        onChange={e => setParsedData({ ...parsedData, aciklama: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 5. Review Form: Yoklama */}
                {docType === 'yoklama' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Rapor / Yoklama Tarihi</label>
                        <input 
                          type="text" 
                          placeholder="Örn: 2026-06-15 veya Haziran 2026"
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div className="flex items-end text-[10px] text-slate-500 italic">
                        * Tespit edilen isimler sistemdeki personellerle eşleştirilir.
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                      <div className="bg-slate-100 px-3 py-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">Personel Yoklama Listesi</div>
                      <div className="p-2 space-y-2 max-h-56 overflow-y-auto bg-slate-50">
                        {(parsedData.yoklamaKayitlari || []).map((kayit: any, idx: number) => (
                          <div key={idx} className="flex gap-2 items-center text-xs">
                            <input 
                              type="text" 
                              value={kayit.adSoyad || ''} 
                              placeholder="Personel Adı Soyadı"
                              onChange={e => {
                                const newKayitlar = [...parsedData.yoklamaKayitlari];
                                newKayitlar[idx].adSoyad = e.target.value;
                                setParsedData({ ...parsedData, yoklamaKayitlari: newKayitlar });
                              }}
                              className="flex-1 bg-white border border-slate-200 p-1 px-2 rounded text-slate-800 text-xs"
                            />
                            <select 
                              value={kayit.durum || 'Geldi'} 
                              onChange={e => {
                                const newKayitlar = [...parsedData.yoklamaKayitlari];
                                newKayitlar[idx].durum = e.target.value;
                                setParsedData({ ...parsedData, yoklamaKayitlari: newKayitlar });
                              }}
                              className="w-24 bg-white border border-slate-200 p-1 rounded text-slate-800 text-xs cursor-pointer"
                            >
                              <option value="Geldi">Geldi</option>
                              <option value="Yok">Yok</option>
                              <option value="İzinli">İzinli</option>
                              <option value="Raporlu">Raporlu</option>
                              <option value="Pazar">Pazar</option>
                              <option value="Tatil">Tatil</option>
                            </select>
                            <input 
                              type="number" 
                              value={kayit.gunNo || ''} 
                              placeholder="Gün"
                              title="Ayın Günü (1-31)"
                              onChange={e => {
                                const newKayitlar = [...parsedData.yoklamaKayitlari];
                                newKayitlar[idx].gunNo = e.target.value ? Number(e.target.value) : '';
                                setParsedData({ ...parsedData, yoklamaKayitlari: newKayitlar });
                              }}
                              className="w-12 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs font-mono"
                            />
                            <input 
                              type="number" 
                              value={kayit.mesaiSaati || ''} 
                              placeholder="Mesai"
                              title="Fazla Mesai Saati"
                              onChange={e => {
                                const newKayitlar = [...parsedData.yoklamaKayitlari];
                                newKayitlar[idx].mesaiSaati = e.target.value ? Number(e.target.value) : '';
                                setParsedData({ ...parsedData, yoklamaKayitlari: newKayitlar });
                              }}
                              className="w-12 bg-white border border-slate-200 p-1 rounded text-center text-slate-800 text-xs font-mono text-emerald-600"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Review Form: Saha Faaliyet */}
                {docType === 'saha_faaliyet' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Rapor Tarihi</label>
                        <input 
                          type="date" 
                          value={parsedData.tarih || ''} 
                          onChange={e => setParsedData({ ...parsedData, tarih: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">İş Niteliği (Aktivite)</label>
                        <input 
                          type="text" 
                          value={parsedData.isNiteligi || ''} 
                          onChange={e => setParsedData({ ...parsedData, isNiteligi: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Parsel No</label>
                        <input 
                          type="text" 
                          value={parsedData.parsel || ''} 
                          onChange={e => setParsedData({ ...parsedData, parsel: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Blok No</label>
                        <input 
                          type="text" 
                          value={parsedData.blok || ''} 
                          onChange={e => setParsedData({ ...parsedData, blok: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Günlük Detaylı Faaliyet Açıklamaları</label>
                      <textarea 
                        rows={3}
                        value={parsedData.aciklama || ''} 
                        onChange={e => setParsedData({ ...parsedData, aciklama: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 text-xs rounded-xl text-slate-800 outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Aktif Çalışan Sahadaki Personeller (Virgülle Ayrılmış)</label>
                      <input 
                        type="text" 
                        value={(parsedData.aktifPersonelListesi || []).join(', ')} 
                        onChange={e => {
                          const list = e.target.value.split(',').map(s => s.trim()).filter(s => s !== '');
                          setParsedData({ ...parsedData, aktifPersonelListesi: list });
                        }}
                        placeholder="Ahmet Yılmaz, Nuri Mutlu..."
                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                )}

                <button
                  disabled={importing}
                  onClick={handleImportToSystem}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-800/40 text-slate-800 font-black text-xs py-3.5 rounded-xl transition tracking-wide flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  {importing ? <RefreshCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>DOĞRULANAN VERİLERİ ŞANTİYE SİSTEMİNE AKTAR</span>
                </button>
              </div>
            )}

        </div>

      </div>
    </div>
  );
};

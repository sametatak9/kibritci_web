import React, { useState } from 'react';
import { 
  CreditCard, FileText, ClipboardList, Plus, Trash2, Edit3, 
  Search, Eye, Printer, Upload, Sparkles, Send, CheckCircle2 
} from 'lucide-react';
import { Fatura, FaturaItem, Irsaliye, CariKart, StokKart, SatinAlmaTalebi, EvrakBaglantiGrubu } from '../types/erp';
import { compressImage } from '../lib/imageCompress';
import { fetchApiJson } from '../lib/apiClient';
import { fileToAiPayload } from '../lib/aiFileUpload';
import { faturaIsLinked } from '../lib/documentLinkUtils';
import { BagliEvraklarListesi } from './BagliEvraklarListesi';
import { EvrakTabBilgi } from './EvrakTabBilgi';

interface FaturaGirisScreenProps {
  faturalar: Fatura[];
  setFaturalar: React.Dispatch<React.SetStateAction<Fatura[]>>;
  irsaliyeler: Irsaliye[];
  setIrsaliyeler?: React.Dispatch<React.SetStateAction<Irsaliye[]>>;
  satinAlmaTalepleri: SatinAlmaTalebi[];
  cariKartlar: CariKart[];
  setCariKartlar?: React.Dispatch<React.SetStateAction<CariKart[]>>;
  stokKartlar: StokKart[];
  setStokKartlar?: React.Dispatch<React.SetStateAction<StokKart[]>>;
  evrakBaglantiGruplari: EvrakBaglantiGrubu[];
  setEvrakBaglantiGruplari: React.Dispatch<React.SetStateAction<EvrakBaglantiGrubu[]>>;
  currentUser?: any;
  addNotification?: (mesaj: string) => void;
  onNavigateToBaglama?: (prefill?: { saId?: string; irIds?: string[]; faturaId?: string; anchor?: 'satin_alma' | 'irsaliye' | 'fatura' }) => void;
}

export const FaturaGirisScreen: React.FC<FaturaGirisScreenProps> = ({
  faturalar,
  setFaturalar,
  irsaliyeler,
  setIrsaliyeler,
  satinAlmaTalepleri,
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
  evrakBaglantiGruplari,
  setEvrakBaglantiGruplari,
  currentUser,
  addNotification
  ,
  onNavigateToBaglama
}) => {
  const [activeTab, setActiveTab] = useState<'giris' | 'bagli'>('giris');
  
  // Form states
  const [ftNo, setFtNo] = useState("");
  const [ftDate, setFtDate] = useState(new Date().toISOString().split('T')[0]);
  const [ftSupplier, setFtSupplier] = useState("");
  const [ftItems, setFtItems] = useState<FaturaItem[]>([]);
  const [tempItem, setTempItem] = useState({ name: "", qty: 0, unit: "ADET", price: 0, kdv: 20 });
  const [ftAttachmentUrl, setFtAttachmentUrl] = useState<string | null>(null);
  const [ftSignedAttachmentUrl, setFtSignedAttachmentUrl] = useState<string | null>(null);
  const [editingFtId, setEditingFtId] = useState<string | null>(null);

  // AI Parser states
  const [isFtParsing, setIsFtParsing] = useState(false);
  const [ftParseError, setFtParseError] = useState<string | null>(null);
  const [ftParseSuccess, setFtParseSuccess] = useState<string | null>(null);

  // Suggestions/Modal states for Cari and Stok creation
  const [showCariSuggest, setShowCariSuggest] = useState(false);
  const [suggestedCariName, setSuggestedCariName] = useState("");
  const [suggestedCariType, setSuggestedCariType] = useState<CariKart['kartTipi']>('TEDARIKCI');
  
  const [showStokSuggest, setShowStokSuggest] = useState(false);
  const [suggestedStokName, setSuggestedStokName] = useState("");
  const [suggestedStokCat, setSuggestedStokCat] = useState("Kaba İnşaat İmalatı");
  const [suggestedStokUnit, setSuggestedStokUnit] = useState("ADET");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setFtAttachmentUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setFtSignedAttachmentUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const processFaturaAi = async (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFtParseError("Lütfen sadece PDF veya Görsel (PNG, JPG, WEBP) formatında Fatura yükleyiniz.");
      return;
    }

    setIsFtParsing(true);
    setFtParseError(null);
    setFtParseSuccess(null);

    try {
      const { fileBase64, mimeType } = await fileToAiPayload(file);
      const resData = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
        '/api/parse-fatura',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64, mimeType }),
        }
      );
      if (!resData.success) {
        throw new Error(resData.error || 'Fatura belgesi çözümlenirken hata oluştu.');
      }

      const parsed = resData.data;
      setFtNo(parsed.faturaNo || "");
      if (parsed.tarih) setFtDate(parsed.tarih);
      if (parsed.firma) {
        setFtSupplier(parsed.firma);
        checkAndSuggestCari(parsed.firma);
      }
      if (parsed.kalemler && parsed.kalemler.length > 0) {
        const formatted = parsed.kalemler.map((x: any, idx: number) => ({
          id: `fti_ai_${Date.now()}_${idx}`,
          urunAdi: x.urunAdi,
          miktar: Number(x.miktar) || 0,
          birim: x.birim || "ADET",
          birimFiyat: Number(x.birimFiyat) || 0,
          kdvOran: Number(x.kdvOran) || 20,
          toplam: Number(x.toplam) || (Number(x.miktar) * Number(x.birimFiyat)) || 0
        }));
        setFtItems(formatted);
        formatted.forEach((item: any) => checkAndSuggestStok(item.urunAdi, item.birim));
      }
      setFtParseSuccess(`Yapay Zeka Okuması Başarılı! No: ${parsed.faturaNo || ''}`);
    } catch (err: any) {
      setFtParseError(err.message || "Dosya çözümlenemedi.");
    } finally {
      setIsFtParsing(false);
    }
  };

  const checkAndSuggestCari = (name: string) => {
    const exists = cariKartlar.some(c => c.unvan.toLowerCase().trim() === name.toLowerCase().trim());
    if (!exists) {
      setSuggestedCariName(name);
      setShowCariSuggest(true);
    }
  };

  const handleCreateCari = () => {
    if (!suggestedCariName) return;
    const exists = cariKartlar.some(c => c.unvan.toLowerCase().trim() === suggestedCariName.toLowerCase().trim());
    if (exists) {
      alert("Hata: Bu isimde bir cari zaten bulunmaktadır.");
      setShowCariSuggest(false);
      return;
    }
    const newCari: CariKart = {
      id: `ck_${Date.now()}`,
      kartTipi: suggestedCariType,
      kod: `CAR-${Math.floor(100 + Math.random() * 900)}`,
      unvan: suggestedCariName,
      yetkili: "Otomatik Eklendi",
      telefon: "",
      eposta: "",
      vergiNo: "",
      vergiDairesi: "",
      adres: "Fatura girişinden otomatik oluşturuldu.",
      iban: "",
      durum: 'AKTIF',
      notlar: "Otomatik eklendi."
    };
    if (setCariKartlar) {
      setCariKartlar(prev => [newCari, ...prev]);
    }
    setShowCariSuggest(false);
    alert(`Yeni Cari Kart (${suggestedCariName}) başarıyla oluşturuldu!`);
  };

  const checkAndSuggestStok = (name: string, unit: string = "ADET") => {
    const exists = stokKartlar.some(s => s.stokAdi.toLowerCase().trim() === name.toLowerCase().trim());
    if (!exists) {
      setSuggestedStokName(name);
      setSuggestedStokUnit(unit);
      setShowStokSuggest(true);
    }
  };

  const handleCreateStok = () => {
    if (!suggestedStokName) return;
    const exists = stokKartlar.some(s => s.stokAdi.toLowerCase().trim() === suggestedStokName.toLowerCase().trim());
    if (exists) {
      alert("Hata: Bu isimde bir stok zaten bulunmaktadır.");
      setShowStokSuggest(false);
      return;
    }
    const newStok: StokKart = {
      id: `sk_${Date.now()}`,
      stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
      stokAdi: suggestedStokName,
      kategori: suggestedStokCat,
      birim: suggestedStokUnit,
      kritikSeviye: 5,
      durum: 'AKTIF',
      aciklama: "Fatura girişinden otomatik oluşturuldu."
    };
    if (setStokKartlar) {
      setStokKartlar(prev => [newStok, ...prev]);
    }
    setShowStokSuggest(false);
    alert(`Yeni Stok Kartı (${suggestedStokName}) başarıyla oluşturuldu!`);
  };

  const handleAddItem = () => {
    if (!tempItem.name || tempItem.qty <= 0 || tempItem.price <= 0) return;
    const itemTotal = tempItem.qty * tempItem.price;
    setFtItems(prev => [
      ...prev,
      {
        id: `fti_${Date.now()}`,
        urunAdi: tempItem.name,
        miktar: tempItem.qty,
        birim: tempItem.unit,
        birimFiyat: tempItem.price,
        kdvOran: tempItem.kdv,
        toplam: itemTotal
      }
    ]);
    checkAndSuggestStok(tempItem.name, tempItem.unit);
    setTempItem({ name: "", qty: 0, unit: "ADET", price: 0, kdv: 20 });
  };

  const handleSaveFatura = () => {
    if (!ftNo || !ftSupplier || ftItems.length === 0) {
      alert("Lütfen Fatura No, Firma ve en az 1 Fatura Kalemi giriniz.");
      return;
    }

    const calculatedSub = ftItems.reduce((acc, curr) => acc + curr.toplam, 0);
    const calculatedKdv = ftItems.reduce((acc, curr) => acc + (curr.toplam * (curr.kdvOran / 100)), 0);
    const calculatedGrand = calculatedSub + calculatedKdv;

    if (editingFtId) {
      const existing = faturalar.find((f) => f.id === editingFtId);
      setFaturalar(prev => prev.map(ft => {
        if (ft.id === editingFtId) {
          return {
            ...ft,
            faturaNo: ftNo,
            tarih: ftDate,
            cariUnvan: ftSupplier,
            cariKartId: cariKartlar.find(c => c.unvan === ftSupplier)?.id || "",
            saId: existing?.saId,
            toplamTutar: calculatedSub,
            kdvTutar: calculatedKdv,
            genelToplam: calculatedGrand,
            kalemler: ftItems,
            evrakUrl: ftAttachmentUrl || undefined,
            imzaliEvrakUrl: ftSignedAttachmentUrl || undefined,
            bagliIrsaliyeler: existing?.bagliIrsaliyeler || [],
          };
        }
        return ft;
      }));
      setEditingFtId(null);
    } else {
      const newFt: Fatura = {
        id: `ft_${Date.now()}`,
        faturaNo: ftNo,
        tarih: ftDate,
        cariUnvan: ftSupplier,
        cariKartId: cariKartlar.find(c => c.unvan === ftSupplier)?.id || "",
        toplamTutar: calculatedSub,
        kdvTutar: calculatedKdv,
        genelToplam: calculatedGrand,
        durum: 'KONTROL BEKLEYOR',
        kalemler: ftItems,
        evrakUrl: ftAttachmentUrl || undefined,
        imzaliEvrakUrl: ftSignedAttachmentUrl || undefined,
        bagliIrsaliyeler: [],
      };
      setFaturalar(prev => [newFt, ...prev]);
    }

    checkAndSuggestCari(ftSupplier);

    setFtNo("");
    setFtSupplier("");
    setFtItems([]);
    setFtAttachmentUrl(null);
    setFtSignedAttachmentUrl(null);
    setActiveTab('giris');
    alert("Fatura kaydedildi. Bağlama için «Bağlama» sekmesini kullanın.");
  };

  const handlePreviewPdf = (ft: Fatura) => {
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Kibritçi İnşaat - Fatura Raporu: ${ft.faturaNo}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .corporate-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .logo { font-weight: 900; font-size: 22px; color: #1e3a8a; display: flex; align-items: center; gap: 8px; }
            .logo svg { fill: #1e3a8a; }
            .title-area { text-align: right; }
            .title-area h2 { margin: 0; font-size: 16px; color: #0f172a; }
            .title-area p { margin: 2px 0 0 0; font-size: 10px; font-weight: bold; color: #64748b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
            .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 11px; }
            .info-card h4 { margin: 0 0 8px 0; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 12px; }
            .info-card p { margin: 4px 0; font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; }
            .items-table th { background-color: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .items-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 11px; font-weight: 500; }
            .items-table tr:nth-child(even) { background-color: #f8fafc; }
            .total-section { float: right; width: 280px; margin-top: 20px; font-size: 11px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-weight: 500; }
            .grand-total { font-weight: bold; color: #1e3a8a; border-bottom: 2px double #1e3a8a; font-size: 12px; }
            .signatures-title { margin-top: 180px; font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px dashed #cbd5e1; padding-bottom: 5px; text-transform: uppercase; }
            .signatures-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 15px; }
            .sig-col { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; font-size: 10px; background: #fff; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between; }
            .sig-title { font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="corporate-header">
            <div class="logo">
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 19H5.5L12 5.5z"/></svg>
              KİBRİTÇİ İNŞAAT A.Ş.
            </div>
            <div class="title-area">
              <h2>RESMİ FATURA İNCELEME FORMU</h2>
              <p>FATURA NO: ${ft.faturaNo}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h4>📋 FATURA DETAYI</h4>
              <p><strong>Tarih:</strong> ${ft.tarih}</p>
              <p><strong>Cari Ünvan:</strong> ${ft.cariUnvan}</p>
              <p><strong>Bağlı Sipariş (PO):</strong> ${ft.saId || 'BAĞLANTI YOK'}</p>
            </div>
            <div class="info-card">
              <h4>🚛 SEVKİYAT İLİŞKİLERİ</h4>
              <p><strong>Bağlı İrsaliye Sayısı:</strong> ${ft.bagliIrsaliyeler ? ft.bagliIrsaliyeler.length : 0}</p>
              <p><strong>Bağlı Belgeler:</strong> ${ft.bagliIrsaliyeler ? ft.bagliIrsaliyeler.join(', ') : 'Yok'}</p>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Malzeme / Hizmet Adı</th>
                <th style="text-align: right;">Miktar</th>
                <th style="text-align: right;">Birim Fiyat</th>
                <th style="text-align: right;">KDV %</th>
                <th style="text-align: right;">Tutar (KDV Hariç)</th>
              </tr>
            </thead>
            <tbody>
              ${ft.kalemler.map(x => `
                <tr>
                  <td>${x.urunAdi}</td>
                  <td style="text-align: right;">${x.miktar} ${x.birim}</td>
                  <td style="text-align: right;">${x.birimFiyat.toLocaleString('tr-TR')} TL</td>
                  <td style="text-align: right;">%${x.kdvOran}</td>
                  <td style="text-align: right;">${x.toplam.toLocaleString('tr-TR')} TL</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total-section">
            <div class="total-row">
              <span>Toplam Matrah:</span>
              <span>${ft.toplamTutar.toLocaleString('tr-TR')} TL</span>
            </div>
            <div class="total-row">
              <span>Hesaplanan KDV:</span>
              <span>${ft.kdvTutar.toLocaleString('tr-TR')} TL</span>
            </div>
            <div class="total-row grand-total">
              <span>GENEL TOPLAM (KDV Dahil):</span>
              <span>${ft.genelToplam.toLocaleString('tr-TR')} TL</span>
            </div>
          </div>

          <div class="signatures-title">🖋️ ONAY VE İMZA KANALLARI</div>
          <div class="signatures-grid">
            <div class="sig-col">
              <span class="sig-title">Hazırlayan</span>
              <span style="font-weight:bold; color:#0f172a; margin-top:10px;">${currentUser?.email ? currentUser.email.split('@')[0].toUpperCase() : 'ŞANTİYE'}</span>
            </div>
            <div class="sig-col">
              <span class="sig-title">Muhasebe</span>
              <span style="color:#94a3b8; font-style:italic;">İmza Yetkisi</span>
            </div>
            <div class="sig-col">
              <span class="sig-title">Satın Alma Md.</span>
              <span style="color:#94a3b8; font-style:italic;">İmza Yetkisi</span>
            </div>
            <div class="sig-col">
              <span class="sig-title">Şantiye Şefi</span>
              <span style="color:#10b981; font-weight:850; margin-top:10px;">✓ ONAYLANDI</span>
            </div>
            <div class="sig-col">
              <span class="sig-title">Proje Müdürü</span>
              <span style="color:#10b981; font-weight:850; margin-top:10px;">✓ ONAYLANDI</span>
            </div>
          </div>
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
  };

  const bagimsizFaturalar = faturalar.filter(ft => !faturaIsLinked(ft));

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col font-sans select-none bg-slate-50/50 space-y-6">
      
      {/* Navigation tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-xs gap-4 shrink-0">
        <div className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-[#2563eb] uppercase">Fatura &amp; Finansal Kontrol</span>
          <h2 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
            💳 Şantiye Fatura Kayıt ve Yapay Zeka Eşleştirme Paneli
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setActiveTab('giris');
              setEditingFtId(null);
            }}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${activeTab === 'giris' ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            1 · Fatura Giriş (Manuel / AI)
          </button>
          <button
            onClick={() => onNavigateToBaglama?.({ anchor: 'fatura' })}
            className="px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200"
          >
            → Evrak Bağlama Merkezi
          </button>
          <button
            onClick={() => setActiveTab('bagli')}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${activeTab === 'bagli' ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            2 · Bağlı Evraklar
          </button>
        </div>
      </div>

      {activeTab === 'giris' && <EvrakTabBilgi tab="fatura-giris" />}

      {activeTab === 'giris' && (
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Left Form Panel */}
          <div className="w-full lg:w-[440px] bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            
            {/* AI parse box */}
            <div className="bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 space-y-3">
              <span className="font-extrabold text-blue-900 tracking-wide text-[9px] uppercase block">🤖 YAPAY ZEKA DESTEKLİ FATURA OKUYUCU</span>
              <p className="text-[10px] text-blue-700 font-medium">Fatura belgenizi yükleyin; no, firma ve kalemleri yapay zeka ile otomatik dolduralım.</p>
              <div className="relative border-2 border-dashed border-blue-200 rounded-xl p-4 text-center bg-white hover:bg-blue-50/20 transition cursor-pointer">
                <input 
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => { if(e.target.files?.[0]) processFaturaAi(e.target.files[0]); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isFtParsing ? (
                  <span className="text-[10px] font-bold text-blue-800 block animate-pulse">Gemini Belgeyi Çözümlüyor...</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-550 block">Belge Seçin veya Sürükleyin</span>
                )}
              </div>
              {ftParseError && <p className="text-[9px] font-bold text-rose-600">❌ {ftParseError}</p>}
              {ftParseSuccess && <p className="text-[9px] font-bold text-emerald-700">✅ {ftParseSuccess}</p>}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Fatura No *</label>
                <input 
                  type="text"
                  placeholder="FAT-2026-X88"
                  value={ftNo}
                  onChange={(e) => setFtNo(e.target.value)}
                  className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg focus:border-[#2563eb] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fatura Tarihi</label>
                  <input 
                    type="date"
                    value={ftDate}
                    onChange={(e) => setFtDate(e.target.value)}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Firma / Cari Ünvan *</label>
                  <input 
                    type="text"
                    list="cari-datalist"
                    placeholder="Tedarikçi Adı"
                    value={ftSupplier}
                    onChange={(e) => setFtSupplier(e.target.value)}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                  />
                  <datalist id="cari-datalist">
                    {cariKartlar.map(c => (
                      <option key={c.id} value={c.unvan} />
                    ))}
                  </datalist>
                </div>
              </div>

              <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-2.5">
                PO ve irsaliye bağlama «Bağlama» sekmesinde 2 aşamalı yapılır. YZ analiz için «YZ Karşılaştır» menüsünü kullanın.
              </p>

              {/* Add items */}
              <div className="bg-slate-550/5 p-3 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">💰 Fatura Kalemleri</span>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="text"
                    list="stok-datalist"
                    placeholder="Kalem Adı"
                    value={tempItem.name}
                    onChange={(e) => setTempItem(prev => ({ ...prev, name: e.target.value }))}
                    className="col-span-2 p-1.5 border border-slate-200 rounded-lg text-[10px]"
                  />
                  <datalist id="stok-datalist">
                    {stokKartlar.map(s => (
                      <option key={s.id} value={s.stokAdi} />
                    ))}
                  </datalist>
                  <input 
                    type="number"
                    placeholder="Miktar"
                    value={tempItem.qty || ""}
                    onChange={(e) => setTempItem(prev => ({ ...prev, qty: Number(e.target.value) }))}
                    className="p-1.5 border border-slate-200 rounded-lg text-[10px] text-center"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="number"
                    placeholder="Birim Fiyat"
                    value={tempItem.price || ""}
                    onChange={(e) => setTempItem(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="p-1.5 border border-slate-200 rounded-lg text-[10px]"
                  />
                  <select
                    value={tempItem.kdv}
                    onChange={(e) => setTempItem(prev => ({ ...prev, kdv: Number(e.target.value) }))}
                    className="p-1.5 border border-slate-200 rounded-lg text-[10px]"
                  >
                    <option value="20">KDV %20</option>
                    <option value="10">KDV %10</option>
                    <option value="1">KDV %1</option>
                    <option value="0">KDV %0</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-950 transition cursor-pointer"
                  >
                    Kalem Ekle
                  </button>
                </div>

                {/* List items */}
                <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2 border-t text-[11px] font-semibold text-slate-700">
                  {ftItems.map(p => (
                    <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded-lg border">
                      <span>{p.urunAdi}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-900">{p.miktar} x {p.birimFiyat.toLocaleString('tr-TR')} TL</span>
                        <button
                          type="button"
                          onClick={() => setFtItems(prev => prev.filter(x => x.id !== p.id))}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload bills */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Fatura Belgesi</span>
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl border border-slate-200 block text-center font-bold text-[10px]">
                    {ftAttachmentUrl ? "✓ Yüklendi" : "Belge Yükle"}
                    <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                  </label>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">İmzalı Nüsha</span>
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl border border-slate-200 block text-center font-bold text-[10px]">
                    {ftSignedAttachmentUrl ? "✓ İmzalı Yüklendi" : "İmzalı Belge"}
                    <input type="file" onChange={handleSignedFileChange} className="hidden" accept="image/*,application/pdf" />
                  </label>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setFtItems([]);
                  setFtNo("");
                  setFtSupplier("");
                  setFtAttachmentUrl(null);
                  setFtSignedAttachmentUrl(null);
                  setEditingFtId(null);
                  setActiveTab('giris');
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-center cursor-pointer transition text-xs"
              >
                Temizle / Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveFatura}
                className="flex-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold py-2 rounded-xl text-center shadow cursor-pointer transition text-xs"
              >
                Faturayı Kaydet
              </button>
            </div>

          </div>

          <div className="flex-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">💡 Finansal Uyarı</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Bağlama işlemi «Evrak Bağlama Merkezi» sekmesinde yapılır. YZ analiz için «YZ Karşılaştır ve Yorumla» menüsünü kullanın.
              </p>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'bagli' && (
        <BagliEvraklarListesi
          mode="fatura"
          accent="blue"
          faturalar={faturalar}
          irsaliyeler={irsaliyeler}
          satinAlmaTalepleri={satinAlmaTalepleri}
          evrakBaglantiGruplari={evrakBaglantiGruplari}
          setFaturalar={setFaturalar}
          setIrsaliyeler={setIrsaliyeler}
          onEditBinding={(g) => {
            onNavigateToBaglama?.({
              saId: g.saId,
              irIds: g.irsaliyeIds,
              faturaId: g.faturaId,
              anchor: 'fatura',
            });
          }}
        />
      )}

      {/* ➕ CARİ SUGGEST MODAL */}
      {showCariSuggest && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-display font-bold text-xs text-slate-900 uppercase">🏢 Cari Firma Önerisi</h3>
            <p className="text-xs text-slate-500 leading-normal">
              Girdiğiniz <strong>"{suggestedCariName}"</strong> firması veritabanında bulunamadı. Bu firmayı yeni bir Cari Kart olarak eklemek ister misiniz?
            </p>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Cari Kart Türü (Etiket):</label>
              <select
                value={suggestedCariType}
                onChange={(e) => setSuggestedCariType(e.target.value as any)}
                className="w-full text-xs p-2 bg-slate-50 border rounded-lg font-bold"
              >
                <option value="TEDARIKCI">Tedarikçi</option>
                <option value="TASERON">Altyüklenici / Taşeron</option>
                <option value="ALICI">Alıcı</option>
                <option value="SATICI">Satıcı</option>
                <option value="PERSONEL">Personel</option>
                <option value="ORTAKLAR">Ortaklar</option>
                <option value="CARI">Diğer Cari</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCariSuggest(false)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-center text-xs"
              >
                Hayır, Geç
              </button>
              <button 
                onClick={handleCreateCari} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-center text-xs"
              >
                Evet, Kart Aç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ➕ STOK SUGGEST MODAL */}
      {showStokSuggest && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-display font-bold text-xs text-slate-900 uppercase">📦 Stok Malzeme Önerisi</h3>
            <p className="text-xs text-slate-500 leading-normal">
              Girdiğiniz <strong>"{suggestedStokName}"</strong> malzemesi veritabanında bulunamadı. Bu malzemeyi yeni bir Stok Kartı olarak envantere eklemek ister misiniz?
            </p>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Stok Türü / Kategori (Etiket):</label>
                <select
                  value={suggestedStokCat}
                  onChange={(e) => setSuggestedStokCat(e.target.value)}
                  className="w-full p-2 bg-slate-50 border rounded-lg font-bold"
                >
                  <option value="Kaba İnşaat İmalatı">Kaba İnşaat İmalatı</option>
                  <option value="Dış Cephe İmalatı">Dış Cephe İmalatı</option>
                  <option value="İnce İşler İmalatı">İnce İşler İmalatı</option>
                  <option value="Elektrik Tesisat Malzemesi">Elektrik Tesisat Malzemesi</option>
                  <option value="Mekanik Tesisat Malzemesi">Mekanik Tesisat Malzemesi</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Ölçü Birimi:</label>
                <input 
                  type="text"
                  value={suggestedStokUnit}
                  onChange={(e) => setSuggestedStokUnit(e.target.value)}
                  className="w-full p-2 bg-slate-50 border rounded-lg font-bold text-center"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowStokSuggest(false)} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-center text-xs"
              >
                Hayır, Geç
              </button>
              <button 
                onClick={handleCreateStok} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-center text-xs"
              >
                Evet, Kart Aç
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FaturaGirisScreen;

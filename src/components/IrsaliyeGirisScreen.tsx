import React, { useState } from 'react';
import { 
  Truck, ClipboardList, Plus, Trash2, Edit3, ArrowRight, 
  Upload, Printer, Download, Sparkles, FileText, CheckCircle2 
} from 'lucide-react';
import { Irsaliye, IrsaliyeItem, SatinAlmaTalebi, CariKart, StokKart } from '../types/erp';
import { compressImage } from '../lib/imageCompress';

interface IrsaliyeGirisScreenProps {
  irsaliyeler: Irsaliye[];
  setIrsaliyeler: React.Dispatch<React.SetStateAction<Irsaliye[]>>;
  satinAlmaTalepleri: SatinAlmaTalebi[];
  cariKartlar: CariKart[];
  setCariKartlar?: React.Dispatch<React.SetStateAction<CariKart[]>>;
  stokKartlar: StokKart[];
  setStokKartlar?: React.Dispatch<React.SetStateAction<StokKart[]>>;
  currentUser?: any;
  addNotification?: (mesaj: string) => void;
}

export const IrsaliyeGirisScreen: React.FC<IrsaliyeGirisScreenProps> = ({
  irsaliyeler,
  setIrsaliyeler,
  satinAlmaTalepleri,
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
  currentUser,
  addNotification
}) => {
  const [activeTab, setActiveTab] = useState<'liste' | 'giris' | 'eslestir'>('liste');
  
  // Form states
  const [irNo, setIrNo] = useState("");
  const [irDate, setIrDate] = useState(new Date().toISOString().split('T')[0]);
  const [irSupplier, setIrSupplier] = useState("");
  const [irSaLink, setIrSaLink] = useState(""); // linked PO
  const [irProducts, setIrProducts] = useState<IrsaliyeItem[]>([]);
  const [tempProduct, setTempProduct] = useState({ name: "", qty: 0, unit: "ADET" });
  const [irAttachmentUrl, setIrAttachmentUrl] = useState<string | null>(null);
  const [irSignedAttachmentUrl, setIrSignedAttachmentUrl] = useState<string | null>(null);
  const [editingIrId, setEditingIrId] = useState<string | null>(null);

  // AI Parser states
  const [isIrParsing, setIsIrParsing] = useState(false);
  const [irParseError, setIrParseError] = useState<string | null>(null);
  const [irParseSuccess, setIrParseSuccess] = useState<string | null>(null);

  // Suggestions/Modal states for Cari and Stok creation
  const [showCariSuggest, setShowCariSuggest] = useState(false);
  const [suggestedCariName, setSuggestedCariName] = useState("");
  const [suggestedCariType, setSuggestedCariType] = useState<CariKart['kartTipi']>('TEDARIKCI');
  
  const [showStokSuggest, setShowStokSuggest] = useState(false);
  const [suggestedStokName, setSuggestedStokName] = useState("");
  const [suggestedStokCat, setSuggestedStokCat] = useState("Kaba İnşaat İmalatı");
  const [suggestedStokUnit, setSuggestedStokUnit] = useState("ADET");

  // Comparison Report Modal state
  const [compareReportResult, setCompareReportResult] = useState<any | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Filter for matching
  const [searchTerm, setSearchTerm] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setIrAttachmentUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignedFileChange = (e: React.ChangeEvent<HTMLInputElement>, irId?: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        
        if (irId) {
          // Direct upload from list
          setIrsaliyeler(prev => prev.map(ir => {
            if (ir.id === irId) {
              return {
                ...ir,
                imzaliEvrakUrl: compressed,
                onayDurumu: '1. ONAY TAMAMLANDI' // Sevkiyat Teslim Alındı
              };
            }
            return ir;
          }));
          alert("İmzalı sevkiyat evrağı başarıyla yüklendi! Teslimat durumu güncellendi.");
        } else {
          setIrSignedAttachmentUrl(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const processIrsaliyeAi = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setIrParseError("Lütfen sadece PDF veya Görsel (PNG, JPG, WEBP) formatında İrsaliye yükleyiniz.");
      return;
    }

    setIsIrParsing(true);
    setIrParseError(null);
    setIrParseSuccess(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rawBase64 = (reader.result as string).split(',')[1];
        const response = await fetch('/api/parse-irsaliye', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64: rawBase64, mimeType: file.type })
        });
        const resData = await response.json();
        if (!response.ok || !resData.success) {
          throw new Error(resData.error || "İrsaliye belgesi çözümlenirken hata oluştu.");
        }

        const parsed = resData.data;
        setIrNo(parsed.irsaliyeNo || "");
        if (parsed.tarih) setIrDate(parsed.tarih);
        if (parsed.firma) {
          setIrSupplier(parsed.firma);
          checkAndSuggestCari(parsed.firma);
        }
        if (parsed.kalemler && parsed.kalemler.length > 0) {
          const formatted = parsed.kalemler.map((x: any, idx: number) => ({
            id: `iri_ai_${Date.now()}_${idx}`,
            urunAdi: x.urunAdi,
            miktar: Number(x.miktar) || 0,
            birim: x.birim || "ADET"
          }));
          setIrProducts(formatted);
          formatted.forEach((item: any) => checkAndSuggestStok(item.urunAdi, item.birim));
        }
        setIrParseSuccess(`Yapay Zeka Okuması Başarılı! No: ${parsed.irsaliyeNo || ''}`);
      } catch (err: any) {
        setIrParseError(err.message || "Dosya çözümlenemedi.");
      } finally {
        setIsIrParsing(false);
      }
    };
    reader.readAsDataURL(file);
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
      adres: "İrsaliye girişinden otomatik oluşturuldu.",
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
    const newStok: StokKart = {
      id: `sk_${Date.now()}`,
      stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
      stokAdi: suggestedStokName,
      kategori: suggestedStokCat,
      birim: suggestedStokUnit,
      kritikSeviye: 5,
      durum: 'AKTIF',
      aciklama: "İrsaliye girişinden otomatik oluşturuldu."
    };
    if (setStokKartlar) {
      setStokKartlar(prev => [newStok, ...prev]);
    }
    setShowStokSuggest(false);
    alert(`Yeni Stok Kartı (${suggestedStokName}) başarıyla oluşturuldu!`);
  };

  const handleAddProduct = () => {
    if (!tempProduct.name || tempProduct.qty <= 0) return;
    setIrProducts(prev => [
      ...prev,
      {
        id: `iri_${Date.now()}`,
        urunAdi: tempProduct.name,
        miktar: tempProduct.qty,
        birim: tempProduct.unit
      }
    ]);
    checkAndSuggestStok(tempProduct.name, tempProduct.unit);
    setTempProduct({ name: "", qty: 0, unit: "ADET" });
  };

  const handleSaveIrsaliye = () => {
    if (!irNo || !irSupplier || irProducts.length === 0) {
      alert("Lütfen İrsaliye No, Firma ve en az 1 Malzeme kalemi giriniz.");
      return;
    }

    const calculatedStatus = 'ONAY BEKLİYOR';

    if (editingIrId) {
      setIrsaliyeler(prev => prev.map(ir => {
        if (ir.id === editingIrId) {
          return {
            ...ir,
            irsaliyeNo: irNo,
            tarih: irDate,
            firma: irSupplier,
            saId: irSaLink || undefined,
            onayDurumu: calculatedStatus,
            kalemler: irProducts,
            fisEvrakUrl: irAttachmentUrl || undefined,
            imzaliEvrakUrl: irSignedAttachmentUrl || undefined
          };
        }
        return ir;
      }));
      setEditingIrId(null);
    } else {
      const newIr: Irsaliye = {
        id: `ir_${Date.now()}`,
        irsaliyeId: `IR-${irDate.replace(/-/g, '')}-${Math.random().toString(16).substr(2, 4).toUpperCase()}`,
        irsaliyeNo: irNo,
        tarih: irDate,
        firma: irSupplier,
        saId: irSaLink || undefined,
        onayDurumu: calculatedStatus,
        kalemler: irProducts,
        fisEvrakUrl: irAttachmentUrl || undefined,
        imzaliEvrakUrl: irSignedAttachmentUrl || undefined
      };
      setIrsaliyeler(prev => [newIr, ...prev]);
    }

    checkAndSuggestCari(irSupplier);

    // Reset form
    setIrNo("");
    setIrSupplier("");
    setIrSaLink("");
    setIrProducts([]);
    setIrAttachmentUrl(null);
    setIrSignedAttachmentUrl(null);
    setActiveTab('liste');
    alert("İrsaliye başarıyla kaydedildi.");
  };

  const handleMergeAndCompare = async (sa: SatinAlmaTalebi, linkedIrs: Irsaliye[]) => {
    setIsComparing(true);
    try {
      const response = await fetch('/api/compare-3way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saTalebi: sa,
          irsaliyeler: linkedIrs,
          fatura: { faturaNo: "ON-DEMAND-MERGE", kalemler: [], toplamTutar: 0, kdvTutar: 0, genelToplam: 0 }
        })
      });
      const res = await response.json();
      if (!response.ok || !res.success) {
        throw new Error(res.error || "Yapay zeka karşılaştırması başarısız oldu.");
      }
      setCompareReportResult({
        saId: sa.saId,
        report: res.data.reportText,
        status: res.data.status,
        discrepancies: res.data.discrepancies
      });
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsComparing(false);
    }
  };

  const filteredIrsaliyeler = irsaliyeler.filter(ir => 
    ir.irsaliyeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ir.firma.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const saLinkedIrs = filteredIrsaliyeler.filter(ir => ir.saId);
  const standaloneIrs = filteredIrsaliyeler.filter(ir => !ir.saId);

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col font-sans select-none bg-slate-50/50 space-y-6">
      
      {/* Sub navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-xs gap-4 shrink-0">
        <div className="space-y-1">
          <span className="text-[10px] font-black tracking-widest text-[#10b981] uppercase">Teslimat &amp; Sevkiyat Girişi</span>
          <h2 className="font-display font-bold text-sm text-slate-900 flex items-center gap-1.5">
            🚛 Şantiye İrsaliye, Makbuz ve Fiş Giriş Paneli
          </h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('liste')}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${activeTab === 'liste' ? 'bg-[#10b981] text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            📋 İrsaliye Listesi
          </button>
          <button
            onClick={() => {
              setActiveTab('giris');
              setEditingIrId(null);
            }}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${activeTab === 'giris' ? 'bg-[#10b981] text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            ➕ Yeni İrsaliye Girişi (AI)
          </button>
          <button
            onClick={() => setActiveTab('eslestir')}
            className={`px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer ${activeTab === 'eslestir' ? 'bg-[#10b981] text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
          >
            🔄 Eşleştir &amp; Birleştir
          </button>
        </div>
      </div>

      {activeTab === 'giris' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Creator Drawer Form */}
          <div className="w-full lg:w-[440px] bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            
            {/* AI Document parser widget */}
            <div className="bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
              <span className="font-extrabold text-emerald-900 tracking-wide text-[9px] uppercase block">🤖 YAPAY ZEKA DESTEKLİ İRSALİYE OKUYUCU</span>
              <p className="text-[10px] text-emerald-700 font-medium">Fotoğraf veya PDF irsaliye belgesini sürükleyip bırakarak form alanlarını otomatik doldurun.</p>
              <div className="relative border-2 border-dashed border-emerald-250 rounded-xl p-4 text-center bg-white hover:bg-emerald-50/20 transition cursor-pointer">
                <input 
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => { if(e.target.files?.[0]) processIrsaliyeAi(e.target.files[0]); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isIrParsing ? (
                  <span className="text-[10px] font-bold text-emerald-850 block animate-pulse">Gemini Belgeyi Çözümlüyor...</span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-550 block">Dosya Seçin veya Sürükleyin</span>
                )}
              </div>
              {irParseError && <p className="text-[9px] font-bold text-rose-600">❌ {irParseError}</p>}
              {irParseSuccess && <p className="text-[9px] font-bold text-emerald-700">✅ {irParseSuccess}</p>}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">İrsaliye / Fiş No *</label>
                <input 
                  type="text"
                  placeholder="Örn: IRS-2026-0041"
                  value={irNo}
                  onChange={(e) => setIrNo(e.target.value)}
                  className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg focus:border-[#10b981] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tarih</label>
                  <input 
                    type="date"
                    value={irDate}
                    onChange={(e) => setIrDate(e.target.value)}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Satıcı Firma Ünvanı *</label>
                  <input 
                    type="text"
                    placeholder="Firma Adı"
                    value={irSupplier}
                    onChange={(e) => setIrSupplier(e.target.value)}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Bağlı Satın Alma Siparişi</label>
                <select
                  value={irSaLink}
                  onChange={(e) => setIrSaLink(e.target.value)}
                  className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                >
                  <option value="">Satın Alma Talebiyle Eşleştirme (İsteğe Bağlı)</option>
                  {satinAlmaTalepleri.map(sa => (
                    <option key={sa.id} value={sa.saId}>{sa.saId} ({sa.cariFirma})</option>
                  ))}
                </select>
              </div>

              {/* Add items */}
              <div className="bg-slate-550/5 p-3 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">📦 Malzeme Teslimat Kalemleri</span>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="text"
                    placeholder="Malzeme Adı"
                    value={tempProduct.name}
                    onChange={(e) => setTempProduct(prev => ({ ...prev, name: e.target.value }))}
                    className="col-span-2 p-1.5 border border-slate-200 rounded-lg text-[10px]"
                  />
                  <input 
                    type="number"
                    placeholder="Miktar"
                    value={tempProduct.qty || ""}
                    onChange={(e) => setTempProduct(prev => ({ ...prev, qty: Number(e.target.value) }))}
                    className="p-1.5 border border-slate-200 rounded-lg text-[10px] text-center"
                  />
                </div>
                <div className="flex gap-2 justify-between items-center pt-1.5">
                  <select
                    value={tempProduct.unit}
                    onChange={(e) => setTempProduct(prev => ({ ...prev, unit: e.target.value }))}
                    className="p-1.5 border border-slate-200 rounded-lg text-[10px] flex-1"
                  >
                    <option value="ADET">ADET</option>
                    <option value="TON">TON</option>
                    <option value="KG">KG</option>
                    <option value="M3">M3</option>
                    <option value="TORBA">TORBA</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="bg-slate-900 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg hover:bg-slate-950 transition cursor-pointer"
                  >
                    Kalem Ekle
                  </button>
                </div>

                {/* Listing added items */}
                <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2 border-t border-slate-100/60 text-[11px] font-semibold text-slate-700">
                  {irProducts.map((p, idx) => (
                    <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded-lg border">
                      <span>{p.urunAdi}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-900">{p.miktar} {p.birim}</span>
                        <button
                          type="button"
                          onClick={() => setIrProducts(prev => prev.filter(x => x.id !== p.id))}
                          className="text-rose-600 hover:text-rose-800"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Attachment inputs */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Evrak Fotoğrafı</span>
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl border border-slate-200 block text-center font-bold text-[10px]">
                    {irAttachmentUrl ? "✓ Yüklendi" : "Belge Yükle"}
                    <input type="file" onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                  </label>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">İmzalı Evrak</span>
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 p-2.5 rounded-xl border border-slate-200 block text-center font-bold text-[10px]">
                    {irSignedAttachmentUrl ? "✓ İmzalı Yüklendi" : "İmzalı Belge"}
                    <input type="file" onChange={(e) => handleSignedFileChange(e)} className="hidden" accept="image/*,application/pdf" />
                  </label>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIrProducts([]);
                  setIrNo("");
                  setIrSupplier("");
                  setIrSaLink("");
                  setIrAttachmentUrl(null);
                  setIrSignedAttachmentUrl(null);
                  setActiveTab('liste');
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-center cursor-pointer transition text-xs"
              >
                Temizle / Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveIrsaliye}
                className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white font-bold py-2 rounded-xl text-center shadow cursor-pointer transition text-xs"
              >
                İrsaliyeyi Kaydet
              </button>
            </div>

          </div>

          <div className="flex-1 space-y-6">
            {/* Form list preview if needed, or help section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">💡 Doğrulama Bilgisi</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                İrsaliye belgelerinizi sisteme girerken yapay zeka desteğini kullanmak hata payını sıfıra indirir. Eğer girdiniz sırasında yeni bir Cari veya Stok ismi yazarsanız, sistem size otomatik olarak bu ismin veritabanında kayıtlı olmadığını belirtecek ve yeni kartı tek tıkla oluşturma fırsatı sunacaktır.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'liste' && (
        <div className="flex-grow flex flex-col lg:flex-row gap-6">
          
          {/* Linked waybills list */}
          <div className="flex-1 bg-white border border-slate-200 rounded-3xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">🔄 SATIN ALMA BAĞLANTILI İRSALİYELER</span>
              <input 
                type="text"
                placeholder="İrsaliye no veya firma ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs border p-2 rounded-xl bg-white w-48 sm:w-64"
              />
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {saLinkedIrs.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Bağlantılı irsaliye bulunmuyor.</p>
              ) : (
                saLinkedIrs.map(ir => (
                  <div key={ir.id} className="border border-slate-100 rounded-2xl p-4 bg-white hover:shadow transition flex justify-between items-center text-xs">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono bg-slate-100 border text-slate-700 px-2 py-0.5 rounded font-bold">No: {ir.irsaliyeNo}</span>
                        <span className="font-mono bg-amber-50 border border-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">PO: {ir.saId}</span>
                      </div>
                      <p className="font-bold text-slate-900">Firma: {ir.firma} · Tarih: {ir.tarih}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">
                        Kalemler: {ir.kalemler.map(x => `${x.urunAdi} (${x.miktar} ${x.birim})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        ir.onayDurumu === '1. ONAY TAMAMLANDI'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-100'
                      }`}>
                        {ir.onayDurumu === '1. ONAY TAMAMLANDI' ? 'SEVKİYAT TESLİM ALINDI' : 'ONAY BEKLİYOR'}
                      </span>
                      
                      {/* Signed document file input */}
                      {!ir.imzaliEvrakUrl && (
                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold text-slate-600">
                          İmzalı Yükle
                          <input type="file" onChange={(e) => handleSignedFileChange(e, ir.id)} className="hidden" accept="image/*,application/pdf" />
                        </label>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Standalone waybills list */}
          <div className="w-full lg:w-[480px] bg-white border border-slate-200 rounded-3xl flex flex-col overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">📋 SADE / DOĞRUDAN İRSALİYELER</span>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {standaloneIrs.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Bağlantısız irsaliye bulunmuyor.</p>
              ) : (
                standaloneIrs.map(ir => (
                  <div key={ir.id} className="border border-slate-100 rounded-2xl p-4 bg-white hover:shadow transition flex flex-col space-y-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono bg-slate-100 border text-slate-700 px-2 py-0.5 rounded font-bold">No: {ir.irsaliyeNo}</span>
                        <h5 className="font-bold text-slate-900 mt-2">Firma: {ir.firma} · Tarih: {ir.tarih}</h5>
                      </div>
                      <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 uppercase">
                        {ir.onayDurumu}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-semibold">
                      Kalemler: {ir.kalemler.map(x => `${x.urunAdi} (${x.miktar} ${x.birim})`).join(', ')}
                    </div>

                    <div className="flex gap-2 border-t pt-2.5 text-[10px]">
                      <button
                        onClick={() => {
                          setEditingIrId(ir.id);
                          setIrNo(ir.irsaliyeNo);
                          setIrDate(ir.tarih);
                          setIrSupplier(ir.firma);
                          setIrSaLink(ir.saId || "");
                          setIrProducts(ir.kalemler);
                          setIrAttachmentUrl(ir.fisEvrakUrl || null);
                          setIrSignedAttachmentUrl(ir.imzaliEvrakUrl || null);
                          setActiveTab('giris');
                        }}
                        className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-250 py-1.5 rounded-lg font-bold transition cursor-pointer text-center"
                      >
                        ✏️ Düzelt
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Bu irsaliye kaydını silmek istediğinize emin misiniz?")) {
                            setIrsaliyeler(prev => prev.filter(x => x.id !== ir.id));
                            alert("İrsaliye kaydı silindi.");
                          }
                        }}
                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-1.5 rounded-lg font-bold transition cursor-pointer text-center"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {activeTab === 'eslestir' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex-grow flex flex-col overflow-hidden max-h-[calc(100vh-190px)]">
          <div className="border-b pb-3 mb-4 flex justify-between items-center shrink-0">
            <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-widest">🔄 Satın Alma ve İrsaliye Birleştirme &amp; Eşleştirme</h4>
            <span className="text-[10px] text-slate-450 font-semibold italic">* Eşleştirme işlemleri yapay zeka yardımıyla birim dönüşümlerine göre doğrulanır.</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6">
            {satinAlmaTalepleri.map(sa => {
              const linkedIrs = irsaliyeler.filter(ir => ir.saId === sa.saId);
              return (
                <div key={sa.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2.5">
                    <div>
                      <span className="font-mono bg-slate-900 text-amber-500 rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">SIPARİŞ: {sa.saId}</span>
                      <h5 className="font-bold text-slate-950 mt-1">{sa.cariFirma} · Sipariş Tarihi: {sa.tarih}</h5>
                    </div>
                    <button
                      onClick={() => handleMergeAndCompare(sa, linkedIrs)}
                      disabled={isComparing}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-wide cursor-pointer transition shadow-md disabled:bg-blue-300"
                    >
                      {isComparing ? "Yapay Zeka İnceliyor..." : "Birleştir & Raporla (AI)"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">📦 Sipariş Edilen Kalemler:</p>
                      <ul className="mt-1 space-y-1 text-slate-700">
                        {sa.kalemler.map(k => (
                          <li key={k.id} className="bg-white p-2 rounded-lg border border-slate-100 flex justify-between">
                            <span>{k.urunAdi}</span>
                            <span className="font-mono text-slate-900">{k.miktar} {k.birim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">🚛 Teslim Edilen İrsaliyeler ({linkedIrs.length} adet):</p>
                      <ul className="mt-1 space-y-1.5">
                        {linkedIrs.length === 0 ? (
                          <li className="text-[10px] text-slate-450 italic py-2">Bu siparişe bağlı henüz irsaliye girilmemiştir.</li>
                        ) : (
                          linkedIrs.map(ir => (
                            <li key={ir.id} className="bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                              <div className="flex justify-between font-bold text-slate-900">
                                <span>No: {ir.irsaliyeNo}</span>
                                <span>{ir.tarih}</span>
                              </div>
                              <div className="text-slate-500 font-medium text-[10px] mt-1">
                                {ir.kalemler.map(x => `${x.urunAdi} (${x.miktar} ${x.birim})`).join(', ')}
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Comparison Results output overlay */}
          {compareReportResult && (
            <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col h-[550px]">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                  <h3 className="font-display font-bold text-xs tracking-wider uppercase text-amber-500">✨ YAPAY ZEKA KONSOLİDE TESLİMAT KONTROL RAPORU</h3>
                  <button 
                    onClick={() => setCompareReportResult(null)}
                    className="text-slate-450 hover:text-white font-bold cursor-pointer text-xs"
                  >
                    ✖
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700 leading-relaxed">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex items-center justify-between">
                    <span className="font-bold">Eşleşen Sipariş: {compareReportResult.saId}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] border uppercase ${
                      compareReportResult.status === 'SORUNSUZ ONAY' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                        : 'bg-rose-50 text-rose-800 border-rose-100'
                    }`}>
                      {compareReportResult.status}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">BULGULAR &amp; RAPOR DETAYI</span>
                    <div className="bg-slate-950 text-slate-350 p-4 rounded-xl font-mono text-[10px] whitespace-pre-wrap leading-relaxed">
                      {compareReportResult.report}
                    </div>
                  </div>

                  {compareReportResult.discrepancies.length > 0 && (
                    <div className="space-y-1.5 bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl text-rose-900">
                      <span className="text-[9px] font-bold text-rose-700 uppercase tracking-widest block">⚠️ TESPİT EDİLEN UYUMSUZLUKLAR:</span>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] font-semibold">
                        {compareReportResult.discrepancies.map((d: string, idx: number) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                  <button
                    onClick={() => {
                      // print simulated
                      window.print();
                    }}
                    className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition cursor-pointer"
                  >
                    Raporu PDF Olarak İndir
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
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

export default IrsaliyeGirisScreen;

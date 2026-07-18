import React, { useState } from 'react';
import { 
  Truck, ClipboardList, Plus, Trash2, Edit3, ArrowRight, 
  Upload, Printer, Download, Sparkles, FileText, CheckCircle2 
} from 'lucide-react';
import { Irsaliye, IrsaliyeItem, SatinAlmaTalebi, CariKart, StokKart, Fatura, EvrakBaglantiGrubu } from '../types/erp';
import { compressImage } from '../lib/imageCompress';
import { fetchApiJson } from '../lib/apiClient';
import { fileToAiPayload } from '../lib/aiFileUpload';
import { EvrakTabBilgi } from './EvrakTabBilgi';
import { warnIfDuplicateStok } from '../lib/duplicateNameUtils';
import { kibritciLogoHtml } from '../lib/kibritciBrand';
import { wrapCorporateReportHtml } from '../lib/corporateReportHtml';

interface IrsaliyeGirisScreenProps {
  irsaliyeler: Irsaliye[];
  setIrsaliyeler: React.Dispatch<React.SetStateAction<Irsaliye[]>>;
  faturalar?: Fatura[];
  setFaturalar?: React.Dispatch<React.SetStateAction<Fatura[]>>;
  evrakBaglantiGruplari: EvrakBaglantiGrubu[];
  setEvrakBaglantiGruplari: React.Dispatch<React.SetStateAction<EvrakBaglantiGrubu[]>>;
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
  faturalar = [],
  setFaturalar,
  evrakBaglantiGruplari,
  setEvrakBaglantiGruplari,
  satinAlmaTalepleri,
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
  currentUser,
  addNotification,
}) => {

  // Form states
  const [irNo, setIrNo] = useState("");
  const [irDate, setIrDate] = useState(new Date().toISOString().split('T')[0]);
  const [irSupplier, setIrSupplier] = useState("");
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

  const processIrsaliyeAi = async (file: File) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setIrParseError("Lütfen sadece PDF veya Görsel (PNG, JPG, WEBP) formatında İrsaliye yükleyiniz.");
      return;
    }

    setIsIrParsing(true);
    setIrParseError(null);
    setIrParseSuccess(null);

    try {
      const { fileBase64, mimeType } = await fileToAiPayload(file);
      const resData = await fetchApiJson<{ success: boolean; data?: any; error?: string }>(
        '/api/parse-irsaliye',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileBase64, mimeType }),
        }
      );
        if (!resData.success) {
          throw new Error(resData.error || 'İrsaliye belgesi çözümlenirken hata oluştu.');
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
    if (warnIfDuplicateStok(stokKartlar, suggestedStokName)) {
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
      const existing = irsaliyeler.find((ir) => ir.id === editingIrId);
      setIrsaliyeler(prev => prev.map(ir => {
        if (ir.id === editingIrId) {
          return {
            ...ir,
            irsaliyeNo: irNo,
            tarih: irDate,
            firma: irSupplier,
            saId: existing?.saId,
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
        onayDurumu: calculatedStatus,
        kalemler: irProducts,
        fisEvrakUrl: irAttachmentUrl || undefined,
        imzaliEvrakUrl: irSignedAttachmentUrl || undefined
      };
      setIrsaliyeler(prev => [newIr, ...prev]);
    }

    checkAndSuggestCari(irSupplier);

    setIrNo("");
    setIrSupplier("");
    setIrProducts([]);
    setIrAttachmentUrl(null);
    setIrSignedAttachmentUrl(null);
    alert("İrsaliye kaydedildi.");
  };

  const handlePreviewIrsaliyePdf = (ir: Irsaliye) => {
    const innerBody = `
      <div class="mb-6">
        <h2 class="text-xl font-extrabold text-slate-800 tracking-tight">SEVK İRSALİYESİ RAPORU</h2>
        <p class="text-xs text-slate-500 mt-1">Malzeme Sevk ve Teslim Tesellüm Belgesi</p>
      </div>

      <!-- Bilgi Kartları -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="border border-slate-200 bg-slate-50/50 p-4 rounded-xl">
          <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">🚚 Sevk &amp; İrsaliye Bilgileri</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">İrsaliye No:</span> <strong class="text-slate-800">${ir.irsaliyeNo || '-'}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">İrsaliye Tarihi:</span> <strong class="text-slate-800">${ir.tarih || '-'}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Onay Durumu:</span> <strong class="text-indigo-600">${ir.onayDurumu || 'ONAY BEKLİYOR'}</strong></div>
          </div>
        </div>
        
        <div class="border border-slate-200 bg-slate-50/50 p-4 rounded-xl">
          <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">🏢 Gönderici / Tedarikçi</h4>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">Tedarikçi Firma:</span> <strong class="text-slate-800">${ir.firma || '-'}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">İlişkili Fatura No:</span> <strong class="text-slate-800">${ir.faturaNo || 'Bağlanmadı'}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">İlişkili Talep No:</span> <strong class="text-slate-800">${ir.saId || 'Bağlanmadı'}</strong></div>
          </div>
        </div>
      </div>

      <!-- Malzeme Kalemleri Tablosu -->
      <div class="border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table class="w-full text-xs text-left border-collapse">
          <thead>
            <tr class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <th class="p-3 w-12 text-center">#</th>
              <th class="p-3">Malzeme / Ürün Adı</th>
              <th class="p-3 text-right w-32">Miktar</th>
              <th class="p-3 w-24">Birim</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${(ir.kalemler || []).map((k, index) => `
              <tr class="hover:bg-slate-50/50 transition">
                <td class="p-3 text-center text-slate-400 font-mono">${index + 1}</td>
                <td class="p-3 font-semibold text-slate-800">${k.urunAdi || '-'}</td>
                <td class="p-3 text-right font-mono font-bold text-slate-900">${k.miktar || 0}</td>
                <td class="p-3 text-slate-650">${k.birim || 'Adet'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Onay ve İmza Kanalları -->
      <div class="mt-8">
        <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">🖋️ Teslim Tesellüm İmza Alanları</h4>
        <div class="grid grid-cols-3 gap-4">
          <div class="border border-slate-200 p-4 rounded-xl text-center min-h-[100px] flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-500 block uppercase">Teslim Eden (Firma Şoförü)</span>
            <span class="text-[10px] text-slate-400 font-mono italic">Ad Soyad / İmza</span>
          </div>
          <div class="border border-slate-200 p-4 rounded-xl text-center min-h-[100px] flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-500 block uppercase">Teslim Alan (Güvenlik / Depo)</span>
            <span class="text-[10px] text-slate-400 font-mono italic">Ad Soyad / İmza</span>
          </div>
          <div class="border border-slate-200 p-4 rounded-xl text-center min-h-[100px] flex flex-col justify-between">
            <span class="text-[10px] font-bold text-slate-500 block uppercase">Kontrol Eden (Şantiye Şefi)</span>
            <span class="text-[10px] text-slate-400 font-mono italic">Ad Soyad / İmza</span>
          </div>
        </div>
      </div>

      <!-- Dijital e-İmzalar -->
      ${ir.eImzalar && ir.eImzalar.length > 0 ? `
        <div class="mt-6 border border-emerald-100 bg-emerald-50/30 p-3 rounded-xl text-[10px] text-emerald-800 leading-relaxed">
          <div class="font-bold flex items-center space-x-1 mb-1">
            <span>🛡️ DİJİTAL ONAY ZİNCİRİ VE E-İMZA KANITLARI</span>
          </div>
          ${ir.eImzalar.map(im => `<div>• ${im}</div>`).join('')}
        </div>
      ` : ''}
    `;

    const html = wrapCorporateReportHtml(innerBody, {
      docCode: `İRSALİYE NO: ${ir.irsaliyeNo || 'İRSALİYE'}`,
      orientation: 'portrait',
      title: `Kibritçi İnşaat - İrsaliye Raporu - ${ir.irsaliyeNo}`,
    });

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
  };

  const handleIrsaliyeArchiveReport = () => {
    const rows = [...irsaliyeler]
      .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
      .map((ir, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${ir.tarih || '-'}</td>
          <td>${ir.irsaliyeNo || '-'}</td>
          <td>${ir.firma || '-'}</td>
          <td>${(ir.kalemler || []).length}</td>
          <td>${ir.fisEvrakUrl ? 'Var' : 'Yok'}</td>
          <td>${ir.imzaliEvrakUrl ? 'Var' : 'Yok'}</td>
        </tr>
      `)
      .join('');
    const html = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>İrsaliye Evrak Arşiv Raporu</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { margin: 0 0 8px; font-size: 18px; }
            p { margin: 0 0 16px; font-size: 12px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <div style="margin-bottom:12px;">${kibritciLogoHtml(44)}</div>
          <h1 style="font-size:14px;margin:0 0 8px;">İRSALİYE EVRAK ARŞİV RAPORU</h1>
          <p>Kayıt sayısı: ${irsaliyeler.length} • Üretim: ${new Date().toLocaleString('tr-TR')}</p>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Tarih</th><th>İrsaliye No</th><th>Firma</th><th>Kalem</th><th>Evrak</th><th>İmzalı</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
  };

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
        <button
          type="button"
          onClick={() => setEditingIrId(null)}
          className="px-4 py-2 font-bold rounded-xl text-xs transition cursor-pointer bg-[#10b981] text-white shadow-sm"
        >
          İrsaliye Giriş (Manuel / AI)
        </button>
      </div>

      <EvrakTabBilgi tab="irsaliye-giris" />

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
                    list="cari-datalist"
                    placeholder="Firma Adı"
                    value={irSupplier}
                    onChange={(e) => setIrSupplier(e.target.value)}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                  />
                  <datalist id="cari-datalist">
                    {cariKartlar.map(c => (
                      <option key={c.id} value={c.unvan} />
                    ))}
                  </datalist>
                </div>
              </div>

              <p className="text-[10px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                İrsaliye kalemlerini girin; belgeyi AI ile okutabilirsiniz.
              </p>

              {/* Add items */}
              <div className="bg-slate-550/5 p-3 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">📦 Malzeme Teslimat Kalemleri</span>
                <div className="grid grid-cols-3 gap-2">
                  <input 
                    type="text"
                    list="stok-datalist"
                    placeholder="Malzeme Adı"
                    value={tempProduct.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const matched = stokKartlar.find(
                        (s) => s.stokAdi.toLowerCase().trim() === name.toLowerCase().trim()
                      );
                      setTempProduct((prev) => ({
                        ...prev,
                        name,
                        unit: matched?.birim || prev.unit,
                      }));
                    }}
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
                  setIrAttachmentUrl(null);
                  setIrSignedAttachmentUrl(null);
                  setEditingIrId(null);
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
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">📚 İrsaliye Evrak Arşivi</h4>
                <button
                  type="button"
                  onClick={handleIrsaliyeArchiveReport}
                  className="text-[10px] bg-slate-900 hover:bg-slate-950 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer"
                >
                  PDF Rapor (Yazdır)
                </button>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                İrsaliye belgelerinizi burada arşivleyip tek ekrandan raporlayabilirsiniz.
              </p>
              <div className="max-h-64 overflow-auto border border-slate-100 rounded-xl">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-slate-600">
                      <th className="px-2 py-2">Tarih</th>
                      <th className="px-2 py-2">İrsaliye No</th>
                      <th className="px-2 py-2">Firma</th>
                      <th className="px-2 py-2">Kalem</th>
                      <th className="px-2 py-2">Rapor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...irsaliyeler]
                      .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
                      .slice(0, 200)
                      .map((ir) => (
                        <tr key={ir.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">{ir.tarih || '-'}</td>
                          <td className="px-2 py-1.5 font-semibold">
                            {ir.irsaliyeNo}
                            {(ir as any).kaynak === 'VIDANJOR_FIS' && (
                              <span className="ml-1 text-[8px] font-black uppercase bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded">
                                Vidanjör
                              </span>
                            )}
                            {(ir as any).kaynak === 'YILDIRIM_TANKER_FIS' && (
                              <span className="ml-1 text-[8px] font-black uppercase bg-sky-100 text-sky-700 px-1 py-0.5 rounded">
                                Yıldırım
                              </span>
                            )}
                            {(ir as any).kaynak === 'MICIR_STABILIZE_FIS' && (
                              <span className="ml-1 text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded">
                                Mıcır/Stabilize
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            {ir.firma}
                            {(ir as any).plaka ? (
                              <span className="block text-[9px] text-slate-400 font-mono">{(ir as any).plaka}</span>
                            ) : null}
                          </td>
                          <td className="px-2 py-1.5">
                            {(ir as any).kaynak === 'VIDANJOR_FIS'
                              ? `${(ir as any).cekimAdedi ?? (ir.kalemler || [])[0]?.miktar ?? 0} çekim`
                              : (ir as any).kaynak === 'YILDIRIM_TANKER_FIS'
                                ? `İ:${(ir as any).icmeSuyuAdet ?? 0} / S:${(ir as any).sanayiSuyuAdet ?? 0}`
                              : (ir as any).kaynak === 'MICIR_STABILIZE_FIS'
                                ? `${(ir as any).tonaj ?? (ir.kalemler || [])[0]?.miktar ?? 0} ton`
                              : (ir.kalemler || []).length}
                          </td>
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() => handlePreviewIrsaliyePdf(ir)}
                              className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-2 py-1 font-bold cursor-pointer"
                            >
                              Aç
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

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
                className="flex-1 bg-slate-900 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-center text-xs"
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
                className="flex-1 bg-slate-900 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-center text-xs"
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

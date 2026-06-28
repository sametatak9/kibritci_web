import React, { useState } from 'react';
import { 
  ShoppingCart, Plus, Trash2, Edit3, Eye, Upload, 
  Send, ShieldCheck, Search, Sparkles, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { SatinAlmaTalebi, SatinAlmaItem, CariKart, StokKart } from '../types/erp';
import { compressImage } from '../lib/imageCompress';

interface SatinAlmaScreenProps {
  satinAlmaTalepleri: SatinAlmaTalebi[];
  setSatinAlmaTalepleri: React.Dispatch<React.SetStateAction<SatinAlmaTalebi[]>>;
  irsaliyeler?: any;
  setIrsaliyeler?: any;
  faturalar?: any;
  setFaturalar?: any;
  cariKartlar: CariKart[];
  setCariKartlar?: React.Dispatch<React.SetStateAction<CariKart[]>>;
  stokKartlar: StokKart[];
  setStokKartlar?: React.Dispatch<React.SetStateAction<StokKart[]>>;
  kullanicilar?: any[];
  currentUser?: any;
  addNotification?: (mesaj: string) => void;
}

export const SatinAlmaScreen: React.FC<SatinAlmaScreenProps> = ({
  satinAlmaTalepleri,
  setSatinAlmaTalepleri,
  cariKartlar,
  setCariKartlar,
  stokKartlar,
  setStokKartlar,
  currentUser,
  addNotification
}) => {
  const [saRequestor, setSaRequestor] = useState(currentUser?.email ? currentUser.email.split('@')[0].toUpperCase() : "ŞANTİYE");
  const [saSupplier, setSaSupplier] = useState("");
  const [saNotes, setSaNotes] = useState("");
  const [cartItems, setCartItems] = useState<SatinAlmaItem[]>([]);
  const [editingSaId, setEditingSaId] = useState<string | null>(null);
  const [saAttachmentUrl, setSaAttachmentUrl] = useState<string | null>(null);
  const [saSearchKeyword, setSaSearchKeyword] = useState("");

  const [tempItem, setTempItem] = useState<Omit<SatinAlmaItem, 'id'>>({
    urunAdi: "",
    miktar: 0,
    birim: "ADET",
    marka: "",
    kullanilacakYer: "",
    aciklama: ""
  });

  // Suggest modals
  const [showCariSuggest, setShowCariSuggest] = useState(false);
  const [suggestedCariName, setSuggestedCariName] = useState("");
  const [suggestedCariType, setSuggestedCariType] = useState<CariKart['kartTipi']>('TEDARIKCI');

  const [showStokSuggest, setShowStokSuggest] = useState(false);
  const [suggestedStokName, setSuggestedStokName] = useState("");
  const [suggestedStokCat, setSuggestedStokCat] = useState("Kaba İnşaat İmalatı");
  const [suggestedStokUnit, setSuggestedStokUnit] = useState("ADET");

  const checkAndSuggestCari = (name: string) => {
    const exists = cariKartlar.some(c => c.unvan.toLowerCase().trim() === name.toLowerCase().trim());
    if (!exists) {
      setSuggestedCariName(name);
      setShowCariSuggest(true);
    }
  };

  const checkAndSuggestStok = (name: string, unit: string = "ADET") => {
    const exists = stokKartlar.some(s => s.stokAdi.toLowerCase().trim() === name.toLowerCase().trim());
    if (!exists) {
      setSuggestedStokName(name);
      setSuggestedStokUnit(unit);
      setShowStokSuggest(true);
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
    const newC: CariKart = {
      id: `ck_${Date.now()}`,
      kartTipi: suggestedCariType,
      kod: `CAR-${Math.floor(100 + Math.random() * 900)}`,
      unvan: suggestedCariName,
      yetkili: "Otomatik Eklendi",
      telefon: "",
      eposta: "",
      vergiNo: "",
      vergiDairesi: "",
      adres: "Satın alma talebinden otomatik oluşturuldu.",
      iban: "",
      durum: 'AKTIF',
      notlar: "Otomatik eklendi."
    };
    if (setCariKartlar) {
      setCariKartlar(prev => [newC, ...prev]);
    }
    setShowCariSuggest(false);
    alert(`Yeni Cari Kart (${suggestedCariName}) başarıyla oluşturuldu!`);
  };

  const handleCreateStok = () => {
    if (!suggestedStokName) return;
    const exists = stokKartlar.some(s => s.stokAdi.toLowerCase().trim() === suggestedStokName.toLowerCase().trim());
    if (exists) {
      alert("Hata: Bu isimde bir stok zaten bulunmaktadır.");
      setShowStokSuggest(false);
      return;
    }
    const newS: StokKart = {
      id: `sk_${Date.now()}`,
      stokKodu: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
      stokAdi: suggestedStokName,
      kategori: suggestedStokCat,
      birim: suggestedStokUnit,
      kritikSeviye: 5,
      durum: 'AKTIF',
      aciklama: "Satın alma talebinden otomatik oluşturuldu."
    };
    if (setStokKartlar) {
      setStokKartlar(prev => [newS, ...prev]);
    }
    setShowStokSuggest(false);
    alert(`Yeni Stok Kartı (${suggestedStokName}) başarıyla oluşturuldu!`);
  };

  const handleAddToCart = () => {
    if (!tempItem.urunAdi || tempItem.miktar <= 0) {
      alert("Lütfen ürün adı ve miktarını doldurun.");
      return;
    }
    const newItem: SatinAlmaItem = {
      ...tempItem,
      id: `sai_${Date.now()}`
    };
    setCartItems(prev => [...prev, newItem]);
    checkAndSuggestStok(tempItem.urunAdi, tempItem.birim);
    setTempItem({
      urunAdi: "",
      miktar: 0,
      birim: "ADET",
      marka: "",
      kullanilacakYer: "",
      aciklama: ""
    });
  };

  const handleSavePurchaseOrder = () => {
    if (cartItems.length === 0 || !saSupplier) {
      alert("Lütfen firma adını ve en az bir malzeme kalemi ekleyin!");
      return;
    }

    const cleanDate = new Date().toISOString().split('T')[0];

    if (editingSaId) {
      setSatinAlmaTalepleri(prev => prev.map(sa => {
        if (sa.id === editingSaId) {
          return {
            ...sa,
            talepEden: saRequestor,
            cariFirma: saSupplier,
            aciklama: saNotes,
            kalemler: cartItems,
            imzaliEvrakUrl: saAttachmentUrl || sa.imzaliEvrakUrl
          };
        }
        return sa;
      }));
      setEditingSaId(null);
    } else {
      const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
      const newSa: SatinAlmaTalebi = {
        id: `sa_${Date.now()}`,
        saId: `PO-${cleanDate.replace(/-/g, '')}-${randomHex}`,
        tarih: cleanDate,
        talepEden: saRequestor,
        cariFirma: saSupplier,
        onayDurumu: 'ONAY BEKLİYOR',
        aciklama: saNotes,
        kalemler: cartItems,
        imzaliEvrakUrl: saAttachmentUrl || undefined,
        eImzalar: []
      };
      setSatinAlmaTalepleri(prev => [newSa, ...prev]);
    }

    checkAndSuggestCari(saSupplier);

    // reset
    setSaSupplier("");
    setSaNotes("");
    setCartItems([]);
    setSaAttachmentUrl(null);
    alert("Satın alma talebi kaydedildi.");
  };

  const handleSimulateESignature = (sa: SatinAlmaTalebi) => {
    const selectedEmail = window.prompt(
      "E-İmza ile onaylayacak yetkiliyi giriniz:\n- sametatak9@gmail.com\n- santiye@kibritci.com",
      "sametatak9@gmail.com"
    );

    if (selectedEmail === "sametatak9@gmail.com" || selectedEmail === "santiye@kibritci.com") {
      const name = selectedEmail === "sametatak9@gmail.com" ? "SAMET ATAK" : "ŞANTİYE SORUMLUSU";
      setSatinAlmaTalepleri(prev => prev.map(item => {
        if (item.id === sa.id) {
          return {
            ...item,
            onayDurumu: 'ONAYLANDI',
            eImzalar: [...(item.eImzalar || []), `${name} (${selectedEmail} - Dijital E-İmza)`]
          };
        }
        return item;
      }));
      alert(`Dijital E-İmza onaylandı! (${name}) Sipariş durumu ONAYLANDI olarak işaretlendi ve kilitlendi.`);
    } else {
      alert("Hata: Geçersiz e-imza yetkilisi seçildi.");
    }
  };

  const handleUploadSignedFile = (e: React.ChangeEvent<HTMLInputElement>, saId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressImage(rawBase64);
        setSatinAlmaTalepleri(prev => prev.map(sa => {
          if (sa.id === saId) {
            return {
              ...sa,
              imzaliEvrakUrl: compressed,
              onayDurumu: 'ONAYLANDI'
            };
          }
          return sa;
        }));
        alert("Fiziksel ıslak imzalı evrak sisteme yüklendi! Talep onaylandı.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePreviewPdf = (sa: SatinAlmaTalebi) => {
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Kibritçi İnşaat - PO: ${sa.saId}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .corporate-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px; }
            .logo-placeholder { font-weight: 900; font-size: 24px; color: #1e3a8a; display: flex; align-items: center; gap: 8px; }
            .logo-placeholder svg { fill: #1e3a8a; }
            .title-area { text-align: right; }
            .title-area h2 { margin: 0; font-size: 18px; color: #0f172a; }
            .title-area p { margin: 2px 0 0 0; font-size: 11px; font-weight: bold; color: #64748b; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
            .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; font-size: 11px; }
            .info-card h4 { margin: 0 0 8px 0; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 12px; }
            .info-card p { margin: 4px 0; font-weight: 500; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border-radius: 8px; overflow: hidden; }
            .items-table th { background-color: #1e3a8a; color: white; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .items-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 11px; font-weight: 500; }
            .items-table tr:nth-child(even) { background-color: #f8fafc; }
            .signatures-title { margin-top: 40px; font-size: 11px; font-weight: bold; color: #1e3a8a; border-bottom: 2px dashed #cbd5e1; padding-bottom: 5px; text-transform: uppercase; }
            .signatures-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 15px; }
            .sig-col { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; font-size: 10px; background: #fff; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between; }
            .sig-title { font-weight: bold; color: #475569; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
            .sig-status { font-weight: 800; color: #10b981; font-size: 8px; margin-top: 10px; word-break: break-all; }
            .e-imza-bar { margin-top: 20px; font-size: 9px; color: #059669; font-weight: bold; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="corporate-header">
            <div class="logo-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 19H5.5L12 5.5z"/></svg>
              KİBRİTÇİ İNŞAAT A.Ş.
            </div>
            <div class="title-area">
              <h2>SATIN ALMA SİPARİŞİ / PO FORMU</h2>
              <p>BELGE NO: ${sa.saId}</p>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <h4>📋 SİPARİŞ BİLGİLERİ</h4>
              <p><strong>Belge Tarihi:</strong> ${sa.tarih}</p>
              <p><strong>Talep Eden:</strong> ${sa.talepEden}</p>
              <p><strong>Onay Durumu:</strong> ${sa.onayDurumu}</p>
            </div>
            <div class="info-card">
              <h4>🏢 TEDARİKÇİ CARİ KART</h4>
              <p><strong>Firma Ünvanı:</strong> ${sa.cariFirma}</p>
              <p><strong>Açıklama/Not:</strong> ${sa.aciklama || 'Belirtilmemiş'}</p>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Malzeme / Ürün Adı</th>
                <th>Sipariş Miktarı</th>
                <th>Marka / Üretici</th>
                <th>Kullanılacak Yer</th>
              </tr>
            </thead>
            <tbody>
              ${sa.kalemler.map(x => `
                <tr>
                  <td>${x.urunAdi}</td>
                  <td>${x.miktar} ${x.birim}</td>
                  <td>${x.marka || "Belirtilmemiş"}</td>
                  <td>${x.kullanilacakYer || "Genel Şantiye"}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="signatures-title">🖋️ ONAY VE İMZA KANALLARI (ÇİFT METOT GEÇERLİDİR)</div>
          <div class="signatures-grid">
            <div class="sig-col">
              <span class="sig-title">Talep Eden</span>
              <span style="font-weight:bold; color:#0f172a;">${sa.talepEden}</span>
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
              <span class="${sa.onayDurumu === 'ONAYLANDI' ? 'sig-status' : 'color:#94a3b8'}">
                ${sa.onayDurumu === 'ONAYLANDI' ? '✓ FİİLİ/DİJİTAL ONAYLANDI' : 'İmza Bekleniyor'}
              </span>
            </div>
            <div class="sig-col">
              <span class="sig-title">Proje Müdürü</span>
              <span class="${sa.onayDurumu === 'ONAYLANDI' ? 'sig-status' : 'color:#94a3b8'}">
                ${sa.onayDurumu === 'ONAYLANDI' ? '✓ FİİLİ/DİJİTAL ONAYLANDI' : 'İmza Bekleniyor'}
              </span>
            </div>
          </div>

          ${sa.eImzalar && sa.eImzalar.length > 0 ? `
            <div class="e-imza-bar">
              🛡️ DİJİTAL E-İMZA KANIT ZİNCİRİ:<br/>
              ${sa.eImzalar.map(im => `• ${im}`).join('<br/>')}
            </div>
          ` : ''}
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.print();
  };

  const filteredTalepler = satinAlmaTalepleri.filter(sa => {
    const kw = saSearchKeyword.toLowerCase();
    return sa.saId.toLowerCase().includes(kw) || 
           sa.cariFirma.toLowerCase().includes(kw) || 
           sa.talepEden.toLowerCase().includes(kw);
  });

  return (
    <div className="flex-grow p-6 min-h-[calc(100vh-52px)] overflow-y-auto flex flex-col lg:flex-row font-sans gap-6 select-none bg-slate-50/50">
      
      {/* LEFT FORM PANEL */}
      <div className="w-full lg:w-[420px] shrink-0 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center gap-2">
          <ShoppingCart size={18} className="text-amber-500" />
          <div>
            <h3 className="font-display font-semibold text-sm">🛒 Satın Alma Sipariş Talebi</h3>
            <p className="text-[10px] text-slate-400">Yeni bir malzeme tedarik sipariş talebi oluşturun.</p>
          </div>
        </div>

        <div className="flex-grow p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tedarikçi Cari Firma *</label>
            <input 
              type="text"
              list="cari-datalist"
              placeholder="Örn: ABC İnşaat Ltd."
              value={saSupplier}
              onChange={(e) => setSaSupplier(e.target.value)}
              className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
            />
            <datalist id="cari-datalist">
              {cariKartlar.map(c => (
                <option key={c.id} value={c.unvan} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Talep Eden Kişi / Sorumlu</label>
            <input 
              type="text"
              value={saRequestor}
              onChange={(e) => setSaRequestor(e.target.value)}
              className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
            />
          </div>

          <div className="bg-slate-50 border p-3 rounded-2xl space-y-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">📦 Malzeme / Sipariş Kalemleri</span>
            
            <div className="grid grid-cols-3 gap-2">
              <input 
                type="text"
                list="stok-datalist"
                placeholder="Malzeme Adı"
                value={tempItem.urunAdi}
                onChange={(e) => setTempItem(prev => ({ ...prev, urunAdi: e.target.value }))}
                className="col-span-2 p-1.5 border border-slate-200 bg-white rounded-lg text-[10px]"
              />
              <datalist id="stok-datalist">
                {stokKartlar.map(s => (
                  <option key={s.id} value={s.stokAdi} />
                ))}
              </datalist>
              <input 
                type="number"
                placeholder="Miktar"
                value={tempItem.miktar || ""}
                onChange={(e) => setTempItem(prev => ({ ...prev, miktar: Number(e.target.value) }))}
                className="p-1.5 border border-slate-200 bg-white rounded-lg text-[10px] text-center"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={tempItem.birim}
                onChange={(e) => setTempItem(prev => ({ ...prev, birim: e.target.value as any }))}
                className="p-1.5 border border-slate-200 bg-white rounded-lg text-[10px]"
              >
                <option value="ADET">ADET</option>
                <option value="TON">TON</option>
                <option value="KG">KG</option>
                <option value="M3">M3</option>
                <option value="TORBA">TORBA</option>
              </select>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-slate-900 text-white font-bold text-[10px] rounded-lg hover:bg-slate-950 transition cursor-pointer"
              >
                Kalem Ekle
              </button>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2 border-t text-[11px] font-semibold text-slate-700">
              {cartItems.map((p) => (
                <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded-lg border">
                  <span>{p.urunAdi}</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-slate-900">{p.miktar} {p.birim}</span>
                    <button
                      type="button"
                      onClick={() => setCartItems(prev => prev.filter(x => x.id !== p.id))}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase">Açıklama / Özel Notlar</label>
            <textarea 
              rows={2}
              placeholder="Sipariş detayları veya kargo notu..."
              value={saNotes}
              onChange={(e) => setSaNotes(e.target.value)}
              className="w-full text-xs mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 shrink-0">
          <button
            onClick={handleSavePurchaseOrder}
            className="w-full bg-blue-600 hover:bg-blue-750 text-white font-bold text-xs py-2.5 rounded-xl shadow transition cursor-pointer"
          >
            Satın Alma Talebini Kaydet
          </button>
        </div>
      </div>

      {/* RIGHT LIST PANEL */}
      <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm min-h-[450px]">
        <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
          <h4 className="font-display font-bold text-xs text-slate-800 uppercase tracking-widest">
            📋 Mevcut Talepler
          </h4>
          <input 
            type="text"
            placeholder="Kod veya firma ara..."
            value={saSearchKeyword}
            onChange={(e) => setSaSearchKeyword(e.target.value)}
            className="text-xs border p-2 rounded-xl bg-white w-48 sm:w-64"
          />
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {filteredTalepler.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Kayıtlı talep bulunmuyor.</p>
          ) : (
            filteredTalepler.map(sa => {
              const isLocked = sa.onayDurumu === 'ONAYLANDI';
              return (
                <div key={sa.id} className="border border-slate-100 rounded-2xl p-4 bg-white hover:shadow transition flex flex-col space-y-3.5 text-xs text-slate-700">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono bg-slate-900 text-amber-500 rounded px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          {sa.saId}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          isLocked 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                            : 'bg-amber-50 text-amber-800 border-amber-100'
                        }`}>
                          {sa.onayDurumu === 'ONAYLANDI' ? '✓ ONAYLANDI (KİLİTLİ)' : 'ONAY BEKLİYOR'}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-950 mt-1">Firma: {sa.cariFirma} · Tarih: {sa.tarih}</h5>
                    </div>

                    {isLocked && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl font-bold flex items-center gap-1 text-[10px]">
                        <CheckCircle2 size={13} />
                        Kilitli
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium">
                    Talep Eden: {sa.talepEden} · Açıklama: {sa.aciklama || "Yok"}
                  </p>
                  
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150/50 space-y-1 text-[10px] font-semibold text-slate-650">
                    {sa.kalemler.map((item, idx) => (
                      <p key={idx}>• {item.urunAdi}: {item.miktar} {item.birim} {item.marka ? `(${item.marka})` : ''}</p>
                    ))}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-wrap gap-2 pt-1.5 text-[10px]">
                    <button
                      onClick={() => handlePreviewPdf(sa)}
                      className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={13} />
                      PDF Raporu Önizle
                    </button>

                    {!isLocked ? (
                      <>
                        <button
                          onClick={() => handleSimulateESignature(sa)}
                          className="bg-indigo-650 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <ShieldCheck size={13} />
                          E-İmzaya Gönder
                        </button>

                        <label className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1">
                          <Upload size={13} />
                          İmzalı Evrak Yükle
                          <input 
                            type="file" 
                            onChange={(e) => handleUploadSignedFile(e, sa.id)} 
                            className="hidden" 
                            accept="image/*,application/pdf" 
                          />
                        </label>

                        <button
                          onClick={() => {
                            setEditingSaId(sa.id);
                            setSaSupplier(sa.cariFirma);
                            setSaNotes(sa.aciklama || "");
                            setCartItems(sa.kalemler);
                          }}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-250 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                        >
                          ✏️ Düzenle
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm("Bu satın alma talebini silmek istediğinize emin misiniz?")) {
                              setSatinAlmaTalepleri(prev => prev.filter(x => x.id !== sa.id));
                              alert("Talep silindi.");
                            }
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-250 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer"
                        >
                          🗑️ Sil
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[9px]">
                        <span>✍️ İmzalayanlar: {sa.eImzalar && sa.eImzalar.length > 0 ? sa.eImzalar.join(', ') : 'Fiziksel Evrak Yüklendi'}</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
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

export default SatinAlmaScreen;

import React, { useState } from 'react';
import { Truck, CreditCard, Eye, Check, X, Sparkles, ExternalLink, FileText, Download, ZoomIn, Loader2 } from 'lucide-react';
import { openBase64InNewTab } from '../lib/fileViewerUtils';

interface GuvenlikEvrakOnayHavuzuProps {
  pendingGateDocs: any[];
  pendingWaybills: any[];
  pendingInvoices: any[];
  setActiveDocForDetail: (val: any) => void;
  handleApproveDocument: (type: 'waybill' | 'invoice', id: string) => void;
  handleRejectGateDoc: (id: string) => void;
  handleOpenGateDocApproval: (doc: any) => void;
  activeGateDoc: any | null;
  setActiveGateDoc: (val: any) => void;
  approvalStep: 'SELECT_METHOD' | 'FORM';
  setApprovalStep: (val: 'SELECT_METHOD' | 'FORM') => void;
  selectedDocType: 'FATURA' | 'İRSALİYE' | 'MAKBUZ' | 'GENEL_EVRAK';
  setSelectedDocType: (val: 'FATURA' | 'İRSALİYE' | 'MAKBUZ' | 'GENEL_EVRAK') => void;
  isAiResolving: boolean;
  handleAnalyzeGateDocWithAi: () => void;
  handleStartManualGateDocApproval: () => void;
  handleSaveGateDocApproval: (e: React.FormEvent) => void;

  faturaNo: string;
  setFaturaNo: (val: string) => void;
  faturaFirma: string;
  setFaturaFirma: (val: string) => void;
  faturaTarih: string;
  setFaturaTarih: (val: string) => void;
  faturaToplam: number;
  setFaturaToplam: (val: number) => void;
  faturaKdv: number;
  setFaturaKdv: (val: number) => void;
  faturaGenelToplam: number;
  setFaturaGenelToplam: (val: number) => void;
  faturaKalemler: any[];
  setFaturaKalemler: React.Dispatch<React.SetStateAction<any[]>>;

  irsaliyeNo: string;
  setIrsaliyeNo: (val: string) => void;
  irsaliyeFirma: string;
  setIrsaliyeFirma: (val: string) => void;
  irsaliyeTarih: string;
  setIrsaliyeTarih: (val: string) => void;
  irsaliyeKalemler: any[];
  setIrsaliyeKalemler: React.Dispatch<React.SetStateAction<any[]>>;

  makbuzRefNo: string;
  setMakbuzRefNo: (val: string) => void;
  makbuzFirma: string;
  setMakbuzFirma: (val: string) => void;
  makbuzTarih: string;
  setMakbuzTarih: (val: string) => void;
  makbuzTutar: number;
  setMakbuzTutar: (val: number) => void;
  makbuzAciklama: string;
  setMakbuzAciklama: (val: string) => void;
  makbuzTip: 'GİRİŞ' | 'ÇIKIŞ';
  setMakbuzTip: (val: 'GİRİŞ' | 'ÇIKIŞ') => void;

  genelAciklama: string;
  setGenelAciklama: (val: string) => void;

  itemUrunAdi: string;
  setItemUrunAdi: (val: string) => void;
  itemMiktar: number | '';
  setItemMiktar: (val: number | '') => void;
  itemBirim: string;
  setItemBirim: (val: string) => void;
  itemBirimFiyat: number | '';
  setItemBirimFiyat: (val: number | '') => void;
  itemKdvOran: number;
  setItemKdvOran: (val: number) => void;
}

export const GuvenlikEvrakOnayHavuzu: React.FC<GuvenlikEvrakOnayHavuzuProps> = ({
  pendingGateDocs,
  pendingWaybills,
  pendingInvoices,
  setActiveDocForDetail,
  handleApproveDocument,
  handleRejectGateDoc,
  handleOpenGateDocApproval,
  activeGateDoc,
  setActiveGateDoc,
  approvalStep,
  setApprovalStep,
  selectedDocType,
  setSelectedDocType,
  isAiResolving,
  handleAnalyzeGateDocWithAi,
  handleStartManualGateDocApproval,
  handleSaveGateDocApproval,

  faturaNo,
  setFaturaNo,
  faturaFirma,
  setFaturaFirma,
  faturaTarih,
  setFaturaTarih,
  faturaToplam,
  setFaturaToplam,
  faturaKdv,
  setFaturaKdv,
  faturaGenelToplam,
  setFaturaGenelToplam,
  faturaKalemler,
  setFaturaKalemler,

  irsaliyeNo,
  setIrsaliyeNo,
  irsaliyeFirma,
  setIrsaliyeFirma,
  irsaliyeTarih,
  setIrsaliyeTarih,
  irsaliyeKalemler,
  setIrsaliyeKalemler,

  makbuzRefNo,
  setMakbuzRefNo,
  makbuzFirma,
  setMakbuzFirma,
  makbuzTarih,
  setMakbuzTarih,
  makbuzTutar,
  setMakbuzTutar,
  makbuzAciklama,
  setMakbuzAciklama,
  makbuzTip,
  setMakbuzTip,

  genelAciklama,
  setGenelAciklama,

  itemUrunAdi,
  setItemUrunAdi,
  itemMiktar,
  setItemMiktar,
  itemBirim,
  setItemBirim,
  itemBirimFiyat,
  setItemBirimFiyat,
  itemKdvOran,
  setItemKdvOran,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  return (
    <div className="space-y-6">
      <div className="border bg-slate-950 p-4.5 rounded-2xl border-slate-800/80 flex justify-between items-center text-xs">
        <div className="space-y-1">
          <span className="text-emerald-500 font-bold block text-[11px] tracking-widest uppercase">🛡️ GÜVENLİK KAPISI EVRAK ONAY HAVUZU</span>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Kapıdaki güvenlik personelleri tarafından çoklu yüklenen fatura, irsaliye, makbuz ve genel evrakların dijital onay, arşivleme ve Yapay Zeka mutabakat paneli.
          </p>
        </div>
      </div>

      {/* 1. GÜVENLİK KAPISINDAN GELEN EVRAKLAR */}
      <div className="space-y-3">
        <h3 className="font-display font-black text-xs text-slate-350 tracking-wider flex items-center space-x-2 uppercase">
          <FileText size={14} className="text-indigo-500" />
          <span>Güvenlik Kapısı Girişleri ({pendingGateDocs.length})</span>
        </h3>

        {pendingGateDocs.length === 0 ? (
          <div className="bg-slate-950 rounded-3xl p-10 text-center flex flex-col items-center justify-center space-y-3 border border-slate-800/50">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="text-xs font-bold text-slate-200">Güvenlik kapısından onay bekleyen yeni evrak bulunmuyor.</h3>
              <p className="text-[10px] text-slate-500 mt-1">Kapı evrak girişleri mutabıktır.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingGateDocs.map(docItem => (
              <div key={docItem.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition space-y-3 shadow-lg">
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                      docItem.evrakTuru === 'FATURA' ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40' :
                      docItem.evrakTuru === 'İRSALİYE' ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' :
                      docItem.evrakTuru === 'MAKBUZ' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' :
                      'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}>
                      {docItem.evrakTuru}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">{docItem.tarih} - {docItem.saat}</span>
                  </div>

                  <div className="text-xs text-slate-200 font-bold mt-2 truncate">
                    Dosya: {docItem.fileName || 'Belge.jpg'}
                  </div>
                  
                  {docItem.aciklama && (
                    <p className="text-[11px] text-slate-450 leading-relaxed italic bg-slate-900/50 p-2 rounded-lg border border-slate-800/50 mt-2 truncate">
                      "{docItem.aciklama}"
                    </p>
                  )}
                  
                  <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                    Yükleyen: {docItem.kaydeden || 'Güvenlik'}
                  </div>

                  {/* AI Status & Parsed Preview */}
                  {docItem.aiParsed && (
                    <div className="mt-2 text-[10px] bg-indigo-950/40 border border-indigo-900/30 p-2.5 rounded-xl text-indigo-300 font-sans">
                      <span className="font-bold block text-[8px] uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                        <Sparkles size={9} className="text-amber-400 animate-pulse" /> YAYINLANAN YZ VERİLERİ
                      </span>
                      <div className="truncate"><strong>Firma:</strong> {docItem.firma || '-'}</div>
                      <div className="truncate"><strong>No/Kod:</strong> {docItem.evrakNo || '-'}</div>
                      <div className="truncate"><strong>Miktar:</strong> {docItem.kalemler?.length || 0} Kalem</div>
                    </div>
                  )}
                  {docItem.aiStatus === 'PARSING' && (
                    <div className="mt-2 text-[10px] bg-slate-900 border border-slate-800 p-2 rounded-xl text-slate-400 font-sans flex items-center gap-1.5 animate-pulse">
                      <Loader2 size={10} className="animate-spin text-indigo-500" />
                      <span>Yapay Zeka evrakı okuyor...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => handleOpenGateDocApproval(docItem)}
                    className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] py-2 px-3 rounded-lg transition tracking-wider uppercase flex items-center justify-center space-x-1"
                  >
                    <Sparkles size={12} />
                    <span>Onayla &amp; İşle</span>
                  </button>
                  <button
                    onClick={() => handleRejectGateDoc(docItem.id)}
                    className="bg-rose-950/50 hover:bg-rose-900 border border-rose-900 text-rose-400 font-bold text-[10px] py-2 px-3 rounded-lg transition"
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. DİĞER BEKLEYEN ONALAR (OFİS LİSTESİ) */}
      <div className="border-t border-slate-800/60 pt-6 space-y-4">
        {(pendingWaybills.length > 0 || pendingInvoices.length > 0) && (
          <div className="space-y-6">
            {/* İrsaliyeler Grid */}
            {pendingWaybills.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-display font-black text-xs text-slate-450 tracking-wider flex items-center space-x-2 uppercase">
                  <Truck size={14} className="text-emerald-500" />
                  <span>Ofisten Kayıtlı Bekleyen İrsaliyeler ({pendingWaybills.length})</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingWaybills.map(doc => (
                    <div key={doc.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition space-y-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {doc.irsaliyeNo}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-bold">{doc.tarih}</span>
                        </div>
                        <p className="text-xs text-slate-200 font-bold mt-2.5">Firma: {doc.firma}</p>
                        <p className="text-[10.5px] text-slate-450 mt-1">İlişkili Sipariş No: {doc.saId || 'Doğrudan Sevkiyat'}</p>

                        <div className="mt-2.5 pt-2 border-t border-slate-800">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Gelen Malzemeler</span>
                          <div className="space-y-1 text-[10px] font-mono text-slate-400">
                            {doc.kalemler?.slice(0, 3).map((k: any, idx: number) => (
                              <div key={k.id || idx} className="flex justify-between">
                                <span className="truncate max-w-[150px]">{k.urunAdi}</span>
                                <span className="text-white font-bold">{k.miktar} {k.birim}</span>
                              </div>
                            ))}
                            {doc.kalemler?.length > 3 && <div className="text-[9px] text-slate-500">+ {doc.kalemler.length - 3} kalem daha</div>}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2.5 border-t border-slate-900">
                        <button 
                          onClick={() => setActiveDocForDetail({ id: doc.id, type: 'waybill', data: doc })}
                          className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-white py-1.5 px-3 rounded-lg text-[10px] font-black tracking-widest transition flex items-center justify-center space-x-1"
                        >
                          <Eye size={11} />
                          <span>Detay İncele</span>
                        </button>
                        <button 
                          onClick={() => handleApproveDocument('waybill', doc.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-1.5 px-3 rounded-lg text-[10px] font-black tracking-widest transition flex items-center justify-center space-x-1"
                        >
                          <Check size={11} />
                          <span>Onayla &amp; İmzala</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Faturalar Grid */}
            {pendingInvoices.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="font-display font-black text-xs text-slate-450 tracking-wider flex items-center space-x-2 uppercase">
                  <CreditCard size={14} className="text-purple-500" />
                  <span>Ofisten Kayıtlı Bekleyen Faturalar ({pendingInvoices.length})</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingInvoices.map(doc => (
                    <div key={doc.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition space-y-3">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="font-mono bg-purple-500/10 border border-purple-200/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            {doc.faturaNo}
                          </span>
                          <span className="text-[10px] text-slate-550 font-mono font-bold">{doc.tarih}</span>
                        </div>
                        <p className="text-xs text-slate-200 font-bold mt-2.5">Cari Unvan: {doc.cariUnvan}</p>
                        <p className="text-[10.5px] text-slate-455 mt-1">Eşleşen İrsaliyeler: {doc.bagliIrsaliyeler?.join(', ') || 'Manuel Bağsız'}</p>
                        
                        <div className="mt-2.5 p-2 bg-purple-500/5 rounded border border-purple-500/10 flex justify-between items-center text-[10px]">
                          <span className="text-slate-450 font-bold">Toplam Tutar:</span>
                          <span className="text-purple-400 font-black font-mono">₺{doc.genelToplam?.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2.5 border-t border-slate-900">
                        <button 
                          onClick={() => setActiveDocForDetail({ id: doc.id, type: 'invoice', data: doc })}
                          className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-white py-1.5 px-3 rounded-lg text-[10px] font-black tracking-widest transition flex items-center justify-center space-x-1"
                        >
                          <Eye size={11} />
                          <span>Karşılaştır &amp; Gör</span>
                        </button>
                        <button 
                          onClick={() => handleApproveDocument('invoice', doc.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-1.5 px-3 rounded-lg text-[10px] font-black tracking-widest transition flex items-center justify-center space-x-1"
                        >
                          <Check size={11} />
                          <span>Mutabakat Onayla</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. EVRAK ONAY & ARŞİVLEME SİHİRBAZI MODAL */}
      {activeGateDoc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl text-white">
            
            {/* Left half: Document image preview */}
            <div className="w-full md:w-1/2 p-5 bg-slate-950 flex flex-col justify-between border-r border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">Evrak Görseli / Önizleme</span>
                {activeGateDoc.fotoUrl && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 font-semibold"
                    >
                      <ZoomIn size={12} />
                      <span>Yakınlaştır</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = activeGateDoc.fotoUrl;
                        link.download = activeGateDoc.fileName || 'evrak.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 font-semibold"
                    >
                      <Download size={12} />
                      <span>İndir</span>
                    </button>
                    <a
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        openBase64InNewTab(activeGateDoc.fotoUrl, activeGateDoc.fileName || 'Belge');
                      }}
                      className="text-[10px] text-slate-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <ExternalLink size={12} />
                      <span>Yeni Sekmede Aç</span>
                    </a>
                  </div>
                )}
              </div>
              
              <div className="flex-grow flex items-center justify-center overflow-hidden bg-slate-900 rounded-2xl border border-slate-800 p-3 min-h-[300px]">
                {activeGateDoc.fotoUrl ? (
                  activeGateDoc.fotoUrl.startsWith('data:image/') || activeGateDoc.fotoUrl.includes('.jpg') || activeGateDoc.fotoUrl.includes('.png') ? (
                    <img
                      src={activeGateDoc.fotoUrl}
                      alt="Evrak"
                      onClick={() => setIsZoomed(true)}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg cursor-zoom-in hover:opacity-90 transition"
                      title="Büyütmek için tıklayın"
                    />
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="text-5xl">📄</div>
                      <div className="text-xs text-slate-400">PDF veya Word Dosyası Yüklenmiş</div>
                      <a
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          openBase64InNewTab(activeGateDoc.fotoUrl, activeGateDoc.fileName || 'Belge');
                        }}
                        className="inline-block bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition"
                      >
                        Dosyayı İndir / Aç
                      </a>
                    </div>
                  )
                ) : (
                  <span className="text-xs text-slate-500 font-bold">Fotoğraf yüklenmedi.</span>
                )}
              </div>
            </div>

            {/* Right half: Form & parsing wizard */}
            <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto max-h-[90vh]">
              <div>
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
                  <div>
                    <h2 className="font-display font-black text-sm uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <Sparkles size={16} />
                      <span>Evrak İşleme Sihirbazı</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Kapı Kayıt Ref: <span className="font-mono text-slate-300">{activeGateDoc.id}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveGateDoc(null)}
                    className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded-full transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Step 1: Select Type & Method */}
                {approvalStep === 'SELECT_METHOD' && (
                  <div className="space-y-5 py-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
                        Onaylanacak Evrak Türünü Belirleyin
                      </label>
                      <select
                        value={selectedDocType}
                        onChange={(e) => setSelectedDocType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 text-amber-400 p-3 rounded-xl font-bold text-xs"
                      >
                        <option value="İRSALİYE">📄 İRSALİYE ARŞİVİNE KAYDET</option>
                        <option value="FATURA">💰 FATURA ARŞİVİNE KAYDET</option>
                        <option value="MAKBUZ">🎫 KASA DEKONT / MAKBUZ HAREKETİNE EKLE</option>
                        <option value="GENEL_EVRAK">📦 GENEL EVRAK DEKONTUNA KAYDET</option>
                      </select>
                    </div>

                    <div className="bg-indigo-950/20 border border-indigo-900/30 p-3 rounded-xl space-y-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wide block">Nöbetçi Açıklaması</span>
                      <p className="text-slate-300 text-xs font-semibold italic">
                        "{activeGateDoc.aciklama || 'Açıklama belirtilmemiş'}"
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-3">
                      {selectedDocType !== 'GENEL_EVRAK' && (
                        <button
                          onClick={handleAnalyzeGateDocWithAi}
                          disabled={isAiResolving}
                          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-550 hover:to-indigo-550 text-white font-extrabold text-xs p-4 rounded-2xl transition disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950/25"
                        >
                          {isAiResolving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                              <span>Yapay Zeka Analiz Ediyor...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} className="text-amber-300 animate-pulse" />
                              <span>YAPAY ZEKA İLE ÇÖZÜMLE &amp; DOLDUR</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={handleStartManualGateDocApproval}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-extrabold text-xs p-3.5 rounded-2xl transition flex items-center justify-center space-x-1.5"
                      >
                        <span>✍️ MANUEL OLARAK KART DOLDUR</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Form editing and review */}
                {approvalStep === 'FORM' && (
                  <form onSubmit={handleSaveGateDocApproval} className="space-y-4">
                    
                    {/* Form fields based on selectedDocType */}
                    {selectedDocType === 'FATURA' && (
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">Fatura No *</label>
                            <input
                              type="text"
                              required
                              value={faturaNo}
                              onChange={(e) => setFaturaNo(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">Fatura Tarihi *</label>
                            <input
                              type="date"
                              required
                              value={faturaTarih}
                              onChange={(e) => setFaturaTarih(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <label className="text-[9px] font-bold text-slate-400 block uppercase">Satıcı Cari Ünvan *</label>
                          <input
                            type="text"
                            required
                            value={faturaFirma}
                            onChange={(e) => setFaturaFirma(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-bold"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 block uppercase">Matrah (KDV Hariç) *</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={faturaToplam}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setFaturaToplam(v);
                                setFaturaGenelToplam(v + faturaKdv);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 block uppercase">Toplam KDV *</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={faturaKdv}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setFaturaKdv(v);
                                setFaturaGenelToplam(faturaToplam + v);
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-white p-2 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-indigo-400 block uppercase">Genel Toplam (TL) *</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={faturaGenelToplam}
                              onChange={(e) => setFaturaGenelToplam(Number(e.target.value))}
                              className="w-full bg-slate-955 border border-indigo-900 text-indigo-450 p-2 rounded-lg font-mono font-black"
                            />
                          </div>
                        </div>

                        {/* Items table for Fatura */}
                        <div className="space-y-2 border-t border-slate-800 pt-3">
                          <span className="text-[9px] font-black text-purple-400 block uppercase tracking-wider">Malzeme Kalemleri ({faturaKalemler.length})</span>
                          
                          {/* Add row */}
                          <div className="grid grid-cols-12 gap-1 bg-slate-950 p-2 border border-slate-800 rounded-xl">
                            <input
                              type="text"
                              placeholder="Malzeme Adı"
                              value={itemUrunAdi}
                              onChange={(e) => setItemUrunAdi(e.target.value)}
                              className="col-span-6 bg-slate-900 border border-slate-800 text-[10px] p-1.5 rounded"
                            />
                            <input
                              type="number"
                              placeholder="Miktar"
                              value={itemMiktar}
                              onChange={(e) => setItemMiktar(e.target.value === '' ? '' : Number(e.target.value))}
                              className="col-span-2 bg-slate-900 border border-slate-800 text-[10px] p-1.5 rounded text-right font-mono"
                            />
                            <input
                              type="number"
                              placeholder="B.Fiyat"
                              value={itemBirimFiyat}
                              onChange={(e) => setItemBirimFiyat(e.target.value === '' ? '' : Number(e.target.value))}
                              className="col-span-2 bg-slate-900 border border-slate-800 text-[10px] p-1.5 rounded text-right font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!itemUrunAdi || !itemMiktar) return;
                                const m = Number(itemMiktar);
                                const bf = Number(itemBirimFiyat || 0);
                                const kdv = Number(itemKdvOran);
                                const sub = m * bf;
                                const tax = sub * (kdv / 100);
                                const tot = sub + tax;
                                setFaturaKalemler(prev => [...prev, {
                                  urunAdi: itemUrunAdi,
                                  miktar: m,
                                  birim: itemBirim,
                                  birimFiyat: bf,
                                  kdvOran: kdv,
                                  toplam: tot
                                }]);
                                setItemUrunAdi('');
                                setItemMiktar('');
                                setItemBirimFiyat('');
                              }}
                              className="col-span-2 bg-purple-700 hover:bg-purple-650 text-white font-extrabold text-[10px] rounded"
                            >
                              Ekle
                            </button>
                          </div>

                          {faturaKalemler.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl text-[10px] divide-y divide-slate-800">
                              {faturaKalemler.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 hover:bg-slate-900 transition">
                                  <div className="font-semibold text-slate-200 truncate max-w-[200px]" title={it.urunAdi}>{it.urunAdi}</div>
                                  <div className="flex items-center space-x-3 text-right">
                                    <span className="font-mono text-slate-400">{it.miktar} {it.birim} × ₺{it.birimFiyat?.toLocaleString()}</span>
                                    <span className="font-mono font-bold text-indigo-400">₺{it.toplam?.toLocaleString()}</span>
                                    <button
                                      type="button"
                                      onClick={() => setFaturaKalemler(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-rose-500 hover:text-rose-400 text-[10px] px-1 font-bold"
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedDocType === 'İRSALİYE' && (
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">İrsaliye No *</label>
                            <input
                              type="text"
                              required
                              value={irsaliyeNo}
                              onChange={(e) => setIrsaliyeNo(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">İrsaliye Tarihi *</label>
                            <input
                              type="date"
                              required
                              value={irsaliyeTarih}
                              onChange={(e) => setIrsaliyeTarih(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <label className="text-[9px] font-bold text-slate-400 block uppercase">Gönderen Firma *</label>
                          <input
                            type="text"
                            required
                            value={irsaliyeFirma}
                            onChange={(e) => setIrsaliyeFirma(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-bold"
                          />
                        </div>

                        {/* Items table for Irsaliye */}
                        <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                          <span className="text-[9px] font-black text-amber-500 block uppercase tracking-wider">Sevk Edilen Malzeme Kalemleri ({irsaliyeKalemler.length})</span>
                          
                          {/* Add row */}
                          <div className="grid grid-cols-12 gap-1 bg-slate-955 p-2 border border-slate-800 rounded-xl">
                            <input
                              type="text"
                              placeholder="Malzeme Adı"
                              value={itemUrunAdi}
                              onChange={(e) => setItemUrunAdi(e.target.value)}
                              className="col-span-7 bg-slate-900 border border-slate-800 text-[10px] p-1.5 rounded"
                            />
                            <input
                              type="number"
                              placeholder="Miktar"
                              value={itemMiktar}
                              onChange={(e) => setItemMiktar(e.target.value === '' ? '' : Number(e.target.value))}
                              className="col-span-3 bg-slate-900 border border-slate-800 text-[10px] p-1.5 rounded text-right font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!itemUrunAdi || !itemMiktar) return;
                                setIrsaliyeKalemler(prev => [...prev, {
                                  urunAdi: itemUrunAdi,
                                  miktar: Number(itemMiktar),
                                  birim: itemBirim
                                }]);
                                setItemUrunAdi('');
                                setItemMiktar('');
                              }}
                              className="col-span-2 bg-amber-650 hover:bg-amber-600 text-slate-950 font-extrabold text-[10px] rounded"
                            >
                              Ekle
                            </button>
                          </div>

                          {irsaliyeKalemler.length > 0 && (
                            <div className="max-h-[150px] overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl text-[10px] divide-y divide-slate-800">
                              {irsaliyeKalemler.map((it, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 hover:bg-slate-900 transition">
                                  <div className="font-semibold text-slate-200 truncate max-w-[250px]">{it.urunAdi}</div>
                                  <div className="flex items-center space-x-3 text-right">
                                    <span className="font-mono text-amber-500 font-bold">{it.miktar} {it.birim || 'Adet'}</span>
                                    <button
                                      type="button"
                                      onClick={() => setIrsaliyeKalemler(prev => prev.filter((_, i) => i !== idx))}
                                      className="text-rose-505 hover:text-rose-400 text-[10px] px-1 font-bold"
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedDocType === 'MAKBUZ' && (
                      <div className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">İşlem / Fiş No *</label>
                            <input
                              type="text"
                              required
                              value={makbuzRefNo}
                              onChange={(e) => setMakbuzRefNo(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">İşlem Tarihi *</label>
                            <input
                              type="date"
                              required
                              value={makbuzTarih}
                              onChange={(e) => setMakbuzTarih(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3 text-xs">
                          <div className="col-span-8 space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">Muhatap Firma / Cari Kart *</label>
                            <input
                              type="text"
                              required
                              value={makbuzFirma}
                              onChange={(e) => setMakbuzFirma(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-bold"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 block uppercase">Kasa Tipi *</label>
                            <select
                              value={makbuzTip}
                              onChange={(e) => setMakbuzTip(e.target.value as any)}
                              className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg font-bold"
                            >
                              <option value="ÇIKIŞ">💰 NAKİT ÇIKIŞI</option>
                              <option value="GİRİŞ">💵 NAKİT TAHMİNAT / GİRİŞ</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs">
                          <label className="text-[9px] font-bold text-slate-400 block uppercase">İşlem Tutarı (₺) *</label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            value={makbuzTutar}
                            onChange={(e) => setMakbuzTutar(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 text-emerald-450 p-2.5 rounded-lg font-mono font-black text-sm"
                          />
                        </div>

                        <div className="space-y-1 text-xs">
                          <label className="text-[9px] font-bold text-slate-400 block uppercase">İşlem Açıklaması *</label>
                          <input
                            type="text"
                            required
                            value={makbuzAciklama}
                            onChange={(e) => setMakbuzAciklama(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-2 rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {selectedDocType === 'GENEL_EVRAK' && (
                      <div className="space-y-3.5">
                        <div className="space-y-1 text-xs">
                          <label className="text-[9px] font-bold text-slate-400 block uppercase">Genel Evrak Kayıt Notu / Açıklaması</label>
                          <textarea
                            required
                            rows={4}
                            value={genelAciklama}
                            onChange={(e) => setGenelAciklama(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-lg text-xs leading-relaxed"
                            placeholder="Evrakın kime teslim edildiği, içeriği veya takip kargo numarası vb..."
                          />
                        </div>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-2.5 border-t border-slate-800 pt-4 mt-6">
                      <button
                        type="button"
                        onClick={() => setApprovalStep('SELECT_METHOD')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 px-5 rounded-xl transition"
                      >
                        Geri
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs py-2.5 px-6 rounded-xl transition shadow-lg shadow-emerald-950/20"
                      >
                        ONAYLA &amp; ARŞİVE KAYDET
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. GÖRSEL YAKINLAŞTIRMA OVERLAY MODALI */}
      {isZoomed && activeGateDoc && activeGateDoc.fotoUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = activeGateDoc.fotoUrl;
                link.download = activeGateDoc.fileName || 'evrak.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition shadow-lg cursor-pointer border-0"
            >
              <Download size={14} />
              <span>İndir</span>
            </button>
            <button
              onClick={() => setIsZoomed(false)}
              className="bg-slate-800 hover:bg-slate-750 text-white p-2 rounded-xl transition shadow-lg cursor-pointer border-0"
              title="Kapat"
            >
              <X size={20} />
            </button>
          </div>
          <div className="max-w-5xl max-h-[85vh] overflow-auto flex items-center justify-center p-2 rounded-2xl bg-slate-900/50 border border-slate-800">
            <img
              src={activeGateDoc.fotoUrl}
              alt="Evrak Zoomed"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
          <span className="text-slate-400 text-xs mt-3 font-semibold font-mono">
            {activeGateDoc.fileName || 'Belge Görseli'} (Tıklayarak veya sağ üstteki X butonu ile kapatabilirsiniz)
          </span>
          <div className="absolute inset-0 -z-10 cursor-zoom-out" onClick={() => setIsZoomed(false)} />
        </div>
      )}
    </div>
  );
};

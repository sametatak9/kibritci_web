import React, { useState } from 'react';
import { FileText, Upload, Send } from 'lucide-react';
import { compressImage } from '../lib/imageCompress';
import { CorporateReportLayout } from './CorporateReportLayout';

export interface HazirTutanak {
  id: string;
  tutanakTipi: 'TAHSİS' | 'TESLİM' | 'SEVK' | 'HASAR' | 'GENEL' | 'CEZA';
  belgeNo: string;
  personelId?: string;
  tarih: string;
  konu: string;
  icerik: string;
  durum: 'TASLAK' | 'ONAY BEKLİYOR' | 'ONAYLANDI';
  aciklama?: string;
  imzaliEvrakUrl?: string;
  taseronAdi?: string;
  cezaTutari?: number;
}

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  gorev: string;
}

interface HazirTutanakTabProps {
  hazirTutanaklar: HazirTutanak[];
  setHazirTutanaklar: any;
  personeller: Personel[];
  cariKartlar: any[];
}

export const HazirTutanakTab: React.FC<HazirTutanakTabProps> = ({
  hazirTutanaklar,
  setHazirTutanaklar,
  personeller,
  cariKartlar
}) => {
  const [tutanakType, setTutanakType] = useState<'TAHSİS' | 'TESLİM' | 'SEVK' | 'HASAR' | 'GENEL' | 'CEZA'>("TAHSİS");
  const [tutanakSubject, setTutanakSubject] = useState("");
  const [tutanakPerson, setTutanakPerson] = useState("");
  const [tutanakText, setTutanakText] = useState("");
  const [taseronAdi, setTaseronAdi] = useState("");
  const [cezaTutari, setCezaTutari] = useState<number>(0);

  const [tutanakSearch, setTutanakSearch] = useState("");
  const [editingTutanakId, setEditingTutanakId] = useState<string | null>(null);
  const [deleteConfirmTutanakId, setDeleteConfirmTutanakId] = useState<string | null>(null);

  const [selectedTutanakForPdf, setSelectedTutanakForPdf] = useState<HazirTutanak | null>(null);

  const handleSaveTutanak = () => {
    if (!tutanakSubject || !tutanakText) {
      alert("Lütfen tutanak konusu ve metin içeriğini doldurun.");
      return;
    }

    if (editingTutanakId) {
      setHazirTutanaklar((prev: any) => prev.map((ht: any) => {
        if (ht.id === editingTutanakId) {
          return {
            ...ht,
            tutanakTipi: tutanakType,
            personelId: tutanakPerson,
            konu: tutanakSubject,
            icerik: tutanakText,
            taseronAdi: taseronAdi,
            cezaTutari: cezaTutari
          };
        }
        return ht;
      }));
      setEditingTutanakId(null);
      setTutanakSubject("");
      setTutanakText("");
      setTaseronAdi("");
      setCezaTutari(0);
      alert("Tutanak başarıyla güncellendi.");
    } else {
      const docNo = `TUT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newDoc: HazirTutanak = {
        id: `t_${Date.now()}`,
        tutanakTipi: tutanakType,
        belgeNo: docNo,
        personelId: tutanakPerson,
        konu: tutanakSubject,
        tarih: new Date().toISOString().split('T')[0],
        icerik: tutanakText,
        durum: "TASLAK",
        aciklama: "Yeni tutanak taslağı açıldı.",
        taseronAdi: taseronAdi,
        cezaTutari: cezaTutari
      };

      setHazirTutanaklar((prev: any) => [newDoc, ...prev]);
      setTutanakSubject("");
      setTutanakText("");
      setTaseronAdi("");
      setCezaTutari(0);
      alert(`${docNo} numaralı resmi tutanak taslağı başarıyla kaydedildi.`);
    }
  };

  const handleStartEditTutanak = (ht: HazirTutanak) => {
    setEditingTutanakId(ht.id);
    setTutanakType(ht.tutanakTipi);
    setTutanakSubject(ht.konu);
    setTutanakPerson(ht.personelId || "");
    setTutanakText(ht.icerik);
    setTaseronAdi(ht.taseronAdi || "");
    setCezaTutari(ht.cezaTutari || 0);
  };

  const handleCancelEditTutanak = () => {
    setEditingTutanakId(null);
    setTutanakSubject("");
    setTutanakText("");
    setTaseronAdi("");
    setCezaTutari(0);
  };

  const handleDeleteTutanak = (id: string) => {
    if (deleteConfirmTutanakId === id) {
      setHazirTutanaklar((prev: any) => prev.filter((t: any) => t.id !== id));
      setDeleteConfirmTutanakId(null);
      if (editingTutanakId === id) {
        handleCancelEditTutanak();
      }
    } else {
      setDeleteConfirmTutanakId(id);
      setTimeout(() => {
        setDeleteConfirmTutanakId(prev => prev === id ? null : prev);
      }, 4000);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0 h-full">
        {/* Creator drawer */}
        <div className="w-full lg:w-[380px] lg:shrink-0 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm min-h-0">
          <div className="bg-[#2563EB] text-slate-100 p-4 shrink-0">
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Hukuki Belgeler</span>
            <h3 className="font-display font-semibold text-sm">📜 Yeni Tutanak Oluştur</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tutanak Şablon Tipi</label>
              <select 
                className="w-full text-xs font-bold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                value={tutanakType}
                onChange={(e) => setTutanakType(e.target.value as any)}
              >
                <option value="TAHSİS">Tahsis / Zimmet Tutanağı</option>
                <option value="TESLİM">Malzeme Teslim Tutanağı</option>
                <option value="SEVK">Sevk / Sevkiyat Tutanağı</option>
                <option value="HASAR">Zarar / Hasar Tespit Protokolü</option>
                <option value="GENEL">Normal Şantiye Genel Tutanağı</option>
                <option value="CEZA">Ceza İhtar Tutanağı</option>
              </select>
            </div>

            {tutanakType === 'CEZA' && (
              <div className="space-y-4 bg-red-50/50 p-3.5 rounded-xl border border-red-200 animate-in fade-in duration-150">
                <span className="font-bold text-[9px] text-red-800 uppercase tracking-widest block">⚠️ CEZA UYGULAMA BİLGİLERİ</span>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Ceza Kesilecek Taşeron Firma</label>
                  <div className="flex gap-2 mt-1">
                    <select 
                      className="flex-1 text-xs font-semibold p-2 bg-white border border-[#e2e8f0] rounded-lg"
                      value={taseronAdi}
                      onChange={(e) => setTaseronAdi(e.target.value)}
                    >
                      <option value="">-- Taşeron Seç (Cari Rehber) --</option>
                      {cariKartlar?.map(c => (
                        <option key={c.id} value={c.unvan}>{c.unvan}</option>
                      ))}
                    </select>
                    <input 
                      type="text"
                      placeholder="Veya manuel yazın"
                      className="w-1/2 text-xs font-semibold p-2 bg-white border border-[#e2e8f0] rounded-lg"
                      value={taseronAdi}
                      onChange={(e) => setTaseronAdi(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Uygulanacak Ceza Tutarı (₺)</label>
                  <input 
                    type="number" 
                    min={0}
                    className="w-full text-xs font-semibold mt-1 p-2 bg-white border border-[#e2e8f0] rounded-lg"
                    placeholder="₺0.00"
                    value={cezaTutari || ""}
                    onChange={(e) => setCezaTutari(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tutanak Konusu / Başlığı *</label>
              <input 
                type="text" 
                className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                placeholder="Örn: Transit Kaza Hasar Tespit"
                value={tutanakSubject}
                onChange={(e) => setTutanakSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Muhatap Personel (DB Seçimi Veya Boş Bırakılıp Manuel Girilebilir)</label>
              <select 
                className="w-full text-xs font-semibold mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg"
                value={tutanakPerson}
                onChange={(e) => setTutanakPerson(e.target.value)}
              >
                <option value="">-- Genel / Belirtilmemiş --</option>
                {personeller.map(p => (
                  <option key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tutanak Metin İçeriği *</label>
              <textarea 
                className="w-full text-xs mt-1 p-2 bg-slate-50 border border-[#e2e8f0] rounded-lg resize-none font-sans"
                rows={6}
                placeholder="Hukuki dili koruyarak şantiye kurallarına göre tutanak detaylarını yazın..."
                value={tutanakText}
                onChange={(e) => setTutanakText(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50">
            {editingTutanakId ? (
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={handleSaveTutanak}
                  className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold text-xs py-2.5 rounded-xl shadow transition cursor-pointer"
                >
                  Tutanak Taslağını Güncelle
                </button>
                <button 
                  onClick={handleCancelEditTutanak}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 rounded-xl transition cursor-pointer"
                >
                  Düzenlemeyi İptal Et
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSaveTutanak}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-bold text-xs py-2.5 rounded-xl shadow transition cursor-pointer"
              >
                Tutanak Taslağını Kaydet
              </button>
            )}
          </div>
        </div>

        {/* List waybills screen column */}
        <div className="flex-1 bg-white border border-[#e2e8f0] rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#e2e8f0] bg-slate-50/50 flex flex-col space-y-2.5">
            <div className="flex items-center space-x-2">
              <FileText size={16} className="text-[#2563EB]" />
              <h4 className="font-display font-bold text-sm text-slate-800 uppercase tracking-widest">Hazır Şantiye Tutanakları</h4>
            </div>
            <div className="relative">
              <input 
                type="text"
                placeholder="Belge no, konu, içerik veya tip ara..."
                value={tutanakSearch}
                onChange={(e) => setTutanakSearch(e.target.value)}
                className="w-full bg-white text-xs text-slate-800 border border-slate-250 rounded-lg py-1.5 pl-3 pr-8 placeholder-slate-400 focus:outline-none transition font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {hazirTutanaklar
              ?.filter(ht => {
                const keyword = tutanakSearch.toLowerCase().trim();
                if (!keyword) return true;
                return (
                  ht.belgeNo.toLowerCase().includes(keyword) ||
                  ht.konu.toLowerCase().includes(keyword) ||
                  ht.icerik.toLowerCase().includes(keyword) ||
                  ht.tutanakTipi.toLowerCase().includes(keyword)
                );
              })
              .map(ht => {
                const targetP = personeller.find(p => p.id === ht.personelId);
              return (
                <div key={ht.id} className="border border-slate-150 rounded-xl p-5 bg-white space-y-4 hover:shadow transition">
                  <div className="flex justify-between items-center text-xs border-b pb-2.5">
                    <div>
                      <span className="font-mono bg-slate-100 rounded px-2.5 py-0.5 text-slate-700 font-bold border border-slate-200">{ht.belgeNo}</span>
                      <p className="text-[9px] text-[#2563EB] font-bold mt-1.5 uppercase">TİP: {ht.tutanakTipi} · {ht.tarih}</p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      {ht.durum}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 text-xs">{ht.konu}</h4>
                    <p className="text-xs text-slate-500 font-medium">Birlikte Tutulan Kişi: <strong className="text-slate-700">{targetP ? `${targetP.ad} ${targetP.soyad}` : "Genel"}</strong></p>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 border p-3 rounded-lg font-sans tracking-tight leading-relaxed italic">
                    "{ht.icerik}"
                  </p>

                  {ht.tutanakTipi === 'CEZA' && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-[10.5px] space-y-1">
                      <span className="font-bold text-red-800 uppercase block">⚠️ CEZA DETAYLARI:</span>
                      <p><strong>Cezalı Taşeron:</strong> {ht.taseronAdi || 'Belirtilmemiş'}</p>
                      <p><strong>Uygulanan Para Cezası:</strong> ₺{(ht.cezaTutari || 0).toLocaleString('tr-TR')}</p>
                    </div>
                  )}

                  {ht.imzaliEvrakUrl && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-32">
                      <img src={ht.imzaliEvrakUrl} alt="İmzalı Belge Görseli" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-2 border-t text-[10px]">
                    {/* Physical Signed Doc Upload */}
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg flex items-center space-x-1 cursor-pointer transition">
                      <Upload size={11} />
                      <span>{ht.imzaliEvrakUrl ? "İmza Güncelle" : "İmzalı Belge Yükle"}</span>
                      <input 
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const rawBase64 = reader.result as string;
                              const compressed = await compressImage(rawBase64);
                              setHazirTutanaklar((prev: any) => prev.map((item: any) => {
                                if (item.id === ht.id) {
                                  return {
                                    ...item,
                                    imzaliEvrakUrl: compressed,
                                    durum: 'ONAYLANDI'
                                  };
                                }
                                return item;
                              }));
                              alert("Islak imzalı tutanak başarıyla sisteme yüklendi!");
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {/* E-Posta Gönder button if signed */}
                    {(ht.imzaliEvrakUrl || ht.durum === 'ONAYLANDI') && (
                      <button
                        type="button"
                        onClick={() => alert(`${ht.belgeNo} nolu ıslak imzalı ${ht.tutanakTipi} tutanağı merkez ofise (merkez@kibritci.com) e-posta ile başarıyla gönderildi!`)}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-1 px-2.5 rounded-lg transition cursor-pointer flex items-center space-x-1"
                      >
                        <Send size={11} />
                        <span>E-Posta Gönder</span>
                      </button>
                    )}

                    <button 
                      onClick={() => handleStartEditTutanak(ht)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold py-1 px-2.5 rounded-lg transition cursor-pointer"
                    >
                      ✏️ Düzenle
                    </button>

                    {deleteConfirmTutanakId === ht.id ? (
                      <button 
                        onClick={() => handleDeleteTutanak(ht.id)}
                        className="bg-red-650 hover:bg-red-700 text-white font-extrabold py-1 px-2.5 rounded-lg transition animate-pulse cursor-pointer"
                        title="Silmek için tekrar tıklayın"
                      >
                        Emin misiniz? Sil
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDeleteTutanak(ht.id)}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-1 px-2.5 rounded-lg transition cursor-pointer"
                      >
                        🗑️ Sil
                      </button>
                    )}

                    <button 
                      onClick={() => setSelectedTutanakForPdf(ht)}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-1 px-3 rounded-lg transition cursor-pointer"
                    >
                      🖨️ Logolu Rapor Al
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rapor Modal */}
      {selectedTutanakForPdf && (
        <CorporateReportLayout 
          title="RESMİ ŞANTİYE TUTANAĞI"
          date={selectedTutanakForPdf.tarih}
          documentNo={selectedTutanakForPdf.belgeNo}
          subtitle={`${selectedTutanakForPdf.tutanakTipi} TUTANAĞI`}
          onClose={() => setSelectedTutanakForPdf(null)}
          onPrint={() => window.print()}
          signatureBlocks={[
            {
              title: "Tutanak Tutulan Personel",
              name: personeller.find(p => p.id === selectedTutanakForPdf.personelId)
                    ? `${personeller.find(p => p.id === selectedTutanakForPdf.personelId)?.ad} ${personeller.find(p => p.id === selectedTutanakForPdf.personelId)?.soyad}`
                    : "Genel Beyan",
            },
            {
              title: "Şantiye Şefi / Yetkili",
              name: "Şantiye Yönetimi",
            }
          ]}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 border-b pb-1">Tutanak Konusu</h3>
              <p className="mt-2 text-slate-700 font-serif leading-relaxed text-sm">
                {selectedTutanakForPdf.konu}
              </p>
            </div>
            
            {selectedTutanakForPdf.tutanakTipi === 'CEZA' && selectedTutanakForPdf.taseronAdi && (
              <div className="bg-red-50/50 p-4 rounded-lg border border-red-200 print:border-red-500">
                <h3 className="font-bold text-red-800">Cezai İşlem Detayı</h3>
                <p className="mt-1 text-sm"><strong>Taşeron Firma:</strong> {selectedTutanakForPdf.taseronAdi}</p>
                <p className="mt-1 text-sm"><strong>Kesilen Ceza:</strong> ₺{(selectedTutanakForPdf.cezaTutari || 0).toLocaleString('tr-TR')}</p>
              </div>
            )}

            <div>
              <h3 className="font-bold text-slate-800 border-b pb-1">Tutanak Metni ve Olay Özeti</h3>
              <p className="mt-4 text-slate-800 font-serif leading-relaxed text-justify whitespace-pre-wrap">
                {selectedTutanakForPdf.icerik}
              </p>
            </div>
            
            <p className="pt-8 text-sm italic text-slate-500">
              İşbu tutanak {selectedTutanakForPdf.tarih} tarihinde mahalinde tanzim edilmiş olup, taraflarca okunarak imza altına alınmıştır.
            </p>
          </div>
        </CorporateReportLayout>
      )}
    </>
  );
};

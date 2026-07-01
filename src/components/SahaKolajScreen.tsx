import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Calendar, FileUp, Grid3X3, Images, Loader2, Pencil, Printer,
  Trash2, X, Check, Layers, Eye,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, removeDocument, saveDocument } from '../lib/firebase';
import { compressImage } from '../lib/imageCompress';
import { SahaKolajFoto } from '../types/erp';
import {
  AY_ADLARI,
  albumBaslik,
  albumKeyFrom,
  buildMagazinePages,
  groupKolajFotolari,
  readFileAsDataUrl,
} from '../lib/sahaKolajUtils';

interface SahaKolajScreenProps {
  currentUser?: { email?: string };
}

export const SahaKolajScreen: React.FC<SahaKolajScreenProps> = ({ currentUser }) => {
  const now = new Date();
  const [yil, setYil] = useState(now.getFullYear());
  const [ay, setAy] = useState(now.getMonth() + 1);
  const albumKey = albumKeyFrom(yil, ay);

  const [fotolar, setFotolar] = useState<SahaKolajFoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editId, setEditId] = useState<string | null>(null);
  const [editBaslik, setEditBaslik] = useState('');
  const [editAciklama, setEditAciklama] = useState('');
  const [editGrup, setEditGrup] = useState('');
  const [bulkGrup, setBulkGrup] = useState('');

  const [viewMode, setViewMode] = useState<'grid' | 'dergi' | 'kolaj'>('grid');
  const [showPreview, setShowPreview] = useState(false);
  const [filterGrup, setFilterGrup] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sahaKolajFotolari'), where('albumKey', '==', albumKey));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: SahaKolajFoto[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as SahaKolajFoto));
        list.sort((a, b) => a.sira - b.sira);
        setFotolar(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [albumKey]);

  useEffect(() => {
    setSelectedIds(new Set());
    setEditId(null);
    setFilterGrup('');
  }, [albumKey]);

  const gruplar = useMemo(() => {
    const set = new Set<string>();
    fotolar.forEach((f) => {
      const g = (f.grupAdi || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [fotolar]);

  const filteredFotolar = useMemo(() => {
    if (!filterGrup) return fotolar;
    return fotolar.filter((f) => (f.grupAdi || '').trim() === filterGrup);
  }, [fotolar, filterGrup]);

  const magazinePages = useMemo(
    () => buildMagazinePages(fotolar, yil, ay),
    [fotolar, yil, ay]
  );

  const kolajGruplar = useMemo(() => groupKolajFotolari(fotolar), [fotolar]);

  const openEdit = (f: SahaKolajFoto) => {
    setEditId(f.id);
    setEditBaslik(f.baslik || '');
    setEditAciklama(f.aciklama || '');
    setEditGrup(f.grupAdi || '');
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    const f = fotolar.find((x) => x.id === editId);
    if (!f) return;
    const updated: SahaKolajFoto = {
      ...f,
      baslik: editBaslik.trim() || undefined,
      aciklama: editAciklama.trim() || undefined,
      grupAdi: editGrup.trim() || undefined,
    };
    await saveDocument('sahaKolajFotolari', updated);
    setEditId(null);
  };

  const handleBulkGrup = async () => {
    if (!bulkGrup.trim() || selectedIds.size === 0) return;
    const grup = bulkGrup.trim();
    await Promise.all(
      fotolar
        .filter((f) => selectedIds.has(f.id))
        .map((f) => saveDocument('sahaKolajFotolari', { ...f, grupAdi: grup }))
    );
    setBulkGrup('');
    setSelectedIds(new Set());
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Lütfen yalnızca görsel dosyası seçin (JPG, PNG, WEBP).');
      return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: imageFiles.length });
    let sira = fotolar.length;

    try {
      for (const file of imageFiles) {
        const raw = await readFileAsDataUrl(file);
        const compressed = await compressImage(raw, 1024, 1024, 0.72);
        const id = `skf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const foto: SahaKolajFoto = {
          id,
          albumKey,
          yil,
          ay,
          imageUrl: compressed,
          sira: sira++,
          dosyaAdi: file.name,
          yuklemeTarihi: new Date().toISOString(),
          yukleyen: currentUser?.email,
        };
        await saveDocument('sahaKolajFotolari', foto);
        setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    } catch (err) {
      console.error(err);
      alert('Yükleme sırasında hata oluştu. Bağlantınızı kontrol edin.');
    } finally {
      setUploading(false);
      setUploadProgress({ done: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu fotoğraf silinsin mi?')) return;
    await removeDocument('sahaKolajFotolari', id);
    if (editId === id) setEditId(null);
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size} fotoğraf silinsin mi?`)) return;
    await Promise.all([...selectedIds].map((id) => removeDocument('sahaKolajFotolari', id)));
    setSelectedIds(new Set());
  };

  const handleDeleteAlbum = async () => {
    if (fotolar.length === 0) return;
    if (
      !window.confirm(
        `${albumBaslik(yil, ay)} albümündeki ${fotolar.length} fotoğrafın tamamı kalıcı silinecek. Devam?`
      )
    ) {
      return;
    }
    await Promise.all(fotolar.map((f) => removeDocument('sahaKolajFotolari', f.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const yilSecenekleri = [2025, 2026, 2027];

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #saha-kolaj-print, #saha-kolaj-print * { visibility: visible; }
          #saha-kolaj-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .magazine-page { page-break-after: always; break-after: page; }
        }
        .magazine-page {
          min-height: 100vh;
          box-sizing: border-box;
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl">
            <Images className="text-amber-700" size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Saha Faaliyeti Kolaj Hazırla</h2>
            <p className="text-[11px] text-slate-500">
              Ay bazlı toplu fotoğraf yükle → başlık/grupla → dergi veya kolaj olarak yönetime sun
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowPreview(true); setViewMode('dergi'); }}
            disabled={fotolar.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
          >
            <BookOpen size={14} />
            Dergi Önizle
          </button>
          <button
            type="button"
            onClick={() => { setShowPreview(true); setViewMode('kolaj'); }}
            disabled={fotolar.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
          >
            <Grid3X3 size={14} />
            Kolaj Önizle
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={fotolar.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
          >
            <Printer size={14} />
            PDF / Yazdır
          </button>
        </div>
      </div>

      <div className="no-print flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* Sol: Ay seç & yükle */}
        <div className="w-[300px] shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="bg-amber-600 text-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Albüm Seçimi</span>
            <h3 className="font-bold text-sm flex items-center gap-2 mt-1">
              <Calendar size={16} />
              {albumBaslik(yil, ay)}
            </h3>
          </div>

          <div className="p-4 space-y-4 text-xs flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Yıl</label>
                <select
                  value={yil}
                  onChange={(e) => setYil(Number(e.target.value))}
                  className="w-full mt-1 p-2 border rounded-lg font-bold"
                >
                  {yilSecenekleri.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Ay</label>
                <select
                  value={ay}
                  onChange={(e) => setAy(Number(e.target.value))}
                  className="w-full mt-1 p-2 border rounded-lg font-bold"
                >
                  {AY_ADLARI.map((ad, i) => (
                    <option key={ad} value={i + 1}>{ad}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-2 border-dashed border-amber-200 rounded-xl p-4 bg-amber-50/50 text-center space-y-2">
              <FileUp className="mx-auto text-amber-600" size={28} />
              <p className="font-bold text-slate-700">Toplu Fotoğraf Yükle</p>
              <p className="text-[10px] text-slate-500">100+ fotoğraf seçebilirsiniz. Sıkıştırılarak kaydedilir.</p>
              <label className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                <span>{uploading ? 'Yükleniyor…' : 'Dosya Seç'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
                />
              </label>
              {uploading && uploadProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all"
                      style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-amber-800 font-bold">
                    {uploadProgress.done} / {uploadProgress.total}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 rounded-xl p-3 space-y-1 border">
              <div className="flex justify-between">
                <span className="text-slate-500">Fotoğraf</span>
                <strong>{fotolar.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Grup</span>
                <strong>{gruplar.length || '—'}</strong>
              </div>
            </div>

            {gruplar.length > 0 && (
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase">Gruba Göre Filtre</label>
                <select
                  value={filterGrup}
                  onChange={(e) => setFilterGrup(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                >
                  <option value="">Tümü</option>
                  {gruplar.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedIds.size > 0 && (
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2">
                <span className="font-bold text-blue-800">{selectedIds.size} seçili</span>
                <input
                  type="text"
                  placeholder="Grup adı (ör: A Blok Beton)"
                  value={bulkGrup}
                  onChange={(e) => setBulkGrup(e.target.value)}
                  className="w-full p-2 border rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleBulkGrup}
                  className="w-full bg-blue-600 text-white font-bold py-1.5 rounded-lg"
                >
                  Seçililere Grup Ata
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="w-full bg-rose-100 text-rose-700 font-bold py-1.5 rounded-lg"
                >
                  Seçilileri Sil
                </button>
              </div>
            )}

            {fotolar.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAlbum}
                className="w-full text-rose-600 border border-rose-200 hover:bg-rose-50 font-bold py-2 rounded-lg text-[10px]"
              >
                Bu Ayın Albümünü Tamamen Sil
              </button>
            )}
          </div>
        </div>

        {/* Orta: Foto grid */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm min-w-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} />
              Fotoğraf Havuzu
            </span>
            {loading && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!loading && filteredFotolar.length === 0 && (
              <div className="text-center py-20 text-slate-400 space-y-2">
                <Images size={40} className="mx-auto opacity-30" />
                <p className="font-bold text-sm">Bu ay için henüz fotoğraf yok</p>
                <p className="text-xs">Sol panelden ay seçip toplu yükleme yapın</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredFotolar.map((f) => {
                const selected = selectedIds.has(f.id);
                const editing = editId === f.id;
                return (
                  <div
                    key={f.id}
                    className={`relative group rounded-xl overflow-hidden border-2 transition ${
                      selected ? 'border-blue-500 ring-2 ring-blue-200' : editing ? 'border-amber-500' : 'border-slate-100'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSelect(f.id)}
                      className={`absolute top-1 left-1 z-10 w-5 h-5 rounded border flex items-center justify-center ${
                        selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/90 border-slate-300'
                      }`}
                    >
                      {selected && <Check size={12} />}
                    </button>
                    <img
                      src={f.imageUrl}
                      alt={f.baslik || f.dosyaAdi || 'saha'}
                      className="w-full aspect-square object-cover cursor-pointer"
                      onClick={() => openEdit(f)}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition">
                      <p className="text-[9px] text-white font-bold truncate">{f.baslik || f.dosyaAdi || 'Başlıksız'}</p>
                      {f.grupAdi && (
                        <p className="text-[8px] text-amber-200 truncate">{f.grupAdi}</p>
                      )}
                    </div>
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        className="p-1 bg-white/90 rounded text-slate-700"
                        title="Düzenle"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        className="p-1 bg-white/90 rounded text-rose-600"
                        title="Sil"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sağ: Metadata edit */}
        <div className="w-[280px] shrink-0 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Foto Bilgisi</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Dergide görünecek başlık ve açıklama</p>
          </div>
          {editId ? (
            <div className="p-4 space-y-3 text-xs flex-1 overflow-y-auto">
              {(() => {
                const f = fotolar.find((x) => x.id === editId);
                if (!f) return null;
                return (
                  <>
                    <img src={f.imageUrl} alt="" className="w-full rounded-lg border" />
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Başlık</label>
                      <input
                        value={editBaslik}
                        onChange={(e) => setEditBaslik(e.target.value)}
                        placeholder="Örn: C30 Perde Betonu"
                        className="w-full mt-1 p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Grup / Bölüm</label>
                      <input
                        value={editGrup}
                        onChange={(e) => setEditGrup(e.target.value)}
                        placeholder="Örn: A Blok İmalat"
                        list="kolaj-grup-list"
                        className="w-full mt-1 p-2 border rounded-lg"
                      />
                      <datalist id="kolaj-grup-list">
                        {gruplar.map((g) => (
                          <option key={g} value={g} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Açıklama</label>
                      <textarea
                        value={editAciklama}
                        onChange={(e) => setEditAciklama(e.target.value)}
                        rows={4}
                        placeholder="Dergi sayfasında görünecek kısa tanım…"
                        className="w-full mt-1 p-2 border rounded-lg resize-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl"
                    >
                      Kaydet
                    </button>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400 text-xs">
              Düzenlemek için bir fotoğrafa tıklayın. Grup adı vererek dergide bölüm oluşturabilirsiniz.
            </div>
          )}
        </div>
      </div>

      {/* Print / hidden magazine layout */}
      <div id="saha-kolaj-print" ref={printRef} className="hidden print:block">
        {magazinePages.map((page, idx) => (
          <div key={idx} className="magazine-page bg-white p-8 flex flex-col">
            {page.type === 'cover' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center border-4 border-amber-600">
                <p className="text-sm uppercase tracking-[0.3em] text-amber-700 mb-4">Kibritçi Şantiye</p>
                <h1 className="text-4xl font-black text-slate-900 mb-2">{page.title}</h1>
                <p className="text-lg text-slate-600">{page.subtitle}</p>
                <p className="mt-8 text-xs text-slate-400">{fotolar.length} saha fotoğrafı</p>
              </div>
            )}
            {page.type === 'toc' && (
              <div>
                <h2 className="text-2xl font-black text-slate-900 border-b-4 border-amber-500 pb-2 mb-6">{page.title}</h2>
                <ul className="space-y-3">
                  {(page.groups || []).map((g, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-slate-100 pb-2">
                      <span className="font-bold">{g.ad}</span>
                      <span className="text-slate-500">{g.count} foto</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {page.type === 'section' && (
              <div className="flex-1 flex flex-col justify-center">
                <p className="text-xs uppercase tracking-widest text-amber-600 mb-2">Bölüm</p>
                <h2 className="text-3xl font-black text-slate-900">{page.title}</h2>
                {page.subtitle && <p className="text-slate-500 mt-2">{page.subtitle}</p>}
              </div>
            )}
            {page.type === 'spread' && (
              <div className="flex-1">
                {page.title && page.title !== 'Genel Saha Faaliyetleri' && (
                  <p className="text-[10px] uppercase text-amber-700 font-bold mb-3">{page.title}</p>
                )}
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {(page.photos || []).map((f) => (
                    <div key={f.id} className="flex flex-col gap-1">
                      <img src={f.imageUrl} alt="" className="w-full aspect-[4/3] object-cover rounded border" />
                      {f.baslik && <p className="text-[10px] font-bold text-slate-800">{f.baslik}</p>}
                      {f.aciklama && <p className="text-[9px] text-slate-600 line-clamp-2">{f.aciklama}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {page.type === 'collage' && (
              <div>
                <h2 className="text-xl font-black mb-4">{page.title}</h2>
                <div className="grid grid-cols-6 gap-1">
                  {(page.photos || []).map((f) => (
                    <img key={f.id} src={f.imageUrl} alt="" className="w-full aspect-square object-cover rounded-sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/80 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <Eye size={18} />
              <span className="font-bold text-sm">
                {viewMode === 'dergi' ? 'Dergi Önizleme' : 'Kolaj Önizleme'} — {albumBaslik(yil, ay)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('dergi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'dergi' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700'}`}
              >
                Dergi
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kolaj')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${viewMode === 'kolaj' ? 'bg-violet-500 text-white' : 'bg-slate-700'}`}
              >
                Kolaj
              </button>
              <button type="button" onClick={handlePrint} className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1">
                <Printer size={14} /> Yazdır
              </button>
              <button type="button" onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
            {viewMode === 'dergi' ? (
              <div className="max-w-3xl mx-auto space-y-6">
                {magazinePages.map((page, idx) => (
                  <div key={idx} className="bg-white shadow-xl rounded-lg overflow-hidden min-h-[480px] p-8">
                    {page.type === 'cover' && (
                      <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center border-4 border-amber-500">
                        <p className="text-xs uppercase tracking-[0.25em] text-amber-600">Kibritçi Şantiye</p>
                        <h1 className="text-3xl font-black mt-4">{page.title}</h1>
                        <p className="text-slate-500 mt-2">{page.subtitle}</p>
                      </div>
                    )}
                    {page.type === 'toc' && (
                      <div>
                        <h2 className="text-xl font-black border-b-2 border-amber-500 pb-2 mb-4">{page.title}</h2>
                        <ul className="space-y-2">
                          {(page.groups || []).map((g, i) => (
                            <li key={i} className="flex justify-between text-sm py-1 border-b">
                              <span className="font-semibold">{g.ad}</span>
                              <span className="text-slate-400">{g.count} foto</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {page.type === 'section' && (
                      <div className="min-h-[300px] flex flex-col justify-center">
                        <p className="text-[10px] uppercase text-amber-600">Bölüm</p>
                        <h2 className="text-2xl font-black">{page.title}</h2>
                        <p className="text-slate-500 text-sm">{page.subtitle}</p>
                      </div>
                    )}
                    {page.type === 'spread' && (
                      <div className="grid grid-cols-2 gap-4">
                        {(page.photos || []).map((f) => (
                          <div key={f.id}>
                            <img src={f.imageUrl} alt="" className="w-full aspect-[4/3] object-cover rounded-lg" />
                            {f.baslik && <p className="text-xs font-bold mt-1">{f.baslik}</p>}
                            {f.aciklama && <p className="text-[10px] text-slate-500">{f.aciklama}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {page.type === 'collage' && (
                      <div>
                        <h2 className="text-lg font-black mb-3">{page.title}</h2>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
                          {(page.photos || []).map((f) => (
                            <img key={f.id} src={f.imageUrl} alt="" className="w-full aspect-square object-cover rounded" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-6xl mx-auto space-y-8">
                {kolajGruplar.map((g) => (
                  <div key={g.ad} className="bg-white rounded-xl p-4 shadow-lg">
                    <h3 className="font-black text-slate-800 mb-3 border-l-4 border-violet-500 pl-3">{g.ad}</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
                      {g.fotolar.map((f) => (
                        <div key={f.id} className="relative group">
                          <img src={f.imageUrl} alt="" className="w-full aspect-square object-cover rounded" />
                          {f.baslik && (
                            <p className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white p-0.5 truncate opacity-0 group-hover:opacity-100">
                              {f.baslik}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

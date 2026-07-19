import React, { useMemo, useState } from 'react';
import { Images, Search, ZoomIn, FileText } from 'lucide-react';
import { openBase64InNewTab } from '../lib/fileViewerUtils';
import { EmptyState } from './EmptyState';

export type EvrakDuvariItem = {
  id: string;
  src: string;
  title: string;
  meta?: string;
  kategori?: string;
  tarih?: string;
};

type Props = {
  items: EvrakDuvariItem[];
};

function isImageSrc(src: string) {
  const s = (src || '').toLowerCase();
  return (
    s.startsWith('data:image/') ||
    s.includes('.jpg') ||
    s.includes('.jpeg') ||
    s.includes('.png') ||
    s.includes('.webp') ||
    s.includes('image/')
  );
}

/** Güvenlik kapı fotoğrafları — salt okunur galeri */
export const EvrakDuvariPanel: React.FC<Props> = ({ items }) => {
  const [q, setQ] = useState('');
  const [kategori, setKategori] = useState('HEPSI');

  const kategoriler = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.kategori) set.add(i.kategori);
    });
    return ['HEPSI', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLocaleLowerCase('tr-TR');
    return items.filter((i) => {
      if (kategori !== 'HEPSI' && i.kategori !== kategori) return false;
      if (!kw) return true;
      const blob = `${i.title} ${i.meta || ''} ${i.kategori || ''} ${i.tarih || ''}`.toLocaleLowerCase(
        'tr-TR'
      );
      return blob.includes(kw);
    });
  }, [items, q, kategori]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E3F2EE] text-[#0F6C5C] flex items-center justify-center shrink-0">
            <Images size={18} />
          </div>
          <div>
            <h2
              className="text-xl font-extrabold tracking-tight text-slate-900 leading-none"
              style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
            >
              Evrak Duvarı
            </h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Kapıdan yüklenen fotoğraf ve belgeler · {filtered.length} / {items.length}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Plaka, firma, irsaliye…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium"
            />
          </div>
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
          >
            {kategoriler.map((k) => (
              <option key={k} value={k}>
                {k === 'HEPSI' ? 'Tüm kategoriler' : k}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Görüntülenecek evrak yok"
          description="Kapıdan fotoğraflı evrak veya mıcır irsaliyesi yüklenince burada listelenir."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const img = isImageSrc(item.src);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openBase64InNewTab(item.src, item.title)}
                className="group text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-[#0F6C5C]/45 hover:shadow-md transition cursor-pointer"
              >
                <div className="relative h-36 bg-slate-100 flex items-center justify-center overflow-hidden">
                  {img ? (
                    <img
                      src={item.src}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <FileText size={28} />
                      <span className="text-[10px] font-bold">Belge</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition bg-white/95 border border-slate-200 text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                    <ZoomIn size={11} /> Aç
                  </span>
                </div>
                <div className="p-2.5 space-y-0.5">
                  {item.kategori && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#0F6C5C]">
                      {item.kategori}
                    </span>
                  )}
                  <p className="text-[11px] font-bold text-slate-800 truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{item.meta || item.tarih || '—'}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EvrakDuvariPanel;

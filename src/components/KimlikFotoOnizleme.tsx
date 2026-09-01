import React from 'react';
import { Camera, FileText, ImageIcon } from 'lucide-react';
import { isPdfKimlikSrc } from '../lib/personelKimlikFotoStorage';

interface KimlikFotoOnizlemeProps {
  urls: string[];
  onRemove: (index: number) => void;
  onPick: (files: File[]) => void;
  max?: number;
  uploading?: boolean;
  accept?: string;
}

export const KimlikFotoOnizleme: React.FC<KimlikFotoOnizlemeProps> = ({
  urls,
  onRemove,
  onPick,
  max = 2,
  uploading = false,
  accept = 'image/*',
}) => {
  const canAdd = urls.length < max && !uploading;
  const labels = ['Ön yüz', 'Arka yüz'];

  return (
    <div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        Kimlik fotoğrafı — önizleme ({urls.length}/{max})
      </span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {canAdd && (
          <label className="w-28 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-500 cursor-pointer hover:border-emerald-500">
            <Camera size={18} />
            <span className="text-[8px] font-bold mt-1">{urls.length === 0 ? 'Ön yüz yükle' : 'Arka yüz yükle'}</span>
            <input
              type="file"
              accept={accept}
              {...(accept.includes('pdf') ? {} : { capture: 'environment' as const })}
              className="hidden"
              onChange={(e) => {
                const files = e.target.files ? (Array.from(e.target.files) as File[]) : [];
                if (files.length) onPick(files);
                e.target.value = '';
              }}
            />
          </label>
        )}
        {urls.map((src, idx) => (
          <div
            key={`${idx}-${src.slice(0, 24)}`}
            className="relative w-28 h-24 rounded-2xl overflow-hidden border border-emerald-200 bg-slate-100 shadow-sm"
          >
            {isPdfKimlikSrc(src) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1 px-2">
                <FileText size={18} />
                <span className="text-[9px] font-bold text-center">{labels[idx] || 'Kimlik'} PDF</span>
              </div>
            ) : (
              <img src={src} alt={labels[idx] || 'Kimlik'} className="w-full h-full object-cover" />
            )}
            <span className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[8px] font-bold text-center py-0.5">
              {labels[idx] || `Görsel ${idx + 1}`} önizleme
            </span>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-[10px] font-bold"
            >
              ×
            </button>
          </div>
        ))}
        {urls.length === 0 && (
          <div className="flex-1 min-w-[120px] h-24 rounded-2xl bg-white/70 border border-slate-200 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <ImageIcon size={16} className="mx-auto mb-1" />
              <span className="text-[10px]">{uploading ? 'Yükleniyor…' : 'Kimlik önizlemesi yok'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

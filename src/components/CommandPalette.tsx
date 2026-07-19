import React, { useState, useEffect, useRef } from 'react';
import {
  Search, ChevronRight, LayoutDashboard, Users, CreditCard, Tent, Truck,
  Settings, Camera, ShieldCheck, FileText, Package, Wallet, ClipboardList, MessageSquare
} from 'lucide-react';
import { EmptyState } from './EmptyState';

interface CommandPaletteProps {
  onSelect: (route: string) => void;
}

const ROUTES = [
  { key: 'ana_sayfa', label: 'Ana Sayfa', icon: LayoutDashboard },
  { key: 'onay_islemleri', label: 'Onay Havuzu & İmzalar', icon: ShieldCheck },
  { key: 'guvenlik_ekrani', label: 'Güvenlik & Kapı Kontrol', icon: ShieldCheck },
  { key: 'personel', label: 'Personel Yönetimi', icon: Users },
  { key: 'yoklama', label: 'Yoklama & Puantaj', icon: ClipboardList },
  { key: 'faaliyet_personel', label: 'Faaliyeti Olan Personeller', icon: Camera },
  { key: 'maas', label: 'Maaş Hesaplama', icon: CreditCard },
  { key: 'personel_izin', label: 'Personel İzin Formu', icon: FileText },
  { key: 'satin_alma', label: 'Satın Alma', icon: Package },
  { key: 'irsaliye_giris', label: 'İrsaliye Girişi', icon: FileText },
  { key: 'fatura_giris', label: 'Fatura Girişi', icon: FileText },
  { key: 'cari_stok', label: 'Cari ve Stok Kartları', icon: Wallet },
  { key: 'kasa', label: 'Kasa', icon: Wallet },
  { key: 'kamp', label: 'Kamp Yönetimi', icon: Tent },
  { key: 'kampci_ekrani', label: 'Kampçı Ekranı', icon: Tent },
  { key: 'arac', label: 'Araç ve Demirbaş', icon: Truck },
  { key: 'lojistik_ekrani', label: 'Lojistik', icon: Truck },
  { key: 'depocu_ekrani', label: 'Depocu', icon: Package },
  { key: 'formen_ekrani', label: 'Formen Ekranı', icon: Users },
  { key: 'imalat_terminali', label: 'İmalat Terminali', icon: Settings },
  { key: 'sohbet', label: 'Sohbet', icon: MessageSquare },
  { key: 'eposta', label: 'E-Posta', icon: MessageSquare },
  { key: 'admin', label: 'Admin Paneli', icon: Settings },
  { key: 'yetki_verme', label: 'Yetki Verme', icon: Settings },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    const openFromEvent = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('kibritci-open-command-palette', openFromEvent as EventListener);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('kibritci-open-command-palette', openFromEvent as EventListener);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setActiveIndex(0);
    }
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const filtered = ROUTES.filter((r) =>
    r.label.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (key: string) => {
    onSelect(key);
    setIsOpen(false);
    setQuery('');
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      handleSelect(filtered[activeIndex].key);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/35 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4">
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Hızlı menü"
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-slate-50/80">
          <Search size={18} className="text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium text-sm"
            placeholder="Modül ara… (ör. onay, güvenlik, personel)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sonuç bulunamadı"
              description="Farklı bir kelime deneyin veya Ctrl+K ile menüyü kapatın."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            filtered.map((route, i) => {
              const Icon = route.icon;
              const active = i === activeIndex;
              return (
                <button
                  key={route.key}
                  type="button"
                  onClick={() => handleSelect(route.key)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition cursor-pointer group text-left ${
                    active ? 'bg-[#E3F2EE]' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        active
                          ? 'bg-white border-[#B9DBD2] text-[#0F6C5C]'
                          : 'bg-slate-100 border-transparent text-slate-500'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <span className="font-medium text-[13px]">{route.label}</span>
                  </div>
                  <ChevronRight
                    size={15}
                    className={active ? 'text-[#0F6C5C]' : 'text-slate-300'}
                  />
                </button>
              );
            })
          )}
        </div>
      </div>
      <div className="absolute inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
    </div>
  );
};

export default CommandPalette;

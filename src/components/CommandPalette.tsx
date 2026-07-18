import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronRight, LayoutDashboard, Users, CreditCard, Tent, Truck, Settings, Camera } from 'lucide-react';

interface CommandPaletteProps {
  onSelect: (route: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const routes = [
    { key: 'ana_sayfa', label: 'Dashboard Ana Sayfa', icon: <LayoutDashboard size={16} /> },
    { key: 'personel', label: 'Personel Yönetimi', icon: <Users size={16} /> },
    { key: 'yoklama', label: 'Yoklama & Puantaj', icon: <Users size={16} /> },
    { key: 'faaliyet_personel', label: 'Faaliyeti Olan Personeller', icon: <Camera size={16} /> },
    { key: 'maas', label: 'Maaş Hesaplama', icon: <CreditCard size={16} /> },
    { key: 'satin_alma', label: 'Satın Alma', icon: <CreditCard size={16} /> },
    { key: 'kamp', label: 'Kamp Yönetimi', icon: <Tent size={16} /> },
    { key: 'arac', label: 'Araç ve Demirbaş', icon: <Truck size={16} /> },
    { key: 'admin', label: 'Admin Paneli', icon: <Settings size={16} /> }
  ];

  const filtered = routes.filter(r => r.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelect = (key: string) => {
    onSelect(key);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-md flex items-start justify-center pt-[15vh] p-4 animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.4)] border border-slate-200/60 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <Search size={20} className="text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 font-medium"
            placeholder="Nereye gitmek istersiniz? (Arama yapın...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1.5 ml-3">
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-white border border-slate-200 shadow-sm text-[10px] font-bold text-slate-400">ESC</kbd>
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">Sonuç bulunamadı.</div>
          ) : (
            filtered.map((route, i) => (
              <button
                key={route.key}
                onClick={() => handleSelect(route.key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3 text-slate-700 group-hover:text-slate-900">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 transition-all">
                    {route.icon}
                  </div>
                  <span className="font-medium text-[13px]">{route.label}</span>
                </div>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-800 transition-transform group-hover:translate-x-1" />
              </button>
            ))
          )}
        </div>
      </div>
      
      {/* Invisible backdrop click area */}
      <div className="absolute inset-0 z-[-1]" onClick={() => setIsOpen(false)}></div>
    </div>
  );
};

import React, { useMemo } from 'react';
import {
  ShieldCheck, ShoppingCart, Users, Bell, ChevronRight, CalendarDays
} from 'lucide-react';
import { Personel, SatinAlmaTalebi } from '../types/erp';
import { todayDateKey } from '../lib/dateKeyUtils';

type Props = {
  personeller: Personel[];
  satinAlmaTalepleri: SatinAlmaTalebi[];
  bildirimler?: any[];
  onNavigate: (tab: string) => void;
};

/** Ana sayfa — bugünün kısa özeti (mevcut panellere ek, onları değiştirmez). */
export const DashboardTodaySummary: React.FC<Props> = ({
  personeller,
  satinAlmaTalepleri,
  bildirimler = [],
  onNavigate,
}) => {
  const today = todayDateKey();
  const todayLabel = useMemo(() => {
    try {
      return new Date(`${today}T12:00:00`).toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return today;
    }
  }, [today]);

  const activePersonel = useMemo(
    () => personeller.filter((p) => p.durum === true || String(p.durum) === 'true').length,
    [personeller]
  );

  const pendingSatinAlma = useMemo(
    () =>
      (satinAlmaTalepleri || []).filter(
        (sa) =>
          sa.onayDurumu === 'ONAY BEKLİYOR' ||
          sa.onayDurumu === 'BEKLİYOR' ||
          String(sa.onayDurumu || '').includes('BEKLİYOR')
      ).length,
    [satinAlmaTalepleri]
  );

  const unreadNotifs = useMemo(
    () => (bildirimler || []).filter((n) => !n.okundu).length,
    [bildirimler]
  );

  const chips = [
    {
      key: 'onay',
      label: 'Onay bekleyen',
      value: pendingSatinAlma,
      icon: ShoppingCart,
      tab: 'onay_islemleri',
      tone: pendingSatinAlma > 0 ? 'amber' : 'muted',
    },
    {
      key: 'personel',
      label: 'Aktif personel',
      value: activePersonel,
      icon: Users,
      tab: 'personel',
      tone: 'teal',
    },
    {
      key: 'bildirim',
      label: 'Okunmamış bildirim',
      value: unreadNotifs,
      icon: Bell,
      tab: 'ana_sayfa',
      tone: unreadNotifs > 0 ? 'rose' : 'muted',
    },
  ] as const;

  const toneClass = (tone: string) => {
    if (tone === 'amber') return 'bg-amber-50 border-amber-200 text-amber-900';
    if (tone === 'rose') return 'bg-rose-50 border-rose-200 text-rose-900';
    if (tone === 'teal') return 'bg-[#E3F2EE] border-[#B9DBD2] text-[#0F3D3E]';
    return 'bg-slate-50 border-slate-200 text-slate-700';
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#E3F2EE] text-[#0F6C5C] flex items-center justify-center shrink-0">
            <CalendarDays size={18} />
          </div>
          <div className="min-w-0">
            <h3
              className="text-lg font-extrabold tracking-tight text-slate-900 leading-none"
              style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
            >
              Bugün
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 capitalize">{todayLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('onay_islemleri')}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F6C5C] hover:underline cursor-pointer self-start sm:self-auto"
        >
          <ShieldCheck size={13} />
          Onay Havuzuna git
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onNavigate(chip.tab)}
              className={`text-left rounded-xl border px-3.5 py-3 transition hover:-translate-y-0.5 cursor-pointer ${toneClass(chip.tone)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {chip.label}
                </span>
                <Icon size={14} className="opacity-70" />
              </div>
              <div
                className="text-2xl font-extrabold tabular-nums mt-1 leading-none"
                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
              >
                {chip.value}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 mt-3">
        İpucu: <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono">Ctrl</kbd>
        {' + '}
        <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono">K</kbd>
        {' '}ile hızlı menüyü açabilirsiniz.
      </p>
    </section>
  );
};

export default DashboardTodaySummary;

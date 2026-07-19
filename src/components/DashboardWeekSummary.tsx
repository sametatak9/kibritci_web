import React, { useMemo } from 'react';
import { TrendingUp, ShoppingCart, Wallet, Users, ChevronRight } from 'lucide-react';
import { Personel, SatinAlmaTalebi, KasaHareketi, AylikYoklamaMap } from '../types/erp';
import { todayDateKey } from '../lib/dateKeyUtils';

type Props = {
  personeller: Personel[];
  satinAlmaTalepleri: SatinAlmaTalebi[];
  kasaHareketleri: KasaHareketi[];
  yoklamalar: AylikYoklamaMap;
  onNavigate: (tab: string) => void;
};

function dateKeysLast7Days(endKey: string): Set<string> {
  const set = new Set<string>();
  const end = new Date(`${endKey}T12:00:00`);
  for (let i = 0; i < 7; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    set.add(`${y}-${m}-${day}`);
  }
  return set;
}

function normalizeDocDate(raw?: string | null): string {
  if (!raw) return '';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd.MM.yyyy
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  try {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch {
    /* ignore */
  }
  return '';
}

/** Ana sayfa — son 7 gün özeti (mevcut props ile, panelleri bozmaz). */
export const DashboardWeekSummary: React.FC<Props> = ({
  personeller,
  satinAlmaTalepleri,
  kasaHareketleri,
  yoklamalar,
  onNavigate,
}) => {
  const today = todayDateKey();
  const weekKeys = useMemo(() => dateKeysLast7Days(today), [today]);

  const stats = useMemo(() => {
    const saWeek = (satinAlmaTalepleri || []).filter((sa) =>
      weekKeys.has(normalizeDocDate(sa.tarih))
    );
    const saPending = saWeek.filter(
      (sa) =>
        sa.onayDurumu === 'ONAY BEKLİYOR' ||
        sa.onayDurumu === 'BEKLİYOR' ||
        String(sa.onayDurumu || '').includes('BEKLİYOR')
    ).length;

    let kasaGiris = 0;
    let kasaCikis = 0;
    (kasaHareketleri || []).forEach((k) => {
      if (!weekKeys.has(normalizeDocDate(k.tarih))) return;
      const tutar = Number(k.tutar) || 0;
      if (k.hareketTipi === 'GİRİŞ') kasaGiris += tutar;
      else kasaCikis += tutar;
    });

    let geldi = 0;
    let yok = 0;
    Object.keys(yoklamalar || {}).forEach((pId) => {
      const map = yoklamalar[pId] || {};
      Object.entries(map).forEach(([dayKey, day]: [string, any]) => {
        // dayKey may be "1".."31" under month maps — skip if not ISO
        const iso =
          normalizeDocDate(day?.tarih) ||
          (dayKey.length >= 8 ? normalizeDocDate(dayKey) : '');
        if (iso && !weekKeys.has(iso)) return;
        // Monthly map: only count if we can resolve date; otherwise count all Geldi in current month lightly
        if (!iso) {
          // fallback: current month day numbers within last 7 calendar days
          const n = Number(dayKey);
          if (!Number.isFinite(n)) return;
          const now = new Date(`${today}T12:00:00`);
          const candidate = new Date(now.getFullYear(), now.getMonth(), n);
          const key = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
          if (!weekKeys.has(key)) return;
        }
        if (day?.durum === 'Geldi') geldi++;
        if (day?.durum === 'Yok') yok++;
      });
    });

    const activePersonel = personeller.filter(
      (p) => p.durum === true || String(p.durum) === 'true'
    ).length;

    return {
      saWeek: saWeek.length,
      saPending,
      kasaNet: kasaGiris - kasaCikis,
      geldi,
      yok,
      activePersonel,
    };
  }, [satinAlmaTalepleri, kasaHareketleri, yoklamalar, personeller, weekKeys, today]);

  const cards = [
    {
      label: 'Satın alma (7g)',
      value: String(stats.saWeek),
      hint: stats.saPending > 0 ? `${stats.saPending} onayda` : 'Bekleyen yok',
      icon: ShoppingCart,
      tab: 'satin_alma',
    },
    {
      label: 'Kasa net (7g)',
      value: `${Math.round(stats.kasaNet).toLocaleString('tr-TR')} ₺`,
      hint: 'Giriş − çıkış',
      icon: Wallet,
      tab: 'kasa',
    },
    {
      label: 'Yoklama geldi',
      value: String(stats.geldi),
      hint: stats.yok > 0 ? `${stats.yok} yok` : 'Yok kaydı yok',
      icon: Users,
      tab: 'yoklama',
    },
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <TrendingUp size={17} />
          </div>
          <div>
            <h3
              className="text-lg font-extrabold tracking-tight text-slate-900 leading-none"
              style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
            >
              Bu hafta
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Son 7 günün kısa özeti</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('onay_islemleri')}
          className="text-[11px] font-bold text-[#0F6C5C] inline-flex items-center gap-1 hover:underline cursor-pointer"
        >
          Onaylara bak <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onNavigate(c.tab)}
              className="text-left rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-[#B9DBD2] px-3.5 py-3 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {c.label}
                </span>
                <Icon size={14} className="text-slate-400" />
              </div>
              <div
                className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums leading-none"
                style={{ fontFamily: '"Barlow Condensed", sans-serif' }}
              >
                {c.value}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">{c.hint}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default DashboardWeekSummary;

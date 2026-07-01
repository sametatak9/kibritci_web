import React, { useMemo, useState } from 'react';
import { Link2, Edit3, Search } from 'lucide-react';
import { EvrakBaglantiGrubu, Fatura, Irsaliye, SatinAlmaTalebi } from '../types/erp';
import { deriveBaglantiGruplariFromEntities, irsaliyeIsLinked } from '../lib/evrakBaglamaUtils';
import { faturaIsLinked } from '../lib/documentLinkUtils';

interface BagliEvraklarListesiProps {
  mode: 'fatura' | 'irsaliye';
  accent: 'blue' | 'emerald';
  faturalar: Fatura[];
  irsaliyeler: Irsaliye[];
  satinAlmaTalepleri: SatinAlmaTalebi[];
  evrakBaglantiGruplari: EvrakBaglantiGrubu[];
  onEditBinding?: (grup: EvrakBaglantiGrubu) => void;
}

export const BagliEvraklarListesi: React.FC<BagliEvraklarListesiProps> = ({
  mode,
  accent,
  faturalar,
  irsaliyeler,
  satinAlmaTalepleri,
  evrakBaglantiGruplari,
  onEditBinding,
}) => {
  const [search, setSearch] = useState('');
  const accentBadge = accent === 'emerald' ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50';

  const gruplar = useMemo(
    () =>
      deriveBaglantiGruplariFromEntities(
        faturalar,
        irsaliyeler,
        satinAlmaTalepleri,
        evrakBaglantiGruplari
      ).filter((g) => {
        if (mode === 'fatura') return Boolean(g.faturaId);
        return g.irsaliyeIds.length > 0 && (!g.faturaId || mode === 'irsaliye');
      }),
    [faturalar, irsaliyeler, satinAlmaTalepleri, evrakBaglantiGruplari, mode]
  );

  const filtered = gruplar.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const ft = g.faturaId ? faturalar.find((f) => f.id === g.faturaId) : null;
    return (
      g.saId?.toLowerCase().includes(q) ||
      g.cariUnvan?.toLowerCase().includes(q) ||
      ft?.faturaNo.toLowerCase().includes(q) ||
      g.irsaliyeIds.some((id) => {
        const ir = irsaliyeler.find((x) => x.id === id);
        return ir?.irsaliyeNo.toLowerCase().includes(q);
      })
    );
  });

  const bagimsizCount =
    mode === 'fatura'
      ? faturalar.filter((f) => !faturaIsLinked(f)).length
      : irsaliyeler.filter((ir) => !irsaliyeIsLinked(ir)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Bağlı Evraklar
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {filtered.length} bağlı grup · {bagimsizCount} bağımsız evrak
          </p>
        </div>
        <input
          type="search"
          placeholder="PO, fatura, irsaliye, firma ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border rounded-xl px-3 py-2 w-full sm:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl">
          Henüz bağlı evrak yok. &quot;Bağlama&quot; sekmesinden 2 aşamalı bağlama yapın.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => {
            const ft = g.faturaId ? faturalar.find((f) => f.id === g.faturaId) : undefined;
            const irs = irsaliyeler.filter((ir) => g.irsaliyeIds.includes(ir.id));
            const sa = g.saId ? satinAlmaTalepleri.find((s) => s.saId === g.saId) : undefined;

            return (
              <div
                key={g.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {g.saId && (
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${accentBadge}`}>
                      SA: {g.saId}
                    </span>
                  )}
                  {irs.map((ir) => (
                    <span
                      key={ir.id}
                      className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-1 rounded-lg"
                    >
                      İRS {ir.irsaliyeNo}
                    </span>
                  ))}
                  {ft && (
                    <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 px-2 py-1 rounded-lg">
                      FAT {ft.faturaNo}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 ml-auto">{g.olusturmaTarihi}</span>
                </div>

                <p className="text-xs font-semibold text-slate-800">
                  {g.cariUnvan || ft?.cariUnvan || irs[0]?.cariUnvan || sa?.talepEden}
                </p>

                {g.kalemBaglantilari.length > 0 && (
                  <div className="text-[10px] text-slate-600 bg-slate-50 rounded-xl p-3 space-y-1">
                    <p className="font-bold uppercase text-slate-500 mb-1">Kalem bağlantıları</p>
                    {g.kalemBaglantilari.slice(0, 5).map((k) => (
                      <p key={k.id}>
                        • {k.urunAdi}
                        {k.saMiktar != null && ` · SA:${k.saMiktar}`}
                        {k.irsaliyeMiktar != null && ` · İRS:${k.irsaliyeMiktar}`}
                        {k.faturaMiktar != null && ` · FAT:${k.faturaMiktar}`}
                        {k.birim && ` ${k.birim}`}
                      </p>
                    ))}
                    {g.kalemBaglantilari.length > 5 && (
                      <p className="text-slate-400">+{g.kalemBaglantilari.length - 5} kalem daha</p>
                    )}
                  </div>
                )}

                {onEditBinding && (
                  <button
                    type="button"
                    onClick={() => onEditBinding(g)}
                    className="text-[10px] font-bold flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Bağlamayı düzenle
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

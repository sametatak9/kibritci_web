import React from 'react';
import { X, Package, Truck, CreditCard, AlertTriangle } from 'lucide-react';
import { Fatura, Irsaliye, SatinAlmaTalebi } from '../types/erp';

export type EvrakDetayKind = 'sa' | 'irsaliye' | 'fatura';

export interface EvrakDetayPayload {
  kind: EvrakDetayKind;
  sa?: SatinAlmaTalebi;
  irsaliye?: Irsaliye;
  fatura?: Fatura;
}

interface EvrakDetayModalProps {
  open: boolean;
  payload: EvrakDetayPayload | null;
  onClose: () => void;
}

export const EvrakDetayModal: React.FC<EvrakDetayModalProps> = ({ open, payload, onClose }) => {
  if (!open || !payload) return null;

  const { kind, sa, irsaliye, fatura } = payload;

  const Icon =
    kind === 'sa' ? Package : kind === 'irsaliye' ? Truck : CreditCard;

  const title =
    kind === 'sa'
      ? `Satın Alma · ${sa?.saId}`
      : kind === 'irsaliye'
        ? `İrsaliye · ${irsaliye?.irsaliyeNo}`
        : `Fatura · ${fatura?.faturaNo}`;

  const onayBadge = (() => {
    if (kind === 'sa' && sa) {
      const ok = sa.onayDurumu === 'ONAYLANDI';
      return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {ok ? '✓ ONAYLANDI' : sa.onayDurumu}
          {(sa as { imzaliEvrakUyumsuz?: boolean }).imzaliEvrakUyumsuz && ' ⚠️'}
        </span>
      );
    }
    if (kind === 'irsaliye' && irsaliye) {
      const ok = irsaliye.onayDurumu === '1. ONAY TAMAMLANDI';
      return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {ok ? '✓ ONAYLANDI' : irsaliye.onayDurumu}
          {(irsaliye as { imzaliEvrakUyumsuz?: boolean }).imzaliEvrakUyumsuz && ' ⚠️'}
        </span>
      );
    }
    if (kind === 'fatura' && fatura) {
      const ok = fatura.durum === 'ONAYLANDI';
      return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {ok ? '✓ ONAYLANDI' : fatura.durum}
          {(fatura as { imzaliEvrakUyumsuz?: boolean }).imzaliEvrakUyumsuz && ' ⚠️'}
        </span>
      );
    }
    return null;
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-600" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2 items-center">{onayBadge}</div>

          {kind === 'sa' && sa && (
            <>
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-slate-500">Talep eden</dt>
                <dd className="font-semibold">{sa.talepEden}</dd>
                <dt className="text-slate-500">Firma</dt>
                <dd>{sa.cariFirma}</dd>
                <dt className="text-slate-500">Tarih</dt>
                <dd>{sa.tarih}</dd>
              </dl>
              <KalemTable
                rows={sa.kalemler.map((k) => ({
                  urun: k.urunAdi,
                  miktar: k.miktar,
                  birim: k.birim,
                }))}
              />
            </>
          )}

          {kind === 'irsaliye' && irsaliye && (
            <>
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-slate-500">Firma</dt>
                <dd className="font-semibold">{irsaliye.firma}</dd>
                <dt className="text-slate-500">Tarih</dt>
                <dd>{irsaliye.tarih}</dd>
                <dt className="text-slate-500">PO</dt>
                <dd>{irsaliye.saId || '—'}</dd>
                <dt className="text-slate-500">Fatura</dt>
                <dd>{irsaliye.faturaNo || '—'}</dd>
              </dl>
              <KalemTable
                rows={irsaliye.kalemler.map((k) => ({
                  urun: k.urunAdi,
                  miktar: k.miktar,
                  birim: k.birim,
                }))}
              />
              {irsaliye.fisEvrakUrl && (
                <img src={irsaliye.fisEvrakUrl} alt="Evrak" className="max-h-40 rounded-lg border" />
              )}
            </>
          )}

          {kind === 'fatura' && fatura && (
            <>
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-slate-500">Cari</dt>
                <dd className="font-semibold">{fatura.cariUnvan}</dd>
                <dt className="text-slate-500">Tarih</dt>
                <dd>{fatura.tarih}</dd>
                <dt className="text-slate-500">Toplam</dt>
                <dd>{fatura.genelToplam.toLocaleString('tr-TR')} TL</dd>
                <dt className="text-slate-500">PO</dt>
                <dd>{fatura.saId || '—'}</dd>
              </dl>
              <KalemTable
                rows={fatura.kalemler.map((k) => ({
                  urun: k.urunAdi,
                  miktar: k.miktar,
                  birim: k.birim,
                  extra: `${k.birimFiyat} TL`,
                }))}
              />
            </>
          )}

          {(payload.sa?.imzaliEvrakUrl ||
            payload.irsaliye?.imzaliEvrakUrl ||
            payload.fatura?.imzaliEvrakUrl) && (
            <div className="border-t pt-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">İmzalı evrak</p>
              <img
                src={
                  payload.sa?.imzaliEvrakUrl ||
                  payload.irsaliye?.imzaliEvrakUrl ||
                  payload.fatura?.imzaliEvrakUrl
                }
                alt="İmzalı"
                className="max-h-36 rounded-lg border"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function KalemTable({
  rows,
}: {
  rows: { urun: string; miktar: number; birim: string; extra?: string }[];
}) {
  if (!rows.length) {
    return <p className="text-slate-400 italic">Kalem yok</p>;
  }
  return (
    <table className="w-full text-[10px] border rounded-xl overflow-hidden">
      <thead>
        <tr className="bg-slate-100 text-slate-600">
          <th className="p-2 text-left">Ürün</th>
          <th className="p-2 text-right">Miktar</th>
          <th className="p-2">Birim</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-slate-100">
            <td className="p-2 font-medium">{r.urun}</td>
            <td className="p-2 text-right">{r.miktar}</td>
            <td className="p-2 text-center">
              {r.birim}
              {r.extra && <span className="text-slate-400 ml-1">· {r.extra}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Havuz kartı için mini özet satırı */
export function EvrakMiniOzet({
  label,
  no,
  sub,
  uyumsuz,
}: {
  label: string;
  no: string;
  sub?: string;
  uyumsuz?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className="font-black text-slate-400 w-8">{label}</span>
      <div>
        <span className="font-bold text-slate-800">{no}</span>
        {uyumsuz && (
          <AlertTriangle className="inline w-3 h-3 text-amber-500 ml-1" aria-label="İmza uyumsuz" />
        )}
        {sub && <p className="text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

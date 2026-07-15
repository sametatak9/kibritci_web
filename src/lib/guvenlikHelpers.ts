import { Personel } from '../types/erp';
import { isDayActiveForPersonel, isTaseronPersonel } from './yoklamaUtils';
import { isFounderEmail } from './roleClaims';
import { buildWhatsAppUrl } from './mobilOnayUtils';

/** Ana firma (Kibritçi) vs taşeron görsel ayrımı */
export function isAnaFirmaPersonel(p?: Personel): boolean {
  if (!p) return true;
  return !isTaseronPersonel(p);
}

export function firmaEtiketi(p: Personel): string {
  if (isTaseronPersonel(p)) {
    return (p.firmaAdi || 'Taşeron').trim() || 'Taşeron';
  }
  return (p.firmaAdi || 'Kibritçi İnşaat').trim() || 'Kibritçi İnşaat';
}

/** Akvizyon taşeron firması (isim eşleşmesi) */
export function isAkvizyonFirmaAdi(name?: string | null): boolean {
  const n = String(name || '')
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/\s+/g, ' ')
    .trim();
  return n.includes('AKVIZYON');
}

export function isAkvizyonPersonel(p?: Personel): boolean {
  if (!p) return false;
  if (!isTaseronPersonel(p)) return false;
  return isAkvizyonFirmaAdi(p.firmaAdi);
}

export const AKVIZYON_GOREV = 'GÜVENLİK';

/** Akvizyon güvenlik firması — görev her zaman GÜVENLİK olmalı */
export function resolveAkvizyonGorev(firmaAdi?: string | null, currentGorev?: string | null): string {
  if (isAkvizyonFirmaAdi(firmaAdi)) return AKVIZYON_GOREV;
  return String(currentGorev || '').trim() || 'DÜZ İŞÇİ';
}

export function displayPersonelGorev(p?: Personel): string {
  if (!p) return '—';
  return resolveAkvizyonGorev(p.firmaAdi, p.gorev);
}

/** YYYY-MM-DD için işe giriş / işten çıkış penceresi */
export function isPersonelActiveOnDate(p: Personel, dateStr: string): boolean {
  const parts = String(dateStr || '').split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return true;
  const [y, m, d] = parts;
  return isDayActiveForPersonel(p, y, m, d);
}

/** Güvenlik / Kurucu / Yönetici — Akvizyon yoklaması alabilir */
export function canTakeAkvizyonYoklama(yetki?: string | null, email?: string | null): boolean {
  const y = String(yetki || '')
    .trim()
    .toLocaleUpperCase('tr-TR');
  if (y === 'GÜVENLİK' || y === 'YÖNETİCİ') return true;
  if (isFounderEmail(email)) return true;
  return false;
}

/** Kapı ekranı erişimi: Güvenlik, Yönetici, Kurucu */
export function canAccessGuvenlikScreen(yetki?: string | null, email?: string | null): boolean {
  if (!yetki) return true;
  return canTakeAkvizyonYoklama(yetki, email);
}

export type AkvizyonYoklamaDurum = 'VAR' | 'YOK' | 'İZİN' | 'RAPOR';

export function formatZamanTr(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return String(iso);
  }
}

export function buildZiyaretciWhatsAppText(z: {
  adSoyad?: string;
  firma?: string;
  ziyaretSebebi?: string;
  ziyaretEdilen?: string;
  kartNo?: string;
  girisZamani?: string;
  cikisZamani?: string;
  durum?: string;
  tcNo?: string;
}): string {
  const lines = [
    '🎫 *KİBRİTÇİ İNŞAAT — Ziyaretçi Giriş Kaydı*',
    '',
    `Kart: ${z.kartNo || '—'}`,
    `Ad Soyad: ${z.adSoyad || '—'}`,
    `Firma: ${z.firma || '—'}`,
    `Görüşülen: ${z.ziyaretEdilen || '—'}`,
    `Neden: ${z.ziyaretSebebi || '—'}`,
    `Durum: ${z.durum || '—'}`,
    `Giriş: ${formatZamanTr(z.girisZamani)}`,
  ];
  if (z.cikisZamani) lines.push(`Çıkış: ${formatZamanTr(z.cikisZamani)}`);
  lines.push('', '_Şantiye Güvenlik Kapısı_');
  return lines.join('\n');
}

export function buildPersonelLoglariWhatsAppText(
  logs: Array<{
    ad?: string;
    soyad?: string;
    gorev?: string;
    tip?: string;
    zaman?: string;
    firmaAdi?: string;
    firmaTipi?: string;
  }>,
  tarih?: string
): string {
  const header = [
    '👥 *KİBRİTÇİ İNŞAAT — Personel Kapı Logları*',
    tarih ? `Tarih: ${tarih}` : '',
    `Seçili kayıt: ${logs.length}`,
    '',
  ].filter(Boolean);

  const body = logs.map((l, i) => {
    const firma =
      l.firmaTipi === 'TASERON'
        ? ` [Taşeron: ${l.firmaAdi || '—'}]`
        : l.firmaAdi
          ? ` [${l.firmaAdi}]`
          : '';
    return `${i + 1}. ${l.ad || ''} ${l.soyad || ''}${firma}\n   ${l.tip || '—'} · ${formatZamanTr(l.zaman)}\n   ${l.gorev || ''}`;
  });

  return [...header, ...body, '', '_Şantiye Güvenlik Kapısı_'].join('\n');
}

/** Kamp/kayıt hatası — otomatik personel oluşturmayı engelle */
export function isPlaceholderPersonelName(name?: string | null): boolean {
  const n = String(name || '').toLocaleUpperCase('tr-TR');
  return (
    n.includes('SOYADI?') ||
    n.includes('(SOYADI') ||
    n.includes('SOYAD?') ||
    /\(\?+\)/.test(n)
  );
}

export function personelNameKey(p?: { ad?: string; soyad?: string } | null): string {
  return `${p?.ad || ''} ${p?.soyad || ''}`.trim().toLocaleLowerCase('tr-TR');
}

export function buildSuTankeriLoglariWhatsAppText(
  logs: Array<{
    plaka?: string;
    firma?: string;
    surucuAdi?: string;
    miktar?: string;
    aciklama?: string;
    durum?: string;
    girisZamani?: string;
    cikisZamani?: string;
  }>,
  tarih?: string
): string {
  const header = [
    '💧 *KİBRİTÇİ İNŞAAT — Su Tankeri Giriş/Çıkış Logları*',
    tarih ? `Tarih: ${tarih}` : '',
    `Sefer sayısı: ${logs.length}`,
    '',
  ].filter(Boolean);

  const body = logs.map((l, i) => {
    const lines = [
      `${i + 1}. ${l.plaka || '—'} · ${l.firma || '—'}`,
      `   Sürücü: ${l.surucuAdi || '—'} · Miktar: ${l.miktar || '—'}`,
      `   Durum: ${l.durum || '—'}`,
      `   Giriş: ${formatZamanTr(l.girisZamani)}`,
    ];
    if (l.cikisZamani) lines.push(`   Çıkış: ${formatZamanTr(l.cikisZamani)}`);
    if (l.aciklama) lines.push(`   Not: ${l.aciklama}`);
    return lines.join('\n');
  });

  return [...header, ...body, '', '_Şantiye Güvenlik Kapısı_'].join('\n');
}

export function buildAracLoglariWhatsAppText(
  logs: Array<{
    plaka?: string;
    aracTipi?: string;
    firma?: string;
    surucuAdi?: string;
    yukDurumu?: string;
    aciklama?: string;
    durum?: string;
    girisZamani?: string;
    cikisZamani?: string;
  }>,
  tarih?: string
): string {
  const header = [
    '🚛 *KİBRİTÇİ İNŞAAT — Araç Giriş/Çıkış Logları*',
    tarih ? `Tarih: ${tarih}` : '',
    `Seçili kayıt: ${logs.length}`,
    '',
  ].filter(Boolean);

  const body = logs.map((l, i) => {
    const lines = [
      `${i + 1}. ${l.plaka || '—'} · ${l.aracTipi || ''}`,
      `   Firma: ${l.firma || '—'} · Durum: ${l.durum || '—'}`,
      `   Sürücü: ${l.surucuAdi || '—'} · Yük: ${l.yukDurumu || '—'}`,
      `   Giriş: ${formatZamanTr(l.girisZamani)}`,
    ];
    if (l.cikisZamani) lines.push(`   Çıkış: ${formatZamanTr(l.cikisZamani)}`);
    if (l.aciklama) lines.push(`   Not: ${l.aciklama}`);
    return lines.join('\n');
  });

  return [...header, ...body, '', '_Şantiye Güvenlik Kapısı_'].join('\n');
}

export function openWhatsAppText(text: string): void {
  window.open(buildWhatsAppUrl(text), '_blank');
}

export function buildAkvizyonYoklamaReportHtml(
  tarih: string,
  rows: Array<{ ad: string; soyad: string; gorev: string; durum: string }>
): string {
  const dateFormatted = new Date(tarih + 'T12:00:00').toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const varCount = rows.filter((r) => r.durum === 'VAR').length;
  const yokCount = rows.filter((r) => r.durum === 'YOK').length;
  const otherCount = rows.length - varCount - yokCount;

  const trs = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.ad} ${r.soyad}</strong></td>
        <td>${r.gorev || '—'}</td>
        <td style="font-weight:800;color:${r.durum === 'VAR' ? '#059669' : r.durum === 'YOK' ? '#e11d48' : '#64748b'}">${r.durum}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Akvizyon Yoklama — ${dateFormatted}</title>
  <style>
    body{font-family:system-ui,sans-serif;color:#1e293b;padding:32px;max-width:900px;margin:0 auto}
    h1{font-size:20px;margin:0} .meta{color:#64748b;font-size:13px;margin:8px 0 24px}
    .badge{display:inline-block;background:#f59e0b;color:#0f172a;font-weight:800;font-size:11px;padding:4px 10px;border-radius:999px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th{background:#f1f5f9;text-align:left;padding:8px;border-bottom:2px solid #cbd5e1;text-transform:uppercase;font-size:10px}
    td{padding:8px;border-bottom:1px solid #e2e8f0}
    .ozet{display:flex;gap:12px;margin-bottom:20px}
    .ozet div{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center}
    .ozet strong{display:block;font-size:22px}
  </style></head><body>
  <span class="badge">TAŞERON · AKVİZYON</span>
  <h1>Günlük Personel Yoklama Raporu</h1>
  <p class="meta">Kibritçi İnşaat Şantiyesi · ${dateFormatted} · Ana firma puantajından bağımsızdır</p>
  <div class="ozet">
    <div><strong>${rows.length}</strong>Toplam</div>
    <div><strong style="color:#059669">${varCount}</strong>Var</div>
    <div><strong style="color:#e11d48">${yokCount}</strong>Yok</div>
    <div><strong>${otherCount}</strong>Diğer</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Ad Soyad</th><th>Görev</th><th>Durum</th></tr></thead>
    <tbody>${trs || '<tr><td colspan="4">Kayıt yok</td></tr>'}</tbody>
  </table>
  <p class="meta" style="margin-top:28px">Bu rapor yalnızca Akvizyon taşeron firması günlük takip içindir. Kibritçi İnşaat yoklama/puantajına dahil edilmez.</p>
  </body></html>`;
}

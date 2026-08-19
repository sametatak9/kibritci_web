/**
 * Geçmiş listesi — Tümü (veya açık sekme) toplu HTML raporu.
 * Firebase yok; yalnızca HTML üretir. Fotoğraflar çağıran tarafça eklenir.
 */
import { wrapCorporateReportHtml } from './corporateReportHtml';
import { formatDateLabelTr } from './dateKeyUtils';

export type GecmisRaporLog = {
  id: string;
  type: string;
  title: string;
  desc: string;
  date: string;
  collection?: string;
  kalemler?: Array<{
    urunAdi: string;
    miktar?: number | string;
    birim?: string;
    birimFiyat?: number;
    toplam?: number;
  }>;
};

export type GecmisRaporFoto = {
  url: string;
  label: string;
  kind: 'image' | 'pdf';
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function typeCountsHtml(logs: GecmisRaporLog[]): string {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const t = String(log.type || 'KAYIT').trim() || 'KAYIT';
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const chips = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([type, n]) => `<span>${esc(type)} · ${n}</span>`)
    .join('');
  return chips ? `<div class="ir-type-counts">${chips}</div>` : '';
}

function renderFotoBlock(f: GecmisRaporFoto, idx: number): string {
  if (f.kind === 'pdf') {
    return `<div class="ir-foto-slot">
      <p class="ir-foto-label">${esc(f.label)} · PDF</p>
      <a class="ir-foto-pdf" href="${esc(f.url)}" target="_blank" rel="noopener">PDF evrakı yeni sekmede aç</a>
    </div>`;
  }
  return `<figure class="ir-foto-slot">
    <p class="ir-foto-label">${esc(f.label)}${idx > 0 ? ` · ${idx + 1}` : ''}</p>
    <button type="button" class="ir-foto-btn" data-foto-url="${esc(f.url)}" title="Büyütmek için tıklayın">
      <img src="${esc(f.url)}" alt="${esc(f.label)}" />
    </button>
  </figure>`;
}

function renderGecmisLogKart(log: GecmisRaporLog, sira: number, fotolar: GecmisRaporFoto[]): string {
  const kalemler = (log.kalemler || [])
    .map((x) => `${esc(x.urunAdi)} ${esc(x.miktar ?? '')} ${esc(x.birim || '')}`.trim())
    .filter(Boolean)
    .join(' · ');
  const fotoHtml = fotolar.length
    ? `<div class="ir-foto-grid">${fotolar.map((f, i) => renderFotoBlock(f, i)).join('')}</div>`
    : '';
  return `<article class="ir-foto-card">
    <header class="ir-foto-head">
      <div class="ir-foto-sira">${sira}</div>
      <div class="min-w-0">
        <span class="ir-type-badge">${esc(log.type || 'Kayıt')}</span>
        <h2>${esc(log.title || 'Kayıt')}</h2>
        <p>
          ${esc(formatDateLabelTr(log.date))}
          ${log.date && log.date !== 'İlk Kayıt' ? ` · ${esc(log.date)}` : ''}
        </p>
        ${log.desc ? `<p>${esc(log.desc)}</p>` : ''}
        ${kalemler ? `<p class="ir-foto-kalem">${kalemler}</p>` : ''}
      </div>
    </header>
    ${fotoHtml}
  </article>`;
}

function lightboxHtml(): string {
  return `
    <div id="ir-foto-lightbox" hidden>
      <button type="button" id="ir-foto-lightbox-close">Kapat</button>
      <img id="ir-foto-lightbox-img" alt="Büyük fotoğraf" />
    </div>
    <script>
      (function () {
        var box = document.getElementById('ir-foto-lightbox');
        var img = document.getElementById('ir-foto-lightbox-img');
        var closeBtn = document.getElementById('ir-foto-lightbox-close');
        function closeLb() { if (box) box.hidden = true; }
        document.addEventListener('click', function (e) {
          var btn = e.target && e.target.closest ? e.target.closest('.ir-foto-btn') : null;
          if (!btn || !box || !img) return;
          var url = btn.getAttribute('data-foto-url');
          if (!url) return;
          img.src = url;
          box.hidden = false;
        });
        if (closeBtn) closeBtn.addEventListener('click', closeLb);
        if (box) box.addEventListener('click', function (e) { if (e.target === box) closeLb(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });
      })();
    </script>
  `;
}

const GECMIS_TUMU_RAPOR_CSS = `
      .ir-foto-card{break-inside:avoid;page-break-inside:avoid;margin:0 0 18px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff}
      .ir-foto-head{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .ir-foto-sira{flex:none;width:28px;height:28px;border-radius:999px;background:#1e3a5f;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center}
      .ir-foto-head h2{margin:0;font-size:14px;font-weight:900;color:#0f172a}
      .ir-foto-head p{margin:3px 0 0;font-size:11px;color:#475569;line-height:1.45}
      .ir-foto-kalem{font-family:ui-monospace,monospace;font-size:10px!important;color:#334155}
      .ir-foto-grid{display:grid;grid-template-columns:1fr;gap:14px;padding:12px 14px}
      .ir-foto-label{margin:0 0 6px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#64748b}
      .ir-foto-btn{display:block;width:100%;padding:0;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;background:#0f172a;cursor:zoom-in}
      .ir-foto-btn img{display:block;width:100%;max-height:620px;object-fit:contain;background:#0f172a}
      .ir-foto-pdf{display:inline-block;padding:10px 12px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;font-weight:800;text-decoration:none}
      .ir-type-badge{display:inline-block;margin:0 0 4px;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:9px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
      .ir-type-counts{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
      .ir-type-counts span{display:inline-block;padding:3px 8px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:10px;font-weight:800;color:#334155}
      #ir-foto-lightbox[hidden]{display:none!important}
      #ir-foto-lightbox{position:fixed;inset:0;z-index:50;background:rgba(15,23,42,.92);display:flex;align-items:center;justify-content:center;padding:24px}
      #ir-foto-lightbox img{max-width:96vw;max-height:90vh;object-fit:contain;border-radius:12px;background:#111}
      #ir-foto-lightbox-close{position:absolute;top:16px;right:16px;border:0;background:#fff;color:#0f172a;font-weight:900;font-size:13px;border-radius:999px;padding:8px 14px;cursor:pointer}
      @media print{
        #ir-foto-lightbox{display:none!important}
        .ir-foto-card{page-break-after:always}
        .ir-foto-card:last-of-type{page-break-after:auto}
        .ir-foto-btn img{max-height:170mm}
      }
    `;

export function buildGecmisTumunuRaporHtml(input: {
  logs: GecmisRaporLog[];
  fotoByIrsaliyeId?: Map<string, GecmisRaporFoto[]>;
  cariUnvan?: string;
  filterLabel?: string;
}): string {
  const logs = input.logs || [];
  const fotoById = input.fotoByIrsaliyeId || new Map<string, GecmisRaporFoto[]>();
  const fotoToplam = [...fotoById.values()].reduce((n, list) => n + list.length, 0);
  const filterLabel = String(input.filterLabel || 'Tümü').trim() || 'Tümü';
  const title = `${filterLabel} — Toplu Rapor`;
  const bodyCards = logs
    .map((log, i) => {
      const fotolar = log.collection === 'irsaliyeler' ? fotoById.get(log.id) || [] : [];
      return renderGecmisLogKart(log, i + 1, fotolar);
    })
    .join('');
  const body = `
    <div class="mb-5">
      <h1 class="text-lg font-black tracking-tight text-slate-900 m-0">${esc(title)}</h1>
      <p class="text-xs text-slate-600 mt-1 mb-0">
        ${esc(input.cariUnvan || 'Cari')}
        · ${logs.length} kayıt
        ${fotoToplam ? ` · ${fotoToplam} görsel` : ''}
        · ${esc(new Date().toLocaleString('tr-TR'))}
      </p>
      ${typeCountsHtml(logs)}
      <p class="text-[11px] text-slate-500 mt-2 mb-0">Listedeki tüm kayıtlar. İrsaliye fotoğraflarına tıklayınca büyür. Yazdır / PDF için üstteki yazdırı kullanın.</p>
    </div>
    ${bodyCards}
    ${lightboxHtml()}
  `;
  return wrapCorporateReportHtml(body, {
    title,
    docCode: 'GECMIS-TUMU-RAPOR',
    orientation: 'portrait',
    autoPrint: false,
    extraCss: GECMIS_TUMU_RAPOR_CSS,
  });
}

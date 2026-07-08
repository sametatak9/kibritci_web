import { getAntetliUrl } from './reportAssets';

export const CORPORATE_COMPANY = {
  legalName: 'KİBRİTÇİ İNŞAAT TAAHHÜT TURİZM SANAYİ VE TİCARET LİMİTED ŞİRKETİ',
  address: 'Rüzgarlıbahçe Mah. Cumhuriyet Cad. Gülsan Plaza No: 22 /1 Kat: 3 Kavacık - Beykoz / İstanbul',
  phone: 'T: +90 212 213 77 61 - 66 - 68',
  email: 'info@kibritciinsaat.com.tr',
  website: 'kibritciinsaat.com.tr',
};

export function getCorporateReportCss(): string {
  const antetUrl = getAntetliUrl();
  return `
    .corporate-report{position:relative;display:flex;flex-direction:column;min-height:190mm;background:#fff;color:#1e293b;font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .corporate-report--landscape{min-height:277mm}
    .corporate-report-watermark{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .corporate-report-logo-clip{width:17rem;height:4.5rem;overflow:hidden;flex-shrink:0;position:relative;z-index:2;background:#fff}
    .corporate-report-logo-clip img{width:918px;max-width:none;height:auto;display:block}
    .corporate-report-watermark-clip{position:absolute;right:0;top:44%;transform:translateY(-50%);width:24rem;height:28rem;overflow:hidden;pointer-events:none}
    .corporate-report-watermark-clip img{width:918px;max-width:none;height:auto;display:block;margin-left:-27.5rem;margin-top:-17.5rem;opacity:.14}
    .corporate-report-header{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:.75rem;margin-bottom:1rem}
    .corporate-report-meta{text-align:right}
    .corporate-report-doc-code{display:block;font-size:.58rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border:1px solid #334155;padding:.2rem .55rem;background:#f8fafc;margin-bottom:.2rem}
    .corporate-report-date{display:block;font-size:.55rem;color:#64748b;font-family:JetBrains Mono,ui-monospace,monospace}
    .corporate-report-body{position:relative;z-index:1;flex:1}
    .corporate-report-footer{position:relative;z-index:1;margin-top:1.5rem;padding-top:.5rem}
    .corporate-report-footer-line{height:1px;background:linear-gradient(to right,transparent,#cbd5e1 15%,#cbd5e1 85%,transparent);margin-bottom:.55rem}
    .corporate-report-footer-grid{display:grid;grid-template-columns:1fr auto auto;gap:1.25rem;align-items:start;font-size:.52rem;line-height:1.45;color:#475569}
    .corporate-report-footer-legal{font-weight:800;font-size:.5rem;letter-spacing:.04em;color:#334155;text-transform:uppercase;margin:0 0 .15rem}
    .corporate-report-footer-address{font-size:.48rem;color:#64748b;margin:0}
    .corporate-report-footer-contact{border-left:1px solid #e2e8f0;padding-left:1rem;white-space:nowrap}
    .corporate-report-footer-web{text-align:right;font-weight:600;color:#334155;align-self:end}
    @media print{.corporate-report{min-height:auto;overflow:visible}.corporate-report-watermark-clip img{opacity:.11}}
  `;
}

export function wrapCorporateReportHtml(
  bodyContent: string,
  options?: {
    docCode?: string;
    orientation?: 'portrait' | 'landscape';
    title?: string;
    extraCss?: string;
    autoPrint?: boolean;
  }
): string {
  const antetUrl = getAntetliUrl();
  const printDate = new Date().toLocaleDateString('tr-TR');
  const docCode = options?.docCode ?? '';
  const orientation = options?.orientation ?? 'landscape';
  const title = options?.title ?? 'Kibritçi Rapor';
  const extraCss = options?.extraCss ?? '';
  const autoPrint = options?.autoPrint !== false;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${getCorporateReportCss()}${extraCss}</style>
</head>
<body class="bg-white text-slate-900 font-sans p-4 sm:p-8">
  <div class="corporate-report corporate-report--${orientation}" data-orientation="${orientation}">
    <div class="corporate-report-watermark" aria-hidden="true">
      <div class="corporate-report-watermark-clip">
        <img src="${antetUrl}" alt="" />
      </div>
    </div>
    <header class="corporate-report-header">
      <div class="corporate-report-logo-clip">
        <img src="${antetUrl}" alt="Kibritçi İnşaat" />
      </div>
      ${docCode ? `<div class="corporate-report-meta"><span class="corporate-report-doc-code">${docCode}</span><span class="corporate-report-date">Baskı: ${printDate}</span></div>` : ''}
    </header>
    <main class="corporate-report-body">${bodyContent}</main>
    <footer class="corporate-report-footer">
      <div class="corporate-report-footer-line"></div>
      <div class="corporate-report-footer-grid">
        <div>
          <p class="corporate-report-footer-legal">${CORPORATE_COMPANY.legalName}</p>
          <p class="corporate-report-footer-address">${CORPORATE_COMPANY.address}</p>
        </div>
        <div class="corporate-report-footer-contact">
          <p>${CORPORATE_COMPANY.phone}</p>
          <p>@: ${CORPORATE_COMPANY.email}</p>
        </div>
        <div class="corporate-report-footer-web"><p>${CORPORATE_COMPANY.website}</p></div>
      </div>
    </footer>
  </div>
  ${autoPrint ? '<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>' : ''}
</body>
</html>`;
}

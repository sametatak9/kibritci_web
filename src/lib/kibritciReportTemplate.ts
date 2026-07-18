/** Kibritçi logolu analiz / evrak raporu HTML şablonu */
import { kibritciLogoHtml, kibritciReportHeaderHtml } from './kibritciBrand';
import { getReportEmailToolbarHtml, installReportEmailGlobalBridge } from './reportEmail';

export function buildKibritciReportHtml(options: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  meta?: string[];
}): string {
  const metaRows = (options.meta || [])
    .map((m) => `<p style="margin:0;font-size:11px;color:#64748b">${m}</p>`)
    .join('');

  const emailToolbar = getReportEmailToolbarHtml({
    subject: options.subtitle ? `${options.title} — ${options.subtitle}` : options.title,
    fileName: `${String(options.title).replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ ]+/gi, '_').slice(0, 60) || 'Kibritci_Rapor'}.html`,
  });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <title>${options.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #fff; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .head { padding: 24px 28px; border-bottom: 1px solid #e2e8f0; background: transparent; }
    .meta { padding: 12px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .content { padding: 28px; font-size: 13px; line-height: 1.65; white-space: pre-wrap; }
    .foot { padding: 16px 28px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; text-align: center; }
    .kibritci-logo { background: transparent !important; }
  </style>
</head>
<body>
  ${emailToolbar}
  <div class="page">
    <div class="head">
      ${kibritciReportHeaderHtml(options.title, options.subtitle)}
    </div>
    ${metaRows ? `<div class="meta">${metaRows}</div>` : ''}
    <div class="content">${options.bodyHtml.replace(/\n/g, '<br/>')}</div>
    <div class="foot">Kibritçi ERP · Şantiye Finans Kontrol Sistemi · ${new Date().toLocaleDateString('tr-TR')}</div>
  </div>
</body>
</html>`;
}

export function openKibritciReportPrint(html: string, title: string): void {
  installReportEmailGlobalBridge();
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up engellendi. Tarayıcı izinlerini kontrol edin.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  // Kullanıcı araç çubuğundan yazdırabilir; otomatik print biraz gecikmeli
  setTimeout(() => {
    try {
      w.focus();
    } catch {
      /* ignore */
    }
  }, 200);
}

export function downloadKibritciReportHtml(html: string, fileName: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export { kibritciLogoHtml, kibritciReportHeaderHtml };

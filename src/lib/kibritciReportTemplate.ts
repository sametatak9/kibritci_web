/** Kibritçi logolu analiz / evrak raporu HTML şablonu */
export function buildKibritciReportHtml(options: {
  title: string;
  subtitle?: string;
  bodyHtml: string;
  meta?: string[];
}): string {
  const metaRows = (options.meta || [])
    .map((m) => `<p style="margin:0;font-size:11px;color:#64748b">${m}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <title>${options.title}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #f8fafc; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: #fff; padding: 24px 28px; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; }
    .logo span { color: #fbbf24; }
    .sub { font-size: 12px; opacity: 0.9; margin-top: 6px; }
    .meta { padding: 12px 28px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .content { padding: 28px; font-size: 13px; line-height: 1.65; white-space: pre-wrap; }
    .foot { padding: 16px 28px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; text-align: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="logo">KİBRİTÇİ <span>İNŞAAT</span></div>
      <div class="sub">${options.title}</div>
      ${options.subtitle ? `<div class="sub" style="margin-top:4px">${options.subtitle}</div>` : ''}
    </div>
    ${metaRows ? `<div class="meta">${metaRows}</div>` : ''}
    <div class="content">${options.bodyHtml.replace(/\n/g, '<br/>')}</div>
    <div class="foot">Kibritçi ERP · Şantiye Finans Kontrol Sistemi · ${new Date().toLocaleDateString('tr-TR')}</div>
  </div>
</body>
</html>`;
}

export function openKibritciReportPrint(html: string, title: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up engellendi. Tarayıcı izinlerini kontrol edin.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  setTimeout(() => w.print(), 400);
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

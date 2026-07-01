import {
  buildKibritciReportHtml,
  downloadKibritciReportHtml,
  openKibritciReportPrint,
} from './kibritciReportTemplate';

export type ReportExportFormat = 'html' | 'csv' | 'txt';

export interface HistoryLogRow {
  date: string;
  type: string;
  title: string;
  desc: string;
}

export function escapeCsvCell(value: string): string {
  const v = String(value ?? '').replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

export function downloadCsv(rows: string[][], fileName: string): void {
  const bom = '\uFEFF';
  const body = rows.map((r) => r.map(escapeCsvCell).join(';')).join('\r\n');
  const blob = new Blob([bom + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPlainText(lines: string[], fileName: string): void {
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildHistoryTableHtml(options: {
  title: string;
  subtitle?: string;
  meta?: string[];
  logs: HistoryLogRow[];
}): string {
  const rows = options.logs
    .map(
      (log) =>
        `<tr><td>${log.date}</td><td>${log.type}</td><td><strong>${log.title}</strong><br/><span style="color:#64748b;font-size:11px">${log.desc}</span></td></tr>`
    )
    .join('');
  const bodyHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px;text-align:left">Tarih</th><th style="padding:8px;text-align:left">Tip</th><th style="padding:8px;text-align:left">Detay</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  return buildKibritciReportHtml({
    title: options.title,
    subtitle: options.subtitle,
    meta: options.meta,
    bodyHtml,
  });
}

export function exportHistoryReport(options: {
  title: string;
  fileBase: string;
  meta: string[];
  logs: HistoryLogRow[];
  format: ReportExportFormat;
}): void {
  if (options.logs.length === 0) {
    alert('İndirilecek kayıt bulunmamaktadır.');
    return;
  }

  if (options.format === 'csv') {
    downloadCsv(
      [
        ['Tarih', 'Tip', 'Başlık', 'Açıklama'],
        ...options.logs.map((l) => [l.date, l.type, l.title, l.desc]),
      ],
      `${options.fileBase}.csv`
    );
    return;
  }

  if (options.format === 'html') {
    const html = buildHistoryTableHtml({
      title: options.title,
      meta: options.meta,
      logs: options.logs,
    });
    downloadKibritciReportHtml(html, `${options.fileBase}.html`);
    return;
  }

  downloadPlainText(
    [
      options.title,
      ...options.meta,
      '---------------------------------------------',
      ...options.logs.map(
        (l, i) => `[${i + 1}] ${l.date} | ${l.type}\n    ${l.title}\n    ${l.desc}`
      ),
    ],
    `${options.fileBase}.txt`
  );
}

export function exportPersonelRows(
  rows: Record<string, string>[],
  columns: { key: string; label: string }[],
  fileName: string,
  format: 'html' | 'csv'
): void {
  if (rows.length === 0) {
    alert('Dışa aktarılacak personel seçilmedi.');
    return;
  }

  if (format === 'csv') {
    downloadCsv(
      [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))],
      fileName
    );
    return;
  }

  const head = columns.map((c) => `<th>${c.label}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${String(r[c.key] ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`
    )
    .join('');
  const html = buildKibritciReportHtml({
    title: 'Personel Dışa Aktarım',
    bodyHtml: `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f1f5f9">${head}</tr></thead><tbody>${body}</tbody></table>`,
  });
  downloadKibritciReportHtml(html, fileName.endsWith('.html') ? fileName : `${fileName}.html`);
}

export { openKibritciReportPrint, downloadKibritciReportHtml };

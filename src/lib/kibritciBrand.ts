/** Kibritçi kurumsal logo — raporlarda şeffaf arka plan */
export const KIBRITCI_LOGO_PATH = '/kibritci-logo.png';

export function getKibritciLogoUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${KIBRITCI_LOGO_PATH}`;
  }
  return KIBRITCI_LOGO_PATH;
}

export function kibritciLogoHtml(heightPx = 56): string {
  const url = getKibritciLogoUrl();
  return `<img src="${url}" alt="Kibritçi İnşaat" class="kibritci-logo" style="height:${heightPx}px;width:auto;max-width:220px;object-fit:contain;background:transparent;border:none;display:block;" />`;
}

export function kibritciReportHeaderHtml(title: string, subtitle?: string): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:2px solid #1e4e78;padding-bottom:12px;margin-bottom:16px;background:transparent;">
      ${kibritciLogoHtml(52)}
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:800;color:#1e4e78;">${title}</div>
        ${subtitle ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">${subtitle}</div>` : ''}
      </div>
    </div>`;
}

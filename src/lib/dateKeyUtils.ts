/** Tarih alanlarını YYYY-MM-DD anahtarına normalize eder (ISO, TR format, datetime). */
export function normalizeDateKey(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const trMatch = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (trMatch) return `${trMatch[3]}-${trMatch[2]}-${trMatch[1]}`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const offset = parsed.getTimezoneOffset();
    const local = new Date(parsed.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
  }
  return value;
}

export function formatDateLabelTr(raw: unknown): string {
  const key = normalizeDateKey(raw);
  return key ? key.split('-').reverse().join('.') : '-';
}

export function todayDateKey(): string {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localToday = new Date(today.getTime() - offset * 60 * 1000);
  return localToday.toISOString().split('T')[0];
}

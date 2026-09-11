const dateTimeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export function formatMoney(cents, currency = 'USD') {
  if (cents === null || cents === undefined) return '—';
  const amount = Number(cents) / 100;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// ISO timestamps (UTC) written by the server.
export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : dateTimeFormatter.format(date);
}

// Calendar dates in YYYY-MM-DD form.
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
}

// Wall-clock values from <input type="datetime-local"> (YYYY-MM-DDTHH:MM, no zone).
export function formatLocalDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateTimeFormatter.format(date);
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(iso);
}

export function truncate(text, max = 120) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

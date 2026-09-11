// Locale-aware formatting. `tag` is a BCP 47 tag such as "en" or "ar-u-nu-latn".

const DATE_TIME_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
const DATE_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric' };

const cache = new Map();
function cached(kind, tag, factory) {
  const key = `${kind}|${tag}`;
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = factory();
    cache.set(key, formatter);
  }
  return formatter;
}

// Some locales (Arabic among them) prefix the amount with an invisible
// directional mark; it is dropped so callers control the layout direction.
const DIRECTION_MARKS = /[\u200e\u200f]/g;

export function formatMoney(cents, currency = 'USD', tag = 'en') {
  if (cents === null || cents === undefined) return '—';
  const amount = Number(cents) / 100;
  try {
    return cached(`money|${currency}`, tag, () => new Intl.NumberFormat(tag, { style: 'currency', currency }))
      .format(amount)
      .replace(DIRECTION_MARKS, '');
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value, tag = 'en') {
  return cached('number', tag, () => new Intl.NumberFormat(tag)).format(Number(value));
}

// ISO timestamps (UTC) written by the server.
export function formatDateTime(iso, tag = 'en') {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return cached('datetime', tag, () => new Intl.DateTimeFormat(tag, DATE_TIME_OPTIONS)).format(date);
}

// Calendar dates in YYYY-MM-DD form.
export function formatDate(value, tag = 'en') {
  if (!value) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return cached('date', tag, () => new Intl.DateTimeFormat(tag, DATE_OPTIONS)).format(date);
}

// Wall-clock values from <input type="datetime-local"> (YYYY-MM-DDTHH:MM, no zone).
export function formatLocalDateTime(value, tag = 'en') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return cached('datetime', tag, () => new Intl.DateTimeFormat(tag, DATE_TIME_OPTIONS)).format(date);
}

export function createFormatters(tag, currency) {
  return {
    tag,
    money: (cents) => formatMoney(cents, currency, tag),
    number: (value) => formatNumber(value, tag),
    dateTime: (iso) => formatDateTime(iso, tag),
    date: (value) => formatDate(value, tag),
    localDateTime: (value) => formatLocalDateTime(value, tag),
  };
}

export function truncate(text, max = 120) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

// Tiny HTML templating helper with escaping by default.
//
// Interpolated values inside the `html` tagged template are escaped unless they
// are the result of another `html` call (or wrapped with `raw`). Arrays are
// joined, and null/undefined/false render as nothing.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export function raw(value) {
  return new SafeHtml(String(value));
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(String(value));
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) {
    out += render(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

// Escapes text and preserves line breaks (for user-written descriptions).
export function multiline(text) {
  if (!text) return raw('');
  return raw(escapeHtml(String(text)).replace(/\r?\n/g, '<br>'));
}

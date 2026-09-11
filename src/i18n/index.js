// Translations, locale detection and message formatting.
//
// Dictionaries live in ./en.js and ./ar.js and share the same key structure.
// `translate(locale, key, params)` interpolates `{name}` placeholders (with an
// optional `{name|lower}` transform), supports plural forms (objects keyed by
// Intl.PluralRules categories, selected with `params.count`), keeps SafeHtml
// parameters unescaped while escaping everything else, and falls back to
// English for keys missing from another locale.

import { SafeHtml, escapeHtml, raw } from '../lib/html.js';
import en from './en.js';
import ar from './ar.js';

export const LOCALES = { en, ar };
export const DEFAULT_LOCALE = 'en';
export const LANG_COOKIE = 'hf_lang';
const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

// A reference to another translation, resolved when interpolated (used for
// error messages built from several translatable pieces).
export class TRef {
  constructor(key, params = {}) {
    this.key = key;
    this.params = params;
  }

  // Survives JSON round-trips (flash messages travel through a cookie).
  toJSON() {
    return { $t: this.key, params: this.params };
  }
}

function isSerializedRef(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.$t === 'string';
}

export const tref = (key, params) => new TRef(key, params);

export function isLocale(value) {
  return typeof value === 'string' && Object.hasOwn(LOCALES, value);
}

function dictionary(locale) {
  return LOCALES[locale] ?? LOCALES[DEFAULT_LOCALE];
}

export function intlTag(locale) {
  return dictionary(locale).meta.intl;
}

export function localeDir(locale) {
  return dictionary(locale).meta.dir;
}

export function localeName(locale) {
  return dictionary(locale).meta.name;
}

function lookup(dict, key) {
  let node = dict;
  for (const part of String(key).split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

const pluralRules = new Map();
function pluralCategory(locale, count) {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(intlTag(locale));
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

const PLACEHOLDER = /\{(\w+)(?:\|(\w+))?\}/g;
const TRANSFORMS = {
  lower: (text) => text.toLowerCase(),
  upper: (text) => text.toUpperCase(),
};

// Unicode "first strong isolate" … "pop directional isolate": keeps a Latin
// name, price or duration intact inside a right-to-left sentence.
const FSI = '\u2068';
const PDI = '\u2069';

function resolveParam(locale, value, transform) {
  if (value instanceof TRef) value = translate(locale, value.key, value.params);
  else if (isSerializedRef(value)) value = translate(locale, value.$t, value.params || {});
  if (value instanceof SafeHtml) return value;
  let text = value === null || value === undefined ? '' : String(value);
  if (transform && TRANSFORMS[transform]) text = TRANSFORMS[transform](text);
  if (text && localeDir(locale) === 'rtl') text = `${FSI}${text}${PDI}`;
  return text;
}

function interpolate(locale, template, params) {
  const parts = [];
  let hasHtml = false;
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    parts.push({ text: template.slice(last, match.index) });
    const value = resolveParam(locale, params[match[1]], match[2]);
    if (value instanceof SafeHtml) {
      hasHtml = true;
      parts.push({ html: value.value });
    } else {
      parts.push({ text: value });
    }
    last = match.index + match[0].length;
  }
  parts.push({ text: template.slice(last) });
  if (!hasHtml) return parts.map((part) => part.text).join('');
  return raw(parts.map((part) => (part.html !== undefined ? part.html : escapeHtml(part.text))).join(''));
}

export function translate(locale, key, params = {}) {
  if (key instanceof TRef) return translate(locale, key.key, { ...key.params, ...params });
  let value = lookup(dictionary(locale), key);
  if (value === undefined) value = lookup(LOCALES[DEFAULT_LOCALE], key);
  if (value === undefined) return String(key);
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === 'object') {
    if (!('other' in value)) return String(key);
    const count = Number(params.count ?? 0);
    value = value[pluralCategory(locale, count)] ?? value.other;
  }
  return interpolate(locale, String(value), params);
}

export function createTranslator(locale) {
  return (key, params) => translate(locale, key, params);
}

// Translates a map of field → message key (as produced by validation).
export function translateErrors(locale, errors) {
  return Object.fromEntries(
    Object.entries(errors || {}).map(([field, message]) => [
      field,
      typeof message === 'string' || message instanceof TRef ? translate(locale, message) : message,
    ]),
  );
}

// Accepts a TRef that has been through JSON (e.g. from a flash cookie).
export function reviveRef(value) {
  return isSerializedRef(value) ? new TRef(value.$t, value.params || {}) : value;
}

// Order of preference: ?lang= query → cookie → Accept-Language → configured default.
export function resolveLocale({ query, cookies = {}, acceptLanguage = '', fallback = DEFAULT_LOCALE }) {
  const requested = query?.get?.('lang');
  if (isLocale(requested)) return requested;
  if (isLocale(cookies[LANG_COOKIE])) return cookies[LANG_COOKIE];
  for (const part of String(acceptLanguage || '').split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase();
    if (!tag) continue;
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return isLocale(fallback) ? fallback : DEFAULT_LOCALE;
}

// Persists an explicit ?lang= choice in a cookie and removes it from the URL.
export function localeMiddleware() {
  return (ctx) => {
    const requested = ctx.query.get('lang');
    if (requested === null) return;
    if (isLocale(requested)) {
      ctx.setCookie(LANG_COOKIE, requested, { path: '/', maxAge: LANG_COOKIE_MAX_AGE, sameSite: 'Lax' });
    }
    if (ctx.method === 'GET') {
      const url = new URL(ctx.url);
      url.searchParams.delete('lang');
      ctx.redirect(url.pathname + url.search);
    }
  };
}

export function switchLocaleHref(url, locale) {
  const target = new URL(url);
  target.searchParams.set('lang', locale);
  return target.pathname + target.search;
}

export function otherLocales(locale) {
  return Object.keys(LOCALES).filter((code) => code !== locale);
}

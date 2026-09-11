import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Client, startApp } from './helpers.js';
import { LOCALES, resolveLocale, translate, tref } from '../src/i18n/index.js';
import { renderEventMessage } from '../src/i18n/events.js';
import { SafeHtml, html } from '../src/lib/html.js';
import { CATEGORIES, STATUS_ORDER, STEPS, URGENCY_LEVELS } from '../src/workflow.js';

// Arabic output wraps interpolated values in invisible Unicode isolates (U+2068/U+2069)
// so Latin runs keep their order; strip them to compare the visible text.
const visible = (value) => String(value).replace(/[\u2068\u2069]/g, '');

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

function keysOf(value, prefix = '') {
  if (Array.isArray(value)) return [prefix];
  if (value && typeof value === 'object') {
    if ('other' in value) return [prefix];
    return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    return statSync(file).isDirectory() ? sourceFiles(file) : file.endsWith('.js') ? [file] : [];
  });
}

test('every English key has an Arabic translation and vice versa', () => {
  const en = keysOf(LOCALES.en).sort();
  const ar = keysOf(LOCALES.ar).sort();
  assert.deepEqual(ar, en);
  assert.equal(LOCALES.ar.meta.dir, 'rtl');
});

test('every translation key referenced in the source exists', () => {
  const sections = 'common|nav|roles|status|statusNote|steps|categories|urgency|offerStatus|userStatus|userBadge|fields|visit|home|auth|errors|flash|customer|admin|tech|events';
  const pattern = new RegExp(`'((?:${sections})\\.[\\w.]+)'`, 'g');
  const missing = new Set();
  for (const file of sourceFiles('src')) {
    if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
      if (translate('en', match[1]) === match[1]) missing.add(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual([...missing], []);

  const dynamic = [
    ...STATUS_ORDER.flatMap((s) => [`status.${s}`, `statusNote.customer.${s}`, `statusNote.admin.${s}`]),
    ...STEPS.map((s) => `steps.${s}`),
    ...CATEGORIES.map((c) => `categories.${c}`),
    ...URGENCY_LEVELS.flatMap((u) => [`urgency.${u}.label`, `urgency.${u}.hint`]),
    ...['pending', 'accepted', 'rejected', 'withdrawn'].map((s) => `offerStatus.${s}`),
    ...['customer', 'technician', 'admin'].map((r) => `roles.${r}`),
    ...['active', 'disabled', 'pending'].map((s) => [`userStatus.${s}`, `userBadge.${s}`]).flat(),
    ...[400, 403, 404, 405, 409, 413, 500].map((s) => `errors.titles.${s}`),
    ...['scheduleVisit', 'recordFindings', 'cancel', 'acceptOffer', 'completeWork', 'confirm', 'rework'].map((a) => `errors.actions.${a}`),
  ];
  for (const locale of Object.keys(LOCALES)) {
    for (const key of dynamic) assert.notEqual(translate(locale, key), key, `${locale}: ${key}`);
  }
});

test('translate interpolates, pluralises, transforms and keeps safe HTML', () => {
  assert.equal(translate('en', 'flash.welcomeBack', { name: 'Nadia' }), 'Welcome back, Nadia.');
  assert.equal(visible(translate('ar', 'flash.welcomeBack', { name: 'نادية' })), 'مرحبًا بعودتك يا نادية.');
  assert.match(translate('ar', 'flash.welcomeBack', { name: 'Nadia' }), /\u2068Nadia\u2069/, 'parameters are isolated in RTL output');
  assert.doesNotMatch(translate('en', 'flash.welcomeBack', { name: 'Nadia' }), /[\u2068\u2069]/, 'no isolates in LTR output');
  assert.equal(translate('en', 'common.completedJobs', { count: 1 }), '1 completed job');
  assert.equal(translate('en', 'common.completedJobs', { count: 3 }), '3 completed jobs');
  assert.equal(translate('ar', 'common.completedJobs', { count: 0 }), 'لا توجد أعمال مكتملة');
  assert.equal(translate('ar', 'common.completedJobs', { count: 2 }), 'عملان مكتملان');
  assert.equal(visible(translate('ar', 'common.completedJobs', { count: 5 })), '5 أعمال مكتملة');
  assert.equal(visible(translate('ar', 'common.completedJobs', { count: 15 })), '15 عملاً مكتملاً');
  assert.equal(translate('en', 'events.created', { actor: 'A', category: 'Plumbing' }), 'A submitted a new plumbing request.');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
  assert.equal(visible(translate('ar', 'errors.transition', { action: tref('errors.actions.cancel'), status: tref('status.in_progress') })), 'لا يمكنك إلغاء هذا الطلب بينما حالة الطلب "قيد التنفيذ".');

  const roundTripped = JSON.parse(JSON.stringify({ action: tref('errors.actions.cancel'), status: tref('status.in_progress') }));
  assert.equal(translate('en', 'errors.transition', roundTripped), 'You can\'t cancel this request while the request is "In progress".');

  const withHtml = translate('en', 'common.updated', { time: html`<time>now</time>` });
  assert.ok(withHtml instanceof SafeHtml);
  assert.equal(String(withHtml), 'Updated <time>now</time>');
  const escaped = translate('en', 'flash.welcomeBack', { name: '<b>x</b>' });
  assert.equal(escaped, 'Welcome back, <b>x</b>.', 'plain strings are escaped later by the template');
  const mixed = translate('en', 'customer.show.markedCompletedBy', { name: '<b>x</b>', time: html`<time>t</time>` });
  assert.equal(String(mixed), '&lt;b&gt;x&lt;/b&gt; marked this job as completed <time>t</time>.');
});

test('activity log entries render in either language', () => {
  const data = { actor: 'Omar Haddad', amountCents: 14500, duration: '2 hours', currency: 'USD' };
  assert.equal(renderEventMessage('en', 'offer_submitted', data), 'Omar Haddad submitted an offer of $145.00 (2 hours).');
  assert.match(visible(renderEventMessage('ar', 'offer_submitted', data)), /^قدّم Omar Haddad عرضًا بقيمة .*145\.00.* \(2 hours\)\.$/);
  assert.equal(renderEventMessage('en', 'closed', { actor: 'N', rating: 5, review: 'Great' }), 'N confirmed the work and rated it 5/5. Review: Great');
  assert.doesNotMatch(renderEventMessage('ar', 'offer_submitted', data), /[\u200e\u200f]/, 'no stray direction marks inside isolated amounts');
  assert.equal(visible(renderEventMessage('ar', 'created', { actor: 'نادية', category: 'plumbing' })), 'قدّم نادية طلبًا جديدًا في فئة السباكة.');
});

test('locale is resolved from the query, cookie, Accept-Language or default', () => {
  const query = (lang) => new URLSearchParams(lang ? { lang } : {});
  assert.equal(resolveLocale({ query: query('ar') }), 'ar');
  assert.equal(resolveLocale({ query: query('xx'), cookies: { hf_lang: 'ar' } }), 'ar');
  assert.equal(resolveLocale({ query: query(), acceptLanguage: 'ar-SA,ar;q=0.9,en;q=0.8' }), 'ar');
  assert.equal(resolveLocale({ query: query(), acceptLanguage: 'fr-FR,fr;q=0.9' }), 'en');
  assert.equal(resolveLocale({ query: query(), acceptLanguage: 'fr-FR,fr;q=0.9', fallback: 'ar' }), 'ar');
  assert.equal(resolveLocale({ query: query() }), 'en');
});

test('the site can be switched to Arabic and remembers the choice', async () => {
  const client = new Client(app.base);
  let res = await client.get('/login?next=%2Frequests&lang=ar');
  assert.equal(res.status, 303);
  assert.equal(res.location, '/login?next=%2Frequests');
  assert.equal(client.cookies.get('hf_lang'), 'ar');

  res = await client.get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<html lang="ar" dir="rtl"/);
  assert.match(res.text, /إصلاحات المنزل، من البداية إلى النهاية\./);
  assert.match(res.text, /تسجيل الدخول/);
  assert.match(res.text, /href="\/\?lang=en"[^>]*>English</, 'switch link points back to English');
  assert.match(res.headers.get('content-language'), /ar/);

  res = await client.register({ name: 'A', email: 'bad', password: 'short', password_confirm: 'x' });
  assert.equal(res.status, 400);
  assert.match(res.text, /أدخل بريدًا إلكترونيًا صالحًا\./);
  assert.match(res.text, /كلمتا المرور غير متطابقتين\./);

  res = await client.get('/?lang=en');
  assert.equal(res.status, 303);
  res = await client.get('/');
  assert.match(res.text, /<html lang="en" dir="ltr"/);
});

test('Accept-Language selects Arabic when nothing else is set', async () => {
  const client = new Client(app.base);
  const res = await client.request('GET', '/login', { headers: { 'accept-language': 'ar-EG,ar;q=0.9,en;q=0.5' } });
  assert.equal(res.status, 200);
  assert.match(res.text, /dir="rtl"/);
  assert.match(res.text, /مرحبًا بعودتك\. سجّل الدخول لإدارة طلبات الصيانة\./);
});

test('a request created in English reads naturally in Arabic, including the activity log', async () => {
  const customer = new Client(app.base);
  let res = await customer.register({ name: 'Nadia Khalil', email: 'nadia@example.com', password: 'customer123', password_confirm: 'customer123' });
  assert.equal(res.status, 303);
  res = await customer.post('/requests', { category: 'plumbing', title: 'Kitchen sink leaking under the cabinet', description: 'Water pools under the sink every time we use it.', address: '12 Cedar Lane', urgency: 'high' });
  const id = Number(res.location.split('/').pop());
  res = await customer.get(`/requests/${id}`);
  assert.match(res.text, /Your request was submitted/);
  assert.match(res.text, /Nadia Khalil submitted a new plumbing request\./);

  res = await customer.get(`/requests/${id}?lang=ar`);
  assert.equal(res.status, 303);
  res = await customer.get(`/requests/${id}`);
  const arabicPage = visible(res.text);
  assert.match(arabicPage, /dir="rtl"/);
  assert.match(arabicPage, /badge-neutral">مُقدَّم</);
  assert.match(arabicPage, /badge-warn">عالية</);
  assert.match(arabicPage, /السباكة/);
  assert.match(arabicPage, /قدّم Nadia Khalil طلبًا جديدًا في فئة السباكة\./);
  assert.match(arabicPage, /سيراجع فريقنا طلبك ويحدد موعد زيارة المعاينة\./);
  assert.match(arabicPage, /إلغاء الطلب/);

  // A workflow conflict is explained in Arabic too.
  const admin = new Client(app.base);
  await admin.login('admin@homefix.test', 'admin123');
  await admin.get('/admin?lang=ar');
  res = await admin.post(`/admin/requests/${id}/assessment`, { assessment: 'Not scheduled yet, so this must fail.' });
  assert.equal(res.status, 303);
  res = await admin.get(`/admin/requests/${id}`);
  assert.match(visible(res.text), /لا يمكنك تسجيل نتائج المعاينة بينما حالة الطلب &quot;مُقدَّم&quot;\./);
  assert.match(res.text, /جدولة زيارة المعاينة/);
});

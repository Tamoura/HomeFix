import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, rawRequest, startApp } from './helpers.js';
import { hashPassword, verifyPassword } from '../src/auth.js';
import { escapeHtml, html, raw } from '../src/lib/html.js';
import { parseAmount } from '../src/services/offers.js';

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

test('password hashing uses scrypt with a per-user salt', () => {
  const hash = hashPassword('correct horse');
  assert.match(hash, /^scrypt:\d+:/);
  assert.notEqual(hash, hashPassword('correct horse'));
  assert.equal(verifyPassword('correct horse', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
  assert.equal(verifyPassword('anything', 'garbage'), false);
});

test('html templates escape interpolated values', () => {
  const rendered = String(html`<p>${'<script>alert(1)</script>'}</p>${raw('<b>ok</b>')}${['a', html`<i>${'&'}</i>`]}${null}${false}`);
  assert.equal(rendered, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><b>ok</b>a<i>&amp;</i>');
  assert.equal(escapeHtml(`"'`), '&quot;&#39;');
});

test('offer amounts are parsed into cents', () => {
  assert.equal(parseAmount('250'), 25000);
  assert.equal(parseAmount('1,250.50'), 125050);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('12.345'), null);
  assert.equal(parseAmount('abc'), null);
});

test('registration validates input and rejects duplicates', async () => {
  const client = new Client(app.base);
  let res = await client.register({ name: 'A', email: 'not-an-email', password: 'short', password_confirm: 'other' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Enter your full name/);
  assert.match(res.text, /Enter a valid email address/);
  assert.match(res.text, /at least 8 characters/);
  assert.match(res.text, /Passwords do not match/);

  res = await client.register({ role: 'technician', name: 'Tech Without Specialty', email: 'tech@example.com', password: 'password1', password_confirm: 'password1' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Tell us your specialty/);

  res = await client.register({ name: 'Nadia Khalil', email: 'Nadia@Example.com', password: 'customer123', password_confirm: 'customer123' });
  assert.equal(res.status, 303);
  const other = new Client(app.base);
  res = await other.register({ name: 'Nadia Again', email: 'nadia@example.com', password: 'customer123', password_confirm: 'customer123' });
  assert.equal(res.status, 400);
  assert.match(res.text, /already exists/);
});

test('login rejects bad credentials and redirects by role', async () => {
  const client = new Client(app.base);
  let res = await client.login('nadia@example.com', 'wrong-password');
  assert.equal(res.status, 401);
  assert.match(res.text, /Incorrect email or password/);
  res = await client.login('nobody@example.com', 'whatever');
  assert.equal(res.status, 401);
  res = await client.login('nadia@example.com', 'customer123');
  assert.equal(res.status, 303);
  assert.equal(res.location, '/requests');

  const admin = new Client(app.base);
  res = await admin.login('admin@homefix.test', 'admin123');
  assert.equal(res.location, '/admin');
});

test('login honours a safe "next" path only', async () => {
  const client = new Client(app.base);
  let res = await client.get('/requests/new');
  assert.equal(res.status, 303);
  assert.equal(res.location, '/login?next=%2Frequests%2Fnew');
  await client.get('/login?next=%2Frequests%2Fnew');
  res = await client.post('/login', { email: 'nadia@example.com', password: 'customer123', next: '/requests/new' });
  assert.equal(res.location, '/requests/new');

  const evil = new Client(app.base);
  await evil.get('/login');
  res = await evil.post('/login', { email: 'nadia@example.com', password: 'customer123', next: '//evil.example.com' });
  assert.equal(res.location, '/requests');
});

test('POST requests require a valid CSRF token', async () => {
  const client = new Client(app.base);
  await client.login('nadia@example.com', 'customer123');
  await client.get('/requests/new');
  const goodToken = client.csrf;
  client.csrf = 'forged-token';
  let res = await client.request('POST', '/requests', { form: { _csrf: 'forged-token', category: 'plumbing', title: 'Leaking tap in the bathroom', description: 'Drips constantly.', address: '12 Cedar Lane' } });
  assert.equal(res.status, 403);
  assert.match(res.text, /security token/);
  client.csrf = null; // the error page carries the real token; drop it so the next request has none
  res = await client.request('POST', '/requests', { form: { category: 'plumbing', title: 'Leaking tap in the bathroom', description: 'Drips constantly.', address: '12 Cedar Lane' } });
  assert.equal(res.status, 403, 'missing token');
  client.csrf = goodToken;
  res = await client.post('/requests', { category: 'plumbing', title: 'Leaking tap in the bathroom', description: 'Drips constantly.', address: '12 Cedar Lane' });
  assert.equal(res.status, 303);
});

test('roles are enforced and customers only see their own requests', async () => {
  const nadia = new Client(app.base);
  await nadia.login('nadia@example.com', 'customer123');
  let res = await nadia.get('/admin');
  assert.equal(res.status, 403);
  res = await nadia.get('/tech');
  assert.equal(res.status, 403);
  res = await nadia.get('/admin/users');
  assert.equal(res.status, 403);

  const stranger = new Client(app.base);
  await stranger.register({ name: 'Other Person', email: 'other@example.com', password: 'customer123', password_confirm: 'customer123' });
  const request = app.db.prepare('SELECT id FROM requests ORDER BY id DESC LIMIT 1').get();
  res = await stranger.get(`/requests/${request.id}`);
  assert.equal(res.status, 404);
  res = await stranger.post(`/requests/${request.id}/cancel`, { reason: 'nope' });
  assert.equal(res.status, 404);
  res = await stranger.get('/requests/abc');
  assert.equal(res.status, 404);

  const admin = new Client(app.base);
  await admin.login('admin@homefix.test', 'admin123');
  res = await admin.get('/requests');
  assert.equal(res.status, 403);
  res = await admin.get(`/admin/requests/${request.id}`);
  assert.equal(res.status, 200);
});

test('logout ends the session and disabled technicians cannot sign in', async () => {
  const client = new Client(app.base);
  await client.login('nadia@example.com', 'customer123');
  let res = await client.get('/requests');
  assert.equal(res.status, 200);
  res = await client.post('/logout');
  assert.equal(res.status, 303);
  assert.equal(res.location, '/');
  res = await client.get('/requests');
  assert.equal(res.status, 303);
  assert.match(res.location, /^\/login/);

  const tech = new Client(app.base);
  await tech.register({ role: 'technician', name: 'Disabled Tech', email: 'disabled@example.com', specialty: 'Painting', password: 'password1', password_confirm: 'password1' });
  const techId = app.db.prepare('SELECT id FROM users WHERE email = ?').get('disabled@example.com').id;
  const admin = new Client(app.base);
  await admin.login('admin@homefix.test', 'admin123');
  res = await admin.post(`/admin/users/${techId}/status`, { status: 'disabled' });
  assert.equal(res.status, 303);
  res = await tech.get('/tech');
  assert.equal(res.status, 303, 'existing session is revoked');
  res = await tech.login('disabled@example.com', 'password1');
  assert.equal(res.status, 401);
  assert.match(res.text, /deactivated/);
  res = await admin.post(`/admin/users/${techId}/status`, { status: 'bogus' });
  assert.equal(res.status, 400);
});

test('admin can create technician accounts directly', async () => {
  const admin = new Client(app.base);
  await admin.login('admin@homefix.test', 'admin123');
  let res = await admin.post('/admin/users', { name: 'Karim Nasser', email: 'karim@example.com', phone: '555-0203', specialty: 'General maintenance', password: 'tech1234' });
  assert.equal(res.status, 303);
  const karim = new Client(app.base);
  res = await karim.login('karim@example.com', 'tech1234');
  assert.equal(res.location, '/tech');
  res = await karim.get('/tech');
  assert.match(res.text, /Technician dashboard/);
  res = await admin.post('/admin/users', { name: 'Dup', email: 'karim@example.com', specialty: 'x', password: 'tech1234' });
  assert.equal(res.status, 400);
  assert.match(res.text, /already exists/);
});

test('static files are served and path traversal is blocked', async () => {
  const client = new Client(app.base);
  let res = await client.get('/public/styles.css');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/css/);
  res = await rawRequest(app.base, '/public/../package.json');
  assert.equal(res.status, 404);
  res = await rawRequest(app.base, '/public/%2e%2e/package.json');
  assert.equal(res.status, 404);
  res = await client.get('/public/missing.css');
  assert.equal(res.status, 404);
  res = await client.get('/definitely-not-here');
  assert.equal(res.status, 404);
  assert.match(res.text, /Page not found/);
});

test('landing pages render for visitors and logged-in users', async () => {
  const visitor = new Client(app.base);
  let res = await visitor.get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /Every home repair, handled by people you can trust\./);
  assert.match(res.text, /<meta name="description"/);
  assert.match(res.text, /Why homeowners choose HomeFix/);
  assert.match(res.text, /Questions homeowners ask/);
  assert.match(res.text, /Leaks, blocked drains, taps, toilets and water heaters\./);
  assert.match(res.text, /href="\/technicians"/);
  assert.match(res.text, /href="\/register"[^>]*>Request a service</);
  assert.doesNotMatch(res.text, /stats-strip/, 'no track record until a job has been closed');

  res = await visitor.get('/technicians');
  assert.equal(res.status, 200);
  assert.match(res.text, /Inspected jobs, clear scope, your price\./);
  assert.match(res.text, /href="\/register\?role=technician"[^>]*>Join as a technician</);

  const technician = new Client(app.base);
  await technician.login('karim@example.com', 'tech1234');
  res = await technician.get('/technicians');
  assert.match(res.text, /href="\/tech"[^>]*>Go to your dashboard</);
  assert.doesNotMatch(res.text, /Join as a technician/);

  const customer = new Client(app.base);
  await customer.login('nadia@example.com', 'customer123');
  res = await customer.get('/');
  assert.match(res.text, /href="\/requests\/new"[^>]*>Submit a new request</);
  assert.doesNotMatch(res.text, /Are you a technician\?/);
});

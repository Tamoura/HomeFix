import http from 'node:http';
import { createServer, loadConfig } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { seedDemoData } from '../scripts/seed.js';

const silentLog = { info() {}, warn() {}, error: (error) => console.error(error) };

export async function startApp(overrides = {}) {
  const config = { ...loadConfig({}), logRequests: false, databaseFile: ':memory:', ...overrides };
  const db = openDatabase(':memory:');
  if (config.demoMode) seedDemoData(db, config);
  const server = createServer({ db, config, log: silentLog });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    db,
    config,
    base,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
    },
  };
}

// A minimal browser-like client: keeps cookies, remembers the CSRF token from
// the last rendered page and never follows redirects (so tests can assert on them).
export class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
    this.csrf = null;
  }

  async request(method, path, { form, headers = {} } = {}) {
    const options = { method, headers: { ...headers }, redirect: 'manual' };
    if (this.cookies.size) {
      options.headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }
    if (form) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(form)) params.set(key, String(value));
      if (this.csrf && !params.has('_csrf')) params.set('_csrf', this.csrf);
      options.headers['content-type'] = 'application/x-www-form-urlencoded';
      options.body = params.toString();
    }
    const response = await fetch(this.base + path, options);
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (attributes.some((attribute) => /^\s*max-age=0$/i.test(attribute))) {
        this.cookies.delete(name);
        if (name === 'hf_session') this.csrf = null;
      } else {
        this.cookies.set(name, value);
      }
    }
    const text = await response.text();
    const token = text.match(/name="_csrf" value="([^"]+)"/);
    if (token) this.csrf = token[1];
    return { status: response.status, headers: response.headers, text, location: response.headers.get('location') };
  }

  get(path) {
    return this.request('GET', path);
  }

  async post(path, form = {}) {
    if (!this.csrf && this.cookies.has('hf_session')) await this.get('/');
    return this.request('POST', path, { form });
  }

  async login(email, password) {
    await this.get('/login');
    return this.post('/login', { email, password });
  }

  async register(fields) {
    await this.get('/register');
    return this.post('/register', { role: 'customer', ...fields });
  }
}

// Sends a raw request without URL normalisation (fetch would collapse "..").
export function rawRequest(base, path) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text: body }));
    });
    req.on('error', reject);
    req.end();
  });
}

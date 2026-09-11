// Minimal HTTP toolkit on top of node:http: request context, router, body
// parsing, cookies, flash messages and static files. No external dependencies.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, serializeCookie } from './cookies.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export class ValidationError extends Error {
  constructor(errors, message = 'Please correct the highlighted fields.') {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const MAX_BODY_BYTES = 1_000_000;

export async function readBody(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'The submitted form is too large.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (type === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (type === 'application/json') {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new HttpError(400, 'Malformed JSON body.');
    }
  }
  return {};
}

function encodeFlash(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeFlash(value) {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed && typeof parsed.message === 'string') return parsed;
  } catch {
    // ignore malformed cookie
  }
  return null;
}

export function createContext(req, res, { db, config }) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const cookies = parseCookies(req.headers.cookie);
  const outgoingCookies = new Map();

  const ctx = {
    req,
    res,
    db,
    config,
    url,
    method: req.method === 'HEAD' ? 'GET' : req.method.toUpperCase(),
    path: url.pathname,
    query: url.searchParams,
    cookies,
    params: {},
    body: {},
    user: null,
    session: null,

    setCookie(name, value, options = {}) {
      outgoingCookies.set(name, serializeCookie(name, value, options));
    },
    clearCookie(name, options = {}) {
      outgoingCookies.set(name, serializeCookie(name, '', { ...options, maxAge: 0 }));
    },
    send(status, body, headers = {}) {
      if (res.writableEnded) return;
      const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
      const finalHeaders = { 'Content-Length': payload.length, ...headers };
      if (outgoingCookies.size) finalHeaders['Set-Cookie'] = [...outgoingCookies.values()];
      res.writeHead(status, finalHeaders);
      res.end(req.method === 'HEAD' ? undefined : payload);
    },
    html(body, status = 200) {
      ctx.send(status, String(body), {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    },
    json(data, status = 200) {
      ctx.send(status, JSON.stringify(data), {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
    },
    redirect(location, status = 303) {
      ctx.send(status, '', { Location: location });
    },
    flash(type, message) {
      ctx.setCookie('flash', encodeFlash({ type, message }), { path: '/', httpOnly: true, sameSite: 'Lax' });
    },
    takeFlash() {
      if (!cookies.flash) return null;
      ctx.clearCookie('flash', { path: '/' });
      return decodeFlash(cookies.flash);
    },
  };
  return ctx;
}

function compilePattern(pattern) {
  const keys = [];
  const parts = pattern.split('/').map((segment) => {
    if (segment.startsWith(':')) {
      keys.push(segment.slice(1));
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regex: new RegExp(`^${parts.join('/')}/?$`), keys };
}

export function createRouter() {
  const routes = [];
  const middlewares = [];

  function add(method, pattern, handlers) {
    routes.push({ method, ...compilePattern(pattern), handlers });
  }

  return {
    use(middleware) {
      middlewares.push(middleware);
    },
    get(pattern, ...handlers) {
      add('GET', pattern, handlers);
    },
    post(pattern, ...handlers) {
      add('POST', pattern, handlers);
    },
    async dispatch(ctx) {
      for (const middleware of middlewares) {
        await middleware(ctx);
        if (ctx.res.writableEnded) return;
      }
      let pathMatched = false;
      for (const route of routes) {
        const match = route.regex.exec(ctx.path);
        if (!match) continue;
        pathMatched = true;
        if (route.method !== ctx.method) continue;
        ctx.params = Object.fromEntries(
          route.keys.map((key, index) => {
            try {
              return [key, decodeURIComponent(match[index + 1])];
            } catch {
              return [key, match[index + 1]];
            }
          }),
        );
        for (const handler of route.handlers) {
          await handler(ctx);
          if (ctx.res.writableEnded) return;
        }
        return;
      }
      if (pathMatched) throw new HttpError(405, 'That action is not allowed on this page.');
      throw new HttpError(404, 'We could not find that page.');
    },
  };
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export async function serveStatic(ctx, rootDir, urlPrefix) {
  const root = path.resolve(rootDir);
  let relative = ctx.path.slice(urlPrefix.length);
  try {
    relative = decodeURIComponent(relative);
  } catch {
    throw new HttpError(404, 'File not found.');
  }
  const file = path.resolve(root, `.${path.posix.normalize(`/${relative}`)}`);
  if (!file.startsWith(root + path.sep)) throw new HttpError(404, 'File not found.');
  let data;
  try {
    data = await readFile(file);
  } catch {
    throw new HttpError(404, 'File not found.');
  }
  ctx.send(200, data, {
    'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=300',
  });
}

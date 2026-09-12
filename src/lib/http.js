// Minimal HTTP toolkit on top of node:http: request context, router, body
// parsing, cookies, flash messages and static files. No external dependencies.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCookies, serializeCookie } from './cookies.js';
import { createFormatters } from './format.js';
import { intlTag, localeDir, resolveLocale, translate, translateErrors } from '../i18n/index.js';

// Errors carry a translation key (plus parameters) so they can be shown in the
// reader's language.
export class HttpError extends Error {
  constructor(status, key, params = {}) {
    super(key);
    this.name = 'HttpError';
    this.status = status;
    this.key = key;
    this.params = params;
  }
}

export class ValidationError extends Error {
  constructor(errors) {
    super('errors.validationGeneric');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

const MAX_BODY_BYTES = 1_000_000;

function parseBody(body, type) {
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (body && typeof body === 'object') return body; // already parsed by the host runtime
  const text = String(body ?? '');
  if (type === 'application/x-www-form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(text));
  }
  if (type === 'application/json') {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new HttpError(400, 'errors.malformedJson');
    }
  }
  return {};
}

export async function readBody(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  // Some hosts (Vercel's Node.js helpers, for example) consume the stream and
  // expose the parsed body up front.
  if (req.body !== undefined && req.body !== null) return parseBody(req.body, type);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'errors.tooLarge');
    chunks.push(chunk);
  }
  return parseBody(Buffer.concat(chunks).toString('utf8'), type);
}

function encodeFlash(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeFlash(value) {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed && typeof parsed.key === 'string') return parsed;
  } catch {
    // ignore malformed cookie
  }
  return null;
}

export function createContext(req, res, { db, config }) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const cookies = parseCookies(req.headers.cookie);
  const outgoingCookies = new Map();
  const locale = resolveLocale({
    query: url.searchParams,
    cookies,
    acceptLanguage: req.headers['accept-language'],
    fallback: config.defaultLocale,
  });

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

    locale,
    dir: localeDir(locale),
    intl: intlTag(locale),
    t: (key, params) => translate(locale, key, params),
    tErrors: (errors) => translateErrors(locale, errors),
    fmt: createFormatters(intlTag(locale), config.currency),

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
        'Content-Language': locale,
        Vary: 'Cookie, Accept-Language',
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
    // Flash messages are stored as translation keys so they render in the
    // language of the page that displays them.
    flash(type, key, params = {}) {
      ctx.setCookie('flash', encodeFlash({ type, key, params }), { path: '/', httpOnly: true, sameSite: 'Lax' });
    },
    takeFlash() {
      if (!cookies.flash) return null;
      ctx.clearCookie('flash', { path: '/' });
      const payload = decodeFlash(cookies.flash);
      if (!payload) return null;
      return { type: payload.type, message: translate(locale, payload.key, payload.params || {}) };
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
      if (pathMatched) throw new HttpError(405, 'errors.methodNotAllowed');
      throw new HttpError(404, 'errors.notFound');
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
  '.woff2': 'font/woff2',
};

export async function serveStatic(ctx, rootDir, urlPrefix) {
  const root = path.resolve(rootDir);
  let relative = ctx.path.slice(urlPrefix.length);
  try {
    relative = decodeURIComponent(relative);
  } catch {
    throw new HttpError(404, 'errors.notFound');
  }
  const file = path.resolve(root, `.${path.posix.normalize(`/${relative}`)}`);
  if (!file.startsWith(root + path.sep)) throw new HttpError(404, 'errors.notFound');
  let data;
  try {
    data = await readFile(file);
  } catch {
    throw new HttpError(404, 'errors.notFound');
  }
  ctx.send(200, data, {
    'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=300',
  });
}

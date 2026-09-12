import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, ValidationError, createContext, createRouter, readBody, serveStatic } from './lib/http.js';
import { sessionMiddleware } from './auth.js';
import { localeMiddleware } from './i18n/index.js';
import { ensureAdmin } from './services/users.js';
import { errorPage } from './views/public.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCustomerRoutes } from './routes/customer.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerTechRoutes } from './routes/tech.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const STATIC_PATH = /\.[A-Za-z0-9]+$/;

export function loadConfig(env = process.env) {
  // On Vercel the filesystem is read-only except /tmp, requests are always
  // HTTPS, and demo data is seeded unless SEED_DEMO=0.
  const onVercel = Boolean(env.VERCEL);
  return {
    appName: env.APP_NAME || 'HomeFix',
    currency: env.CURRENCY || 'USD',
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    databaseFile: env.DATABASE_FILE || (onVercel ? '/tmp/homefix.db' : 'data/homefix.db'),
    secureCookies: env.COOKIE_SECURE === '1' || (onVercel && env.COOKIE_SECURE !== '0'),
    demoMode: env.SEED_DEMO !== undefined ? env.SEED_DEMO === '1' : onVercel,
    adminEmail: env.ADMIN_EMAIL || 'admin@homefix.test',
    adminPassword: env.ADMIN_PASSWORD || 'admin123',
    adminName: env.ADMIN_NAME || 'Site Admin',
    logRequests: env.LOG_REQUESTS !== '0',
    defaultLocale: env.DEFAULT_LOCALE || 'en',
  };
}

function renderError(ctx, error, log) {
  let status = 500;
  if (error instanceof HttpError) status = error.status;
  else if (error instanceof ValidationError) status = 400;
  if (status >= 500) log.error(error);
  if (ctx.res.headersSent) {
    ctx.res.end();
    return;
  }
  let message;
  if (status >= 500) message = ctx.t('errors.unexpected');
  else if (error instanceof HttpError) message = ctx.t(error.key, error.params);
  else if (error instanceof ValidationError) message = ctx.t('errors.validationGeneric');
  else message = error.message;
  try {
    ctx.html(errorPage(ctx, { status, message }), status);
  } catch (renderFailure) {
    log.error(renderFailure);
    ctx.send(status, message, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

export function createApp({ db, config, log = console }) {
  const admin = ensureAdmin(db, config);
  if (admin.created) {
    log.warn(`Created the initial admin account ${config.adminEmail}. Set ADMIN_PASSWORD (or change the password) before going live.`);
  }

  const router = createRouter();
  router.use(sessionMiddleware());
  router.use(localeMiddleware());
  registerAuthRoutes(router);
  registerCustomerRoutes(router);
  registerAdminRoutes(router);
  registerTechRoutes(router);

  async function handle(req, res) {
    const startedAt = process.hrtime.bigint();
    const ctx = createContext(req, res, { db, config });
    if (config.logRequests) {
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
        log.info(`${req.method} ${ctx.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
      });
    }
    try {
      if (ctx.method === 'GET' && STATIC_PATH.test(ctx.path)) {
        try {
          await serveStatic(ctx, PUBLIC_DIR, '/');
          return;
        } catch (error) {
          if (!(error instanceof HttpError && error.status === 404)) throw error;
          // Not a static asset: fall through to the router.
        }
      }
      if (ctx.method === 'POST') ctx.body = await readBody(req);
      await router.dispatch(ctx);
      if (!res.writableEnded) throw new HttpError(404, 'errors.notFound');
    } catch (error) {
      renderError(ctx, error, log);
    }
  }

  return { handle, db, config };
}

export function createServer(options) {
  const app = createApp(options);
  return http.createServer(app.handle);
}

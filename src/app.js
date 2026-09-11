import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError, ValidationError, createContext, createRouter, readBody, serveStatic } from './lib/http.js';
import { sessionMiddleware } from './auth.js';
import { ensureAdmin } from './services/users.js';
import { errorPage } from './views/public.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCustomerRoutes } from './routes/customer.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerTechRoutes } from './routes/tech.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');

export function loadConfig(env = process.env) {
  return {
    appName: env.APP_NAME || 'HomeFix',
    currency: env.CURRENCY || 'USD',
    port: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    databaseFile: env.DATABASE_FILE || 'data/homefix.db',
    secureCookies: env.COOKIE_SECURE === '1',
    adminEmail: env.ADMIN_EMAIL || 'admin@homefix.test',
    adminPassword: env.ADMIN_PASSWORD || 'admin123',
    adminName: env.ADMIN_NAME || 'Site Admin',
    logRequests: env.LOG_REQUESTS !== '0',
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
  const message = status >= 500 ? 'An unexpected error occurred. Please try again in a moment.' : error.message;
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
      if (ctx.path.startsWith('/public/')) {
        await serveStatic(ctx, PUBLIC_DIR, '/public/');
        return;
      }
      if (ctx.method === 'POST') ctx.body = await readBody(req);
      await router.dispatch(ctx);
      if (!res.writableEnded) throw new HttpError(404, 'We could not find that page.');
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

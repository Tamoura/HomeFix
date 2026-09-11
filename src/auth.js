import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './lib/http.js';

export const SESSION_COOKIE = 'hf_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SCRYPT_COST = 16384;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N: SCRYPT_COST, r: 8, p: 1 });
  return `scrypt:${SCRYPT_COST}:${salt.toString('base64')}:${key.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, cost, saltB64, keyB64] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const actual = scryptSync(password, salt, expected.length, { N: Number(cost) || SCRYPT_COST, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const csrf = randomBytes(24).toString('base64url');
  const createdAt = Date.now();
  db.prepare('INSERT INTO sessions (token, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    token,
    userId,
    csrf,
    new Date(createdAt).toISOString(),
    new Date(createdAt + SESSION_TTL_MS).toISOString(),
  );
  return { token, csrf };
}

export function destroySession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function purgeExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
}

export function loadSession(db, token) {
  const row = db
    .prepare(
      `SELECT s.token, s.csrf, s.expires_at,
              u.id, u.name, u.email, u.phone, u.role, u.specialty, u.status
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`,
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now() || row.status === 'disabled') {
    destroySession(db, token);
    return null;
  }
  return {
    session: { token: row.token, csrf: row.csrf },
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      specialty: row.specialty,
      status: row.status,
    },
  };
}

export function signIn(ctx, userId) {
  const session = createSession(ctx.db, userId);
  ctx.setCookie(SESSION_COOKIE, session.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: ctx.config.secureCookies,
    maxAge: SESSION_TTL_MS / 1000,
  });
  return session;
}

export function signOut(ctx) {
  if (ctx.session) destroySession(ctx.db, ctx.session.token);
  ctx.clearCookie(SESSION_COOKIE, { path: '/' });
  ctx.user = null;
  ctx.session = null;
}

export function sessionMiddleware() {
  return async (ctx) => {
    const token = ctx.cookies[SESSION_COOKIE];
    if (token) {
      const loaded = loadSession(ctx.db, token);
      if (loaded) {
        ctx.user = loaded.user;
        ctx.session = loaded.session;
      } else {
        ctx.clearCookie(SESSION_COOKIE, { path: '/' });
      }
    }
    if (ctx.method === 'POST' && ctx.session) {
      const provided = ctx.body && typeof ctx.body._csrf === 'string' ? ctx.body._csrf : '';
      if (!provided || !safeEqual(provided, ctx.session.csrf)) {
        throw new HttpError(403, 'Your form session expired or the security token was missing. Please reload the page and try again.');
      }
    }
  };
}

export function homePathFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'technician') return '/tech';
  return '/requests';
}

// Only allow redirects to local paths.
export function safeNextPath(value, fallback) {
  const next = String(value || '');
  if (next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next;
  return fallback;
}

export function requireAuth(ctx) {
  if (ctx.user) return;
  ctx.flash('info', 'Please sign in to continue.');
  ctx.redirect(`/login?next=${encodeURIComponent(ctx.path)}`);
}

export function requireRole(...roles) {
  return (ctx) => {
    requireAuth(ctx);
    if (ctx.res.writableEnded) return;
    if (!roles.includes(ctx.user.role)) {
      throw new HttpError(403, 'Your account does not have access to that page.');
    }
  };
}

import { hashPassword, verifyPassword } from '../auth.js';
import { HttpError, ValidationError } from '../lib/http.js';
import { now } from '../db.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_ROLES = new Set(['customer', 'technician']);

const USER_COLUMNS = 'id, name, email, phone, role, specialty, status, created_at';

export function getUser(db, id) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) ?? null;
}

export function findUserByEmail(db, email) {
  return db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`).get(String(email || '').trim()) ?? null;
}

function validateAccount(input, { requirePassword = true } = {}) {
  const errors = {};
  const values = {
    name: String(input.name || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    phone: String(input.phone || '').trim(),
    specialty: String(input.specialty || '').trim(),
  };
  if (values.name.length < 2 || values.name.length > 80) errors.name = 'Enter your full name (2–80 characters).';
  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 160) errors.email = 'Enter a valid email address.';
  if (values.phone.length > 40) errors.phone = 'Phone number is too long.';
  if (values.specialty.length > 80) errors.specialty = 'Specialty is too long.';
  if (requirePassword) {
    const password = String(input.password || '');
    if (password.length < 8 || password.length > 200) errors.password = 'Use a password of at least 8 characters.';
    if (input.password_confirm !== undefined && input.password_confirm !== password) {
      errors.password_confirm = 'Passwords do not match.';
    }
  }
  return { values, errors };
}

export function registerUser(db, input) {
  const { values, errors } = validateAccount(input);
  const role = String(input.role || 'customer');
  if (!PUBLIC_ROLES.has(role)) errors.role = 'Choose whether you are a customer or a technician.';
  if (role === 'technician' && !values.specialty) errors.specialty = 'Tell us your specialty (for example Plumbing).';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  if (findUserByEmail(db, values.email)) throw new ValidationError({ email: 'An account with this email already exists.' });

  const status = role === 'technician' ? 'pending' : 'active';
  const result = db
    .prepare(
      'INSERT INTO users (name, email, phone, password_hash, role, specialty, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(values.name, values.email, values.phone, hashPassword(String(input.password)), role, role === 'technician' ? values.specialty : '', status, now());
  return getUser(db, result.lastInsertRowid);
}

export function createUserByAdmin(db, input) {
  const { values, errors } = validateAccount(input);
  const role = input.role === 'admin' ? 'admin' : 'technician';
  if (role === 'technician' && !values.specialty) errors.specialty = 'Enter the technician specialty.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  if (findUserByEmail(db, values.email)) throw new ValidationError({ email: 'An account with this email already exists.' });
  const result = db
    .prepare(
      'INSERT INTO users (name, email, phone, password_hash, role, specialty, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(values.name, values.email, values.phone, hashPassword(String(input.password)), role, values.specialty, 'active', now());
  return getUser(db, result.lastInsertRowid);
}

export function authenticate(db, email, password) {
  const row = db.prepare(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`).get(String(email || '').trim());
  if (!row || !verifyPassword(String(password || ''), row.password_hash)) return { error: 'Incorrect email or password.' };
  if (row.status === 'disabled') return { error: 'This account has been deactivated. Please contact support.' };
  const { password_hash: _hash, ...user } = row;
  return { user };
}

export function setUserStatus(db, id, status) {
  if (!['active', 'disabled'].includes(status)) throw new HttpError(400, 'Unknown account status.');
  const user = getUser(db, id);
  if (!user) throw new HttpError(404, 'User not found.');
  if (user.role === 'admin') throw new HttpError(409, 'Admin accounts cannot be changed here.');
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  if (status === 'disabled') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  return getUser(db, id);
}

export function listTechnicians(db) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.specialty, u.status, u.created_at,
              (SELECT COUNT(*) FROM offers o WHERE o.technician_id = u.id) AS offers_count,
              (SELECT COUNT(*) FROM requests r WHERE r.technician_id = u.id AND r.status IN ('in_progress', 'completed')) AS active_jobs,
              (SELECT COUNT(*) FROM requests r WHERE r.technician_id = u.id AND r.status = 'closed') AS closed_jobs,
              (SELECT AVG(r.rating) FROM requests r WHERE r.technician_id = u.id AND r.rating IS NOT NULL) AS avg_rating
         FROM users u
        WHERE u.role = 'technician'
        ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.name COLLATE NOCASE`,
    )
    .all();
}

export function listCustomers(db) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              (SELECT COUNT(*) FROM requests r WHERE r.customer_id = u.id) AS requests_count,
              (SELECT COUNT(*) FROM requests r WHERE r.customer_id = u.id AND r.status NOT IN ('closed', 'cancelled')) AS open_requests
         FROM users u
        WHERE u.role = 'customer'
        ORDER BY u.created_at DESC`,
    )
    .all();
}

export function ensureAdmin(db, { adminEmail, adminPassword, adminName }) {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return { created: false };
  db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role, specialty, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(adminName, adminEmail.toLowerCase(), '', hashPassword(adminPassword), 'admin', '', 'active', now());
  return { created: true };
}

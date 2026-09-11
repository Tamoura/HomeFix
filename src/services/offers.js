import { HttpError, ValidationError } from '../lib/http.js';
import { now, transaction } from '../db.js';
import { STATUS, can } from '../workflow.js';
import { addEvent } from './requests.js';

const MAX_AMOUNT = 10_000_000;

const OFFER_SELECT = `
  SELECT o.*, u.name AS technician_name, u.specialty AS technician_specialty, u.phone AS technician_phone,
         u.email AS technician_email, u.status AS technician_status,
         (SELECT AVG(r.rating) FROM requests r WHERE r.technician_id = u.id AND r.rating IS NOT NULL) AS technician_rating,
         (SELECT COUNT(*) FROM requests r WHERE r.technician_id = u.id AND r.status = 'closed') AS technician_jobs
    FROM offers o
    JOIN users u ON u.id = o.technician_id`;

export function listOffersForRequest(db, requestId) {
  return db
    .prepare(
      `${OFFER_SELECT}
        WHERE o.request_id = ?
        ORDER BY CASE o.status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, o.amount_cents ASC, o.id ASC`,
    )
    .all(requestId);
}

export function getTechnicianOffer(db, requestId, technicianId) {
  return db.prepare(`${OFFER_SELECT} WHERE o.request_id = ? AND o.technician_id = ?`).get(requestId, technicianId) ?? null;
}

export function parseAmount(value) {
  const cleaned = String(value ?? '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!(amount > 0) || amount > MAX_AMOUNT) return null;
  return Math.round(amount * 100);
}

export function submitOffer(db, request, technician, input, currency) {
  if (!can.submitOffer(request)) throw new HttpError(409, 'errors.notOpenForOffers');
  const amountCents = parseAmount(input.amount);
  const duration = String(input.duration || '').trim();
  const note = String(input.note || '').trim();
  const errors = {};
  if (amountCents === null) errors.amount = 'errors.validation.amount';
  if (duration.length < 1 || duration.length > 60) errors.duration = 'errors.validation.duration';
  if (note.length > 2000) errors.note = 'errors.validation.note';
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const existing = getTechnicianOffer(db, request.id, technician.id);
  const timestamp = now();
  return transaction(db, () => {
    if (existing) {
      db.prepare("UPDATE offers SET amount_cents = ?, duration = ?, note = ?, status = 'pending', updated_at = ? WHERE id = ?").run(
        amountCents,
        duration,
        note,
        timestamp,
        existing.id,
      );
      const verb = existing.status === 'withdrawn' ? 'submitted' : 'updated';
      addEvent(db, request.id, technician.id, `offer_${verb}`, { actor: technician.name, amountCents, duration, currency });
      return existing.id;
    }
    const result = db
      .prepare(
        "INSERT INTO offers (request_id, technician_id, amount_cents, duration, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
      )
      .run(request.id, technician.id, amountCents, duration, note, timestamp, timestamp);
    addEvent(db, request.id, technician.id, 'offer_submitted', { actor: technician.name, amountCents, duration, currency });
    return Number(result.lastInsertRowid);
  });
}

export function withdrawOffer(db, request, technician) {
  const existing = getTechnicianOffer(db, request.id, technician.id);
  if (!existing || existing.status !== 'pending') throw new HttpError(409, 'errors.noPendingOffer');
  transaction(db, () => {
    db.prepare("UPDATE offers SET status = 'withdrawn', updated_at = ? WHERE id = ?").run(now(), existing.id);
    addEvent(db, request.id, technician.id, 'offer_withdrawn', { actor: technician.name });
  });
}

// Requests a technician may open: anything open for offers, anything assigned
// to them, and anything they have offered on (so they can see the outcome).
export function technicianCanView(db, request, technicianId) {
  if (request.status === STATUS.OPEN_FOR_OFFERS) return true;
  if (request.technician_id === technicianId) return true;
  return Boolean(getTechnicianOffer(db, request.id, technicianId));
}

export function listOpenRequestsForTechnician(db, technicianId) {
  return db
    .prepare(
      `SELECT r.id, r.title, r.category, r.address, r.urgency, r.status, r.assessment, r.assessment_at, r.preferred_date, r.updated_at,
              o.id AS my_offer_id, o.status AS my_offer_status, o.amount_cents AS my_offer_amount_cents,
              (SELECT COUNT(*) FROM offers x WHERE x.request_id = r.id AND x.status = 'pending') AS pending_offers
         FROM requests r
         LEFT JOIN offers o ON o.request_id = r.id AND o.technician_id = ?
        WHERE r.status = 'open_for_offers'
        ORDER BY CASE r.urgency WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, r.assessment_at ASC`,
    )
    .all(technicianId);
}

export function listJobsForTechnician(db, technicianId) {
  return db
    .prepare(
      `SELECT r.id, r.title, r.category, r.address, r.status, r.urgency, r.updated_at, r.completed_at, r.rating,
              c.name AS customer_name, c.phone AS customer_phone,
              o.amount_cents AS accepted_amount_cents, o.duration AS accepted_duration
         FROM requests r
         JOIN users c ON c.id = r.customer_id
         LEFT JOIN offers o ON o.id = r.accepted_offer_id
        WHERE r.technician_id = ?
        ORDER BY CASE r.status WHEN 'in_progress' THEN 0 WHEN 'completed' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END, r.updated_at DESC`,
    )
    .all(technicianId);
}

export function listOffersByTechnician(db, technicianId) {
  return db
    .prepare(
      `SELECT o.id, o.amount_cents, o.duration, o.status, o.updated_at,
              r.id AS request_id, r.title AS request_title, r.category, r.status AS request_status
         FROM offers o
         JOIN requests r ON r.id = o.request_id
        WHERE o.technician_id = ?
        ORDER BY o.updated_at DESC`,
    )
    .all(technicianId);
}

export function technicianStats(db, technicianId) {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM requests WHERE status = 'open_for_offers') AS open_requests,
         (SELECT COUNT(*) FROM offers WHERE technician_id = ? AND status = 'pending') AS pending_offers,
         (SELECT COUNT(*) FROM requests WHERE technician_id = ? AND status IN ('in_progress', 'completed')) AS active_jobs,
         (SELECT COUNT(*) FROM requests WHERE technician_id = ? AND status = 'closed') AS closed_jobs,
         (SELECT AVG(rating) FROM requests WHERE technician_id = ? AND rating IS NOT NULL) AS avg_rating`,
    )
    .get(technicianId, technicianId, technicianId, technicianId);
}

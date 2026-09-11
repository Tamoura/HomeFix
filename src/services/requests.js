import { HttpError, ValidationError } from '../lib/http.js';
import { now, transaction } from '../db.js';
import { CATEGORIES, STATUS, URGENCY_LEVELS, can, statusLabel } from '../workflow.js';
import { formatLocalDateTime, formatMoney } from '../lib/format.js';

const REQUEST_SELECT = `
  SELECT r.*,
         c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
         t.name AS technician_name, t.phone AS technician_phone, t.email AS technician_email, t.specialty AS technician_specialty,
         o.amount_cents AS accepted_amount_cents, o.duration AS accepted_duration
    FROM requests r
    JOIN users c ON c.id = r.customer_id
    LEFT JOIN users t ON t.id = r.technician_id
    LEFT JOIN offers o ON o.id = r.accepted_offer_id`;

export function addEvent(db, requestId, actorId, type, message) {
  db.prepare('INSERT INTO request_events (request_id, actor_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)').run(
    requestId,
    actorId ?? null,
    type,
    message,
    now(),
  );
}

export function listEvents(db, requestId) {
  return db
    .prepare(
      `SELECT e.*, u.name AS actor_name, u.role AS actor_role
         FROM request_events e
         LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.request_id = ?
        ORDER BY e.id ASC`,
    )
    .all(requestId);
}

export function getRequest(db, id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(numericId) ?? null;
}

export function getRequestOr404(db, id) {
  const request = getRequest(db, id);
  if (!request) throw new HttpError(404, 'We could not find that maintenance request.');
  return request;
}

export function getCustomerRequest(db, id, customerId) {
  const request = getRequest(db, id);
  if (!request || request.customer_id !== customerId) {
    throw new HttpError(404, 'We could not find that maintenance request.');
  }
  return request;
}

export function listRequests(db, { customerId, technicianId, status, query, limit = 200 } = {}) {
  const conditions = [];
  const params = [];
  if (customerId) {
    conditions.push('r.customer_id = ?');
    params.push(customerId);
  }
  if (technicianId) {
    conditions.push('r.technician_id = ?');
    params.push(technicianId);
  }
  if (status && status !== 'all') {
    if (status === 'active') conditions.push("r.status NOT IN ('closed', 'cancelled')");
    else {
      conditions.push('r.status = ?');
      params.push(status);
    }
  }
  if (query) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ? OR r.address LIKE ? OR c.name LIKE ? OR r.category LIKE ?)');
    const like = `%${query}%`;
    params.push(like, like, like, like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`${REQUEST_SELECT} ${where} ORDER BY r.updated_at DESC, r.id DESC LIMIT ?`).all(...params, limit);
}

export function countByStatus(db, { customerId } = {}) {
  const rows = customerId
    ? db.prepare('SELECT status, COUNT(*) AS count FROM requests WHERE customer_id = ? GROUP BY status').all(customerId)
    : db.prepare('SELECT status, COUNT(*) AS count FROM requests GROUP BY status').all();
  const counts = Object.fromEntries(Object.values(STATUS).map((status) => [status, 0]));
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.count;
    total += row.count;
  }
  counts.all = total;
  counts.active = total - counts.closed - counts.cancelled;
  return counts;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function validateRequestInput(input) {
  const values = {
    category: String(input.category || '').trim(),
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    address: String(input.address || '').trim(),
    preferred_date: String(input.preferred_date || '').trim(),
    urgency: String(input.urgency || 'normal').trim(),
  };
  const errors = {};
  if (!CATEGORIES.includes(values.category)) errors.category = 'Choose a service category.';
  if (values.title.length < 5 || values.title.length > 120) errors.title = 'Give the request a short title (5–120 characters).';
  if (values.description.length < 10 || values.description.length > 4000) {
    errors.description = 'Describe the problem in at least 10 characters.';
  }
  if (values.address.length < 5 || values.address.length > 300) errors.address = 'Enter the full address of the property.';
  if (values.preferred_date) {
    if (!isValidDate(values.preferred_date)) errors.preferred_date = 'Enter a valid date.';
    else if (values.preferred_date < todayIso()) errors.preferred_date = 'The preferred date cannot be in the past.';
  }
  if (!URGENCY_LEVELS[values.urgency]) errors.urgency = 'Choose an urgency level.';
  return { values, errors };
}

export function createRequest(db, customer, input) {
  const { values, errors } = validateRequestInput(input);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  const timestamp = now();
  return transaction(db, () => {
    const result = db
      .prepare(
        `INSERT INTO requests (customer_id, category, title, description, address, preferred_date, urgency, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        customer.id,
        values.category,
        values.title,
        values.description,
        values.address,
        values.preferred_date || null,
        values.urgency,
        STATUS.SUBMITTED,
        timestamp,
        timestamp,
      );
    const id = Number(result.lastInsertRowid);
    const category = values.category.toLowerCase();
    addEvent(db, id, customer.id, 'created', `${customer.name} submitted ${/^[aeiou]/.test(category) ? 'an' : 'a'} ${category} request.`);
    return id;
  });
}

function transitionError(request, action) {
  return new HttpError(409, `You can't ${action} while the request is "${statusLabel(request.status)}".`);
}

function updateRequest(db, id, fields) {
  const keys = Object.keys(fields);
  const assignments = keys.map((key) => `${key} = ?`).join(', ');
  db.prepare(`UPDATE requests SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...keys.map((key) => fields[key] ?? null),
    now(),
    id,
  );
}

export function scheduleVisit(db, request, admin, input) {
  if (!can.scheduleVisit(request)) throw transitionError(request, 'schedule an inspection visit');
  const visitAt = String(input.visit_at || '').trim();
  const note = String(input.visit_note || '').trim();
  const errors = {};
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(visitAt) || Number.isNaN(new Date(visitAt).getTime())) {
    errors.visit_at = 'Enter the visit date and time.';
  }
  if (note.length > 1000) errors.visit_note = 'The note is too long.';
  if (Object.keys(errors).length) throw new ValidationError(errors);

  const rescheduling = request.status === STATUS.VISIT_SCHEDULED;
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.VISIT_SCHEDULED, visit_at: visitAt, visit_note: note || null });
    addEvent(
      db,
      request.id,
      admin.id,
      rescheduling ? 'visit_rescheduled' : 'visit_scheduled',
      `${admin.name} ${rescheduling ? 'rescheduled' : 'scheduled'} the inspection visit for ${formatLocalDateTime(visitAt)}.${note ? ` Note: ${note}` : ''}`,
    );
  });
}

export function completeVisit(db, request, admin, input) {
  if (!can.completeVisit(request)) throw transitionError(request, 'record the inspection findings');
  const assessment = String(input.assessment || '').trim();
  if (assessment.length < 10 || assessment.length > 4000) {
    throw new ValidationError({ assessment: 'Describe the findings and the scope of work (at least 10 characters).' });
  }
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.OPEN_FOR_OFFERS, assessment, assessment_at: now() });
    addEvent(
      db,
      request.id,
      admin.id,
      'visit_completed',
      `${admin.name} completed the inspection visit and opened the request for technician offers.`,
    );
  });
}

export function cancelRequest(db, request, actor, input = {}) {
  const allowed = actor.role === 'admin' ? can.adminCancel(request) : actor.id === request.customer_id && can.customerCancel(request);
  if (!allowed) throw transitionError(request, 'cancel this request');
  const reason = String(input.reason || '').trim();
  if (reason.length > 500) throw new ValidationError({ reason: 'The reason is too long.' });
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.CANCELLED, cancel_reason: reason || null });
    db.prepare("UPDATE offers SET status = 'rejected', updated_at = ? WHERE request_id = ? AND status = 'pending'").run(now(), request.id);
    addEvent(db, request.id, actor.id, 'cancelled', `${actor.name} cancelled the request.${reason ? ` Reason: ${reason}` : ''}`);
  });
}

export function acceptOffer(db, request, customer, offerId, currency) {
  if (!can.acceptOffer(request)) throw transitionError(request, 'accept an offer');
  const offer = db
    .prepare('SELECT o.*, u.name AS technician_name, u.status AS technician_status FROM offers o JOIN users u ON u.id = o.technician_id WHERE o.id = ? AND o.request_id = ?')
    .get(Number(offerId), request.id);
  if (!offer) throw new HttpError(404, 'That offer does not exist.');
  if (offer.status !== 'pending') throw new HttpError(409, 'That offer is no longer available.');
  if (offer.technician_status !== 'active') throw new HttpError(409, 'That technician is no longer available.');
  transaction(db, () => {
    const timestamp = now();
    db.prepare("UPDATE offers SET status = 'accepted', updated_at = ? WHERE id = ?").run(timestamp, offer.id);
    db.prepare("UPDATE offers SET status = 'rejected', updated_at = ? WHERE request_id = ? AND id <> ? AND status = 'pending'").run(
      timestamp,
      request.id,
      offer.id,
    );
    updateRequest(db, request.id, {
      status: STATUS.IN_PROGRESS,
      accepted_offer_id: offer.id,
      technician_id: offer.technician_id,
    });
    addEvent(
      db,
      request.id,
      customer.id,
      'offer_accepted',
      `${customer.name} accepted ${offer.technician_name}'s offer of ${formatMoney(offer.amount_cents, currency)}. Work assigned.`,
    );
  });
  return offer;
}

export function completeWork(db, request, technician, input = {}) {
  if (!can.completeWork(request, technician)) throw transitionError(request, 'mark the work as completed');
  const note = String(input.completion_note || '').trim();
  if (note.length > 2000) throw new ValidationError({ completion_note: 'The note is too long.' });
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.COMPLETED, completed_at: now(), completion_note: note || null });
    addEvent(
      db,
      request.id,
      technician.id,
      'work_completed',
      `${technician.name} marked the work as completed.${note ? ` Note: ${note}` : ''}`,
    );
  });
}

export function confirmCompletion(db, request, customer, input = {}) {
  if (!can.confirmCompletion(request)) throw transitionError(request, 'confirm the completion');
  const rating = Number(input.rating);
  const review = String(input.review || '').trim();
  const errors = {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Rate the service from 1 to 5 stars.';
  if (review.length > 2000) errors.review = 'The review is too long.';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.CLOSED, closed_at: now(), rating, review: review || null });
    addEvent(
      db,
      request.id,
      customer.id,
      'closed',
      `${customer.name} confirmed the work and rated it ${rating}/5.${review ? ` Review: ${review}` : ''}`,
    );
  });
}

export function requestRework(db, request, customer, input = {}) {
  if (!can.requestRework(request)) throw transitionError(request, 'report a problem');
  const note = String(input.rework_note || '').trim();
  if (note.length < 5 || note.length > 2000) {
    throw new ValidationError({ rework_note: 'Describe what still needs attention (at least 5 characters).' });
  }
  transaction(db, () => {
    updateRequest(db, request.id, { status: STATUS.IN_PROGRESS, completed_at: null });
    addEvent(db, request.id, customer.id, 'rework_requested', `${customer.name} reported that the work is not finished: ${note}`);
  });
}

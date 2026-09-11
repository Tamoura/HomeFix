import { html, multiline } from '../lib/html.js';
import { formatDate, formatDateTime, formatLocalDateTime, formatMoney } from '../lib/format.js';
import { OFFER_STATUS_META, STATUS, STATUS_META, STEPS, URGENCY_LEVELS, stepIndex, statusLabel } from '../workflow.js';

export function csrfField(ctx) {
  return html`<input type="hidden" name="_csrf" value="${ctx.session?.csrf ?? ''}">`;
}

export function badge(label, tone = 'neutral') {
  return html`<span class="badge badge-${tone}">${label}</span>`;
}

export function statusBadge(status) {
  const meta = STATUS_META[status] ?? { label: status, tone: 'neutral' };
  return badge(meta.label, meta.tone);
}

export function urgencyBadge(urgency) {
  const meta = URGENCY_LEVELS[urgency] ?? { label: urgency, tone: 'neutral' };
  return badge(meta.label, meta.tone);
}

export function offerStatusBadge(status) {
  const meta = OFFER_STATUS_META[status] ?? { label: status, tone: 'neutral' };
  return badge(meta.label, meta.tone);
}

export function timeTag(iso) {
  if (!iso) return html`<span class="muted">—</span>`;
  return html`<time datetime="${iso}" data-local>${formatDateTime(iso)}</time>`;
}

export function money(cents, ctx) {
  return html`<span class="money">${formatMoney(cents, ctx.config.currency)}</span>`;
}

export function stars(rating) {
  if (rating === null || rating === undefined) return html`<span class="muted">Not rated yet</span>`;
  const value = Math.round(Number(rating));
  const filled = '★'.repeat(Math.max(0, Math.min(5, value)));
  const empty = '☆'.repeat(5 - filled.length);
  return html`<span class="stars" aria-label="${Number(rating).toFixed(1)} out of 5">${filled}${empty}</span> <span class="muted">${Number(rating).toFixed(1)}</span>`;
}

export function errorSummary(errors) {
  const messages = Object.values(errors || {});
  if (!messages.length) return '';
  return html`<div class="flash flash-error" role="alert"><strong>Please fix the following:</strong><ul>${messages.map((m) => html`<li>${m}</li>`)}</ul></div>`;
}

export function field({ label, name, type = 'text', value = '', required = false, error, hint, options, rows = 4, placeholder = '', min, max, step, autocomplete, autofocus = false }) {
  const id = `field-${name}`;
  let control;
  if (type === 'textarea') {
    control = html`<textarea id="${id}" name="${name}" rows="${rows}" placeholder="${placeholder}"${required ? ' required' : ''}>${value}</textarea>`;
  } else if (type === 'select') {
    control = html`<select id="${id}" name="${name}"${required ? ' required' : ''}>
      ${options.map((option) => html`<option value="${option.value}"${String(option.value) === String(value) ? ' selected' : ''}>${option.label}</option>`)}
    </select>`;
  } else {
    control = html`<input id="${id}" type="${type}" name="${name}" value="${value}" placeholder="${placeholder}"${required ? ' required' : ''}${min !== undefined ? html` min="${min}"` : ''}${max !== undefined ? html` max="${max}"` : ''}${step !== undefined ? html` step="${step}"` : ''}${autocomplete ? html` autocomplete="${autocomplete}"` : ''}${autofocus ? ' autofocus' : ''}>`;
  }
  return html`<div class="field${error ? ' has-error' : ''}">
    <label for="${id}">${label}${required ? html` <span class="req" aria-hidden="true">*</span>` : ''}</label>
    ${control}
    ${error ? html`<p class="field-error">${error}</p>` : hint ? html`<p class="field-hint">${hint}</p>` : ''}
  </div>`;
}

export function progressSteps(request) {
  if (request.status === STATUS.CANCELLED) {
    return html`<div class="steps steps-cancelled" aria-label="Progress">
      <div class="step step-cancelled"><span class="step-dot">✕</span><span class="step-label">Cancelled</span></div>
    </div>`;
  }
  const current = stepIndex(request.status);
  return html`<ol class="steps" aria-label="Progress">
    ${STEPS.map((step, index) => {
      const state = index < current || request.status === STATUS.CLOSED ? 'done' : index === current ? 'current' : 'todo';
      return html`<li class="step step-${state}"${state === 'current' ? ' aria-current="step"' : ''}>
        <span class="step-dot">${state === 'done' ? '✓' : index + 1}</span>
        <span class="step-label">${step.label}</span>
      </li>`;
    })}
  </ol>`;
}

export function timeline(events) {
  if (!events.length) return html`<p class="muted">No activity yet.</p>`;
  return html`<ol class="timeline">
    ${events.map(
      (event) => html`<li class="timeline-item timeline-${event.type}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-body">
          <p>${event.message}</p>
          <p class="timeline-meta">${event.actor_name ? html`${event.actor_name} · ` : ''}${timeTag(event.created_at)}</p>
        </div>
      </li>`,
    )}
  </ol>`;
}

export function statTile({ label, value, href, tone = 'neutral' }) {
  const inner = html`<span class="stat-value">${value}</span><span class="stat-label">${label}</span>`;
  return href
    ? html`<a class="stat stat-${tone}" href="${href}">${inner}</a>`
    : html`<div class="stat stat-${tone}">${inner}</div>`;
}

export function emptyState({ title, text, action }) {
  return html`<div class="empty">
    <h3>${title}</h3>
    ${text ? html`<p>${text}</p>` : ''}
    ${action ? html`<p>${action}</p>` : ''}
  </div>`;
}

export function statusNote(request, audience) {
  const meta = STATUS_META[request.status];
  if (!meta) return '';
  return html`<p class="status-note status-${meta.tone}">${meta[audience] ?? meta.customer}</p>`;
}

export function requestDetails(request, { showCustomer = false, showContact = false } = {}) {
  return html`<dl class="details">
    <div><dt>Category</dt><dd>${request.category}</dd></div>
    <div><dt>Urgency</dt><dd>${urgencyBadge(request.urgency)} <span class="muted">${URGENCY_LEVELS[request.urgency]?.hint ?? ''}</span></dd></div>
    <div><dt>Address</dt><dd>${request.address}</dd></div>
    <div><dt>Preferred date</dt><dd>${request.preferred_date ? formatDate(request.preferred_date) : html`<span class="muted">Flexible</span>`}</dd></div>
    ${showCustomer ? html`<div><dt>Customer</dt><dd>${request.customer_name}${showContact ? html`<br><span class="muted">${request.customer_phone || 'no phone'} · ${request.customer_email}</span>` : ''}</dd></div>` : ''}
    <div><dt>Submitted</dt><dd>${timeTag(request.created_at)}</dd></div>
    <div class="details-wide"><dt>Description</dt><dd>${multiline(request.description)}</dd></div>
  </dl>`;
}

export function visitCard(request) {
  if (!request.visit_at && !request.assessment) return '';
  return html`<section class="card">
    <h2>Inspection visit</h2>
    ${request.visit_at ? html`<p><strong>Scheduled for:</strong> ${formatLocalDateTime(request.visit_at)}</p>` : ''}
    ${request.visit_note ? html`<p class="muted">${multiline(request.visit_note)}</p>` : ''}
    ${request.assessment
      ? html`<h3 class="h-sub">Findings & scope of work</h3>
        <p>${multiline(request.assessment)}</p>
        <p class="muted">Recorded ${timeTag(request.assessment_at)}</p>`
      : ''}
  </section>`;
}

export function offerCard(offer, ctx, { actions = '', showContact = false } = {}) {
  return html`<article class="offer offer-${offer.status}">
    <div class="offer-head">
      <div>
        <strong>${offer.technician_name}</strong>
        <span class="muted"> · ${offer.technician_specialty || 'Technician'}</span>
        <div class="muted small">${stars(offer.technician_rating)} · ${offer.technician_jobs} completed job${offer.technician_jobs === 1 ? '' : 's'}</div>
      </div>
      <div class="offer-price">${money(offer.amount_cents, ctx)}<span class="muted small">${offer.duration}</span></div>
    </div>
    ${offer.note ? html`<p class="offer-note">${multiline(offer.note)}</p>` : ''}
    <div class="offer-foot">
      <span>${offerStatusBadge(offer.status)} <span class="muted small">Updated ${timeTag(offer.updated_at)}</span></span>
      ${showContact ? html`<span class="muted small">${offer.technician_phone || ''} ${offer.technician_email}</span>` : ''}
      ${actions}
    </div>
  </article>`;
}

export function requestTable(rows, { linkBase, columns }) {
  return html`<div class="table-wrap"><table class="table">
    <thead><tr>${columns.map((column) => html`<th>${column.label}</th>`)}</tr></thead>
    <tbody>
      ${rows.map((row) => html`<tr>${columns.map((column) => html`<td data-label="${column.label}">${column.render(row, linkBase)}</td>`)}</tr>`)}
    </tbody>
  </table></div>`;
}

export function requestLink(row, linkBase) {
  return html`<a class="table-title" href="${linkBase}/${row.id}">${row.title}</a><div class="muted small">#${row.id} · ${row.category}</div>`;
}

export function statusFilterTabs(counts, activeStatus, basePath, { statuses = ['all', 'active', ...Object.values(STATUS)] } = {}) {
  return html`<nav class="tabs" aria-label="Filter by status">
    ${statuses.map((status) => {
      const label = status === 'all' ? 'All' : status === 'active' ? 'Active' : statusLabel(status);
      const count = counts[status] ?? 0;
      const href = status === 'all' ? basePath : `${basePath}?status=${status}`;
      return html`<a href="${href}" class="tab${activeStatus === status ? ' is-active' : ''}">${label} <span class="tab-count">${count}</span></a>`;
    })}
  </nav>`;
}

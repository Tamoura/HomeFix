import { html, multiline } from '../lib/html.js';
import { OFFER_STATUS_TONES, STATUS, STATUS_TONES, STEPS, URGENCY_TONES, stepIndex } from '../workflow.js';
import { eventMessage } from '../i18n/events.js';

export function csrfField(ctx) {
  return html`<input type="hidden" name="_csrf" value="${ctx.session?.csrf ?? ''}">`;
}

export function badge(label, tone = 'neutral') {
  return html`<span class="badge badge-${tone}">${label}</span>`;
}

export function statusBadge(ctx, status) {
  return badge(ctx.t(`status.${status}`), STATUS_TONES[status] ?? 'neutral');
}

export function urgencyBadge(ctx, urgency) {
  return badge(ctx.t(`urgency.${urgency}.label`), URGENCY_TONES[urgency] ?? 'neutral');
}

export function offerStatusBadge(ctx, status) {
  return badge(ctx.t(`offerStatus.${status}`), OFFER_STATUS_TONES[status] ?? 'neutral');
}

export function categoryLabel(ctx, key) {
  return ctx.t(`categories.${key}`);
}

export function ltr(value) {
  if (value === null || value === undefined || value === '') return '';
  return html`<span class="ltr">${value}</span>`;
}

export function dash() {
  return html`<span class="muted">—</span>`;
}

export function timeTag(ctx, iso) {
  if (!iso) return dash();
  return html`<time datetime="${iso}" data-local>${ctx.fmt.dateTime(iso)}</time>`;
}

export function money(ctx, cents) {
  return html`<span class="money">${ctx.fmt.money(cents)}</span>`;
}

export function stars(ctx, rating) {
  if (rating === null || rating === undefined) return html`<span class="muted">${ctx.t('common.notRatedYet')}</span>`;
  const value = Math.round(Number(rating));
  const filled = '★'.repeat(Math.max(0, Math.min(5, value)));
  const empty = '☆'.repeat(5 - filled.length);
  const shown = Number(rating).toFixed(1);
  return html`<span class="stars" aria-label="${ctx.t('common.outOf5', { rating: shown })}">${filled}${empty}</span> <span class="muted">${shown}</span>`;
}

export function errorSummary(ctx, errors) {
  const messages = Object.values(errors || {});
  if (!messages.length) return '';
  return html`<div class="flash flash-error" role="alert"><strong>${ctx.t('common.fixFollowing')}</strong><ul>${messages.map((message) => html`<li>${message}</li>`)}</ul></div>`;
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

export function progressSteps(ctx, request) {
  if (request.status === STATUS.CANCELLED) {
    return html`<div class="steps steps-cancelled" aria-label="${ctx.t('common.progress')}">
      <div class="step step-cancelled"><span class="step-dot">✕</span><span class="step-label">${ctx.t('status.cancelled')}</span></div>
    </div>`;
  }
  const current = stepIndex(request.status);
  return html`<ol class="steps" aria-label="${ctx.t('common.progress')}">
    ${STEPS.map((step, index) => {
      const state = index < current || request.status === STATUS.CLOSED ? 'done' : index === current ? 'current' : 'todo';
      return html`<li class="step step-${state}"${state === 'current' ? ' aria-current="step"' : ''}>
        <span class="step-dot">${state === 'done' ? '✓' : index + 1}</span>
        <span class="step-label">${ctx.t(`steps.${step}`)}</span>
      </li>`;
    })}
  </ol>`;
}

export function timeline(ctx, events) {
  if (!events.length) return html`<p class="muted">${ctx.t('common.noActivity')}</p>`;
  return html`<ol class="timeline">
    ${events.map(
      (event) => html`<li class="timeline-item timeline-${event.type}">
        <span class="timeline-dot" aria-hidden="true"></span>
        <div class="timeline-body">
          <p>${eventMessage(ctx.locale, event)}</p>
          <p class="timeline-meta">${event.actor_name ? html`${event.actor_name} · ` : ''}${timeTag(ctx, event.created_at)}</p>
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

export function statusNote(ctx, request, audience) {
  const tone = STATUS_TONES[request.status];
  if (!tone) return '';
  return html`<p class="status-note status-${tone}">${ctx.t(`statusNote.${audience}.${request.status}`)}</p>`;
}

export function requestDetails(ctx, request, { showCustomer = false, showContact = false } = {}) {
  const t = ctx.t;
  return html`<dl class="details">
    <div><dt>${t('fields.category')}</dt><dd>${categoryLabel(ctx, request.category)}</dd></div>
    <div><dt>${t('fields.urgency')}</dt><dd>${urgencyBadge(ctx, request.urgency)} <span class="muted">${t(`urgency.${request.urgency}.hint`)}</span></dd></div>
    <div><dt>${t('fields.address')}</dt><dd dir="auto">${request.address}</dd></div>
    <div><dt>${t('fields.preferredDate')}</dt><dd>${request.preferred_date ? ctx.fmt.date(request.preferred_date) : html`<span class="muted">${t('common.flexible')}</span>`}</dd></div>
    ${showCustomer
      ? html`<div><dt>${t('fields.customer')}</dt><dd dir="auto">${request.customer_name}${showContact ? html`<br><span class="muted">${request.customer_phone ? ltr(request.customer_phone) : t('common.noPhone')} · ${ltr(request.customer_email)}</span>` : ''}</dd></div>`
      : ''}
    <div><dt>${t('fields.submitted')}</dt><dd>${timeTag(ctx, request.created_at)}</dd></div>
    <div class="details-wide"><dt>${t('fields.description')}</dt><dd dir="auto">${multiline(request.description)}</dd></div>
  </dl>`;
}

export function visitCard(ctx, request) {
  if (!request.visit_at && !request.assessment) return '';
  const t = ctx.t;
  return html`<section class="card">
    <h2>${t('visit.title')}</h2>
    ${request.visit_at ? html`<p><strong>${t('visit.scheduledFor')}</strong> ${ctx.fmt.localDateTime(request.visit_at)}</p>` : ''}
    ${request.visit_note ? html`<p class="muted" dir="auto">${multiline(request.visit_note)}</p>` : ''}
    ${request.assessment
      ? html`<h3 class="h-sub">${t('visit.findings')}</h3>
        <p dir="auto">${multiline(request.assessment)}</p>
        <p class="muted">${t('common.recorded', { time: timeTag(ctx, request.assessment_at) })}</p>`
      : ''}
  </section>`;
}

export function offerCard(ctx, offer, { actions = '', showContact = false } = {}) {
  const t = ctx.t;
  return html`<article class="offer offer-${offer.status}">
    <div class="offer-head">
      <div>
        <strong dir="auto">${offer.technician_name}</strong>
        <span class="muted" dir="auto"> · ${offer.technician_specialty || t('common.technician')}</span>
        <div class="muted small">${stars(ctx, offer.technician_rating)} · ${t('common.completedJobs', { count: offer.technician_jobs })}</div>
      </div>
      <div class="offer-price">${money(ctx, offer.amount_cents)}<span class="muted small" dir="auto">${offer.duration}</span></div>
    </div>
    ${offer.note ? html`<p class="offer-note" dir="auto">${multiline(offer.note)}</p>` : ''}
    <div class="offer-foot">
      <span>${offerStatusBadge(ctx, offer.status)} <span class="muted small">${t('common.updated', { time: timeTag(ctx, offer.updated_at) })}</span></span>
      ${showContact ? html`<span class="muted small">${ltr(offer.technician_phone)} ${ltr(offer.technician_email)}</span>` : ''}
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

export function requestLink(ctx, row, linkBase) {
  return html`<a class="table-title" href="${linkBase}/${row.id}" dir="auto">${row.title}</a><div class="muted small">${ctx.t('common.requestRef', { id: row.id })} · ${categoryLabel(ctx, row.category)}</div>`;
}

export function statusFilterTabs(ctx, counts, activeStatus, basePath, { statuses = ['all', 'active', ...Object.values(STATUS)] } = {}) {
  return html`<nav class="tabs" aria-label="${ctx.t('common.filterByStatus')}">
    ${statuses.map((status) => {
      const label = status === 'all' ? ctx.t('common.all') : status === 'active' ? ctx.t('common.active') : ctx.t(`status.${status}`);
      const count = counts[status] ?? 0;
      const href = status === 'all' ? basePath : `${basePath}?status=${status}`;
      return html`<a href="${href}" class="tab${activeStatus === status ? ' is-active' : ''}">${label} <span class="tab-count">${count}</span></a>`;
    })}
  </nav>`;
}

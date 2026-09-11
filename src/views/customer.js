import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  csrfField, emptyState, errorSummary, field, money, offerCard, progressSteps, requestDetails, requestLink, requestTable,
  statusBadge, statusFilterTabs, statusNote, stars, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { CATEGORIES, STATUS, URGENCY_LEVELS, can } from '../workflow.js';

export function requestsIndexPage(ctx, { requests, counts, status }) {
  const columns = [
    { label: 'Request', render: (row, base) => requestLink(row, base) },
    { label: 'Urgency', render: (row) => urgencyBadge(row.urgency) },
    { label: 'Status', render: (row) => statusBadge(row.status) },
    { label: 'Technician', render: (row) => row.technician_name ?? html`<span class="muted">—</span>` },
    { label: 'Updated', render: (row) => timeTag(row.updated_at) },
  ];
  const body = html`
    <div class="page-head">
      <div><h1>My requests</h1><p class="muted">Track every maintenance request from submission to completion.</p></div>
      <a class="btn btn-primary" href="/requests/new">New request</a>
    </div>
    ${statusFilterTabs(counts, status, '/requests')}
    ${requests.length
      ? requestTable(requests, { linkBase: '/requests', columns })
      : emptyState({
          title: counts.all ? 'No requests match this filter.' : 'You have not submitted any requests yet.',
          text: counts.all ? '' : 'Tell us what needs fixing and our team will schedule an inspection visit.',
          action: counts.all ? html`<a href="/requests">Show all requests</a>` : html`<a class="btn btn-primary" href="/requests/new">Submit your first request</a>`,
        })}`;
  return page(ctx, { title: 'My requests', body, activeNav: 'requests', wide: true });
}

export function requestFormPage(ctx, { values = {}, errors = {} } = {}) {
  const body = html`
    <section class="card form-card">
      <h1>New maintenance request</h1>
      <p class="muted">Describe the problem as precisely as you can. After you submit, an administrator will schedule an inspection visit and open the request for technician offers.</p>
      ${errorSummary(errors)}
      <form method="post" action="/requests" class="stack">
        ${csrfField(ctx)}
        ${field({
          label: 'Service category',
          name: 'category',
          type: 'select',
          value: values.category ?? '',
          required: true,
          error: errors.category,
          options: [{ value: '', label: 'Choose a category…' }, ...CATEGORIES.map((category) => ({ value: category, label: category }))],
        })}
        ${field({ label: 'Title', name: 'title', value: values.title ?? '', required: true, error: errors.title, placeholder: 'e.g. Kitchen sink is leaking under the cabinet' })}
        ${field({ label: 'Describe the problem', name: 'description', type: 'textarea', rows: 6, value: values.description ?? '', required: true, error: errors.description, placeholder: 'What is happening, since when, and anything the technician should know.' })}
        ${field({ label: 'Property address', name: 'address', value: values.address ?? '', required: true, error: errors.address, placeholder: 'Street, building, apartment, city', autocomplete: 'street-address' })}
        <div class="grid-2">
          ${field({ label: 'Preferred visit date', name: 'preferred_date', type: 'date', value: values.preferred_date ?? '', error: errors.preferred_date, hint: 'Optional. We will confirm the exact time with you.' })}
          ${field({
            label: 'Urgency',
            name: 'urgency',
            type: 'select',
            value: values.urgency ?? 'normal',
            error: errors.urgency,
            options: Object.entries(URGENCY_LEVELS).map(([value, meta]) => ({ value, label: `${meta.label} — ${meta.hint}` })),
          })}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Submit request</button>
          <a class="btn btn-ghost" href="/requests">Cancel</a>
        </div>
      </form>
    </section>`;
  return page(ctx, { title: 'New request', body, activeNav: 'requests' });
}

function ratingInput(errors) {
  return html`<fieldset class="field${errors.rating ? ' has-error' : ''}">
    <legend>Rate the service <span class="req" aria-hidden="true">*</span></legend>
    <div class="rating" role="radiogroup">
      ${[5, 4, 3, 2, 1].map((value) => html`<input type="radio" id="rating-${value}" name="rating" value="${value}" required><label for="rating-${value}" title="${value} star${value === 1 ? '' : 's'}">★</label>`)}
    </div>
    ${errors.rating ? html`<p class="field-error">${errors.rating}</p>` : ''}
  </fieldset>`;
}

export function requestShowPage(ctx, { request, offers, events, errors = {}, values = {} }) {
  const acceptedOffer = offers.find((offer) => offer.status === 'accepted');
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');
  const offersSection = () => {
    if ([STATUS.SUBMITTED, STATUS.VISIT_SCHEDULED].includes(request.status)) return '';
    if (request.status === STATUS.OPEN_FOR_OFFERS) {
      return html`<section class="card">
        <h2>Technician offers <span class="count">${pendingOffers.length}</span></h2>
        ${pendingOffers.length
          ? html`<p class="muted">Compare price, estimated duration and ratings. Accepting an offer assigns the technician and declines the others.</p>
            <div class="offer-list">
              ${pendingOffers.map((offer) =>
                offerCard(offer, ctx, {
                  actions: html`<form method="post" action="/requests/${request.id}/offers/${offer.id}/accept" class="inline-form" data-confirm="Accept ${offer.technician_name}'s offer? Other offers will be declined.">
                    ${csrfField(ctx)}
                    <button type="submit" class="btn btn-primary btn-sm">Accept offer</button>
                  </form>`,
                }),
              )}
            </div>`
          : emptyState({ title: 'No offers yet', text: 'Technicians are reviewing the inspection findings. You will see their offers here.' })}
      </section>`;
    }
    if (acceptedOffer) {
      return html`<section class="card">
        <h2>Assigned technician</h2>
        ${offerCard(acceptedOffer, ctx, { showContact: true })}
      </section>`;
    }
    return '';
  };

  const completionSection = () => {
    if (request.status === STATUS.COMPLETED) {
      return html`<section class="card highlight">
        <h2>Confirm the completed work</h2>
        <p>${request.technician_name} marked this job as completed ${timeTag(request.completed_at)}.</p>
        ${request.completion_note ? html`<blockquote>${multiline(request.completion_note)}</blockquote>` : ''}
        <div class="split">
          <form method="post" action="/requests/${request.id}/confirm" class="stack">
            ${csrfField(ctx)}
            <h3 class="h-sub">Everything is done</h3>
            ${ratingInput(errors)}
            ${field({ label: 'Review (optional)', name: 'review', type: 'textarea', rows: 3, value: values.review ?? '', error: errors.review, placeholder: 'How did it go?' })}
            <button type="submit" class="btn btn-primary">Confirm & close order</button>
          </form>
          <form method="post" action="/requests/${request.id}/rework" class="stack">
            ${csrfField(ctx)}
            <h3 class="h-sub">Something is not right</h3>
            ${field({ label: 'What still needs attention?', name: 'rework_note', type: 'textarea', rows: 3, value: values.rework_note ?? '', error: errors.rework_note, required: true })}
            <button type="submit" class="btn btn-secondary">Send back to technician</button>
          </form>
        </div>
      </section>`;
    }
    if (request.status === STATUS.CLOSED) {
      return html`<section class="card">
        <h2>Order summary</h2>
        <dl class="details">
          <div><dt>Technician</dt><dd>${request.technician_name}</dd></div>
          <div><dt>Agreed price</dt><dd>${money(request.accepted_amount_cents, ctx)}</dd></div>
          <div><dt>Completed</dt><dd>${timeTag(request.completed_at)}</dd></div>
          <div><dt>Closed</dt><dd>${timeTag(request.closed_at)}</dd></div>
          <div><dt>Your rating</dt><dd>${stars(request.rating)}</dd></div>
          ${request.review ? html`<div class="details-wide"><dt>Your review</dt><dd>${multiline(request.review)}</dd></div>` : ''}
        </dl>
      </section>`;
    }
    return '';
  };

  const cancelSection = can.customerCancel(request)
    ? html`<section class="card danger-zone">
        <h2>Cancel request</h2>
        <form method="post" action="/requests/${request.id}/cancel" class="stack" data-confirm="Cancel this request? This cannot be undone.">
          ${csrfField(ctx)}
          ${field({ label: 'Reason (optional)', name: 'reason', value: values.reason ?? '', error: errors.reason })}
          <button type="submit" class="btn btn-danger">Cancel request</button>
        </form>
      </section>`
    : '';

  const body = html`
    <p class="breadcrumb"><a href="/requests">My requests</a> / #${request.id}</p>
    <div class="page-head">
      <div>
        <h1>${request.title}</h1>
        <p class="muted">Request #${request.id} · ${request.category} · submitted ${timeTag(request.created_at)}</p>
      </div>
      ${statusBadge(request.status)}
    </div>
    ${progressSteps(request)}
    ${statusNote(request, 'customer')}
    ${request.status === STATUS.CANCELLED && request.cancel_reason ? html`<p class="muted">Reason: ${request.cancel_reason}</p>` : ''}
    ${errorSummary(errors)}
    <div class="layout-2">
      <div class="stack">
        <section class="card"><h2>Request details</h2>${requestDetails(request)}</section>
        ${visitCard(request)}
        ${offersSection()}
        ${completionSection()}
        ${cancelSection}
      </div>
      <aside class="stack">
        <section class="card"><h2>Activity</h2>${timeline(events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: request.title, body, activeNav: 'requests', wide: true });
}

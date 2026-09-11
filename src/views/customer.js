import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  categoryLabel, csrfField, dash, emptyState, errorSummary, field, money, offerCard, progressSteps, requestDetails, requestLink, requestTable,
  statusBadge, statusFilterTabs, statusNote, stars, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { CATEGORIES, STATUS, URGENCY_LEVELS, can } from '../workflow.js';

export function requestsIndexPage(ctx, { requests, counts, status }) {
  const t = ctx.t;
  const columns = [
    { label: t('fields.request'), render: (row, base) => requestLink(ctx, row, base) },
    { label: t('fields.urgency'), render: (row) => urgencyBadge(ctx, row.urgency) },
    { label: t('fields.status'), render: (row) => statusBadge(ctx, row.status) },
    { label: t('fields.technician'), render: (row) => row.technician_name ?? dash() },
    { label: t('fields.updated'), render: (row) => timeTag(ctx, row.updated_at) },
  ];
  const body = html`
    <div class="page-head">
      <div><h1>${t('customer.indexTitle')}</h1><p class="muted">${t('customer.indexSubtitle')}</p></div>
      <a class="btn btn-primary" href="/requests/new">${t('nav.newRequest')}</a>
    </div>
    ${statusFilterTabs(ctx, counts, status, '/requests')}
    ${requests.length
      ? requestTable(requests, { linkBase: '/requests', columns })
      : emptyState({
          title: counts.all ? t('customer.emptyTitleFilter') : t('customer.emptyTitleNone'),
          text: counts.all ? '' : t('customer.emptyTextNone'),
          action: counts.all
            ? html`<a href="/requests">${t('common.showAll')}</a>`
            : html`<a class="btn btn-primary" href="/requests/new">${t('customer.emptyCtaNone')}</a>`,
        })}`;
  return page(ctx, { title: t('customer.indexTitle'), body, activeNav: 'requests', wide: true });
}

export function requestFormPage(ctx, { values = {}, errors = {} } = {}) {
  const t = ctx.t;
  const body = html`
    <section class="card form-card">
      <h1>${t('customer.form.title')}</h1>
      <p class="muted">${t('customer.form.intro')}</p>
      ${errorSummary(ctx, errors)}
      <form method="post" action="/requests" class="stack">
        ${csrfField(ctx)}
        ${field({
          label: t('customer.form.category'),
          name: 'category',
          type: 'select',
          value: values.category ?? '',
          required: true,
          error: errors.category,
          options: [{ value: '', label: t('customer.form.chooseCategory') }, ...CATEGORIES.map((key) => ({ value: key, label: categoryLabel(ctx, key) }))],
        })}
        ${field({ label: t('customer.form.titleLabel'), name: 'title', value: values.title ?? '', required: true, error: errors.title, placeholder: t('customer.form.titlePlaceholder') })}
        ${field({ label: t('customer.form.description'), name: 'description', type: 'textarea', rows: 6, value: values.description ?? '', required: true, error: errors.description, placeholder: t('customer.form.descriptionPlaceholder') })}
        ${field({ label: t('customer.form.address'), name: 'address', value: values.address ?? '', required: true, error: errors.address, placeholder: t('customer.form.addressPlaceholder'), autocomplete: 'street-address' })}
        <div class="grid-2">
          ${field({ label: t('customer.form.preferredDate'), name: 'preferred_date', type: 'date', value: values.preferred_date ?? '', error: errors.preferred_date, hint: t('customer.form.preferredDateHint') })}
          ${field({
            label: t('customer.form.urgency'),
            name: 'urgency',
            type: 'select',
            value: values.urgency ?? 'normal',
            error: errors.urgency,
            options: URGENCY_LEVELS.map((key) => ({ value: key, label: `${t(`urgency.${key}.label`)} — ${t(`urgency.${key}.hint`)}` })),
          })}
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${t('customer.form.submit')}</button>
          <a class="btn btn-ghost" href="/requests">${t('customer.form.cancel')}</a>
        </div>
      </form>
    </section>`;
  return page(ctx, { title: t('customer.form.title'), body, activeNav: 'requests' });
}

function ratingInput(ctx, errors) {
  return html`<fieldset class="field${errors.rating ? ' has-error' : ''}">
    <legend>${ctx.t('customer.show.rateService')} <span class="req" aria-hidden="true">*</span></legend>
    <div class="rating" role="radiogroup">
      ${[5, 4, 3, 2, 1].map((value) => html`<input type="radio" id="rating-${value}" name="rating" value="${value}" required><label for="rating-${value}" title="${ctx.t('common.outOf5', { rating: value })}">★</label>`)}
    </div>
    ${errors.rating ? html`<p class="field-error">${errors.rating}</p>` : ''}
  </fieldset>`;
}

export function requestShowPage(ctx, { request, offers, events, errors = {}, values = {} }) {
  const t = ctx.t;
  const acceptedOffer = offers.find((offer) => offer.status === 'accepted');
  const pendingOffers = offers.filter((offer) => offer.status === 'pending');

  const offersSection = () => {
    if ([STATUS.SUBMITTED, STATUS.VISIT_SCHEDULED].includes(request.status)) return '';
    if (request.status === STATUS.OPEN_FOR_OFFERS) {
      return html`<section class="card">
        <h2>${t('customer.show.offersTitle')} <span class="count">${pendingOffers.length}</span></h2>
        ${pendingOffers.length
          ? html`<p class="muted">${t('customer.show.offersIntro')}</p>
            <div class="offer-list">
              ${pendingOffers.map((offer) =>
                offerCard(ctx, offer, {
                  actions: html`<form method="post" action="/requests/${request.id}/offers/${offer.id}/accept" class="inline-form" data-confirm="${t('customer.show.acceptConfirm', { name: offer.technician_name })}">
                    ${csrfField(ctx)}
                    <button type="submit" class="btn btn-primary btn-sm">${t('customer.show.acceptOffer')}</button>
                  </form>`,
                }),
              )}
            </div>`
          : emptyState({ title: t('customer.show.noOffersTitle'), text: t('customer.show.noOffersText') })}
      </section>`;
    }
    if (acceptedOffer) {
      return html`<section class="card">
        <h2>${t('customer.show.assignedTechnician')}</h2>
        ${offerCard(ctx, acceptedOffer, { showContact: true })}
      </section>`;
    }
    return '';
  };

  const completionSection = () => {
    if (request.status === STATUS.COMPLETED) {
      return html`<section class="card highlight">
        <h2>${t('customer.show.confirmTitle')}</h2>
        <p>${t('customer.show.markedCompletedBy', { name: request.technician_name, time: timeTag(ctx, request.completed_at) })}</p>
        ${request.completion_note ? html`<blockquote dir="auto">${multiline(request.completion_note)}</blockquote>` : ''}
        <div class="split">
          <form method="post" action="/requests/${request.id}/confirm" class="stack">
            ${csrfField(ctx)}
            <h3 class="h-sub">${t('customer.show.everythingDone')}</h3>
            ${ratingInput(ctx, errors)}
            ${field({ label: t('customer.show.review'), name: 'review', type: 'textarea', rows: 3, value: values.review ?? '', error: errors.review, placeholder: t('customer.show.reviewPlaceholder') })}
            <button type="submit" class="btn btn-primary">${t('customer.show.confirmButton')}</button>
          </form>
          <form method="post" action="/requests/${request.id}/rework" class="stack">
            ${csrfField(ctx)}
            <h3 class="h-sub">${t('customer.show.somethingWrong')}</h3>
            ${field({ label: t('customer.show.whatNeedsAttention'), name: 'rework_note', type: 'textarea', rows: 3, value: values.rework_note ?? '', error: errors.rework_note, required: true })}
            <button type="submit" class="btn btn-secondary">${t('customer.show.sendBack')}</button>
          </form>
        </div>
      </section>`;
    }
    if (request.status === STATUS.CLOSED) {
      return html`<section class="card">
        <h2>${t('customer.show.orderSummary')}</h2>
        <dl class="details">
          <div><dt>${t('fields.technician')}</dt><dd>${request.technician_name}</dd></div>
          <div><dt>${t('fields.agreedPrice')}</dt><dd>${money(ctx, request.accepted_amount_cents)}</dd></div>
          <div><dt>${t('fields.completed')}</dt><dd>${timeTag(ctx, request.completed_at)}</dd></div>
          <div><dt>${t('fields.closed')}</dt><dd>${timeTag(ctx, request.closed_at)}</dd></div>
          <div><dt>${t('fields.yourRating')}</dt><dd>${stars(ctx, request.rating)}</dd></div>
          ${request.review ? html`<div class="details-wide"><dt>${t('fields.yourReview')}</dt><dd dir="auto">${multiline(request.review)}</dd></div>` : ''}
        </dl>
      </section>`;
    }
    return '';
  };

  const cancelSection = can.customerCancel(request)
    ? html`<section class="card danger-zone">
        <h2>${t('customer.show.cancelTitle')}</h2>
        <form method="post" action="/requests/${request.id}/cancel" class="stack" data-confirm="${t('customer.show.cancelConfirm')}">
          ${csrfField(ctx)}
          ${field({ label: t('common.reasonOptional'), name: 'reason', value: values.reason ?? '', error: errors.reason })}
          <button type="submit" class="btn btn-danger">${t('customer.show.cancelButton')}</button>
        </form>
      </section>`
    : '';

  const body = html`
    <p class="breadcrumb"><a href="/requests">${t('customer.indexTitle')}</a> / ${t('common.requestRef', { id: request.id })}</p>
    <div class="page-head">
      <div>
        <h1 dir="auto">${request.title}</h1>
        <p class="muted">${t('common.requestNumber', { id: request.id })} · ${categoryLabel(ctx, request.category)} · ${t('common.submittedAt', { time: timeTag(ctx, request.created_at) })}</p>
      </div>
      ${statusBadge(ctx, request.status)}
    </div>
    ${progressSteps(ctx, request)}
    ${statusNote(ctx, request, 'customer')}
    ${request.status === STATUS.CANCELLED && request.cancel_reason ? html`<p class="muted" dir="auto">${t('common.reasonPrefix', { reason: request.cancel_reason })}</p>` : ''}
    ${errorSummary(ctx, errors)}
    <div class="layout-2">
      <div class="stack">
        <section class="card"><h2>${t('common.requestDetails')}</h2>${requestDetails(ctx, request)}</section>
        ${visitCard(ctx, request)}
        ${offersSection()}
        ${completionSection()}
        ${cancelSection}
      </div>
      <aside class="stack">
        <section class="card"><h2>${t('common.activity')}</h2>${timeline(ctx, events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: request.title, body, activeNav: 'requests', wide: true });
}

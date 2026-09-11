import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  categoryLabel, csrfField, dash, emptyState, ltr, errorSummary, field, money, offerStatusBadge, progressSteps, requestDetails, statTile, stars,
  statusBadge, statusNote, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { truncate } from '../lib/format.js';
import { STATUS, can } from '../workflow.js';

export function dashboardPage(ctx, { stats, open, jobs, offers }) {
  const t = ctx.t;
  const activeJobs = jobs.filter((job) => [STATUS.IN_PROGRESS, STATUS.COMPLETED].includes(job.status));
  const pastJobs = jobs.filter((job) => ![STATUS.IN_PROGRESS, STATUS.COMPLETED].includes(job.status));
  const ref = (row) => html`${t('common.requestRef', { id: row.id })} · ${categoryLabel(ctx, row.category)}`;
  const body = html`
    <div class="page-head">
      <div><h1>${t('tech.dashboardTitle')}</h1><p class="muted">${t('tech.welcome', { name: ctx.user.name, specialty: ctx.user.specialty || t('common.technician') })}</p></div>
    </div>
    <div class="stat-grid">
      ${statTile({ label: t('tech.stats.open'), value: stats.open_requests, href: '#open', tone: 'accent' })}
      ${statTile({ label: t('tech.stats.pendingOffers'), value: stats.pending_offers, href: '#offers', tone: 'info' })}
      ${statTile({ label: t('tech.stats.activeJobs'), value: stats.active_jobs, href: '#jobs', tone: 'warn' })}
      ${statTile({ label: t('tech.stats.completedJobs'), value: stats.closed_jobs, tone: 'ok' })}
      ${statTile({ label: t('tech.stats.avgRating'), value: stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : '—', tone: 'neutral' })}
    </div>

    <section class="card" id="jobs">
      <h2>${t('tech.activeJobs')} <span class="count">${activeJobs.length}</span></h2>
      ${activeJobs.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>${t('fields.job')}</th><th>${t('fields.customer')}</th><th>${t('fields.agreedPrice')}</th><th>${t('fields.status')}</th><th>${t('fields.updated')}</th></tr></thead>
            <tbody>${activeJobs.map(
              (job) => html`<tr>
                <td data-label="${t('fields.job')}"><a class="table-title" href="/tech/requests/${job.id}" dir="auto">${job.title}</a><div class="muted small">${ref(job)} · <span dir="auto">${job.address}</span></div></td>
                <td data-label="${t('fields.customer')}"><span dir="auto">${job.customer_name}</span><div class="muted small">${ltr(job.customer_phone)}</div></td>
                <td data-label="${t('fields.agreedPrice')}">${money(ctx, job.accepted_amount_cents)}</td>
                <td data-label="${t('fields.status')}">${statusBadge(ctx, job.status)}</td>
                <td data-label="${t('fields.updated')}">${timeTag(ctx, job.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : html`<p class="muted">${t('tech.noActiveJobs')}</p>`}
    </section>

    <section class="card" id="open">
      <h2>${t('tech.openTitle')} <span class="count">${open.length}</span></h2>
      ${open.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>${t('fields.request')}</th><th>${t('fields.scopeOfWork')}</th><th>${t('fields.urgency')}</th><th>${t('fields.offers')}</th><th>${t('fields.myOffer')}</th><th></th></tr></thead>
            <tbody>${open.map(
              (row) => html`<tr>
                <td data-label="${t('fields.request')}"><a class="table-title" href="/tech/requests/${row.id}" dir="auto">${row.title}</a><div class="muted small">${ref(row)} · <span dir="auto">${row.address}</span></div></td>
                <td data-label="${t('fields.scopeOfWork')}" class="cell-wrap" dir="auto">${truncate(row.assessment, 140)}</td>
                <td data-label="${t('fields.urgency')}">${urgencyBadge(ctx, row.urgency)}</td>
                <td data-label="${t('fields.offers')}">${row.pending_offers}</td>
                <td data-label="${t('fields.myOffer')}">${row.my_offer_id ? html`${money(ctx, row.my_offer_amount_cents)} ${offerStatusBadge(ctx, row.my_offer_status)}` : dash()}</td>
                <td data-label="${t('fields.actions')}"><a class="btn btn-sm ${row.my_offer_status === 'pending' ? 'btn-secondary' : 'btn-primary'}" href="/tech/requests/${row.id}">${row.my_offer_status === 'pending' ? t('tech.editOffer') : t('tech.sendOffer')}</a></td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : emptyState({ title: t('tech.noOpenTitle'), text: t('tech.noOpenText') })}
    </section>

    <section class="card" id="offers">
      <h2>${t('tech.myOffers')} <span class="count">${offers.length}</span></h2>
      ${offers.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>${t('fields.request')}</th><th>${t('fields.price')}</th><th>${t('fields.duration')}</th><th>${t('fields.offerStatus')}</th><th>${t('fields.requestStatus')}</th><th>${t('fields.updated')}</th></tr></thead>
            <tbody>${offers.map(
              (offer) => html`<tr>
                <td data-label="${t('fields.request')}"><a class="table-title" href="/tech/requests/${offer.request_id}" dir="auto">${offer.request_title}</a><div class="muted small">${t('common.requestRef', { id: offer.request_id })} · ${categoryLabel(ctx, offer.category)}</div></td>
                <td data-label="${t('fields.price')}">${money(ctx, offer.amount_cents)}</td>
                <td data-label="${t('fields.duration')}" dir="auto">${offer.duration}</td>
                <td data-label="${t('fields.offerStatus')}">${offerStatusBadge(ctx, offer.status)}</td>
                <td data-label="${t('fields.requestStatus')}">${statusBadge(ctx, offer.request_status)}</td>
                <td data-label="${t('fields.updated')}">${timeTag(ctx, offer.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : html`<p class="muted">${t('tech.noOffers')}</p>`}
    </section>

    ${pastJobs.length
      ? html`<section class="card">
          <h2>${t('tech.pastJobs')} <span class="count">${pastJobs.length}</span></h2>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>${t('fields.job')}</th><th>${t('fields.agreedPrice')}</th><th>${t('fields.status')}</th><th>${t('fields.rating')}</th><th>${t('fields.updated')}</th></tr></thead>
            <tbody>${pastJobs.map(
              (job) => html`<tr>
                <td data-label="${t('fields.job')}"><a class="table-title" href="/tech/requests/${job.id}" dir="auto">${job.title}</a><div class="muted small">${ref(job)}</div></td>
                <td data-label="${t('fields.agreedPrice')}">${money(ctx, job.accepted_amount_cents)}</td>
                <td data-label="${t('fields.status')}">${statusBadge(ctx, job.status)}</td>
                <td data-label="${t('fields.rating')}">${stars(ctx, job.rating)}</td>
                <td data-label="${t('fields.updated')}">${timeTag(ctx, job.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>
        </section>`
      : ''}`;
  return page(ctx, { title: t('tech.dashboardTitle'), body, activeNav: 'tech', wide: true });
}

export function requestShowPage(ctx, { request, myOffer, events, errors = {}, values = {} }) {
  const t = ctx.t;
  const assigned = request.technician_id === ctx.user.id;

  const offerSection = () => {
    if (can.submitOffer(request)) {
      const editing = myOffer && myOffer.status === 'pending';
      return html`<section class="card highlight">
        <h2>${editing ? t('tech.show.yourOffer') : t('tech.show.sendOffer')}</h2>
        <p class="muted">${editing ? t('tech.show.pendingIntro', { amount: money(ctx, myOffer.amount_cents) }) : t('tech.show.sendIntro')}</p>
        <form method="post" action="/tech/requests/${request.id}/offer" class="stack">
          ${csrfField(ctx)}
          <div class="grid-2">
            ${field({ label: t('tech.show.price', { currency: ctx.config.currency }), name: 'amount', type: 'text', value: values.amount ?? (myOffer ? (myOffer.amount_cents / 100).toFixed(2) : ''), required: true, error: errors.amount, placeholder: '0.00' })}
            ${field({ label: t('tech.show.duration'), name: 'duration', value: values.duration ?? myOffer?.duration ?? '', required: true, error: errors.duration, placeholder: t('tech.show.durationPlaceholder') })}
          </div>
          ${field({ label: t('tech.show.note'), name: 'note', type: 'textarea', rows: 4, value: values.note ?? myOffer?.note ?? '', error: errors.note, placeholder: t('tech.show.notePlaceholder') })}
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${editing ? t('tech.show.updateButton') : t('tech.show.submitButton')}</button>
          </div>
        </form>
        ${editing
          ? html`<form method="post" action="/tech/requests/${request.id}/offer/withdraw" class="inline-form" data-confirm="${t('tech.show.withdrawConfirm')}">
              ${csrfField(ctx)}
              <button type="submit" class="btn btn-ghost btn-sm">${t('tech.show.withdraw')}</button>
            </form>`
          : ''}
      </section>`;
    }
    if (myOffer) {
      return html`<section class="card">
        <h2>${t('tech.show.yourOffer')}</h2>
        <p>${money(ctx, myOffer.amount_cents)} · <span dir="auto">${myOffer.duration}</span> ${offerStatusBadge(ctx, myOffer.status)}</p>
        ${myOffer.note ? html`<p class="muted" dir="auto">${multiline(myOffer.note)}</p>` : ''}
      </section>`;
    }
    return '';
  };

  const workSection = () => {
    if (!assigned) return '';
    if (can.completeWork(request, ctx.user)) {
      return html`<section class="card highlight">
        <h2>${t('tech.show.completeTitle')}</h2>
        <p class="muted">${t('tech.show.completeIntro', { amount: money(ctx, request.accepted_amount_cents), duration: request.accepted_duration })}</p>
        <form method="post" action="/tech/requests/${request.id}/complete" class="stack" data-confirm="${t('tech.show.completeConfirm')}">
          ${csrfField(ctx)}
          ${field({ label: t('tech.show.completionNote'), name: 'completion_note', type: 'textarea', rows: 4, value: values.completion_note ?? '', error: errors.completion_note, placeholder: t('tech.show.completionPlaceholder') })}
          <button type="submit" class="btn btn-primary">${t('tech.show.completeButton')}</button>
        </form>
      </section>`;
    }
    if (request.status === STATUS.COMPLETED) {
      return html`<section class="card"><h2>${t('tech.show.awaitingTitle')}</h2><p>${t('tech.show.awaitingText', { time: timeTag(ctx, request.completed_at) })}</p></section>`;
    }
    if (request.status === STATUS.CLOSED) {
      return html`<section class="card"><h2>${t('tech.show.closedTitle')}</h2><p>${t('tech.show.closedText', { time: timeTag(ctx, request.closed_at) })} · ${stars(ctx, request.rating)}</p>${request.review ? html`<blockquote dir="auto">${multiline(request.review)}</blockquote>` : ''}</section>`;
    }
    return '';
  };

  const body = html`
    <p class="breadcrumb"><a href="/tech">${t('nav.dashboard')}</a> / ${t('common.requestRef', { id: request.id })}</p>
    <div class="page-head">
      <div>
        <h1 dir="auto">${request.title}</h1>
        <p class="muted">${t('common.requestNumber', { id: request.id })} · ${categoryLabel(ctx, request.category)} · <span dir="auto">${request.address}</span></p>
      </div>
      ${statusBadge(ctx, request.status)}
    </div>
    ${progressSteps(ctx, request)}
    ${statusNote(ctx, request, 'admin')}
    ${errorSummary(ctx, errors)}
    <div class="layout-2">
      <div class="stack">
        ${offerSection()}
        ${workSection()}
        ${visitCard(ctx, request)}
        <section class="card"><h2>${t('common.requestDetails')}</h2>${requestDetails(ctx, request, { showCustomer: true, showContact: assigned })}</section>
      </div>
      <aside class="stack">
        <section class="card"><h2>${t('common.activity')}</h2>${timeline(ctx, events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: request.title, body, activeNav: 'tech', wide: true });
}

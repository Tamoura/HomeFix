import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  categoryLabel, csrfField, dash, emptyState, ltr, errorSummary, field, money, offerCard, progressSteps, requestDetails, requestLink, requestTable,
  statTile, stars, statusBadge, statusFilterTabs, statusNote, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { STATUS, can } from '../workflow.js';

export function dashboardPage(ctx, { requests, counts, status, query }) {
  const t = ctx.t;
  const columns = [
    { label: t('fields.request'), render: (row, base) => requestLink(ctx, row, base) },
    { label: t('fields.customer'), render: (row) => html`<span dir="auto">${row.customer_name}</span><div class="muted small">${ltr(row.customer_phone || row.customer_email)}</div>` },
    { label: t('fields.urgency'), render: (row) => urgencyBadge(ctx, row.urgency) },
    { label: t('fields.status'), render: (row) => statusBadge(ctx, row.status) },
    { label: t('fields.visit'), render: (row) => (row.visit_at ? ctx.fmt.localDateTime(row.visit_at) : dash()) },
    { label: t('fields.technician'), render: (row) => row.technician_name ?? dash() },
    { label: t('fields.updated'), render: (row) => timeTag(ctx, row.updated_at) },
  ];
  const body = html`
    <div class="page-head">
      <div><h1>${t('admin.dashboardTitle')}</h1><p class="muted">${t('admin.dashboardSubtitle')}</p></div>
      <form method="get" action="/admin" class="search-form" role="search">
        ${status && status !== 'all' ? html`<input type="hidden" name="status" value="${status}">` : ''}
        <input type="search" name="q" value="${query}" placeholder="${t('admin.searchPlaceholder')}" aria-label="${t('admin.searchLabel')}">
        <button type="submit" class="btn btn-secondary btn-sm">${t('admin.search')}</button>
      </form>
    </div>
    <div class="stat-grid">
      ${statTile({ label: t('admin.stats.needsVisit'), value: counts.submitted, href: '/admin?status=submitted', tone: counts.submitted ? 'accent' : 'neutral' })}
      ${statTile({ label: t('admin.stats.visitsScheduled'), value: counts.visit_scheduled, href: '/admin?status=visit_scheduled', tone: 'info' })}
      ${statTile({ label: t('admin.stats.openForOffers'), value: counts.open_for_offers, href: '/admin?status=open_for_offers', tone: 'accent' })}
      ${statTile({ label: t('admin.stats.inProgress'), value: counts.in_progress, href: '/admin?status=in_progress', tone: 'warn' })}
      ${statTile({ label: t('admin.stats.awaitingConfirmation'), value: counts.completed, href: '/admin?status=completed', tone: 'info' })}
      ${statTile({ label: t('admin.stats.closed'), value: counts.closed, href: '/admin?status=closed', tone: 'ok' })}
    </div>
    ${statusFilterTabs(ctx, counts, status, '/admin')}
    ${requests.length
      ? requestTable(requests, { linkBase: '/admin/requests', columns })
      : emptyState({ title: t('admin.noRequests'), text: query ? t('admin.noRequestsSearch') : t('admin.noRequestsNew') })}`;
  return page(ctx, { title: t('nav.dashboard'), body, activeNav: 'admin', wide: true });
}

export function requestShowPage(ctx, { request, offers, events, errors = {}, values = {} }) {
  const t = ctx.t;
  const rescheduling = request.status === STATUS.VISIT_SCHEDULED;
  const visitForm = can.scheduleVisit(request)
    ? html`<section class="card highlight">
        <h2>${rescheduling ? t('admin.show.rescheduleTitle') : t('admin.show.scheduleTitle')}</h2>
        <form method="post" action="/admin/requests/${request.id}/visit" class="stack">
          ${csrfField(ctx)}
          <div class="grid-2">
            ${field({ label: t('admin.show.visitAt'), name: 'visit_at', type: 'datetime-local', value: values.visit_at ?? request.visit_at ?? '', required: true, error: errors.visit_at })}
            ${field({ label: t('admin.show.visitNote'), name: 'visit_note', value: values.visit_note ?? request.visit_note ?? '', error: errors.visit_note, placeholder: t('admin.show.visitNotePlaceholder') })}
          </div>
          <button type="submit" class="btn btn-primary">${rescheduling ? t('admin.show.updateButton') : t('admin.show.scheduleButton')}</button>
        </form>
      </section>`
    : '';

  const assessmentForm = can.completeVisit(request)
    ? html`<section class="card highlight">
        <h2>${t('admin.show.findingsTitle')}</h2>
        <p class="muted">${t('admin.show.findingsIntro')}</p>
        <form method="post" action="/admin/requests/${request.id}/assessment" class="stack">
          ${csrfField(ctx)}
          ${field({ label: t('admin.show.findingsLabel'), name: 'assessment', type: 'textarea', rows: 6, value: values.assessment ?? '', required: true, error: errors.assessment })}
          <button type="submit" class="btn btn-primary">${t('admin.show.findingsButton')}</button>
        </form>
      </section>`
    : '';

  const offersSection = offers.length
    ? html`<section class="card">
        <h2>${t('admin.show.offersTitle')} <span class="count">${offers.length}</span></h2>
        <div class="offer-list">${offers.map((offer) => offerCard(ctx, offer, { showContact: true }))}</div>
      </section>`
    : request.status === STATUS.OPEN_FOR_OFFERS
      ? html`<section class="card"><h2>${t('admin.show.offersTitle')}</h2>${emptyState({ title: t('admin.show.noOffersTitle'), text: t('admin.show.noOffersText') })}</section>`
      : '';

  const completionSection = [STATUS.COMPLETED, STATUS.CLOSED].includes(request.status)
    ? html`<section class="card">
        <h2>${t('admin.show.completionTitle')}</h2>
        <dl class="details">
          <div><dt>${t('fields.technician')}</dt><dd dir="auto">${request.technician_name}<div class="muted small">${ltr(request.technician_phone)} ${ltr(request.technician_email)}</div></dd></div>
          <div><dt>${t('fields.agreedPrice')}</dt><dd>${money(ctx, request.accepted_amount_cents)}</dd></div>
          <div><dt>${t('fields.markedCompleted')}</dt><dd>${timeTag(ctx, request.completed_at)}</dd></div>
          ${request.status === STATUS.CLOSED
            ? html`<div><dt>${t('fields.closed')}</dt><dd>${timeTag(ctx, request.closed_at)}</dd></div><div><dt>${t('fields.rating')}</dt><dd>${stars(ctx, request.rating)}</dd></div>`
            : ''}
          ${request.completion_note ? html`<div class="details-wide"><dt>${t('fields.technicianNote')}</dt><dd dir="auto">${multiline(request.completion_note)}</dd></div>` : ''}
          ${request.review ? html`<div class="details-wide"><dt>${t('fields.customerReview')}</dt><dd dir="auto">${multiline(request.review)}</dd></div>` : ''}
        </dl>
      </section>`
    : '';

  const cancelSection = can.adminCancel(request)
    ? html`<section class="card danger-zone">
        <h2>${t('admin.show.cancelTitle')}</h2>
        <form method="post" action="/admin/requests/${request.id}/cancel" class="stack" data-confirm="${t('admin.show.cancelConfirm', { id: request.id })}">
          ${csrfField(ctx)}
          ${field({ label: t('common.reason'), name: 'reason', value: values.reason ?? '', error: errors.reason, placeholder: t('admin.show.reasonPlaceholder') })}
          <button type="submit" class="btn btn-danger">${t('admin.show.cancelButton')}</button>
        </form>
      </section>`
    : '';

  const body = html`
    <p class="breadcrumb"><a href="/admin">${t('nav.requests')}</a> / ${t('common.requestRef', { id: request.id })}</p>
    <div class="page-head">
      <div>
        <h1 dir="auto">${request.title}</h1>
        <p class="muted">${t('common.requestNumber', { id: request.id })} · ${categoryLabel(ctx, request.category)} · ${t('common.submittedAt', { time: timeTag(ctx, request.created_at) })}</p>
      </div>
      ${statusBadge(ctx, request.status)}
    </div>
    ${progressSteps(ctx, request)}
    ${statusNote(ctx, request, 'admin')}
    ${request.status === STATUS.CANCELLED && request.cancel_reason ? html`<p class="muted" dir="auto">${t('common.reasonPrefix', { reason: request.cancel_reason })}</p>` : ''}
    ${errorSummary(ctx, errors)}
    <div class="layout-2">
      <div class="stack">
        ${visitForm}
        ${assessmentForm}
        <section class="card"><h2>${t('common.requestDetails')}</h2>${requestDetails(ctx, request, { showCustomer: true, showContact: true })}</section>
        ${visitCard(ctx, request)}
        ${offersSection}
        ${completionSection}
        ${cancelSection}
      </div>
      <aside class="stack">
        <section class="card"><h2>${t('common.activity')}</h2>${timeline(ctx, events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: `${t('common.requestRef', { id: request.id })} ${request.title}`, body, activeNav: 'admin', wide: true });
}

function statusForm(ctx, user, status, label, cls, confirm) {
  return html`<form method="post" action="/admin/users/${user.id}/status" class="inline-form"${confirm ? html` data-confirm="${confirm}"` : ''}>
    ${csrfField(ctx)}
    <input type="hidden" name="status" value="${status}">
    <button type="submit" class="btn ${cls} btn-sm">${label}</button>
  </form>`;
}

export function usersPage(ctx, { technicians, customers, errors = {}, values = {} }) {
  const t = ctx.t;
  const pending = technicians.filter((tech) => tech.status === 'pending');
  const others = technicians.filter((tech) => tech.status !== 'pending');
  const body = html`
    <div class="page-head">
      <div><h1>${t('admin.users.title')}</h1><p class="muted">${t('admin.users.subtitle')}</p></div>
    </div>
    <div class="stack">
      <details class="card details-card"${Object.keys(errors).length ? ' open' : ''}>
        <summary><h2>${t('admin.users.addTitle')}</h2><span class="muted small">${t('admin.users.addSubtitle')}</span></summary>
        <div class="details-body">
          <p class="muted">${t('admin.users.addIntro')}</p>
          ${errorSummary(ctx, errors)}
          <form method="post" action="/admin/users" class="stack">
            ${csrfField(ctx)}
            ${field({ label: t('auth.fullName'), name: 'name', value: values.name ?? '', required: true, error: errors.name })}
            ${field({ label: t('auth.email'), name: 'email', type: 'email', value: values.email ?? '', required: true, error: errors.email })}
            ${field({ label: t('auth.phone'), name: 'phone', type: 'tel', value: values.phone ?? '', error: errors.phone })}
            ${field({ label: t('auth.specialty'), name: 'specialty', value: values.specialty ?? '', required: true, error: errors.specialty, placeholder: t('auth.specialtyPlaceholder') })}
            ${field({ label: t('admin.users.tempPassword'), name: 'password', type: 'password', required: true, error: errors.password, hint: t('auth.passwordHint') })}
            <button type="submit" class="btn btn-primary">${t('admin.users.createButton')}</button>
          </form>
        </div>
      </details>
      <section class="card">
        <h2>${t('admin.users.pendingTitle')} <span class="count">${pending.length}</span></h2>
        ${pending.length
          ? html`<div class="table-wrap"><table class="table">
              <thead><tr><th>${t('fields.name')}</th><th>${t('fields.specialty')}</th><th>${t('fields.contact')}</th><th>${t('fields.registered')}</th><th></th></tr></thead>
              <tbody>${pending.map(
                (tech) => html`<tr>
                  <td data-label="${t('fields.name')}" dir="auto">${tech.name}</td>
                  <td data-label="${t('fields.specialty')}" dir="auto">${tech.specialty}</td>
                  <td data-label="${t('fields.contact')}">${ltr(tech.email)}<div class="muted small">${ltr(tech.phone)}</div></td>
                  <td data-label="${t('fields.registered')}">${timeTag(ctx, tech.created_at)}</td>
                  <td data-label="${t('fields.actions')}" class="actions">${statusForm(ctx, tech, 'active', t('admin.users.approve'), 'btn-primary')} ${statusForm(ctx, tech, 'disabled', t('admin.users.reject'), 'btn-ghost', t('admin.users.rejectConfirm', { name: tech.name }))}</td>
                </tr>`,
              )}</tbody>
            </table></div>`
          : html`<p class="muted">${t('admin.users.noPending')}</p>`}
      </section>
      <section class="card">
        <h2>${t('admin.users.techniciansTitle')} <span class="count">${others.length}</span></h2>
        ${others.length
          ? html`<div class="table-wrap"><table class="table">
              <thead><tr><th>${t('fields.name')}</th><th>${t('fields.specialty')}</th><th>${t('fields.contact')}</th><th>${t('fields.rating')}</th><th>${t('fields.jobs')}</th><th>${t('fields.status')}</th><th></th></tr></thead>
              <tbody>${others.map(
                (tech) => html`<tr>
                  <td data-label="${t('fields.name')}" dir="auto">${tech.name}</td>
                  <td data-label="${t('fields.specialty')}" dir="auto">${tech.specialty}</td>
                  <td data-label="${t('fields.contact')}">${ltr(tech.email)}<div class="muted small">${ltr(tech.phone)}</div></td>
                  <td data-label="${t('fields.rating')}">${stars(ctx, tech.avg_rating)}</td>
                  <td data-label="${t('fields.jobs')}" class="nowrap">${t('admin.users.jobsSummary', { closed: tech.closed_jobs, active: tech.active_jobs, offers: tech.offers_count })}</td>
                  <td data-label="${t('fields.status')}">${tech.status === 'active' ? html`<span class="badge badge-ok">${t('userBadge.active')}</span>` : html`<span class="badge badge-danger">${t('userBadge.disabled')}</span>`}</td>
                  <td data-label="${t('fields.actions')}" class="actions">${tech.status === 'active'
                    ? statusForm(ctx, tech, 'disabled', t('admin.users.deactivate'), 'btn-ghost', t('admin.users.deactivateConfirm', { name: tech.name }))
                    : statusForm(ctx, tech, 'active', t('admin.users.reactivate'), 'btn-secondary')}</td>
                </tr>`,
              )}</tbody>
            </table></div>`
          : html`<p class="muted">${t('admin.users.noTechnicians')}</p>`}
      </section>
      <section class="card">
        <h2>${t('admin.users.customersTitle')} <span class="count">${customers.length}</span></h2>
        ${customers.length
          ? html`<div class="table-wrap"><table class="table">
              <thead><tr><th>${t('fields.name')}</th><th>${t('fields.contact')}</th><th>${t('fields.requests')}</th><th>${t('fields.joined')}</th></tr></thead>
              <tbody>${customers.map(
                (customer) => html`<tr>
                  <td data-label="${t('fields.name')}" dir="auto">${customer.name}</td>
                  <td data-label="${t('fields.contact')}">${ltr(customer.email)}<div class="muted small">${ltr(customer.phone)}</div></td>
                  <td data-label="${t('fields.requests')}">${t('admin.users.requestsSummary', { total: customer.requests_count, open: customer.open_requests })}</td>
                  <td data-label="${t('fields.joined')}">${timeTag(ctx, customer.created_at)}</td>
                </tr>`,
              )}</tbody>
            </table></div>`
          : html`<p class="muted">${t('admin.users.noCustomers')}</p>`}
      </section>
    </div>`;
  return page(ctx, { title: t('admin.users.title'), body, activeNav: 'users', wide: true });
}

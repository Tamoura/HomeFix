import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  csrfField, emptyState, errorSummary, field, money, offerCard, progressSteps, requestDetails, requestLink, requestTable,
  statTile, stars, statusBadge, statusFilterTabs, statusNote, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { formatLocalDateTime } from '../lib/format.js';
import { STATUS, can } from '../workflow.js';

export function dashboardPage(ctx, { requests, counts, status, query }) {
  const columns = [
    { label: 'Request', render: (row, base) => requestLink(row, base) },
    { label: 'Customer', render: (row) => html`${row.customer_name}<div class="muted small">${row.customer_phone || row.customer_email}</div>` },
    { label: 'Urgency', render: (row) => urgencyBadge(row.urgency) },
    { label: 'Status', render: (row) => statusBadge(row.status) },
    { label: 'Visit', render: (row) => (row.visit_at ? formatLocalDateTime(row.visit_at) : html`<span class="muted">—</span>`) },
    { label: 'Technician', render: (row) => row.technician_name ?? html`<span class="muted">—</span>` },
    { label: 'Updated', render: (row) => timeTag(row.updated_at) },
  ];
  const body = html`
    <div class="page-head">
      <div><h1>Operations dashboard</h1><p class="muted">Schedule inspection visits, record findings and follow every order to completion.</p></div>
      <form method="get" action="/admin" class="search-form" role="search">
        ${status && status !== 'all' ? html`<input type="hidden" name="status" value="${status}">` : ''}
        <input type="search" name="q" value="${query}" placeholder="Search title, customer, address…" aria-label="Search requests">
        <button type="submit" class="btn btn-secondary btn-sm">Search</button>
      </form>
    </div>
    <div class="stat-grid">
      ${statTile({ label: 'Needs a visit', value: counts.submitted, href: '/admin?status=submitted', tone: counts.submitted ? 'accent' : 'neutral' })}
      ${statTile({ label: 'Visits scheduled', value: counts.visit_scheduled, href: '/admin?status=visit_scheduled', tone: 'info' })}
      ${statTile({ label: 'Open for offers', value: counts.open_for_offers, href: '/admin?status=open_for_offers', tone: 'accent' })}
      ${statTile({ label: 'In progress', value: counts.in_progress, href: '/admin?status=in_progress', tone: 'warn' })}
      ${statTile({ label: 'Awaiting confirmation', value: counts.completed, href: '/admin?status=completed', tone: 'info' })}
      ${statTile({ label: 'Closed', value: counts.closed, href: '/admin?status=closed', tone: 'ok' })}
    </div>
    ${statusFilterTabs(counts, status, '/admin')}
    ${requests.length
      ? requestTable(requests, { linkBase: '/admin/requests', columns })
      : emptyState({ title: 'No requests found.', text: query ? 'Try a different search term.' : 'New customer requests will appear here.' })}`;
  return page(ctx, { title: 'Dashboard', body, activeNav: 'admin', wide: true });
}

export function requestShowPage(ctx, { request, offers, events, errors = {}, values = {} }) {
  const visitForm = can.scheduleVisit(request)
    ? html`<section class="card highlight">
        <h2>${request.status === STATUS.VISIT_SCHEDULED ? 'Reschedule the inspection visit' : 'Schedule the inspection visit'}</h2>
        <form method="post" action="/admin/requests/${request.id}/visit" class="stack">
          ${csrfField(ctx)}
          <div class="grid-2">
            ${field({ label: 'Visit date & time', name: 'visit_at', type: 'datetime-local', value: values.visit_at ?? request.visit_at ?? '', required: true, error: errors.visit_at })}
            ${field({ label: 'Note for the customer', name: 'visit_note', value: values.visit_note ?? request.visit_note ?? '', error: errors.visit_note, placeholder: 'e.g. Our inspector will call 30 minutes before arriving.' })}
          </div>
          <button type="submit" class="btn btn-primary">${request.status === STATUS.VISIT_SCHEDULED ? 'Update visit' : 'Schedule visit'}</button>
        </form>
      </section>`
    : '';

  const assessmentForm = can.completeVisit(request)
    ? html`<section class="card highlight">
        <h2>Record the inspection findings</h2>
        <p class="muted">Describe what was found and the scope of work. Technicians use this to price their offers, so be specific about materials, quantities and access.</p>
        <form method="post" action="/admin/requests/${request.id}/assessment" class="stack">
          ${csrfField(ctx)}
          ${field({ label: 'Findings & scope of work', name: 'assessment', type: 'textarea', rows: 6, value: values.assessment ?? '', required: true, error: errors.assessment })}
          <button type="submit" class="btn btn-primary">Complete visit & open for offers</button>
        </form>
      </section>`
    : '';

  const offersSection = offers.length
    ? html`<section class="card">
        <h2>Offers <span class="count">${offers.length}</span></h2>
        <div class="offer-list">${offers.map((offer) => offerCard(offer, ctx, { showContact: true }))}</div>
      </section>`
    : request.status === STATUS.OPEN_FOR_OFFERS
      ? html`<section class="card"><h2>Offers</h2>${emptyState({ title: 'No offers yet', text: 'Active technicians can see this request on their dashboard.' })}</section>`
      : '';

  const completionSection = [STATUS.COMPLETED, STATUS.CLOSED].includes(request.status)
    ? html`<section class="card">
        <h2>Completion</h2>
        <dl class="details">
          <div><dt>Technician</dt><dd>${request.technician_name}<div class="muted small">${request.technician_phone || ''} ${request.technician_email}</div></dd></div>
          <div><dt>Agreed price</dt><dd>${money(request.accepted_amount_cents, ctx)}</dd></div>
          <div><dt>Marked completed</dt><dd>${timeTag(request.completed_at)}</dd></div>
          ${request.status === STATUS.CLOSED ? html`<div><dt>Closed</dt><dd>${timeTag(request.closed_at)}</dd></div><div><dt>Rating</dt><dd>${stars(request.rating)}</dd></div>` : ''}
          ${request.completion_note ? html`<div class="details-wide"><dt>Technician note</dt><dd>${multiline(request.completion_note)}</dd></div>` : ''}
          ${request.review ? html`<div class="details-wide"><dt>Customer review</dt><dd>${multiline(request.review)}</dd></div>` : ''}
        </dl>
      </section>`
    : '';

  const cancelSection = can.adminCancel(request)
    ? html`<section class="card danger-zone">
        <h2>Cancel request</h2>
        <form method="post" action="/admin/requests/${request.id}/cancel" class="stack" data-confirm="Cancel request #${request.id}? Pending offers will be declined.">
          ${csrfField(ctx)}
          ${field({ label: 'Reason', name: 'reason', value: values.reason ?? '', error: errors.reason, placeholder: 'Shared with the customer in the activity log.' })}
          <button type="submit" class="btn btn-danger">Cancel request</button>
        </form>
      </section>`
    : '';

  const body = html`
    <p class="breadcrumb"><a href="/admin">Requests</a> / #${request.id}</p>
    <div class="page-head">
      <div>
        <h1>${request.title}</h1>
        <p class="muted">Request #${request.id} · ${request.category} · submitted ${timeTag(request.created_at)}</p>
      </div>
      ${statusBadge(request.status)}
    </div>
    ${progressSteps(request)}
    ${statusNote(request, 'admin')}
    ${request.status === STATUS.CANCELLED && request.cancel_reason ? html`<p class="muted">Reason: ${request.cancel_reason}</p>` : ''}
    ${errorSummary(errors)}
    <div class="layout-2">
      <div class="stack">
        ${visitForm}
        ${assessmentForm}
        <section class="card"><h2>Request details</h2>${requestDetails(request, { showCustomer: true, showContact: true })}</section>
        ${visitCard(request)}
        ${offersSection}
        ${completionSection}
        ${cancelSection}
      </div>
      <aside class="stack">
        <section class="card"><h2>Activity</h2>${timeline(events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: `#${request.id} ${request.title}`, body, activeNav: 'admin', wide: true });
}

function statusForm(ctx, user, status, label, cls, confirm) {
  return html`<form method="post" action="/admin/users/${user.id}/status" class="inline-form"${confirm ? html` data-confirm="${confirm}"` : ''}>
    ${csrfField(ctx)}
    <input type="hidden" name="status" value="${status}">
    <button type="submit" class="btn ${cls} btn-sm">${label}</button>
  </form>`;
}

export function usersPage(ctx, { technicians, customers, errors = {}, values = {} }) {
  const pending = technicians.filter((tech) => tech.status === 'pending');
  const others = technicians.filter((tech) => tech.status !== 'pending');
  const body = html`
    <div class="page-head">
      <div><h1>Users</h1><p class="muted">Approve technician accounts, manage availability and review customers.</p></div>
    </div>
    <div class="stack">
      <details class="card details-card"${Object.keys(errors).length ? ' open' : ''}>
        <summary><h2>Add a technician</h2><span class="muted small">Create an approved account directly</span></summary>
        <div class="details-body">
          <p class="muted">Creates an approved technician account. Share the temporary password with them directly.</p>
          ${errorSummary(errors)}
          <form method="post" action="/admin/users" class="stack">
            ${csrfField(ctx)}
            ${field({ label: 'Full name', name: 'name', value: values.name ?? '', required: true, error: errors.name })}
            ${field({ label: 'Email', name: 'email', type: 'email', value: values.email ?? '', required: true, error: errors.email })}
            ${field({ label: 'Phone', name: 'phone', type: 'tel', value: values.phone ?? '', error: errors.phone })}
            ${field({ label: 'Specialty', name: 'specialty', value: values.specialty ?? '', required: true, error: errors.specialty, placeholder: 'e.g. Plumbing' })}
            ${field({ label: 'Temporary password', name: 'password', type: 'password', required: true, error: errors.password, hint: 'At least 8 characters.' })}
            <button type="submit" class="btn btn-primary">Create technician</button>
          </form>
        </div>
      </details>
        <section class="card">
          <h2>Technicians awaiting approval <span class="count">${pending.length}</span></h2>
          ${pending.length
            ? html`<div class="table-wrap"><table class="table">
                <thead><tr><th>Name</th><th>Specialty</th><th>Contact</th><th>Registered</th><th></th></tr></thead>
                <tbody>${pending.map(
                  (tech) => html`<tr>
                    <td data-label="Name">${tech.name}</td>
                    <td data-label="Specialty">${tech.specialty}</td>
                    <td data-label="Contact">${tech.email}<div class="muted small">${tech.phone}</div></td>
                    <td data-label="Registered">${timeTag(tech.created_at)}</td>
                    <td data-label="Actions" class="actions">${statusForm(ctx, tech, 'active', 'Approve', 'btn-primary')} ${statusForm(ctx, tech, 'disabled', 'Reject', 'btn-ghost', `Reject ${tech.name}'s application?`)}</td>
                  </tr>`,
                )}</tbody>
              </table></div>`
            : html`<p class="muted">No pending applications.</p>`}
        </section>
        <section class="card">
          <h2>Technicians <span class="count">${others.length}</span></h2>
          ${others.length
            ? html`<div class="table-wrap"><table class="table">
                <thead><tr><th>Name</th><th>Specialty</th><th>Contact</th><th>Rating</th><th>Jobs</th><th>Status</th><th></th></tr></thead>
                <tbody>${others.map(
                  (tech) => html`<tr>
                    <td data-label="Name">${tech.name}</td>
                    <td data-label="Specialty">${tech.specialty}</td>
                    <td data-label="Contact">${tech.email}<div class="muted small">${tech.phone}</div></td>
                    <td data-label="Rating">${stars(tech.avg_rating)}</td>
                    <td data-label="Jobs" class="nowrap">${tech.closed_jobs} closed · ${tech.active_jobs} active · ${tech.offers_count} offers</td>
                    <td data-label="Status">${tech.status === 'active' ? html`<span class="badge badge-ok">Active</span>` : html`<span class="badge badge-danger">Disabled</span>`}</td>
                    <td data-label="Actions" class="actions">${tech.status === 'active'
                      ? statusForm(ctx, tech, 'disabled', 'Deactivate', 'btn-ghost', `Deactivate ${tech.name}? They will be signed out and cannot send offers.`)
                      : statusForm(ctx, tech, 'active', 'Reactivate', 'btn-secondary')}</td>
                  </tr>`,
                )}</tbody>
              </table></div>`
            : html`<p class="muted">No technicians yet. Add one below or approve pending applications.</p>`}
        </section>
        <section class="card">
          <h2>Customers <span class="count">${customers.length}</span></h2>
          ${customers.length
            ? html`<div class="table-wrap"><table class="table">
                <thead><tr><th>Name</th><th>Contact</th><th>Requests</th><th>Joined</th></tr></thead>
                <tbody>${customers.map(
                  (customer) => html`<tr>
                    <td data-label="Name">${customer.name}</td>
                    <td data-label="Contact">${customer.email}<div class="muted small">${customer.phone}</div></td>
                    <td data-label="Requests">${customer.requests_count} total · ${customer.open_requests} active</td>
                    <td data-label="Joined">${timeTag(customer.created_at)}</td>
                  </tr>`,
                )}</tbody>
              </table></div>`
            : html`<p class="muted">No customers yet.</p>`}
        </section>
    </div>`;
  return page(ctx, { title: 'Users', body, activeNav: 'users', wide: true });
}

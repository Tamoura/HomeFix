import { html, multiline } from '../lib/html.js';
import { page } from './layout.js';
import {
  csrfField, emptyState, errorSummary, field, money, offerStatusBadge, progressSteps, requestDetails, statTile, stars, statusBadge,
  statusNote, timeTag, timeline, urgencyBadge, visitCard,
} from './components.js';
import { truncate } from '../lib/format.js';
import { STATUS, can } from '../workflow.js';

export function dashboardPage(ctx, { stats, open, jobs, offers }) {
  const activeJobs = jobs.filter((job) => [STATUS.IN_PROGRESS, STATUS.COMPLETED].includes(job.status));
  const pastJobs = jobs.filter((job) => ![STATUS.IN_PROGRESS, STATUS.COMPLETED].includes(job.status));
  const body = html`
    <div class="page-head">
      <div><h1>Technician dashboard</h1><p class="muted">Welcome, ${ctx.user.name} · ${ctx.user.specialty || 'Technician'}</p></div>
    </div>
    <div class="stat-grid">
      ${statTile({ label: 'Open for offers', value: stats.open_requests, href: '#open', tone: 'accent' })}
      ${statTile({ label: 'My pending offers', value: stats.pending_offers, href: '#offers', tone: 'info' })}
      ${statTile({ label: 'Active jobs', value: stats.active_jobs, href: '#jobs', tone: 'warn' })}
      ${statTile({ label: 'Completed jobs', value: stats.closed_jobs, tone: 'ok' })}
      ${statTile({ label: 'Average rating', value: stats.avg_rating ? Number(stats.avg_rating).toFixed(1) : '—', tone: 'neutral' })}
    </div>

    <section class="card" id="jobs">
      <h2>My active jobs <span class="count">${activeJobs.length}</span></h2>
      ${activeJobs.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>Job</th><th>Customer</th><th>Agreed price</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>${activeJobs.map(
              (job) => html`<tr>
                <td data-label="Job"><a class="table-title" href="/tech/requests/${job.id}">${job.title}</a><div class="muted small">#${job.id} · ${job.category} · ${job.address}</div></td>
                <td data-label="Customer">${job.customer_name}<div class="muted small">${job.customer_phone}</div></td>
                <td data-label="Agreed price">${money(job.accepted_amount_cents, ctx)}</td>
                <td data-label="Status">${statusBadge(job.status)}</td>
                <td data-label="Updated">${timeTag(job.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : html`<p class="muted">No assigned jobs right now. Send offers on open requests below.</p>`}
    </section>

    <section class="card" id="open">
      <h2>Requests open for offers <span class="count">${open.length}</span></h2>
      ${open.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>Request</th><th>Scope of work</th><th>Urgency</th><th>Offers</th><th>My offer</th><th></th></tr></thead>
            <tbody>${open.map(
              (row) => html`<tr>
                <td data-label="Request"><a class="table-title" href="/tech/requests/${row.id}">${row.title}</a><div class="muted small">#${row.id} · ${row.category} · ${row.address}</div></td>
                <td data-label="Scope of work" class="cell-wrap">${truncate(row.assessment, 140)}</td>
                <td data-label="Urgency">${urgencyBadge(row.urgency)}</td>
                <td data-label="Offers">${row.pending_offers}</td>
                <td data-label="My offer">${row.my_offer_id ? html`${money(row.my_offer_amount_cents, ctx)} ${offerStatusBadge(row.my_offer_status)}` : html`<span class="muted">—</span>`}</td>
                <td data-label="Actions"><a class="btn btn-sm ${row.my_offer_status === 'pending' ? 'btn-secondary' : 'btn-primary'}" href="/tech/requests/${row.id}">${row.my_offer_status === 'pending' ? 'Edit offer' : 'Send offer'}</a></td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : emptyState({ title: 'Nothing open right now', text: 'Requests appear here after the admin inspection visit is completed.' })}
    </section>

    <section class="card" id="offers">
      <h2>My offers <span class="count">${offers.length}</span></h2>
      ${offers.length
        ? html`<div class="table-wrap"><table class="table">
            <thead><tr><th>Request</th><th>Price</th><th>Duration</th><th>Offer status</th><th>Request status</th><th>Updated</th></tr></thead>
            <tbody>${offers.map(
              (offer) => html`<tr>
                <td data-label="Request"><a class="table-title" href="/tech/requests/${offer.request_id}">${offer.request_title}</a><div class="muted small">#${offer.request_id} · ${offer.category}</div></td>
                <td data-label="Price">${money(offer.amount_cents, ctx)}</td>
                <td data-label="Duration">${offer.duration}</td>
                <td data-label="Offer status">${offerStatusBadge(offer.status)}</td>
                <td data-label="Request status">${statusBadge(offer.request_status)}</td>
                <td data-label="Updated">${timeTag(offer.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>`
        : html`<p class="muted">You have not sent any offers yet.</p>`}
    </section>

    ${pastJobs.length
      ? html`<section class="card">
          <h2>Past jobs <span class="count">${pastJobs.length}</span></h2>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Job</th><th>Agreed price</th><th>Status</th><th>Rating</th><th>Updated</th></tr></thead>
            <tbody>${pastJobs.map(
              (job) => html`<tr>
                <td data-label="Job"><a class="table-title" href="/tech/requests/${job.id}">${job.title}</a><div class="muted small">#${job.id} · ${job.category}</div></td>
                <td data-label="Agreed price">${money(job.accepted_amount_cents, ctx)}</td>
                <td data-label="Status">${statusBadge(job.status)}</td>
                <td data-label="Rating">${stars(job.rating)}</td>
                <td data-label="Updated">${timeTag(job.updated_at)}</td>
              </tr>`,
            )}</tbody>
          </table></div>
        </section>`
      : ''}`;
  return page(ctx, { title: 'Technician dashboard', body, activeNav: 'tech', wide: true });
}

export function requestShowPage(ctx, { request, myOffer, events, errors = {}, values = {} }) {
  const assigned = request.technician_id === ctx.user.id;
  const offerSection = () => {
    if (can.submitOffer(request)) {
      const editing = myOffer && myOffer.status === 'pending';
      return html`<section class="card highlight">
        <h2>${editing ? 'Your offer' : 'Send an offer'}</h2>
        ${editing ? html`<p class="muted">Your offer of ${money(myOffer.amount_cents, ctx)} is pending. You can update it until the customer decides.</p>` : html`<p class="muted">Price the full scope of work described in the inspection findings. The customer sees your price, time estimate and rating.</p>`}
        <form method="post" action="/tech/requests/${request.id}/offer" class="stack">
          ${csrfField(ctx)}
          <div class="grid-2">
            ${field({ label: `Price (${ctx.config.currency})`, name: 'amount', type: 'text', value: values.amount ?? (myOffer ? (myOffer.amount_cents / 100).toFixed(2) : ''), required: true, error: errors.amount, placeholder: '0.00' })}
            ${field({ label: 'Estimated duration', name: 'duration', value: values.duration ?? myOffer?.duration ?? '', required: true, error: errors.duration, placeholder: 'e.g. 2 days' })}
          </div>
          ${field({ label: 'Note to the customer', name: 'note', type: 'textarea', rows: 4, value: values.note ?? myOffer?.note ?? '', error: errors.note, placeholder: 'What is included, materials, warranty, availability.' })}
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${editing ? 'Update offer' : 'Submit offer'}</button>
          </div>
        </form>
        ${editing
          ? html`<form method="post" action="/tech/requests/${request.id}/offer/withdraw" class="inline-form" data-confirm="Withdraw your offer?">
              ${csrfField(ctx)}
              <button type="submit" class="btn btn-ghost btn-sm">Withdraw offer</button>
            </form>`
          : ''}
      </section>`;
    }
    if (myOffer) {
      return html`<section class="card">
        <h2>Your offer</h2>
        <p>${money(myOffer.amount_cents, ctx)} · ${myOffer.duration} ${offerStatusBadge(myOffer.status)}</p>
        ${myOffer.note ? html`<p class="muted">${multiline(myOffer.note)}</p>` : ''}
      </section>`;
    }
    return '';
  };

  const workSection = () => {
    if (!assigned) return '';
    if (can.completeWork(request, ctx.user)) {
      return html`<section class="card highlight">
        <h2>Complete the job</h2>
        <p class="muted">Agreed price ${money(request.accepted_amount_cents, ctx)} · ${request.accepted_duration}. When the work is done, mark it as completed so the customer can confirm.</p>
        <form method="post" action="/tech/requests/${request.id}/complete" class="stack" data-confirm="Mark this job as completed?">
          ${csrfField(ctx)}
          ${field({ label: 'Completion note (optional)', name: 'completion_note', type: 'textarea', rows: 4, value: values.completion_note ?? '', error: errors.completion_note, placeholder: 'What was done, parts replaced, care instructions.' })}
          <button type="submit" class="btn btn-primary">Mark as completed</button>
        </form>
      </section>`;
    }
    if (request.status === STATUS.COMPLETED) {
      return html`<section class="card"><h2>Awaiting customer confirmation</h2><p>You marked this job as completed ${timeTag(request.completed_at)}. The customer will confirm or send it back with comments.</p></section>`;
    }
    if (request.status === STATUS.CLOSED) {
      return html`<section class="card"><h2>Job closed</h2><p>Confirmed by the customer ${timeTag(request.closed_at)} · ${stars(request.rating)}</p>${request.review ? html`<blockquote>${multiline(request.review)}</blockquote>` : ''}</section>`;
    }
    return '';
  };

  const body = html`
    <p class="breadcrumb"><a href="/tech">Dashboard</a> / #${request.id}</p>
    <div class="page-head">
      <div>
        <h1>${request.title}</h1>
        <p class="muted">Request #${request.id} · ${request.category} · ${request.address}</p>
      </div>
      ${statusBadge(request.status)}
    </div>
    ${progressSteps(request)}
    ${statusNote(request, 'admin')}
    ${errorSummary(errors)}
    <div class="layout-2">
      <div class="stack">
        ${offerSection()}
        ${workSection()}
        ${visitCard(request)}
        <section class="card"><h2>Request details</h2>${requestDetails(request, { showCustomer: true, showContact: assigned })}</section>
      </div>
      <aside class="stack">
        <section class="card"><h2>Activity</h2>${timeline(events)}</section>
      </aside>
    </div>`;
  return page(ctx, { title: request.title, body, activeNav: 'tech', wide: true });
}

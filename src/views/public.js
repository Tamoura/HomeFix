import { html } from '../lib/html.js';
import { page } from './layout.js';
import { csrfField, errorSummary, field } from './components.js';
import { CATEGORIES } from '../workflow.js';
import { homePathFor } from '../auth.js';

const STEP_CARDS = [
  {
    title: 'Submit a request',
    text: 'Describe the problem, add the property address and how urgent it is. It takes two minutes.',
  },
  {
    title: 'Inspection visit',
    text: 'Our admin team schedules a visit, inspects the issue on site and records the scope of work.',
  },
  {
    title: 'Compare technician offers',
    text: 'Vetted technicians send priced offers with a time estimate. You pick the one you prefer.',
  },
  {
    title: 'Work done & confirmed',
    text: 'The technician completes the job, you confirm it, rate the service and the order closes.',
  },
];

export function homePage(ctx) {
  const { user } = ctx;
  const primaryHref = user ? (user.role === 'customer' ? '/requests/new' : homePathFor(user)) : '/register';
  const primaryLabel = user ? (user.role === 'customer' ? 'Submit a new request' : 'Go to your dashboard') : 'Request a service';
  const body = html`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Home maintenance services</p>
        <h1>Home repairs, handled end to end.</h1>
        <p class="lead">Submit a maintenance request, get an inspection visit from our team, compare offers from vetted technicians and track the job until it is done.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="${primaryHref}">${primaryLabel}</a>
          ${user ? '' : html`<a class="btn btn-secondary btn-lg" href="/login">Log in</a>`}
        </div>
      </div>
      <div class="hero-panel" aria-hidden="true">
        <div class="hero-card">
          <div class="hero-card-row"><span class="badge badge-neutral">Submitted</span><span>Kitchen sink leaking</span></div>
          <div class="hero-card-row"><span class="badge badge-info">Visit scheduled</span><span>AC not cooling</span></div>
          <div class="hero-card-row"><span class="badge badge-accent">Open for offers</span><span>Bathroom lights · 2 offers</span></div>
          <div class="hero-card-row"><span class="badge badge-warn">In progress</span><span>Repaint living room</span></div>
          <div class="hero-card-row"><span class="badge badge-ok">Closed</span><span>Door hinge · ★★★★★</span></div>
        </div>
      </div>
    </section>

    <section id="how-it-works" class="section">
      <h2>How it works</h2>
      <ol class="how-grid">
        ${STEP_CARDS.map((step, index) => html`<li class="how-card"><span class="how-number">${index + 1}</span><h3>${step.title}</h3><p>${step.text}</p></li>`)}
      </ol>
    </section>

    <section class="section">
      <h2>Services we cover</h2>
      <ul class="chips">${CATEGORIES.map((category) => html`<li class="chip">${category}</li>`)}</ul>
    </section>

    <section class="section split">
      <div class="card">
        <h2>For homeowners</h2>
        <p>One place to report issues, follow the inspection, choose an offer and confirm the finished work. Every step is logged so you always know what happens next.</p>
        <a class="btn btn-primary" href="${user?.role === 'customer' ? '/requests' : '/register'}">${user?.role === 'customer' ? 'View my requests' : 'Create a customer account'}</a>
      </div>
      <div class="card">
        <h2>For technicians</h2>
        <p>Browse inspected jobs with a clear scope of work, send your price and time estimate, and get assigned when the customer accepts. Ratings build your reputation.</p>
        <a class="btn btn-secondary" href="${user?.role === 'technician' ? '/tech' : '/register?role=technician'}">${user?.role === 'technician' ? 'Open technician dashboard' : 'Join as a technician'}</a>
      </div>
    </section>`;
  return page(ctx, { title: '', body, activeNav: 'home' });
}

export function loginPage(ctx, { values = {}, error = '', next = '' } = {}) {
  const body = html`
    <section class="auth-card card">
      <h1>Log in</h1>
      <p class="muted">Welcome back. Sign in to manage your maintenance requests.</p>
      ${error ? html`<div class="flash flash-error" role="alert">${error}</div>` : ''}
      <form method="post" action="/login" class="stack">
        ${csrfField(ctx)}
        ${next ? html`<input type="hidden" name="next" value="${next}">` : ''}
        ${field({ label: 'Email', name: 'email', type: 'email', value: values.email ?? '', required: true, autocomplete: 'email', autofocus: true })}
        ${field({ label: 'Password', name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}
        <button type="submit" class="btn btn-primary">Log in</button>
      </form>
      <p class="muted">No account yet? <a href="/register">Create one</a>.</p>
    </section>`;
  return page(ctx, { title: 'Log in', body, activeNav: 'login' });
}

export function registerPage(ctx, { values = {}, errors = {} } = {}) {
  const role = values.role === 'technician' ? 'technician' : 'customer';
  const body = html`
    <section class="auth-card card">
      <h1>Create your account</h1>
      <p class="muted">Customers can submit requests right away. Technician accounts are reviewed by our team before they can send offers.</p>
      ${errorSummary(errors)}
      <form method="post" action="/register" class="stack" data-register-form>
        ${csrfField(ctx)}
        <fieldset class="field">
          <legend>I am a</legend>
          <div class="radio-row">
            <label class="radio"><input type="radio" name="role" value="customer"${role === 'customer' ? ' checked' : ''}> Homeowner / customer</label>
            <label class="radio"><input type="radio" name="role" value="technician"${role === 'technician' ? ' checked' : ''}> Technician</label>
          </div>
        </fieldset>
        ${field({ label: 'Full name', name: 'name', value: values.name ?? '', required: true, error: errors.name, autocomplete: 'name' })}
        ${field({ label: 'Email', name: 'email', type: 'email', value: values.email ?? '', required: true, error: errors.email, autocomplete: 'email' })}
        ${field({ label: 'Phone', name: 'phone', type: 'tel', value: values.phone ?? '', error: errors.phone, autocomplete: 'tel', hint: 'Used to coordinate visits and work.' })}
        <div data-technician-only${role === 'technician' ? '' : ' hidden'}>
          ${field({ label: 'Specialty', name: 'specialty', value: values.specialty ?? '', error: errors.specialty, placeholder: 'e.g. Plumbing, Electrical, Air conditioning', hint: 'Technicians only.' })}
        </div>
        ${field({ label: 'Password', name: 'password', type: 'password', required: true, error: errors.password, autocomplete: 'new-password', hint: 'At least 8 characters.' })}
        ${field({ label: 'Confirm password', name: 'password_confirm', type: 'password', required: true, error: errors.password_confirm, autocomplete: 'new-password' })}
        <button type="submit" class="btn btn-primary">Create account</button>
      </form>
      <p class="muted">Already registered? <a href="/login">Log in</a>.</p>
    </section>`;
  return page(ctx, { title: 'Register', body, activeNav: 'register' });
}

export function errorPage(ctx, { status, message }) {
  const titles = { 400: 'Bad request', 403: 'Not allowed', 404: 'Page not found', 405: 'Not allowed', 409: 'Action not available', 413: 'Too large', 500: 'Something went wrong' };
  const body = html`
    <section class="card error-card">
      <p class="eyebrow">Error ${status}</p>
      <h1>${titles[status] ?? 'Error'}</h1>
      <p>${message}</p>
      <p><a class="btn btn-secondary" href="${homePathFor(ctx.user)}">${ctx.user ? 'Back to your dashboard' : 'Back to home'}</a></p>
    </section>`;
  return page(ctx, { title: titles[status] ?? 'Error', body });
}

export function pendingApprovalPage(ctx) {
  const body = html`
    <section class="card auth-card">
      <p class="eyebrow">Technician account</p>
      <h1>Your account is awaiting approval</h1>
      <p>Thanks for joining, ${ctx.user.name}. Our team reviews every technician profile before it can see open requests and send offers. You will be able to use the dashboard as soon as an administrator approves your account.</p>
      <p class="muted">Registered specialty: <strong>${ctx.user.specialty || '—'}</strong>. Contact support if you need to change it.</p>
    </section>`;
  return page(ctx, { title: 'Awaiting approval', body, activeNav: 'tech' });
}

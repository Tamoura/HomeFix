import { html } from '../lib/html.js';
import { page } from './layout.js';
import { csrfField, errorSummary, field } from './components.js';
import { CATEGORIES } from '../workflow.js';
import { homePathFor } from '../auth.js';

const DEMO_TONES = ['neutral', 'info', 'accent', 'warn', 'ok'];

export function homePage(ctx) {
  const { user, t } = ctx;
  const primaryHref = user ? (user.role === 'customer' ? '/requests/new' : homePathFor(user)) : '/register';
  const primaryLabel = user ? (user.role === 'customer' ? t('home.submitNew') : t('home.goToDashboard')) : t('home.requestService');
  const demoRows = t('home.demo');
  const body = html`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">${t('home.eyebrow')}</p>
        <h1>${t('home.title')}</h1>
        <p class="lead">${t('home.lead')}</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="${primaryHref}">${primaryLabel}</a>
          ${user ? '' : html`<a class="btn btn-secondary btn-lg" href="/login">${t('home.login')}</a>`}
        </div>
      </div>
      <div class="hero-panel" aria-hidden="true">
        <div class="hero-card">
          ${demoRows.map((text, index) => html`<div class="hero-card-row"><span class="badge badge-${DEMO_TONES[index] ?? 'neutral'}">${t(`status.${['submitted', 'visit_scheduled', 'open_for_offers', 'in_progress', 'closed'][index]}`)}</span><span>${text}</span></div>`)}
        </div>
      </div>
    </section>

    <section id="how-it-works" class="section">
      <h2>${t('home.howItWorks')}</h2>
      <ol class="how-grid">
        ${t('home.steps').map((step, index) => html`<li class="how-card"><span class="how-number">${index + 1}</span><h3>${step.title}</h3><p>${step.text}</p></li>`)}
      </ol>
    </section>

    <section class="section">
      <h2>${t('home.services')}</h2>
      <ul class="chips">${CATEGORIES.map((category) => html`<li class="chip">${t(`categories.${category}`)}</li>`)}</ul>
    </section>

    <section class="section split">
      <div class="card">
        <h2>${t('home.forHomeowners.title')}</h2>
        <p>${t('home.forHomeowners.text')}</p>
        <a class="btn btn-primary" href="${user?.role === 'customer' ? '/requests' : '/register'}">${user?.role === 'customer' ? t('home.forHomeowners.ctaLoggedIn') : t('home.forHomeowners.cta')}</a>
      </div>
      <div class="card">
        <h2>${t('home.forTechnicians.title')}</h2>
        <p>${t('home.forTechnicians.text')}</p>
        <a class="btn btn-secondary" href="${user?.role === 'technician' ? '/tech' : '/register?role=technician'}">${user?.role === 'technician' ? t('home.forTechnicians.ctaLoggedIn') : t('home.forTechnicians.cta')}</a>
      </div>
    </section>`;
  return page(ctx, { title: '', body, activeNav: 'home' });
}

export function loginPage(ctx, { values = {}, error = '', next = '' } = {}) {
  const t = ctx.t;
  const body = html`
    <section class="auth-card card">
      <h1>${t('auth.loginTitle')}</h1>
      <p class="muted">${t('auth.loginIntro')}</p>
      ${error ? html`<div class="flash flash-error" role="alert">${error}</div>` : ''}
      <form method="post" action="/login" class="stack">
        ${csrfField(ctx)}
        ${next ? html`<input type="hidden" name="next" value="${next}">` : ''}
        ${field({ label: t('auth.email'), name: 'email', type: 'email', value: values.email ?? '', required: true, autocomplete: 'email', autofocus: true })}
        ${field({ label: t('auth.password'), name: 'password', type: 'password', required: true, autocomplete: 'current-password' })}
        <button type="submit" class="btn btn-primary">${t('auth.loginButton')}</button>
      </form>
      <p class="muted">${t('auth.noAccount')} <a href="/register">${t('auth.createOne')}</a>.</p>
    </section>`;
  return page(ctx, { title: t('auth.loginTitle'), body, activeNav: 'login' });
}

export function registerPage(ctx, { values = {}, errors = {} } = {}) {
  const t = ctx.t;
  const role = values.role === 'technician' ? 'technician' : 'customer';
  const body = html`
    <section class="auth-card card">
      <h1>${t('auth.registerTitle')}</h1>
      <p class="muted">${t('auth.registerIntro')}</p>
      ${errorSummary(ctx, errors)}
      <form method="post" action="/register" class="stack" data-register-form>
        ${csrfField(ctx)}
        <fieldset class="field">
          <legend>${t('auth.iAm')}</legend>
          <div class="radio-row">
            <label class="radio"><input type="radio" name="role" value="customer"${role === 'customer' ? ' checked' : ''}> ${t('auth.roleCustomer')}</label>
            <label class="radio"><input type="radio" name="role" value="technician"${role === 'technician' ? ' checked' : ''}> ${t('auth.roleTechnician')}</label>
          </div>
        </fieldset>
        ${field({ label: t('auth.fullName'), name: 'name', value: values.name ?? '', required: true, error: errors.name, autocomplete: 'name' })}
        ${field({ label: t('auth.email'), name: 'email', type: 'email', value: values.email ?? '', required: true, error: errors.email, autocomplete: 'email' })}
        ${field({ label: t('auth.phone'), name: 'phone', type: 'tel', value: values.phone ?? '', error: errors.phone, autocomplete: 'tel', hint: t('auth.phoneHint') })}
        <div data-technician-only${role === 'technician' ? '' : ' hidden'}>
          ${field({ label: t('auth.specialty'), name: 'specialty', value: values.specialty ?? '', error: errors.specialty, placeholder: t('auth.specialtyPlaceholder'), hint: t('auth.specialtyHint') })}
        </div>
        ${field({ label: t('auth.password'), name: 'password', type: 'password', required: true, error: errors.password, autocomplete: 'new-password', hint: t('auth.passwordHint') })}
        ${field({ label: t('auth.confirmPassword'), name: 'password_confirm', type: 'password', required: true, error: errors.password_confirm, autocomplete: 'new-password' })}
        <button type="submit" class="btn btn-primary">${t('auth.createAccount')}</button>
      </form>
      <p class="muted">${t('auth.alreadyRegistered')} <a href="/login">${t('auth.loginLink')}</a>.</p>
    </section>`;
  return page(ctx, { title: t('auth.registerTitle'), body, activeNav: 'register' });
}

export function errorPage(ctx, { status, message }) {
  const t = ctx.t;
  const titleKey = `errors.titles.${status}`;
  const title = t(titleKey) === titleKey ? t('errors.generic') : t(titleKey);
  const body = html`
    <section class="card error-card">
      <p class="eyebrow">${t('errors.errorLabel', { status })}</p>
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a class="btn btn-secondary" href="${homePathFor(ctx.user)}">${ctx.user ? t('errors.backDashboard') : t('errors.backHome')}</a></p>
    </section>`;
  return page(ctx, { title, body });
}

export function pendingApprovalPage(ctx) {
  const t = ctx.t;
  const body = html`
    <section class="card auth-card">
      <p class="eyebrow">${t('auth.pendingEyebrow')}</p>
      <h1>${t('auth.pendingTitle')}</h1>
      <p>${t('auth.pendingText', { name: ctx.user.name })}</p>
      <p class="muted">${t('auth.pendingSpecialty')} <strong>${ctx.user.specialty || '—'}</strong>. ${t('auth.pendingContact')}</p>
    </section>`;
  return page(ctx, { title: t('auth.pendingTitle'), body, activeNav: 'tech' });
}

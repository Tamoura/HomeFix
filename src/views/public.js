import { html } from '../lib/html.js';
import { page } from './layout.js';
import { csrfField, errorSummary, field } from './components.js';
import { BENEFIT_ICONS, TECH_BENEFIT_ICONS, categoryIcon } from './icons.js';
import { CATEGORIES } from '../workflow.js';
import { homePathFor } from '../auth.js';

const DEMO_TONES = ['neutral', 'info', 'accent', 'warn', 'ok'];
const DEMO_STATUSES = ['submitted', 'visit_scheduled', 'open_for_offers', 'in_progress', 'closed'];

function demoCard(ctx) {
  const rows = ctx.t('home.demo');
  return html`<div class="hero-panel" aria-hidden="true">
    <div class="hero-card">
      ${rows.map((text, index) => html`<div class="hero-card-row"><span class="badge badge-${DEMO_TONES[index] ?? 'neutral'}">${ctx.t(`status.${DEMO_STATUSES[index]}`)}</span><span>${text}</span></div>`)}
    </div>
  </div>`;
}

function stepsSection(ctx, id, title, steps) {
  return html`<section id="${id}" class="section">
    <h2>${title}</h2>
    <ol class="how-grid">
      ${steps.map((step, index) => html`<li class="how-card"><span class="how-number">${index + 1}</span><h3>${step.title}</h3><p>${step.text}</p></li>`)}
    </ol>
  </section>`;
}

function benefitsSection(ctx, title, benefits, icons) {
  return html`<section class="section">
    <h2>${title}</h2>
    <ul class="benefit-grid">
      ${benefits.map((benefit, index) => html`<li class="benefit-card"><span class="benefit-icon">${icons[index] ?? ''}</span><h3>${benefit.title}</h3><p>${benefit.text}</p></li>`)}
    </ul>
  </section>`;
}

function ctaBand(ctx, { title, text, primary, secondary }) {
  return html`<section class="cta-band">
    <h2>${title}</h2>
    <p>${text}</p>
    ${primary}
    ${secondary ? html`<p class="cta-login">${secondary}</p>` : ''}
  </section>`;
}

// Customer-facing landing page (the site's front page).
export function homePage(ctx, { stats } = {}) {
  const { user, t } = ctx;
  const app = ctx.config.appName;
  const primaryHref = user ? (user.role === 'customer' ? '/requests/new' : homePathFor(user)) : '/register';
  const primaryLabel = user ? (user.role === 'customer' ? t('home.submitNew') : t('home.goToDashboard')) : t('home.requestService');
  const primaryButton = html`<a class="btn btn-primary btn-lg" href="${primaryHref}">${primaryLabel}</a>`;
  const showStats = Boolean(stats && stats.closed_jobs > 0);
  const body = html`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">${t('home.eyebrow')}</p>
        <h1>${t('home.title')}</h1>
        <p class="lead">${t('home.lead')}</p>
        <div class="hero-actions">
          ${primaryButton}
          <a class="btn btn-secondary btn-lg" href="#how-it-works">${t('home.seeHow')}</a>
        </div>
        <ul class="trust">${t('home.trust').map((item) => html`<li>${item}</li>`)}</ul>
      </div>
      ${demoCard(ctx)}
    </section>

    ${showStats
      ? html`<section class="stats-strip" aria-label="${t('home.statsLabel')}">
          <div><strong>${ctx.fmt.number(stats.closed_jobs)}</strong><span>${t('home.stats.jobs')}</span></div>
          <div><strong>${ctx.fmt.number(stats.technicians)}</strong><span>${t('home.stats.technicians')}</span></div>
          ${stats.avg_rating ? html`<div><strong>★ ${Number(stats.avg_rating).toFixed(1)}</strong><span>${t('home.stats.rating')}</span></div>` : ''}
        </section>`
      : ''}

    ${benefitsSection(ctx, t('home.whyTitle', { app }), t('home.benefits'), BENEFIT_ICONS)}
    ${stepsSection(ctx, 'how-it-works', t('home.howItWorks'), t('home.steps'))}

    <section id="services" class="section">
      <h2>${t('home.services')}</h2>
      <p class="section-lead">${t('home.servicesLead')}</p>
      <ul class="service-grid">
        ${CATEGORIES.map((key) => html`<li class="service-card"><span class="service-icon">${categoryIcon(key)}</span><div><h3>${t(`categories.${key}`)}</h3><p>${t(`services.${key}`)}</p></div></li>`)}
      </ul>
    </section>

    <section class="section">
      <h2>${t('home.faqTitle')}</h2>
      <div class="faq">
        ${t('home.faq').map((item) => html`<details><summary>${item.q}</summary><p>${item.a}</p></details>`)}
      </div>
    </section>

    ${ctaBand(ctx, {
      title: t('home.ctaTitle'),
      text: t('home.ctaText'),
      primary: primaryButton,
      secondary: user ? '' : html`${t('home.ctaLogin')} <a href="/login">${t('nav.login')}</a>`,
    })}
    ${user ? '' : html`<p class="tech-callout">${t('home.techCallout')} <a href="/technicians">${t('home.techCalloutLink', { app })}</a></p>`}`;
  return page(ctx, { title: '', description: t('home.metaDescription'), body, activeNav: 'home', wide: true });
}

// Recruitment page for technicians.
export function techniciansPage(ctx) {
  const { user, t } = ctx;
  const app = ctx.config.appName;
  let actions;
  if (user?.role === 'technician') actions = html`<a class="btn btn-primary btn-lg" href="/tech">${t('home.goToDashboard')}</a>`;
  else if (user) actions = '';
  else actions = html`<a class="btn btn-primary btn-lg" href="/register?role=technician">${t('technicians.cta')}</a> <a class="btn btn-secondary btn-lg" href="/login">${t('technicians.login')}</a>`;
  const body = html`
    <section class="hero hero-single">
      <div class="hero-copy">
        <p class="eyebrow">${t('technicians.eyebrow')}</p>
        <h1>${t('technicians.title')}</h1>
        <p class="lead">${t('technicians.lead', { app })}</p>
        ${actions ? html`<div class="hero-actions">${actions}</div>` : ''}
      </div>
    </section>
    ${benefitsSection(ctx, t('technicians.whyTitle', { app }), t('technicians.benefits'), TECH_BENEFIT_ICONS)}
    ${stepsSection(ctx, 'how-it-works', t('technicians.howTitle'), t('technicians.steps'))}
    ${actions ? ctaBand(ctx, { title: t('technicians.ctaTitle'), text: t('technicians.ctaText'), primary: actions }) : ''}`;
  return page(ctx, { title: t('technicians.eyebrow'), description: t('technicians.metaDescription'), body, activeNav: 'technicians', wide: true });
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

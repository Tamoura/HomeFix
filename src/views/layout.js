import { html } from '../lib/html.js';
import { homePathFor } from '../auth.js';
import { localeDir, localeName, otherLocales, switchLocaleHref } from '../i18n/index.js';

function navLink(href, label, active) {
  return html`<a href="${href}" class="nav-link${active ? ' is-active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
}

function languageLinks(ctx) {
  return otherLocales(ctx.locale).map(
    (code) => html`<a class="nav-link lang-link" href="${switchLocaleHref(ctx.url, code)}" lang="${code}" hreflang="${code}" dir="${localeDir(code)}" title="${ctx.t('common.switchLanguage')}">${localeName(code)}</a>`,
  );
}

function navigation(ctx, activeNav) {
  const { user, t } = ctx;
  if (!user) {
    return html`
      ${navLink('/#how-it-works', t('nav.howItWorks'), false)}
      ${navLink('/#services', t('nav.services'), false)}
      ${navLink('/technicians', t('nav.forTechnicians'), activeNav === 'technicians')}
      ${navLink('/login', t('nav.login'), activeNav === 'login')}
      <a href="/register" class="btn btn-primary btn-sm">${t('nav.getStarted')}</a>
      ${languageLinks(ctx)}`;
  }
  const links = [];
  if (user.role === 'customer') {
    links.push(navLink('/requests', t('nav.myRequests'), activeNav === 'requests'));
    links.push(html`<a href="/requests/new" class="btn btn-primary btn-sm">${t('nav.newRequest')}</a>`);
  } else if (user.role === 'technician') {
    links.push(navLink('/tech', t('nav.dashboard'), activeNav === 'tech'));
  } else if (user.role === 'admin') {
    links.push(navLink('/admin', t('nav.requests'), activeNav === 'admin'));
    links.push(navLink('/admin/users', t('nav.users'), activeNav === 'users'));
  }
  return html`
    ${links}
    <span class="nav-user" title="${user.email}">${user.name} <span class="nav-role">${t(`roles.${user.role}`)}</span></span>
    <form method="post" action="/logout" class="inline-form">
      <input type="hidden" name="_csrf" value="${ctx.session?.csrf ?? ''}">
      <button type="submit" class="btn btn-ghost btn-sm">${t('nav.logout')}</button>
    </form>
    ${languageLinks(ctx)}`;
}

export function page(ctx, { title, description = '', body, activeNav = '', wide = false }) {
  const appName = ctx.config.appName;
  const flash = ctx.takeFlash();
  return html`<!doctype html>
<html lang="${ctx.locale}" dir="${ctx.dir}" data-intl="${ctx.intl}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${title} · ${appName}` : appName}</title>
${description ? html`<meta name="description" content="${description}">` : ''}
<link rel="icon" href="/public/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/public/styles.css">
</head>
<body>
<a class="skip-link" href="#main">${ctx.t('common.skipToContent')}</a>
<header class="site-header">
  <div class="container nav-row">
    <a class="brand" href="${ctx.user ? homePathFor(ctx.user) : '/'}">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>
      </span>
      <span>${appName}</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>${ctx.t('common.menu')}</button>
    <nav class="nav" id="site-nav" aria-label="${ctx.t('common.mainNavigation')}">${navigation(ctx, activeNav)}</nav>
  </div>
</header>
<main id="main" class="container${wide ? ' container-wide' : ''}">
  ${flash ? html`<div class="flash flash-${flash.type}" role="status" data-flash>${flash.message}</div>` : ''}
  ${body}
</main>
<footer class="site-footer">
  <div class="container">
    <span>© ${new Date().getFullYear()} ${appName}</span>
    <span>${ctx.t('common.appTagline')}</span>
  </div>
</footer>
<script src="/public/app.js" defer></script>
</body>
</html>`;
}

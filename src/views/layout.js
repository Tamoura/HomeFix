import { html } from '../lib/html.js';
import { homePathFor } from '../auth.js';

function navLink(href, label, active) {
  return html`<a href="${href}" class="nav-link${active ? ' is-active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
}

function navigation(ctx, activeNav) {
  const { user } = ctx;
  if (!user) {
    return html`
      ${navLink('/#how-it-works', 'How it works', false)}
      ${navLink('/login', 'Log in', activeNav === 'login')}
      <a href="/register" class="btn btn-primary btn-sm">Get started</a>`;
  }
  const links = [];
  if (user.role === 'customer') {
    links.push(navLink('/requests', 'My requests', activeNav === 'requests'));
    links.push(html`<a href="/requests/new" class="btn btn-primary btn-sm">New request</a>`);
  } else if (user.role === 'technician') {
    links.push(navLink('/tech', 'Dashboard', activeNav === 'tech'));
  } else if (user.role === 'admin') {
    links.push(navLink('/admin', 'Requests', activeNav === 'admin'));
    links.push(navLink('/admin/users', 'Users', activeNav === 'users'));
  }
  return html`
    ${links}
    <span class="nav-user" title="${user.email}">${user.name} <span class="nav-role">${user.role}</span></span>
    <form method="post" action="/logout" class="inline-form">
      <input type="hidden" name="_csrf" value="${ctx.session?.csrf ?? ''}">
      <button type="submit" class="btn btn-ghost btn-sm">Log out</button>
    </form>`;
}

export function page(ctx, { title, body, activeNav = '', wide = false }) {
  const appName = ctx.config.appName;
  const flash = ctx.takeFlash();
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${title} · ${appName}` : appName}</title>
<link rel="icon" href="/public/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/public/styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="container nav-row">
    <a class="brand" href="${ctx.user ? homePathFor(ctx.user) : '/'}">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>
      </span>
      <span>${appName}</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>Menu</button>
    <nav class="nav" id="site-nav" aria-label="Main navigation">${navigation(ctx, activeNav)}</nav>
  </div>
</header>
<main id="main" class="container${wide ? ' container-wide' : ''}">
  ${flash ? html`<div class="flash flash-${flash.type}" role="status" data-flash>${flash.message}</div>` : ''}
  ${body}
</main>
<footer class="site-footer">
  <div class="container">
    <span>© ${new Date().getFullYear()} ${appName}</span>
    <span>Home maintenance, handled end to end.</span>
  </div>
</footer>
<script src="/public/app.js" defer></script>
</body>
</html>`;
}

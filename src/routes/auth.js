import { homePathFor, safeNextPath, signIn, signOut } from '../auth.js';
import { ValidationError } from '../lib/http.js';
import { authenticate, registerUser } from '../services/users.js';
import { homePage, loginPage, registerPage } from '../views/public.js';

export function registerAuthRoutes(router) {
  router.get('/', (ctx) => ctx.html(homePage(ctx)));

  router.get('/login', (ctx) => {
    if (ctx.user) return ctx.redirect(homePathFor(ctx.user));
    return ctx.html(loginPage(ctx, { next: safeNextPath(ctx.query.get('next'), '') }));
  });

  router.post('/login', (ctx) => {
    if (ctx.user) return ctx.redirect(homePathFor(ctx.user));
    const next = safeNextPath(ctx.body.next, '');
    const { user, error } = authenticate(ctx.db, ctx.body.email, ctx.body.password);
    if (!user) {
      return ctx.html(loginPage(ctx, { values: { email: ctx.body.email ?? '' }, error, next }), 401);
    }
    signIn(ctx, user.id);
    ctx.flash('success', `Welcome back, ${user.name}.`);
    return ctx.redirect(next || homePathFor(user));
  });

  router.get('/register', (ctx) => {
    if (ctx.user) return ctx.redirect(homePathFor(ctx.user));
    return ctx.html(registerPage(ctx, { values: { role: ctx.query.get('role') === 'technician' ? 'technician' : 'customer' } }));
  });

  router.post('/register', (ctx) => {
    if (ctx.user) return ctx.redirect(homePathFor(ctx.user));
    try {
      const user = registerUser(ctx.db, ctx.body);
      signIn(ctx, user.id);
      ctx.flash(
        'success',
        user.role === 'technician'
          ? 'Your technician account was created and is awaiting approval.'
          : `Welcome, ${user.name}! You can submit your first maintenance request now.`,
      );
      return ctx.redirect(homePathFor(user));
    } catch (error) {
      if (error instanceof ValidationError) {
        return ctx.html(registerPage(ctx, { values: ctx.body, errors: error.errors }), 400);
      }
      throw error;
    }
  });

  router.post('/logout', (ctx) => {
    signOut(ctx);
    ctx.flash('info', 'You have been logged out.');
    return ctx.redirect('/');
  });
}

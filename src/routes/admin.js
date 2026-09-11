import { requireRole } from '../auth.js';
import { ValidationError } from '../lib/http.js';
import { STATUS_ORDER } from '../workflow.js';
import { cancelRequest, completeVisit, countByStatus, getRequestOr404, listEvents, listRequests, scheduleVisit } from '../services/requests.js';
import { listOffersForRequest } from '../services/offers.js';
import { createUserByAdmin, listCustomers, listTechnicians, setUserStatus } from '../services/users.js';
import { dashboardPage, requestShowPage, usersPage } from '../views/admin.js';
import { tref } from '../i18n/index.js';
import { performAction, pickStatusFilter } from './helpers.js';

const adminOnly = requireRole('admin');

function renderShow(ctx, request, extra = {}, status = 200) {
  const offers = listOffersForRequest(ctx.db, request.id);
  const events = listEvents(ctx.db, request.id);
  return ctx.html(requestShowPage(ctx, { request, offers, events, ...extra }), status);
}

function renderUsers(ctx, extra = {}, status = 200) {
  return ctx.html(usersPage(ctx, { technicians: listTechnicians(ctx.db), customers: listCustomers(ctx.db), ...extra }), status);
}

export function registerAdminRoutes(router) {
  router.get('/admin', adminOnly, (ctx) => {
    const status = pickStatusFilter(ctx.query.get('status'), ['all', 'active', ...STATUS_ORDER]);
    const query = String(ctx.query.get('q') || '').trim().slice(0, 100);
    const requests = listRequests(ctx.db, { status, query });
    const counts = countByStatus(ctx.db);
    return ctx.html(dashboardPage(ctx, { requests, counts, status, query }));
  });

  router.get('/admin/requests/:id', adminOnly, (ctx) => renderShow(ctx, getRequestOr404(ctx.db, ctx.params.id)));

  router.post('/admin/requests/:id/visit', adminOnly, (ctx) => {
    const request = getRequestOr404(ctx.db, ctx.params.id);
    return performAction(ctx, {
      action: () => scheduleVisit(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.visitScheduled',
      backTo: `/admin/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.post('/admin/requests/:id/assessment', adminOnly, (ctx) => {
    const request = getRequestOr404(ctx.db, ctx.params.id);
    return performAction(ctx, {
      action: () => completeVisit(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.findingsRecorded',
      backTo: `/admin/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.post('/admin/requests/:id/cancel', adminOnly, (ctx) => {
    const request = getRequestOr404(ctx.db, ctx.params.id);
    return performAction(ctx, {
      action: () => cancelRequest(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.requestCancelled',
      backTo: `/admin/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.get('/admin/users', adminOnly, (ctx) => renderUsers(ctx));

  router.post('/admin/users', adminOnly, (ctx) => {
    try {
      const user = createUserByAdmin(ctx.db, { ...ctx.body, role: 'technician' });
      ctx.flash('success', 'flash.techCreated', { name: user.name });
      return ctx.redirect('/admin/users');
    } catch (error) {
      if (error instanceof ValidationError) return renderUsers(ctx, { errors: ctx.tErrors(error.errors), values: ctx.body }, 400);
      throw error;
    }
  });

  router.post('/admin/users/:id/status', adminOnly, (ctx) =>
    performAction(ctx, {
      action: () => setUserStatus(ctx.db, Number(ctx.params.id), String(ctx.body.status || '')),
      success: (user) => ['flash.userStatus', { name: user.name, status: tref(`userStatus.${user.status}`) }],
      backTo: '/admin/users',
    }),
  );
}

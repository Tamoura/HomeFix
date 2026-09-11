import { requireRole } from '../auth.js';
import { STATUS_ORDER } from '../workflow.js';
import {
  acceptOffer, cancelRequest, confirmCompletion, countByStatus, createRequest, getCustomerRequest, listEvents, listRequests, requestRework,
} from '../services/requests.js';
import { listOffersForRequest } from '../services/offers.js';
import { requestFormPage, requestShowPage, requestsIndexPage } from '../views/customer.js';
import { performAction, pickStatusFilter } from './helpers.js';

const customerOnly = requireRole('customer');

function renderShow(ctx, request, extra = {}, status = 200) {
  const offers = listOffersForRequest(ctx.db, request.id);
  const events = listEvents(ctx.db, request.id);
  return ctx.html(requestShowPage(ctx, { request, offers, events, ...extra }), status);
}

export function registerCustomerRoutes(router) {
  router.get('/requests', customerOnly, (ctx) => {
    const status = pickStatusFilter(ctx.query.get('status'), ['all', 'active', ...STATUS_ORDER]);
    const requests = listRequests(ctx.db, { customerId: ctx.user.id, status });
    const counts = countByStatus(ctx.db, { customerId: ctx.user.id });
    return ctx.html(requestsIndexPage(ctx, { requests, counts, status }));
  });

  router.get('/requests/new', customerOnly, (ctx) => ctx.html(requestFormPage(ctx)));

  router.post('/requests', customerOnly, (ctx) =>
    performAction(ctx, {
      action: () => createRequest(ctx.db, ctx.user, ctx.body),
      success: 'flash.requestSubmitted',
      backTo: (id) => `/requests/${id}`,
      onInvalid: (errors) => ctx.html(requestFormPage(ctx, { values: ctx.body, errors }), 400),
    }),
  );

  router.get('/requests/:id', customerOnly, (ctx) => {
    const request = getCustomerRequest(ctx.db, ctx.params.id, ctx.user.id);
    return renderShow(ctx, request);
  });

  router.post('/requests/:id/cancel', customerOnly, (ctx) => {
    const request = getCustomerRequest(ctx.db, ctx.params.id, ctx.user.id);
    return performAction(ctx, {
      action: () => cancelRequest(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.requestCancelled',
      backTo: `/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.post('/requests/:id/offers/:offerId/accept', customerOnly, (ctx) => {
    const request = getCustomerRequest(ctx.db, ctx.params.id, ctx.user.id);
    return performAction(ctx, {
      action: () => acceptOffer(ctx.db, request, ctx.user, ctx.params.offerId, ctx.config.currency),
      success: (offer) => ['flash.offerAccepted', { name: offer.technician_name }],
      backTo: `/requests/${request.id}`,
    });
  });

  router.post('/requests/:id/confirm', customerOnly, (ctx) => {
    const request = getCustomerRequest(ctx.db, ctx.params.id, ctx.user.id);
    return performAction(ctx, {
      action: () => confirmCompletion(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.orderClosed',
      backTo: `/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.post('/requests/:id/rework', customerOnly, (ctx) => {
    const request = getCustomerRequest(ctx.db, ctx.params.id, ctx.user.id);
    return performAction(ctx, {
      action: () => requestRework(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.reworkSent',
      backTo: `/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });
}

import { requireRole } from '../auth.js';
import { HttpError } from '../lib/http.js';
import { completeWork, getRequestOr404, listEvents } from '../services/requests.js';
import {
  getTechnicianOffer, listJobsForTechnician, listOffersByTechnician, listOpenRequestsForTechnician, submitOffer, technicianCanView,
  technicianStats, withdrawOffer,
} from '../services/offers.js';
import { pendingApprovalPage } from '../views/public.js';
import { dashboardPage, requestShowPage } from '../views/tech.js';
import { performAction } from './helpers.js';

const technicianOnly = requireRole('technician');

function activeTechnicianOnly(ctx) {
  technicianOnly(ctx);
  if (ctx.res.writableEnded) return;
  if (ctx.user.status === 'active') return;
  if (ctx.method === 'GET') {
    ctx.html(pendingApprovalPage(ctx));
    return;
  }
  throw new HttpError(403, 'errors.pendingTechnician');
}

function loadViewableRequest(ctx) {
  const request = getRequestOr404(ctx.db, ctx.params.id);
  if (!technicianCanView(ctx.db, request, ctx.user.id)) throw new HttpError(404, 'errors.requestNotFound');
  return request;
}

function renderShow(ctx, request, extra = {}, status = 200) {
  const myOffer = getTechnicianOffer(ctx.db, request.id, ctx.user.id);
  const events = listEvents(ctx.db, request.id);
  return ctx.html(requestShowPage(ctx, { request, myOffer, events, ...extra }), status);
}

export function registerTechRoutes(router) {
  router.get('/tech', activeTechnicianOnly, (ctx) =>
    ctx.html(
      dashboardPage(ctx, {
        stats: technicianStats(ctx.db, ctx.user.id),
        open: listOpenRequestsForTechnician(ctx.db, ctx.user.id),
        jobs: listJobsForTechnician(ctx.db, ctx.user.id),
        offers: listOffersByTechnician(ctx.db, ctx.user.id),
      }),
    ),
  );

  router.get('/tech/requests/:id', activeTechnicianOnly, (ctx) => renderShow(ctx, loadViewableRequest(ctx)));

  router.post('/tech/requests/:id/offer', activeTechnicianOnly, (ctx) => {
    const request = loadViewableRequest(ctx);
    return performAction(ctx, {
      action: () => submitOffer(ctx.db, request, ctx.user, ctx.body, ctx.config.currency),
      success: 'flash.offerSent',
      backTo: `/tech/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });

  router.post('/tech/requests/:id/offer/withdraw', activeTechnicianOnly, (ctx) => {
    const request = loadViewableRequest(ctx);
    return performAction(ctx, {
      action: () => withdrawOffer(ctx.db, request, ctx.user),
      success: 'flash.offerWithdrawn',
      backTo: `/tech/requests/${request.id}`,
    });
  });

  router.post('/tech/requests/:id/complete', activeTechnicianOnly, (ctx) => {
    const request = loadViewableRequest(ctx);
    return performAction(ctx, {
      action: () => completeWork(ctx.db, request, ctx.user, ctx.body),
      success: 'flash.workCompleted',
      backTo: `/tech/requests/${request.id}`,
      onInvalid: (errors) => renderShow(ctx, request, { errors, values: ctx.body }, 400),
    });
  });
}

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, startApp } from './helpers.js';

let app;
before(async () => {
  app = await startApp();
});
after(async () => {
  await app.close();
});

const userId = (email) => app.db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
const requestRow = (id) => app.db.prepare('SELECT * FROM requests WHERE id = ?').get(id);

test('full lifecycle: request → inspection visit → offers → work → confirmation', async () => {
  const customer = new Client(app.base);
  const admin = new Client(app.base);
  const omar = new Client(app.base);
  const lina = new Client(app.base);

  // Customer registers and is taken to the request list.
  let res = await customer.register({ name: 'Nadia Khalil', email: 'nadia@example.com', phone: '555-0100', password: 'customer123', password_confirm: 'customer123' });
  assert.equal(res.status, 303);
  assert.equal(res.location, '/requests');
  res = await customer.get('/requests');
  assert.match(res.text, /Welcome, Nadia Khalil/);
  assert.match(res.text, /not submitted any requests yet/);

  // Technicians register and wait for approval.
  for (const [client, name, email, specialty] of [[omar, 'Omar Haddad', 'omar@example.com', 'Plumbing'], [lina, 'Lina Farah', 'lina@example.com', 'Electrical']]) {
    res = await client.register({ role: 'technician', name, email, specialty, password: 'tech1234', password_confirm: 'tech1234' });
    assert.equal(res.location, '/tech');
    res = await client.get('/tech');
    assert.equal(res.status, 200);
    assert.match(res.text, /awaiting approval/i);
  }

  // Admin approves both technicians.
  res = await admin.login('admin@homefix.test', 'admin123');
  assert.equal(res.location, '/admin');
  res = await admin.get('/admin/users');
  assert.match(res.text, /Technicians awaiting approval <span class="count">2<\/span>/);
  for (const email of ['omar@example.com', 'lina@example.com']) {
    res = await admin.post(`/admin/users/${userId(email)}/status`, { status: 'active' });
    assert.equal(res.status, 303);
  }
  res = await omar.get('/tech');
  assert.match(res.text, /Technician dashboard/);
  assert.match(res.text, /Nothing open right now/);

  // Customer submits a request (with a validation failure first).
  res = await customer.post('/requests', { category: 'plumbing', title: 'Leak', description: 'short', address: '', urgency: 'high' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Give the request a short title/);
  assert.match(res.text, /Enter the full address/);

  res = await customer.post('/requests', {
    category: 'plumbing',
    title: 'Kitchen sink leaking under the cabinet',
    description: 'Water pools under the sink every time we use it.',
    address: '12 Cedar Lane, Apt 4B',
    preferred_date: '',
    urgency: 'high',
  });
  assert.equal(res.status, 303);
  assert.equal(res.location, '/requests/1');
  res = await customer.get('/requests/1');
  assert.equal(res.status, 200);
  assert.match(res.text, /Your request was submitted/);
  assert.match(res.text, /badge-neutral">Submitted</);
  assert.match(res.text, /Nadia Khalil submitted a new plumbing request/);
  assert.match(res.text, /Cancel request/);
  assert.equal(requestRow(1).status, 'submitted');

  // Technicians cannot see it before the inspection.
  res = await omar.get('/tech/requests/1');
  assert.equal(res.status, 404);
  res = await omar.post('/tech/requests/1/offer', { amount: '100', duration: '1 day' });
  assert.equal(res.status, 404);

  // Admin sees it on the dashboard and schedules the inspection visit.
  res = await admin.get('/admin');
  assert.match(res.text, /Kitchen sink leaking under the cabinet/);
  assert.match(res.text, /Needs a visit/);
  res = await admin.get('/admin/requests/1');
  assert.match(res.text, /Schedule the inspection visit/);
  assert.match(res.text, /nadia@example.com/);

  res = await admin.post('/admin/requests/1/visit', { visit_at: 'not-a-date', visit_note: '' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Enter the visit date and time/);

  res = await admin.post('/admin/requests/1/visit', { visit_at: '2030-05-02T10:30', visit_note: 'Inspector will call ahead.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'visit_scheduled');
  res = await customer.get('/requests/1');
  assert.match(res.text, /badge-info">Visit scheduled</);
  assert.match(res.text, /Inspector will call ahead\./);
  assert.match(res.text, /May 2, 2030/);

  // Rescheduling keeps the request in the same state.
  res = await admin.post('/admin/requests/1/visit', { visit_at: '2030-05-03T09:00', visit_note: '' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).visit_at, '2030-05-03T09:00');

  // Admin records the findings and opens the request for offers.
  res = await admin.post('/admin/requests/1/assessment', { assessment: 'short' });
  assert.equal(res.status, 400);
  res = await admin.post('/admin/requests/1/assessment', { assessment: 'Replace the drain trap and reseal the outlet. About two hours of work.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'open_for_offers');
  res = await customer.get('/requests/1');
  assert.match(res.text, /badge-accent">Open for offers</);
  assert.match(res.text, /No offers yet/);
  assert.match(res.text, /Replace the drain trap/);

  // Technicians now see it and send offers.
  res = await omar.get('/tech');
  assert.match(res.text, /Requests open for offers <span class="count">1<\/span>/);
  res = await omar.get('/tech/requests/1');
  assert.match(res.text, /Send an offer/);
  assert.match(res.text, /Replace the drain trap/);
  assert.doesNotMatch(res.text, /nadia@example.com/, 'customer contact hidden before assignment');

  res = await omar.post('/tech/requests/1/offer', { amount: 'abc', duration: '' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Enter a valid price/);
  res = await omar.post('/tech/requests/1/offer', { amount: '250', duration: '2 hours', note: 'Includes a new trap.' });
  assert.equal(res.status, 303);
  res = await lina.post('/tech/requests/1/offer', { amount: '199.50', duration: '3 hours', note: '' });
  assert.equal(res.status, 303);

  // Omar revises his offer; the customer sees both.
  res = await omar.post('/tech/requests/1/offer', { amount: '230', duration: '2 hours', note: 'Includes a new trap.' });
  assert.equal(res.status, 303);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM offers WHERE request_id = 1').get().n, 2);
  res = await customer.get('/requests/1');
  assert.match(res.text, /Technician offers <span class="count">2<\/span>/);
  assert.match(res.text, /\$230\.00/);
  assert.match(res.text, /\$199\.50/);
  assert.match(res.text, /Accept offer/);

  // Customer accepts Omar's offer → in progress, Lina's offer rejected.
  const omarOffer = app.db.prepare('SELECT id FROM offers WHERE request_id = 1 AND technician_id = ?').get(userId('omar@example.com'));
  const linaOffer = app.db.prepare('SELECT id FROM offers WHERE request_id = 1 AND technician_id = ?').get(userId('lina@example.com'));
  res = await customer.post(`/requests/1/offers/${omarOffer.id}/accept`);
  assert.equal(res.status, 303);
  const inProgress = requestRow(1);
  assert.equal(inProgress.status, 'in_progress');
  assert.equal(inProgress.technician_id, userId('omar@example.com'));
  assert.equal(inProgress.accepted_offer_id, omarOffer.id);
  assert.equal(app.db.prepare('SELECT status FROM offers WHERE id = ?').get(linaOffer.id).status, 'rejected');

  res = await customer.get('/requests/1');
  assert.match(res.text, /Omar Haddad has been assigned/);
  assert.match(res.text, /badge-warn">In progress</);
  assert.match(res.text, /Assigned technician/);
  assert.doesNotMatch(res.text, /Accept offer/);

  // Late offers and customer cancellation are refused with a friendly message.
  res = await lina.post('/tech/requests/1/offer', { amount: '150', duration: '1 hour' });
  assert.equal(res.status, 303);
  res = await lina.get('/tech/requests/1');
  assert.match(res.text, /not open for offers/);
  assert.match(res.text, /Not selected/);
  res = await customer.post('/requests/1/cancel', { reason: 'changed my mind' });
  assert.equal(res.status, 303);
  res = await customer.get('/requests/1');
  assert.match(res.text, /can&#39;t cancel this request/);
  assert.equal(requestRow(1).status, 'in_progress');

  // Only the assigned technician can complete the job.
  res = await lina.post('/tech/requests/1/complete', { completion_note: 'done' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'in_progress');
  res = await omar.get('/tech/requests/1');
  assert.match(res.text, /Mark as completed/);
  assert.match(res.text, /nadia@example.com/, 'assigned technician sees customer contact');
  res = await omar.post('/tech/requests/1/complete', { completion_note: 'Replaced the trap and resealed the outlet.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'completed');

  // Customer sends it back once, technician completes again.
  res = await customer.get('/requests/1');
  assert.match(res.text, /Confirm the completed work/);
  assert.match(res.text, /Replaced the trap and resealed the outlet\./);
  res = await customer.post('/requests/1/rework', { rework_note: 'The tap still drips a little.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'in_progress');
  res = await omar.post('/tech/requests/1/complete', { completion_note: 'Tightened the tap fitting as well.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(1).status, 'completed');

  // Customer confirms with a rating → order closed.
  res = await customer.post('/requests/1/confirm', { rating: '9', review: '' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Rate the service from 1 to 5/);
  res = await customer.post('/requests/1/confirm', { rating: '5', review: 'Great job, very tidy.' });
  assert.equal(res.status, 303);
  const closed = requestRow(1);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.rating, 5);
  res = await customer.get('/requests/1');
  assert.match(res.text, /badge-ok">Closed</);
  assert.match(res.text, /Order summary/);
  assert.match(res.text, /rated it 5\/5/);
  assert.doesNotMatch(res.text, /Cancel request/);

  // The activity log tells the whole story, and stats reflect the closed job.
  const events = app.db.prepare('SELECT type FROM request_events WHERE request_id = 1 ORDER BY id').all().map((row) => row.type);
  assert.deepEqual(events, [
    'created', 'visit_scheduled', 'visit_rescheduled', 'visit_completed', 'offer_submitted', 'offer_submitted', 'offer_updated',
    'offer_accepted', 'work_completed', 'rework_requested', 'work_completed', 'closed',
  ]);
  res = await omar.get('/tech');
  assert.match(res.text, /Past jobs <span class="count">1<\/span>/);
  assert.match(res.text, /5\.0/);
  res = await admin.get('/admin/users');
  assert.match(res.text, /1 closed · 0 active · 1 offers/);
  res = await admin.get('/admin?status=closed');
  assert.match(res.text, /Kitchen sink leaking under the cabinet/);
  res = await admin.get('/admin?status=submitted');
  assert.match(res.text, /No requests found/);

  // The landing page now has a track record to show.
  res = await new Client(app.base).get('/');
  assert.match(res.text, /stats-strip/);
  assert.match(res.text, /<strong>1<\/strong><span>Jobs completed</);
  assert.match(res.text, /<strong>2<\/strong><span>Vetted technicians</);
  assert.match(res.text, /★ 5\.0/);
});

test('customers can cancel early, admins can cancel later, and offers get declined', async () => {
  const customer = new Client(app.base);
  const admin = new Client(app.base);
  const omar = new Client(app.base);
  await customer.login('nadia@example.com', 'customer123');
  await admin.login('admin@homefix.test', 'admin123');
  await omar.login('omar@example.com', 'tech1234');

  let res = await customer.post('/requests', { category: 'painting', title: 'Repaint the hallway walls', description: 'Scuffed walls, light grey finish wanted.', address: '12 Cedar Lane', urgency: 'low' });
  const id = Number(res.location.split('/').pop());
  res = await customer.post(`/requests/${id}/cancel`, { reason: 'Found another solution.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(id).status, 'cancelled');
  res = await customer.get(`/requests/${id}`);
  assert.match(res.text, /badge-danger">Cancelled</);
  assert.match(res.text, /Found another solution\./);
  res = await admin.post(`/admin/requests/${id}/visit`, { visit_at: '2030-01-01T10:00' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(id).status, 'cancelled', 'cancelled requests stay cancelled');

  res = await customer.post('/requests', { category: 'electrical', title: 'Socket in the kitchen is dead', description: 'The double socket next to the fridge stopped working.', address: '12 Cedar Lane', urgency: 'normal' });
  const second = Number(res.location.split('/').pop());
  await admin.post(`/admin/requests/${second}/visit`, { visit_at: '2030-01-01T10:00' });
  await admin.post(`/admin/requests/${second}/assessment`, { assessment: 'Replace the socket and check the ring circuit.' });
  res = await omar.post(`/tech/requests/${second}/offer`, { amount: '80', duration: '1 hour' });
  assert.equal(res.status, 303);
  res = await admin.post(`/admin/requests/${second}/cancel`, { reason: 'Customer moved out.' });
  assert.equal(res.status, 303);
  assert.equal(requestRow(second).status, 'cancelled');
  assert.equal(app.db.prepare('SELECT status FROM offers WHERE request_id = ?').get(second).status, 'rejected');
  res = await omar.get('/tech');
  assert.match(res.text, /Not selected/);
});

test('technicians can withdraw and resubmit offers while the request is open', async () => {
  const customer = new Client(app.base);
  const admin = new Client(app.base);
  const lina = new Client(app.base);
  await customer.login('nadia@example.com', 'customer123');
  await admin.login('admin@homefix.test', 'admin123');
  await lina.login('lina@example.com', 'tech1234');

  let res = await customer.post('/requests', { category: 'electrical', title: 'Install a ceiling fan in the bedroom', description: 'Fan purchased already, needs wiring to the existing light point.', address: '12 Cedar Lane', urgency: 'normal' });
  const id = Number(res.location.split('/').pop());
  await admin.post(`/admin/requests/${id}/visit`, { visit_at: '2030-02-01T10:00' });
  await admin.post(`/admin/requests/${id}/assessment`, { assessment: 'Fit the supplied fan to the existing light point; add a wall regulator.' });

  res = await lina.post(`/tech/requests/${id}/offer/withdraw`);
  assert.equal(res.status, 303, 'nothing to withdraw yet');
  res = await lina.post(`/tech/requests/${id}/offer`, { amount: '120', duration: '2 hours' });
  assert.equal(res.status, 303);
  res = await lina.get(`/tech/requests/${id}`);
  assert.match(res.text, /Withdraw offer/);
  res = await lina.post(`/tech/requests/${id}/offer/withdraw`);
  assert.equal(res.status, 303);
  res = await customer.get(`/requests/${id}`);
  assert.match(res.text, /No offers yet/);
  res = await lina.post(`/tech/requests/${id}/offer`, { amount: '110', duration: '2 hours' });
  assert.equal(res.status, 303);
  res = await customer.get(`/requests/${id}`);
  assert.match(res.text, /\$110\.00/);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM offers WHERE request_id = ?').get(id).n, 1, 'one offer row per technician');
});

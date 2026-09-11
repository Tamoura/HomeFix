// Populates the database with demo accounts and requests in every workflow
// state. Safe to run repeatedly: it exits early if the demo data exists.
//
//   npm run seed
//   DATABASE_FILE=data/other.db npm run seed

import { loadConfig } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { ensureAdmin, findUserByEmail, getUser, registerUser, setUserStatus } from '../src/services/users.js';
import {
  acceptOffer, cancelRequest, completeVisit, completeWork, confirmCompletion, createRequest, getRequest, scheduleVisit,
} from '../src/services/requests.js';
import { submitOffer } from '../src/services/offers.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);
ensureAdmin(db, config);
const admin = db.prepare("SELECT id, name, email, role FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();

if (findUserByEmail(db, 'nadia@example.com')) {
  console.log(`Demo data already exists in ${config.databaseFile}. Nothing to do.`);
  process.exit(0);
}

const DAY = 24 * 60 * 60 * 1000;
const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

function createAccount(input, status) {
  const user = registerUser(db, input);
  if (status && user.status !== status) setUserStatus(db, user.id, status);
  return getUser(db, user.id);
}

// Shifts a request (and its activity log) into the past so the demo looks lived-in.
function backdate(requestId, daysAgo) {
  const events = db.prepare('SELECT id FROM request_events WHERE request_id = ? ORDER BY id').all(requestId);
  const start = Date.now() - daysAgo * DAY;
  const spacing = (daysAgo * DAY) / (events.length + 1);
  let last = start;
  events.forEach((event, index) => {
    last = start + spacing * (index + 1);
    db.prepare('UPDATE request_events SET created_at = ? WHERE id = ?').run(new Date(last).toISOString(), event.id);
  });
  db.prepare('UPDATE requests SET created_at = ?, updated_at = ? WHERE id = ?').run(
    new Date(start).toISOString(),
    new Date(last).toISOString(),
    requestId,
  );
  // Align the other timestamps with the events that produced them.
  const eventTime = (type, last = false) => {
    const rows = db.prepare('SELECT created_at FROM request_events WHERE request_id = ? AND type = ? ORDER BY id').all(requestId, type);
    if (!rows.length) return null;
    return (last ? rows[rows.length - 1] : rows[0]).created_at;
  };
  const columns = { assessment_at: eventTime('visit_completed'), completed_at: eventTime('work_completed', true), closed_at: eventTime('closed') };
  for (const [column, value] of Object.entries(columns)) {
    if (value) db.prepare(`UPDATE requests SET ${column} = ? WHERE id = ? AND ${column} IS NOT NULL`).run(value, requestId);
  }
  for (const offer of db.prepare('SELECT id, technician_id FROM offers WHERE request_id = ?').all(requestId)) {
    const submitted = db.prepare("SELECT created_at FROM request_events WHERE request_id = ? AND actor_id = ? AND type LIKE 'offer_%' ORDER BY id").all(requestId, offer.technician_id);
    if (submitted.length) {
      db.prepare('UPDATE offers SET created_at = ?, updated_at = ? WHERE id = ?').run(submitted[0].created_at, submitted[submitted.length - 1].created_at, offer.id);
    }
  }
}

const customerPassword = 'customer123';
const technicianPassword = 'tech1234';

const nadia = createAccount({ role: 'customer', name: 'Nadia Khalil', email: 'nadia@example.com', phone: '+1 555 0101', password: customerPassword });
const youssef = createAccount({ role: 'customer', name: 'Youssef Amin', email: 'youssef@example.com', phone: '+1 555 0102', password: customerPassword });

const omar = createAccount({ role: 'technician', name: 'Omar Haddad', email: 'omar@homefix.test', phone: '+1 555 0201', specialty: 'Plumbing', password: technicianPassword }, 'active');
const lina = createAccount({ role: 'technician', name: 'Lina Farah', email: 'lina@homefix.test', phone: '+1 555 0202', specialty: 'Electrical', password: technicianPassword }, 'active');
const karim = createAccount({ role: 'technician', name: 'Karim Nasser', email: 'karim@homefix.test', phone: '+1 555 0203', specialty: 'General maintenance', password: technicianPassword }, 'active');
createAccount({ role: 'technician', name: 'Sam Ortiz', email: 'sam@homefix.test', phone: '+1 555 0204', specialty: 'Carpentry', password: technicianPassword });

const currency = config.currency;
const fresh = (id) => getRequest(db, id);

// 1. Just submitted — waiting for the admin to schedule a visit.
const r1 = createRequest(db, nadia, {
  category: 'plumbing',
  title: 'Kitchen sink leaking under the cabinet',
  description: 'Water pools under the sink every time we use it. The leak seems to come from the drain connection, not the tap. Started three days ago.',
  address: '12 Cedar Lane, Apt 4B, Springfield',
  preferred_date: isoDate(3),
  urgency: 'high',
});
backdate(r1, 1);

// 2. Visit scheduled for tomorrow.
const r2 = createRequest(db, youssef, {
  category: 'air_conditioning',
  title: 'AC not cooling in the master bedroom',
  description: 'The split unit runs but only blows warm air. Filter was cleaned last month. Remote shows no error codes.',
  address: '88 Palm Avenue, Villa 6, Springfield',
  preferred_date: isoDate(1),
  urgency: 'high',
});
scheduleVisit(db, fresh(r2), admin, { visit_at: `${isoDate(1)}T10:00`, visit_note: 'Our inspector will call 30 minutes before arriving.' });
backdate(r2, 2);

// 3. Inspected and open for offers, with two offers to compare.
const r3 = createRequest(db, nadia, {
  category: 'electrical',
  title: 'Replace bathroom light fixtures and a faulty switch',
  description: 'Two ceiling fixtures flicker and the switch by the door sparks occasionally. Would like modern LED fixtures.',
  address: '12 Cedar Lane, Apt 4B, Springfield',
  preferred_date: '',
  urgency: 'normal',
});
scheduleVisit(db, fresh(r3), admin, { visit_at: `${isoDate(-2)}T14:00`, visit_note: '' });
completeVisit(db, fresh(r3), admin, {
  assessment: 'Two 12W ceiling fixtures to be replaced with IP44 LED fittings. Wall switch shows heat damage and must be replaced together with the back box. Wiring behind it is sound. Estimated 3–4 hours of work; customer prefers a morning slot.',
});
submitOffer(db, fresh(r3), lina, { amount: '180', duration: '1 day', note: 'Price includes two LED fittings (warm white) and a new rocker switch. 12-month warranty on labour.' }, currency);
submitOffer(db, fresh(r3), karim, { amount: '210', duration: 'Half a day', note: 'Can start tomorrow morning. Fixtures of your choice up to $60 each included.' }, currency);
backdate(r3, 5);

// 4. Offer accepted — work in progress.
const r4 = createRequest(db, youssef, {
  category: 'painting',
  title: 'Repaint living room walls (approx. 45 m²)',
  description: 'Walls have scuffs and a few hairline cracks. Looking for a light grey finish; ceiling does not need painting.',
  address: '88 Palm Avenue, Villa 6, Springfield',
  preferred_date: '',
  urgency: 'low',
});
scheduleVisit(db, fresh(r4), admin, { visit_at: `${isoDate(-5)}T11:00`, visit_note: '' });
completeVisit(db, fresh(r4), admin, {
  assessment: 'About 45 m² of wall surface, two hairline cracks to fill and sand. Two coats of washable matt emulsion required. Furniture to be covered; customer will remove pictures.',
});
submitOffer(db, fresh(r4), karim, { amount: '650', duration: '3 days', note: 'Includes filler, primer and two coats of premium washable paint.' }, currency);
const offer4 = db.prepare('SELECT id FROM offers WHERE request_id = ? AND technician_id = ?').get(r4, karim.id);
acceptOffer(db, fresh(r4), youssef, offer4.id, currency);
backdate(r4, 6);

// 5. Technician finished — waiting for the customer to confirm.
const r5 = createRequest(db, nadia, {
  category: 'plumbing',
  title: 'Water heater replacement',
  description: 'The 50 L electric heater is 12 years old and now trips the breaker. Would like a like-for-like replacement.',
  address: '12 Cedar Lane, Apt 4B, Springfield',
  preferred_date: '',
  urgency: 'normal',
});
scheduleVisit(db, fresh(r5), admin, { visit_at: `${isoDate(-8)}T09:30`, visit_note: '' });
completeVisit(db, fresh(r5), admin, { assessment: 'Replace 50 L vertical electric water heater, including new isolation valve and pressure relief. Existing bracket can be reused.' });
submitOffer(db, fresh(r5), omar, { amount: '420', duration: '1 day', note: 'Includes a new 50 L heater (2-year warranty), valves and disposal of the old unit.' }, currency);
const offer5 = db.prepare('SELECT id FROM offers WHERE request_id = ? AND technician_id = ?').get(r5, omar.id);
acceptOffer(db, fresh(r5), nadia, offer5.id, currency);
completeWork(db, fresh(r5), omar, { completion_note: 'New heater installed and tested. Thermostat set to 60 °C. Old unit removed.' });
backdate(r5, 9);

// 6. Closed with a rating.
const r6 = createRequest(db, youssef, {
  category: 'carpentry',
  title: 'Fix broken front door hinge',
  description: 'The top hinge of the front door has pulled out of the frame and the door scrapes the floor.',
  address: '88 Palm Avenue, Villa 6, Springfield',
  preferred_date: '',
  urgency: 'high',
});
scheduleVisit(db, fresh(r6), admin, { visit_at: `${isoDate(-14)}T16:00`, visit_note: '' });
completeVisit(db, fresh(r6), admin, { assessment: 'Top hinge screws stripped. Plug and re-drill the frame, fit a new heavy-duty hinge, re-align the door.' });
submitOffer(db, fresh(r6), karim, { amount: '90', duration: '2 hours', note: '' }, currency);
const offer6 = db.prepare('SELECT id FROM offers WHERE request_id = ? AND technician_id = ?').get(r6, karim.id);
acceptOffer(db, fresh(r6), youssef, offer6.id, currency);
completeWork(db, fresh(r6), karim, { completion_note: 'New hinge fitted, door re-aligned and lock checked.' });
confirmCompletion(db, fresh(r6), youssef, { rating: 5, review: 'Quick, tidy and friendly. Door closes perfectly now.' });
backdate(r6, 15);

// 7. Cancelled by the customer.
const r7 = createRequest(db, nadia, {
  category: 'pest_control',
  title: 'Ants in the garden and kitchen',
  description: 'Trail of ants coming in through the kitchen window every morning.',
  address: '12 Cedar Lane, Apt 4B, Springfield',
  preferred_date: '',
  urgency: 'low',
});
cancelRequest(db, fresh(r7), nadia, { reason: 'Handled it myself with bait traps.' });
backdate(r7, 4);

// 8. Open for offers with no offers yet — something for technicians to bid on.
const r8 = createRequest(db, youssef, {
  category: 'appliance_repair',
  title: 'Washing machine not draining',
  description: 'Front loader stops with water inside at the end of the cycle. Pump filter has been cleaned.',
  address: '88 Palm Avenue, Villa 6, Springfield',
  preferred_date: isoDate(2),
  urgency: 'normal',
});
scheduleVisit(db, fresh(r8), admin, { visit_at: `${isoDate(-1)}T13:00`, visit_note: '' });
completeVisit(db, fresh(r8), admin, { assessment: 'Drain pump is noisy and does not build pressure; likely worn impeller. Replace the drain pump (model WM-5 series) and check the drain hose for kinks.' });
backdate(r8, 1);

console.log(`Seeded demo data into ${config.databaseFile}.\n`);
console.log('Demo accounts (all roles):');
console.log(`  Admin        ${admin.email}   password: ${config.adminPassword}`);
console.log(`  Customer     nadia@example.com     password: ${customerPassword}`);
console.log(`  Customer     youssef@example.com   password: ${customerPassword}`);
console.log(`  Technician   omar@homefix.test     password: ${technicianPassword}   (Plumbing)`);
console.log(`  Technician   lina@homefix.test     password: ${technicianPassword}   (Electrical)`);
console.log(`  Technician   karim@homefix.test    password: ${technicianPassword}   (General maintenance)`);
console.log(`  Technician   sam@homefix.test      password: ${technicianPassword}   (awaiting admin approval)`);
db.close();

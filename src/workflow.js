// The maintenance request lifecycle shared by routes, services and views.
//
//  submitted → visit_scheduled → open_for_offers → in_progress → completed → closed
//       └──────────────┴──────────────┴───────── cancelled ────────┘

export const STATUS = {
  SUBMITTED: 'submitted',
  VISIT_SCHEDULED: 'visit_scheduled',
  OPEN_FOR_OFFERS: 'open_for_offers',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

export const STATUS_META = {
  submitted: {
    label: 'Submitted',
    tone: 'neutral',
    customer: 'Our team will review your request and schedule an inspection visit.',
    admin: 'Waiting for an inspection visit to be scheduled.',
  },
  visit_scheduled: {
    label: 'Visit scheduled',
    tone: 'info',
    customer: 'An inspection visit has been scheduled. Please be available at the agreed time.',
    admin: 'Inspection visit scheduled. Record the findings after the visit to open the request for offers.',
  },
  open_for_offers: {
    label: 'Open for offers',
    tone: 'accent',
    customer: 'Technicians are sending their offers. Accept the one that suits you best.',
    admin: 'Technicians can submit offers. The customer chooses one to start the work.',
  },
  in_progress: {
    label: 'In progress',
    tone: 'warn',
    customer: 'A technician has been assigned and is working on your request.',
    admin: 'Work has been assigned to a technician.',
  },
  completed: {
    label: 'Awaiting confirmation',
    tone: 'info',
    customer: 'The technician marked the work as completed. Please confirm and rate the service.',
    admin: 'Waiting for the customer to confirm the completed work.',
  },
  closed: {
    label: 'Closed',
    tone: 'ok',
    customer: 'This order is complete. Thank you!',
    admin: 'Order confirmed by the customer and closed.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'danger',
    customer: 'This request was cancelled.',
    admin: 'This request was cancelled.',
  },
};

export const STATUS_ORDER = [
  STATUS.SUBMITTED,
  STATUS.VISIT_SCHEDULED,
  STATUS.OPEN_FOR_OFFERS,
  STATUS.IN_PROGRESS,
  STATUS.COMPLETED,
  STATUS.CLOSED,
  STATUS.CANCELLED,
];

export const STEPS = [
  { key: STATUS.SUBMITTED, label: 'Request submitted' },
  { key: STATUS.VISIT_SCHEDULED, label: 'Inspection visit' },
  { key: STATUS.OPEN_FOR_OFFERS, label: 'Technician offers' },
  { key: STATUS.IN_PROGRESS, label: 'Work in progress' },
  { key: STATUS.COMPLETED, label: 'Work completed' },
  { key: STATUS.CLOSED, label: 'Confirmed & closed' },
];

export const TERMINAL_STATUSES = new Set([STATUS.CLOSED, STATUS.CANCELLED]);

export const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Air conditioning',
  'Painting',
  'Carpentry',
  'Appliance repair',
  'Roofing & waterproofing',
  'Pest control',
  'Cleaning',
  'General maintenance',
];

export const URGENCY_LEVELS = {
  low: { label: 'Low', tone: 'neutral', hint: 'Whenever convenient' },
  normal: { label: 'Normal', tone: 'info', hint: 'Within a couple of weeks' },
  high: { label: 'High', tone: 'warn', hint: 'Within a few days' },
  emergency: { label: 'Emergency', tone: 'danger', hint: 'As soon as possible' },
};

export const OFFER_STATUS_META = {
  pending: { label: 'Pending', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'ok' },
  rejected: { label: 'Not selected', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export function statusLabel(status) {
  return STATUS_META[status]?.label ?? status;
}

export function stepIndex(status) {
  return STEPS.findIndex((step) => step.key === status);
}

export const can = {
  scheduleVisit: (request) => [STATUS.SUBMITTED, STATUS.VISIT_SCHEDULED].includes(request.status),
  completeVisit: (request) => request.status === STATUS.VISIT_SCHEDULED,
  submitOffer: (request) => request.status === STATUS.OPEN_FOR_OFFERS,
  acceptOffer: (request) => request.status === STATUS.OPEN_FOR_OFFERS,
  completeWork: (request, technician) =>
    request.status === STATUS.IN_PROGRESS && request.technician_id === technician.id,
  confirmCompletion: (request) => request.status === STATUS.COMPLETED,
  requestRework: (request) => request.status === STATUS.COMPLETED,
  customerCancel: (request) =>
    [STATUS.SUBMITTED, STATUS.VISIT_SCHEDULED, STATUS.OPEN_FOR_OFFERS].includes(request.status),
  adminCancel: (request) => !TERMINAL_STATUSES.has(request.status),
};

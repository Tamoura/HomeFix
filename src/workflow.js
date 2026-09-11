// The maintenance request lifecycle shared by routes, services and views.
// Labels for every key below live in the translation dictionaries (src/i18n).
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

export const STATUS_TONES = {
  submitted: 'neutral',
  visit_scheduled: 'info',
  open_for_offers: 'accent',
  in_progress: 'warn',
  completed: 'info',
  closed: 'ok',
  cancelled: 'danger',
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

// Progress steps shown on a request, in order.
export const STEPS = [
  STATUS.SUBMITTED,
  STATUS.VISIT_SCHEDULED,
  STATUS.OPEN_FOR_OFFERS,
  STATUS.IN_PROGRESS,
  STATUS.COMPLETED,
  STATUS.CLOSED,
];

export const TERMINAL_STATUSES = new Set([STATUS.CLOSED, STATUS.CANCELLED]);

export const CATEGORIES = [
  'plumbing',
  'electrical',
  'air_conditioning',
  'painting',
  'carpentry',
  'appliance_repair',
  'roofing',
  'pest_control',
  'cleaning',
  'general',
];

export const URGENCY_LEVELS = ['low', 'normal', 'high', 'emergency'];

export const URGENCY_TONES = { low: 'neutral', normal: 'info', high: 'warn', emergency: 'danger' };

export const OFFER_STATUS_TONES = { pending: 'info', accepted: 'ok', rejected: 'neutral', withdrawn: 'neutral' };

export function stepIndex(status) {
  return STEPS.indexOf(status);
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

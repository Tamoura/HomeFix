// Activity-log entries are stored as a type plus structured data so they can
// be rendered in whichever language the reader is using.

import { translate, intlTag } from './index.js';
import { formatLocalDateTime, formatMoney } from '../lib/format.js';

export function parseEventData(event) {
  if (!event || !event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function renderEventMessage(locale, type, data = {}) {
  const tag = intlTag(locale);
  const t = (key, params) => translate(locale, key, params);
  const params = { ...data };
  if (data.category) params.category = t(`categories.${data.category}`);
  if (data.amountCents !== undefined && data.amountCents !== null) {
    params.amount = formatMoney(data.amountCents, data.currency || 'USD', tag);
  }
  if (data.visitAt) params.visitAt = formatLocalDateTime(data.visitAt, tag);
  let message = t(`events.${type}`, params);
  if (typeof message !== 'string') return String(type);
  if (data.note) message += t('events.note', { note: data.note });
  if (data.reason) message += t('events.reason', { reason: data.reason });
  if (data.review) message += t('events.review', { review: data.review });
  return message;
}

// Message for a stored event row: structured data when available, otherwise
// the English text saved alongside it.
export function eventMessage(locale, event) {
  const data = parseEventData(event);
  return data ? renderEventMessage(locale, event.type, data) : event.message;
}

import { HttpError, ValidationError } from '../lib/http.js';

// Runs a state-changing action for a form submission.
//  - success: flash + redirect back
//  - validation error: re-render the page with field errors (HTTP 400)
//  - workflow conflict (409): flash the reason and redirect back
export function performAction(ctx, { backTo, action, successMessage, onInvalid }) {
  try {
    const result = action();
    if (successMessage) {
      ctx.flash('success', typeof successMessage === 'function' ? successMessage(result) : successMessage);
    }
    return ctx.redirect(typeof backTo === 'function' ? backTo(result) : backTo);
  } catch (error) {
    if (error instanceof ValidationError) {
      if (onInvalid) return onInvalid(error.errors);
      throw new HttpError(400, error.message);
    }
    if (error instanceof HttpError && error.status === 409) {
      ctx.flash('error', error.message);
      return ctx.redirect(typeof backTo === 'function' ? backTo() : backTo);
    }
    throw error;
  }
}

export function pickStatusFilter(value, allowed) {
  return allowed.includes(value) ? value : 'all';
}

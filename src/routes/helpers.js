import { HttpError, ValidationError } from '../lib/http.js';

// Runs a state-changing action for a form submission.
//  - success: flash (a translation key, or [key, params]) + redirect back
//  - validation error: re-render the page with translated field errors (HTTP 400)
//  - workflow conflict (409): flash the reason and redirect back
export function performAction(ctx, { backTo, action, success, onInvalid }) {
  const target = (result) => (typeof backTo === 'function' ? backTo(result) : backTo);
  try {
    const result = action();
    const message = typeof success === 'function' ? success(result) : success;
    if (Array.isArray(message)) ctx.flash('success', message[0], message[1]);
    else if (message) ctx.flash('success', message);
    return ctx.redirect(target(result));
  } catch (error) {
    if (error instanceof ValidationError) {
      if (onInvalid) return onInvalid(ctx.tErrors(error.errors));
      throw new HttpError(400, 'errors.validationGeneric');
    }
    if (error instanceof HttpError && error.status === 409) {
      ctx.flash('error', error.key, error.params);
      return ctx.redirect(target());
    }
    throw error;
  }
}

export function pickStatusFilter(value, allowed) {
  return allowed.includes(value) ? value : 'all';
}

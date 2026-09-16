/**
 * Every error the client is allowed to see is an AppError.
 * Anything else is logged server-side and reported as a generic failure.
 */
export class AppError extends Error {
  constructor(status, code, message, field = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.expose = true;
  }
}

export const badRequest = (msg, field) => new AppError(400, 'BAD_REQUEST', msg, field);
export const unauthorized = (msg = 'Sign in to continue.') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Not allowed.') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found.') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (msg, field) => new AppError(409, 'CONFLICT', msg, field);
export const tooMany = (msg) => new AppError(429, 'TOO_MANY_REQUESTS', msg);
export const unavailable = (msg = 'The product database is unreachable. Try again in a moment.') =>
  new AppError(503, 'UPSTREAM_UNAVAILABLE', msg);

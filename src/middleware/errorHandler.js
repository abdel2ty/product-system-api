import { AppError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } });
}

/**
 * The only place an error becomes a response. Anything that is not an AppError
 * is logged in full server-side and reduced to a generic message for the client.
 */
export function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message, field: error.field, requestId: req.id },
    });
  }

  if (error?.name === 'ZodError') {
    const first = error.issues[0];
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: first?.message ?? 'Some fields need attention.',
        field: first?.path?.join('.') ?? null,
        requestId: req.id,
      },
    });
  }

  console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: 'Something went wrong on our side. Nothing was saved.',
      requestId: req.id,
    },
  });
}

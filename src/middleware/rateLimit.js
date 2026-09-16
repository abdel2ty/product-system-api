import rateLimit from 'express-rate-limit';

const message = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Wait a few minutes and try again.' },
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

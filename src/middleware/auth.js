import { ACCESS_COOKIE } from '../config/constants.js';
import { verifyAccessToken } from '../services/authService.js';
import { unauthorized } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) return next(unauthorized());
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, tokenVersion: payload.v };
    next();
  } catch {
    next(unauthorized('Your session has expired. Sign in again.'));
  }
}

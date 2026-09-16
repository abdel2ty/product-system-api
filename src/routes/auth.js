import { Router } from 'express';
import { env } from '../config/env.js';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_TOKEN_TTL_DAYS } from '../config/constants.js';
import { loginInput, changePasswordInput } from '../validation/schemas.js';
import { validateBody } from '../middleware/validate.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../services/authService.js';
import { User } from '../integrations/mongo/models/User.js';

const router = Router();

// In development the Vite proxy makes the browser see one origin, so Strict
// cookies work. In production the API and the frontend live on different
// domains (e.g. onrender.com and vercel.app), which requires SameSite=None —
// and browsers only honour None when the cookie is also Secure (HTTPS).
const cookieBase = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'strict',
  path: '/',
};

function setCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBase,
    maxAge: REFRESH_TOKEN_TTL_DAYS * 86400000,
    path: '/api/auth',
  });
}

const context = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') ?? '' });

router.post('/login', loginLimiter, validateBody(loginInput), async (req, res, next) => {
  try {
    const result = await auth.login({ ...req.valid, ...context(req) });
    setCookies(res, result);
    res.json({ data: { username: result.user.username, lastLoginAt: result.user.lastLoginAt } });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const result = await auth.refresh({ token: req.cookies?.[REFRESH_COOKIE], ...context(req) });
    setCookies(res, result);
    res.json({ data: { username: result.user.username } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, cookieBase);
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: '/api/auth' });
    res.json({ data: { signedOut: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await auth.logoutEverywhere(req.user.id);
    res.clearCookie(ACCESS_COOKIE, cookieBase);
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: '/api/auth' });
    res.json({ data: { signedOut: true } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    res.json({ data: { username: user?.username ?? null, lastLoginAt: user?.lastLoginAt ?? null } });
  } catch (error) {
    next(error);
  }
});

router.post('/change-password', requireAuth, validateBody(changePasswordInput), async (req, res, next) => {
  try {
    await auth.changePassword(req.user.id, req.valid);
    res.clearCookie(ACCESS_COOKIE, cookieBase);
    res.clearCookie(REFRESH_COOKIE, { ...cookieBase, path: '/api/auth' });
    res.json({ data: { changed: true } });
  } catch (error) {
    next(error);
  }
});

export default router;

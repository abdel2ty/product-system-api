import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { User } from '../integrations/mongo/models/User.js';
import { Session } from '../integrations/mongo/models/Session.js';
import { audit } from '../integrations/mongo/models/AuditLog.js';
import { env } from '../config/env.js';
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_MINUTES,
} from '../config/constants.js';
import { unauthorized, tooMany, badRequest } from '../utils/errors.js';

export const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Comparing against a real hash on unknown usernames keeps response times flat,
// so the endpoint never reveals whether an account exists.
const DECOY_HASH = await argon2.hash(crypto.randomBytes(32).toString('hex'), ARGON_OPTIONS);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const hashPassword = (password) => argon2.hash(password, ARGON_OPTIONS);

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, v: user.tokenVersion }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signRefreshToken(user) {
  const jti = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ sub: user.id, jti, v: user.tokenVersion }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
  });
  return token;
}

export async function login({ username, password, ip, userAgent }) {
  const user = await User.findOne({ username: username.toLowerCase() });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil - Date.now()) / 60000);
    throw tooMany(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const valid = user
    ? await argon2.verify(user.passwordHash, password).catch(() => false)
    : await argon2.verify(DECOY_HASH, password).catch(() => false);

  if (!user || !valid) {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= LOGIN_MAX_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60000);
        user.failedAttempts = 0;
      }
      await user.save();
    }
    audit('login_failed', { meta: { username }, ip });
    throw unauthorized('That username and password do not match.');
  }

  user.failedAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = ip;
  await user.save();

  const refreshToken = signRefreshToken(user);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(refreshToken),
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000),
  });

  audit('login', { entityId: user.id, ip });
  return { user, accessToken: signAccessToken(user), refreshToken };
}

export async function refresh({ token, ip, userAgent }) {
  if (!token) throw unauthorized('Your session has expired. Sign in again.');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw unauthorized('Your session has expired. Sign in again.');
  }

  const hash = sha256(token);
  const session = await Session.findOne({ tokenHash: hash, revokedAt: null });
  if (!session) throw unauthorized('Your session has expired. Sign in again.');

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) {
    throw unauthorized('Your session has expired. Sign in again.');
  }

  // Rotation: the old refresh token is retired the moment it is used.
  session.revokedAt = new Date();
  await session.save();

  const nextToken = signRefreshToken(user);
  await Session.create({
    userId: user._id,
    tokenHash: sha256(nextToken),
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86400000),
  });

  return { user, accessToken: signAccessToken(user), refreshToken: nextToken };
}

export async function logout(token) {
  if (!token) return;
  await Session.updateOne({ tokenHash: sha256(token), revokedAt: null }, { revokedAt: new Date() });
}

export async function logoutEverywhere(userId) {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId);
  if (!user) throw unauthorized();
  const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
  if (!valid) throw badRequest('That is not your current password.', 'currentPassword');

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
  audit('password_changed', { entityId: user.id });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

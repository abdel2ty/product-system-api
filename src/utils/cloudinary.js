import { env } from '../config/env.js';

const CLOUDINARY_HOST = 'res.cloudinary.com';

/** Accepts any https URL; flags non-Cloudinary hosts so the UI can warn without blocking. */
export function inspectImageUrl(url) {
  if (!url) return { ok: true, empty: true, cloudinary: false };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'That does not look like a valid URL.' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Image links must start with https://' };
  }
  const isCloudinary = parsed.hostname === CLOUDINARY_HOST;
  if (isCloudinary && env.CLOUDINARY_CLOUD_NAME) {
    const cloud = parsed.pathname.split('/').filter(Boolean)[0];
    if (cloud && cloud !== env.CLOUDINARY_CLOUD_NAME) {
      return { ok: false, reason: 'That link points at a different Cloudinary account.' };
    }
  }
  return { ok: true, empty: false, cloudinary: isCloudinary };
}

/**
 * Rewrites a Cloudinary delivery URL to request a small, auto-format version.
 * A 200-row table then pulls a few hundred kilobytes instead of tens of megabytes.
 */
export function thumbnailUrl(url, size = 64) {
  if (!url || !url.includes(`${CLOUDINARY_HOST}/`)) return url || null;
  if (!url.includes('/upload/')) return url;
  if (/\/upload\/[^/]*[wh]_\d+/.test(url)) return url;
  return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);
}

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DAYS = 7;

export const ACCESS_COOKIE = 'ps_at';
export const REFRESH_COOKIE = 'ps_rt';

/** How long the in-memory store may serve before re-reading the spreadsheet. */
export const STORE_TTL_MS = 30 * 60 * 1000;

export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_LOCK_MINUTES = 15;

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export const WARRANTY_BUCKETS = [
  { key: 'none', label: 'No warranty', min: 0, max: 0 },
  { key: '1-6', label: '1-6 months', min: 1, max: 6 },
  { key: '7-12', label: '7-12 months', min: 7, max: 12 },
  { key: '13-24', label: '13-24 months', min: 13, max: 24 },
  { key: '25+', label: 'Over 24 months', min: 25, max: Infinity },
];

import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { unavailable } from '../../utils/errors.js';

const auth = new google.auth.JWT({
  email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: env.GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Three attempts with backoff and jitter — Sheets rate-limits in bursts. */
async function withRetry(label, fn) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.code ?? error?.response?.status;
      if (!RETRYABLE.has(status)) break;
      const wait = 400 * 2 ** attempt + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  console.error(`[sheets] ${label} failed`, lastError?.message);
  throw unavailable();
}

export const sheetsClient = {
  async batchGet(ranges) {
    const res = await withRetry('batchGet', () =>
      sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      }),
    );
    return res.data.valueRanges.map((r) => r.values ?? []);
  },

  async append(range, row) {
    const res = await withRetry('append', () =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        includeValuesInResponse: false,
        requestBody: { values: [row] },
      }),
    );
    // "Products!A1284:T1284" -> 1284
    const updated = res.data.updates?.updatedRange ?? '';
    const match = updated.match(/![A-Z]+(\d+)/);
    return match ? Number(match[1]) : null;
  },

  async updateRow(range, row) {
    await withRetry('updateRow', () =>
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      }),
    );
  },

  async writeRanges(entries) {
    await withRetry('batchUpdate', () =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: entries.map(({ range, row }) => ({ range, values: [row] })),
        },
      }),
    );
  },

  async getSpreadsheet() {
    const res = await withRetry('get', () => sheets.spreadsheets.get({ spreadsheetId }));
    return res.data;
  },

  async structuralUpdate(requests) {
    await withRetry('structuralUpdate', () =>
      sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }),
    );
  },

  raw: sheets,
  spreadsheetId,
};

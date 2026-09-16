import { store } from '../store/ProductStore.js';
import { sheetsClient } from '../integrations/sheets/client.js';
import { SHEETS, dataRange } from '../integrations/sheets/schema.js';

const KEYS = {
  defaultCurrency: 'default_currency',
  defaultWarrantyMonths: 'default_warranty_months',
  codePrefix: 'code_prefix',
  tableDensity: 'table_density',
  pageSize: 'page_size',
};

export async function getSettings() {
  await store.ready();
  return {
    defaultCurrency: store.settings.get(KEYS.defaultCurrency) || '',
    defaultWarrantyMonths: Number(store.settings.get(KEYS.defaultWarrantyMonths) || 0),
    codePrefix: store.settings.get(KEYS.codePrefix) || '019',
    tableDensity: store.settings.get(KEYS.tableDensity) || 'comfortable',
    pageSize: Number(store.settings.get(KEYS.pageSize) || 50),
  };
}

export async function updateSettings(input) {
  await store.ready();
  return store.writeLock.run(async () => {
    for (const [field, sheetKey] of Object.entries(KEYS)) {
      if (input[field] !== undefined) store.settings.set(sheetKey, String(input[field]));
    }
    const rows = [...store.settings.entries()].map(([k, v]) => [k, v]);
    await sheetsClient.raw.spreadsheets.values.clear({
      spreadsheetId: sheetsClient.spreadsheetId,
      range: dataRange(SHEETS.settings),
    });
    if (rows.length) {
      await sheetsClient.raw.spreadsheets.values.update({
        spreadsheetId: sheetsClient.spreadsheetId,
        range: `${SHEETS.settings.title}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      });
    }
    return getSettings();
  });
}

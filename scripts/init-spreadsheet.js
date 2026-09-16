import { sheetsClient } from '../src/integrations/sheets/client.js';
import { SHEETS, headerRange } from '../src/integrations/sheets/schema.js';

/**
 * Prepares a blank spreadsheet: creates the three tabs, writes the header rows,
 * freezes them, and sets sensible column widths. Safe to re-run.
 */
const WIDTHS = {
  Products: [0, 130, 130, 280, 0, 160, 320, 320, 90, 160, 100, 100, 70, 280, 280, 240, 90, 160, 160, 160, 0],
  Categories: [0, 200, 70, 280, 90, 160, 160, 160],
  Suppliers: [0, 200, 280, 90, 160, 160, 160],
  Settings: [200, 200],
};

const spreadsheet = await sheetsClient.getSpreadsheet();
const existing = new Map(spreadsheet.sheets.map((s) => [s.properties.title, s.properties]));

const requests = [];

for (const sheet of Object.values(SHEETS)) {
  if (!existing.has(sheet.title)) {
    requests.push({ addSheet: { properties: { title: sheet.title } } });
  }
}

if (requests.length) {
  await sheetsClient.structuralUpdate(requests);
  console.log(`Created ${requests.length} sheet(s).`);
}

const refreshed = await sheetsClient.getSpreadsheet();
const ids = new Map(refreshed.sheets.map((s) => [s.properties.title, s.properties.sheetId]));

const headerWrites = Object.values(SHEETS).map((sheet) => ({
  range: headerRange(sheet),
  row: sheet.columns,
}));
await sheetsClient.writeRanges(headerWrites);

const formatting = [];
for (const sheet of Object.values(SHEETS)) {
  const sheetId = ids.get(sheet.title);
  formatting.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });
  formatting.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: 'userEnteredFormat.textFormat.bold',
    },
  });
  (WIDTHS[sheet.title] ?? []).forEach((width, index) => {
    if (!width) return;
    formatting.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: width },
        fields: 'pixelSize',
      },
    });
  });
}

await sheetsClient.structuralUpdate(formatting);
console.log('Spreadsheet is ready. Headers written, first row frozen, column widths set.');

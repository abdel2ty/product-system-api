/**
 * The spreadsheet layout, declared once. Column order here is the column order
 * in the sheet; nothing else in the codebase knows about letters or indexes.
 */

export const PRODUCT_COLUMNS = [
  'id',
  'my_product_code',
  'supplier_product_code',
  'name',
  'category_id',
  'type',
  'description',
  'specifications',
  'warranty_months',
  'warranty_note',
  'supplier_price',
  'selling_price',
  'currency',
  'supplier_image_url',
  'my_image_url',
  'notes',
  'status',
  'created_at',
  'updated_at',
  'deleted_at',
  // Appended rather than inserted, so existing rows in an already-populated
  // sheet keep every column they have — only this new one is blank for them.
  'supplier_id',
];

export const CATEGORY_COLUMNS = [
  'id',
  'name',
  'code',
  'description',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
];

// Suppliers have no short "code" of their own — unlike a category, a
// supplier doesn't feed into the product code stem. What each supplier
// contributes is a namespace: two suppliers can use the same
// supplier_product_code without colliding, because uniqueness is checked
// per supplier, not globally.
export const SUPPLIER_COLUMNS = [
  'id',
  'name',
  'description',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
];

export const SETTINGS_COLUMNS = ['key', 'value'];

export const SHEETS = {
  products: { title: 'Products', columns: PRODUCT_COLUMNS },
  categories: { title: 'Categories', columns: CATEGORY_COLUMNS },
  suppliers: { title: 'Suppliers', columns: SUPPLIER_COLUMNS },
  settings: { title: 'Settings', columns: SETTINGS_COLUMNS },
};

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function columnLetter(index) {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = A[n % 26] + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

export function dataRange(sheet) {
  const last = columnLetter(sheet.columns.length - 1);
  return `${sheet.title}!A2:${last}`;
}

export function rowRange(sheet, rowNumber) {
  const last = columnLetter(sheet.columns.length - 1);
  return `${sheet.title}!A${rowNumber}:${last}${rowNumber}`;
}

export function headerRange(sheet) {
  const last = columnLetter(sheet.columns.length - 1);
  return `${sheet.title}!A1:${last}1`;
}

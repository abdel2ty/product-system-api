import { sheetsClient } from '../integrations/sheets/client.js';
import { SHEETS, dataRange } from '../integrations/sheets/schema.js';
import { parseProduct, parseCategory, parseSupplier } from '../integrations/sheets/mapper.js';
import { STORE_TTL_MS } from '../config/constants.js';
import { Mutex } from '../utils/mutex.js';

const normalise = (s) => String(s ?? '').trim().toUpperCase();

/**
 * The whole product database, held in memory.
 *
 * Google Sheets is the system of record; this is the query engine. Search,
 * filtering, sorting, pagination and statistics all run here, so browsing
 * 5,000 products costs zero API calls.
 */
class ProductStore {
  products = new Map(); // id -> product
  categories = new Map(); // id -> category
  suppliers = new Map(); // id -> supplier
  settings = new Map(); // key -> value

  byMyCode = new Map(); // NORMALISED CODE -> id
  // Keyed by "supplierId::NORMALISED CODE" — the same supplier code is only
  // a clash when it's the same supplier. Two suppliers can share a code.
  bySupplierCode = new Map();
  byCategory = new Map(); // categoryId -> Set<id>
  bySupplier = new Map(); // supplierId -> Set<id>
  haystack = new Map(); // id -> lowercased searchable string

  lastSyncedAt = null;
  loading = null;
  lastProductRow = 1;
  lastCategoryRow = 1;
  lastSupplierRow = 1;
  writeLock = new Mutex();

  get isStale() {
    return !this.lastSyncedAt || Date.now() - this.lastSyncedAt > STORE_TTL_MS;
  }

  /** Concurrent callers share one in-flight load rather than stampeding the API. */
  async ready() {
    if (!this.isStale) return;
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null;
      });
    }
    await this.loading;
  }

  async load() {
    const [productRows, categoryRows, supplierRows, settingRows] = await sheetsClient.batchGet([
      dataRange(SHEETS.products),
      dataRange(SHEETS.categories),
      dataRange(SHEETS.suppliers),
      dataRange(SHEETS.settings),
    ]);

    this.products.clear();
    this.categories.clear();
    this.suppliers.clear();
    this.settings.clear();

    categoryRows.forEach((row, i) => {
      const category = parseCategory(row, i + 2);
      if (category && !category.deletedAt) this.categories.set(category.id, category);
    });
    this.lastCategoryRow = categoryRows.length + 1;

    supplierRows.forEach((row, i) => {
      const supplier = parseSupplier(row, i + 2);
      if (supplier && !supplier.deletedAt) this.suppliers.set(supplier.id, supplier);
    });
    this.lastSupplierRow = supplierRows.length + 1;

    productRows.forEach((row, i) => {
      const product = parseProduct(row, i + 2);
      if (product) this.products.set(product.id, product);
    });
    this.lastProductRow = productRows.length + 1;

    settingRows.forEach((row) => {
      if (row[0]) this.settings.set(String(row[0]).trim(), row[1] ?? '');
    });

    this.reindex();
    this.lastSyncedAt = Date.now();
  }

  reindex() {
    this.byMyCode.clear();
    this.bySupplierCode.clear();
    this.byCategory.clear();
    this.haystack.clear();
    for (const product of this.products.values()) {
      this.index(product);
    }
  }

  index(product) {
    if (product.status === 'deleted') return;
    this.byMyCode.set(normalise(product.myProductCode), product.id);

    if (product.supplierProductCode && product.supplierId) {
      const key = supplierCodeKey(product.supplierId, product.supplierProductCode);
      if (!this.bySupplierCode.has(key)) this.bySupplierCode.set(key, new Set());
      this.bySupplierCode.get(key).add(product.id);
    }

    if (product.categoryId) {
      if (!this.byCategory.has(product.categoryId)) this.byCategory.set(product.categoryId, new Set());
      this.byCategory.get(product.categoryId).add(product.id);
    }

    if (product.supplierId) {
      if (!this.bySupplier.has(product.supplierId)) this.bySupplier.set(product.supplierId, new Set());
      this.bySupplier.get(product.supplierId).add(product.id);
    }

    const category = this.categories.get(product.categoryId);
    const supplier = this.suppliers.get(product.supplierId);
    this.haystack.set(
      product.id,
      [
        product.myProductCode,
        product.supplierProductCode,
        product.name,
        product.type,
        product.description,
        product.notes,
        category?.name ?? '',
        supplier?.name ?? '',
      ]
        .join(' \u0000 ')
        .toLowerCase(),
    );
  }

  deindex(product) {
    this.byMyCode.delete(normalise(product.myProductCode));
    if (product.supplierId) {
      this.bySupplierCode.get(supplierCodeKey(product.supplierId, product.supplierProductCode))?.delete(product.id);
    }
    this.byCategory.get(product.categoryId)?.delete(product.id);
    this.bySupplier.get(product.supplierId)?.delete(product.id);
    this.haystack.delete(product.id);
  }

  upsert(product) {
    const existing = this.products.get(product.id);
    if (existing) this.deindex(existing);
    this.products.set(product.id, product);
    this.index(product);
  }

  /** Products the application considers real: not deleted. */
  live() {
    const out = [];
    for (const p of this.products.values()) {
      if (p.status !== 'deleted') out.push(p);
    }
    return out;
  }

  findByMyCode(code) {
    const id = this.byMyCode.get(normalise(code));
    return id ? this.products.get(id) : null;
  }

  /** Scoped to one supplier — the same code under a different supplier is not a clash. */
  findBySupplierCode(supplierId, code) {
    if (!supplierId) return [];
    const ids = this.bySupplierCode.get(supplierCodeKey(supplierId, code));
    if (!ids || ids.size === 0) return [];
    return [...ids].map((id) => this.products.get(id)).filter(Boolean);
  }

  countInCategory(categoryId) {
    let n = 0;
    for (const id of this.byCategory.get(categoryId) ?? []) {
      if (this.products.get(id)?.status !== 'deleted') n += 1;
    }
    return n;
  }

  countInSupplier(supplierId) {
    let n = 0;
    for (const id of this.bySupplier.get(supplierId) ?? []) {
      if (this.products.get(id)?.status !== 'deleted') n += 1;
    }
    return n;
  }

  matches(id, needle) {
    return (this.haystack.get(id) ?? '').includes(needle);
  }
}

function supplierCodeKey(supplierId, code) {
  return `${supplierId}::${normalise(code)}`;
}

export const store = new ProductStore();
export { normalise };

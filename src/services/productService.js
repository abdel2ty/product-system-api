import { ulid } from 'ulid';
import { store, normalise } from '../store/ProductStore.js';
import { sheetsClient } from '../integrations/sheets/client.js';
import { SHEETS, rowRange, dataRange } from '../integrations/sheets/schema.js';
import { serialiseProduct } from '../integrations/sheets/mapper.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';
import { thumbnailUrl } from '../utils/cloudinary.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, WARRANTY_BUCKETS } from '../config/constants.js';

const now = () => new Date().toISOString();

/** A product is "incomplete" when it is missing anything you would need to sell it. */
export function isIncomplete(p) {
  return (
    !p.name ||
    !p.categoryId ||
    !p.type ||
    !p.specifications ||
    p.supplierPrice === null ||
    p.sellingPrice === null ||
    !p.supplierImageUrl
  );
}

function warrantyBucket(months) {
  return WARRANTY_BUCKETS.find((b) => months >= b.min && months <= b.max)?.key ?? 'none';
}

export function present(product) {
  const category = store.categories.get(product.categoryId);
  const supplier = store.suppliers.get(product.supplierId);
  const margin =
    product.supplierPrice !== null && product.sellingPrice !== null && product.supplierPrice > 0
      ? (product.sellingPrice - product.supplierPrice) / product.supplierPrice
      : null;
  return {
    id: product.id,
    myProductCode: product.myProductCode,
    supplierProductCode: product.supplierProductCode,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: category?.name ?? 'Uncategorised',
    categoryCode: category?.code ?? '',
    supplierId: product.supplierId,
    supplierName: supplier?.name ?? 'No supplier',
    type: product.type,
    description: product.description,
    specifications: product.specifications,
    warrantyMonths: product.warrantyMonths,
    warrantyNote: product.warrantyNote,
    supplierPrice: product.supplierPrice,
    sellingPrice: product.sellingPrice,
    margin,
    currency: product.currency || store.settings.get('default_currency') || '',
    supplierImageUrl: product.supplierImageUrl || null,
    myImageUrl: product.myImageUrl || null,
    supplierThumbUrl: thumbnailUrl(product.supplierImageUrl),
    myThumbUrl: thumbnailUrl(product.myImageUrl),
    notes: product.notes,
    status: product.status,
    incomplete: isIncomplete(product),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

const SORTS = {
  updated_at: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  created_at: (a, b) => a.createdAt.localeCompare(b.createdAt),
  name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  my_product_code: (a, b) => a.myProductCode.localeCompare(b.myProductCode, 'en', { numeric: true }),
  supplier_price: (a, b) => (a.supplierPrice ?? -1) - (b.supplierPrice ?? -1),
  selling_price: (a, b) => (a.sellingPrice ?? -1) - (b.sellingPrice ?? -1),
};

export async function queryProducts(params) {
  await store.ready();

  const {
    q = '',
    category = [],
    supplier = [],
    type = '',
    warranty = '',
    hasImages = '',
    incomplete = false,
    minPrice,
    maxPrice,
    sort = 'updated_at',
    dir = 'desc',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params;

  const needle = q.trim().toLowerCase();
  const categories = new Set(Array.isArray(category) ? category : [category].filter(Boolean));
  const suppliers = new Set(Array.isArray(supplier) ? supplier : [supplier].filter(Boolean));

  let rows = store.live().filter((p) => {
    if (categories.size && !categories.has(p.categoryId)) return false;
    if (suppliers.size && !suppliers.has(p.supplierId)) return false;
    if (type && p.type.toLowerCase() !== type.toLowerCase()) return false;
    if (warranty && warrantyBucket(p.warrantyMonths) !== warranty) return false;
    if (incomplete && !isIncomplete(p)) return false;
    if (hasImages === 'both' && !(p.supplierImageUrl && p.myImageUrl)) return false;
    if (hasImages === 'supplier' && !p.supplierImageUrl) return false;
    if (hasImages === 'mine' && !p.myImageUrl) return false;
    if (hasImages === 'none' && (p.supplierImageUrl || p.myImageUrl)) return false;
    if (minPrice !== undefined && (p.sellingPrice ?? 0) < minPrice) return false;
    if (maxPrice !== undefined && (p.sellingPrice ?? 0) > maxPrice) return false;
    if (needle && !store.matches(p.id, needle)) return false;
    return true;
  });

  // Facet counts are computed on the filtered set, so the filter panel shows live numbers.
  const facets = { categories: {}, suppliers: {}, warranty: {} };
  for (const p of rows) {
    facets.categories[p.categoryId] = (facets.categories[p.categoryId] ?? 0) + 1;
    if (p.supplierId) facets.suppliers[p.supplierId] = (facets.suppliers[p.supplierId] ?? 0) + 1;
    const bucket = warrantyBucket(p.warrantyMonths);
    facets.warranty[bucket] = (facets.warranty[bucket] ?? 0) + 1;
  }

  if (needle) {
    // An exact code match is almost always the thing you were looking for.
    const rank = (p) => {
      if (p.myProductCode.toLowerCase() === needle) return 0;
      if (p.supplierProductCode.toLowerCase() === needle) return 1;
      if (p.myProductCode.toLowerCase().startsWith(needle)) return 2;
      if (p.supplierProductCode.toLowerCase().startsWith(needle)) return 3;
      if (p.name.toLowerCase().includes(needle)) return 4;
      return 5;
    };
    rows.sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt));
  } else {
    const comparator = SORTS[sort] ?? SORTS.updated_at;
    rows.sort(comparator);
    if (dir === 'desc') rows.reverse();
  }

  const size = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const slice = rows.slice((current - 1) * size, current * size);

  return {
    data: slice.map(present),
    meta: { total, page: current, pageSize: size, pages, facets, grouped: !needle },
  };
}

export async function getProduct(id) {
  await store.ready();
  const product = store.products.get(id);
  if (!product || product.status === 'deleted') throw notFound('That product no longer exists.');
  return present(product);
}

export async function checkCode({ myCode, supplierCode, supplierId, excludeId }) {
  await store.ready();
  if (myCode) {
    const found = store.findByMyCode(myCode);
    const taken = found && found.id !== excludeId;
    return { taken: Boolean(taken), product: taken ? present(found) : null };
  }
  if (supplierCode && supplierId) {
    const matches = store.findBySupplierCode(supplierId, supplierCode).filter((p) => p.id !== excludeId);
    return { taken: matches.length > 0, products: matches.map(present) };
  }
  return { taken: false };
}

/**
 * Suggests the next code in a category's sequence, e.g. 019-CH-014.
 * The prefix and category code come from Settings and the category record,
 * and the number continues from the highest existing code in that category.
 */
export async function suggestNextCode(categoryId) {
  await store.ready();
  const category = store.categories.get(categoryId);
  if (!category) throw notFound('That category no longer exists.');

  const prefix = store.settings.get('code_prefix') || '019';
  const stem = `${prefix}-${category.code}-`;

  let highest = 0;
  let width = 4; // 0001–9999; widens further on its own if a code ever needs more digits
  for (const id of store.byCategory.get(categoryId) ?? []) {
    const product = store.products.get(id);
    if (!product || product.status === 'deleted') continue;
    const code = normalise(product.myProductCode);
    if (!code.startsWith(normalise(stem))) continue;
    const tail = code.slice(stem.length);
    if (!/^\d+$/.test(tail)) continue;
    width = Math.max(width, tail.length);
    highest = Math.max(highest, Number(tail));
  }

  let candidate;
  let next = highest;
  do {
    next += 1;
    candidate = `${stem}${String(next).padStart(width, '0')}`;
  } while (store.byMyCode.has(normalise(candidate)) && next < highest + 1000);

  return { code: candidate };
}

function assertUnique(input, excludeId) {
  const existing = store.findByMyCode(input.myProductCode);
  if (existing && existing.id !== excludeId) {
    throw conflict(`${existing.myProductCode} is already used by "${existing.name}".`, 'myProductCode');
  }
  // Scoped to the same supplier — the same code under a different supplier is fine and never warned about.
  if (input.supplierProductCode && input.supplierId && !input.allowDuplicateSupplierCode) {
    const clashes = store
      .findBySupplierCode(input.supplierId, input.supplierProductCode)
      .filter((p) => p.id !== excludeId);
    if (clashes.length) {
      throw conflict(
        `Supplier code ${input.supplierProductCode} is already on "${clashes[0].name}" from this supplier. Save again to keep it anyway.`,
        'supplierProductCode',
      );
    }
  }
}

export async function createProduct(input) {
  await store.ready();
  if (!store.categories.has(input.categoryId)) throw badRequest('Choose a category.', 'categoryId');
  if (input.supplierId && !store.suppliers.has(input.supplierId)) {
    throw badRequest('Choose a supplier.', 'supplierId');
  }

  return store.writeLock.run(async () => {
    assertUnique(input);
    const timestamp = now();
    const product = {
      ...input,
      id: ulid(),
      currency: input.currency || store.settings.get('default_currency') || '',
      supplierPrice: input.supplierPrice ?? null,
      sellingPrice: input.sellingPrice ?? null,
      status: input.status ?? 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      rowNumber: null,
    };

    const rowNumber = await sheetsClient.append(dataRange(SHEETS.products), serialiseProduct(product));
    product.rowNumber = rowNumber ?? store.lastProductRow + 1;
    store.lastProductRow = product.rowNumber;
    store.upsert(product);
    return present(product);
  });
}

export async function updateProduct(id, input) {
  await store.ready();
  const current = store.products.get(id);
  if (!current || current.status === 'deleted') throw notFound('That product no longer exists.');
  if (input.categoryId && !store.categories.has(input.categoryId)) {
    throw badRequest('Choose a category.', 'categoryId');
  }
  if (input.supplierId && !store.suppliers.has(input.supplierId)) {
    throw badRequest('Choose a supplier.', 'supplierId');
  }

  return store.writeLock.run(async () => {
    const merged = { ...current, ...input, id: current.id, rowNumber: current.rowNumber };
    assertUnique(merged, id);
    merged.updatedAt = now();

    await sheetsClient.updateRow(rowRange(SHEETS.products, current.rowNumber), serialiseProduct(merged));
    store.upsert(merged);
    return present(merged);
  });
}

/** Soft delete: the spreadsheet row stays, so nothing is ever truly lost. */
export async function deleteProduct(id) {
  await store.ready();
  const current = store.products.get(id);
  if (!current || current.status === 'deleted') throw notFound('That product no longer exists.');

  return store.writeLock.run(async () => {
    const deleted = { ...current, status: 'deleted', deletedAt: now(), updatedAt: now() };
    await sheetsClient.updateRow(rowRange(SHEETS.products, current.rowNumber), serialiseProduct(deleted));
    store.deindex(current);
    store.products.set(id, deleted);
    return { id, deleted: true };
  });
}

export async function restoreProduct(id) {
  await store.ready();
  const current = store.products.get(id);
  if (!current) throw notFound('That product no longer exists.');
  if (current.status !== 'deleted') return present(current);

  return store.writeLock.run(async () => {
    if (store.byMyCode.has(normalise(current.myProductCode))) {
      throw conflict('Another product now uses that code. Change it before restoring.', 'myProductCode');
    }
    const restored = { ...current, status: 'active', deletedAt: null, updatedAt: now() };
    await sheetsClient.updateRow(rowRange(SHEETS.products, current.rowNumber), serialiseProduct(restored));
    store.upsert(restored);
    return present(restored);
  });
}

export async function reassignCategory(fromId, toId) {
  const affected = [...(store.byCategory.get(fromId) ?? [])]
    .map((id) => store.products.get(id))
    .filter((p) => p && p.status !== 'deleted');

  if (!affected.length) return 0;

  const timestamp = now();
  const entries = affected.map((p) => {
    const moved = { ...p, categoryId: toId, updatedAt: timestamp };
    return { product: moved, range: rowRange(SHEETS.products, p.rowNumber), row: serialiseProduct(moved) };
  });

  // Sheets accepts up to a few hundred ranges per batch; chunk to stay well inside.
  for (let i = 0; i < entries.length; i += 100) {
    await sheetsClient.writeRanges(entries.slice(i, i + 100));
  }
  entries.forEach(({ product }) => store.upsert(product));
  return entries.length;
}

export async function reassignSupplier(fromId, toId) {
  const affected = [...(store.bySupplier.get(fromId) ?? [])]
    .map((id) => store.products.get(id))
    .filter((p) => p && p.status !== 'deleted');

  if (!affected.length) return 0;

  const timestamp = now();
  const entries = affected.map((p) => {
    const moved = { ...p, supplierId: toId, updatedAt: timestamp };
    return { product: moved, range: rowRange(SHEETS.products, p.rowNumber), row: serialiseProduct(moved) };
  });

  for (let i = 0; i < entries.length; i += 100) {
    await sheetsClient.writeRanges(entries.slice(i, i + 100));
  }
  entries.forEach(({ product }) => store.upsert(product));
  return entries.length;
}

import { store } from '../store/ProductStore.js';
import { isIncomplete, present } from './productService.js';
import { WARRANTY_BUCKETS } from '../config/constants.js';

const DAY = 24 * 60 * 60 * 1000;

const average = (values) => {
  const usable = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!usable.length) return null;
  return usable.reduce((a, b) => a + b, 0) / usable.length;
};

export async function dashboardStats() {
  await store.ready();
  const products = store.live();
  const since = Date.now() - 7 * DAY;

  const addedThisWeek = products.filter((p) => Date.parse(p.createdAt) >= since).length;
  const updatedThisWeek = products.filter((p) => Date.parse(p.updatedAt) >= since).length;

  const completeness = {
    missingSupplierImage: products.filter((p) => !p.supplierImageUrl).length,
    missingMyImage: products.filter((p) => !p.myImageUrl).length,
    missingSpecifications: products.filter((p) => !p.specifications).length,
    missingPrices: products.filter((p) => p.supplierPrice === null || p.sellingPrice === null).length,
    noWarranty: products.filter((p) => !p.warrantyMonths).length,
    incomplete: products.filter(isIncomplete).length,
  };

  const byCategory = [...store.categories.values()]
    .map((c) => ({ id: c.id, name: c.name, code: c.code, count: store.countInCategory(c.id) }))
    .sort((a, b) => b.count - a.count);

  const byWarranty = WARRANTY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: products.filter((p) => p.warrantyMonths >= bucket.min && p.warrantyMonths <= bucket.max).length,
  }));

  const margins = products
    .filter((p) => p.supplierPrice > 0 && p.sellingPrice !== null)
    .map((p) => (p.sellingPrice - p.supplierPrice) / p.supplierPrice);

  const recent = (field) =>
    [...products]
      .sort((a, b) => b[field].localeCompare(a[field]))
      .slice(0, 8)
      .map(present);

  return {
    overview: {
      totalProducts: products.length,
      totalCategories: store.categories.size,
      addedThisWeek,
      updatedThisWeek,
      lastSyncedAt: store.lastSyncedAt ? new Date(store.lastSyncedAt).toISOString() : null,
    },
    completeness,
    byCategory,
    byWarranty,
    pricing: {
      averageSupplierPrice: average(products.map((p) => p.supplierPrice)),
      averageSellingPrice: average(products.map((p) => p.sellingPrice)),
      averageMargin: average(margins),
      currency: store.settings.get('default_currency') || '',
      missingMargin: products.filter((p) => p.supplierPrice === null || p.sellingPrice === null).length,
    },
    recentlyAdded: recent('createdAt'),
    recentlyUpdated: recent('updatedAt'),
  };
}

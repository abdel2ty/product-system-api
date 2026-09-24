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

  const bySupplier = [...store.suppliers.values()]
    .map((s) => ({ id: s.id, name: s.name, count: store.countInSupplier(s.id) }))
    .sort((a, b) => b.count - a.count);

  const byWarranty = WARRANTY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: products.filter((p) => p.warrantyMonths >= bucket.min && p.warrantyMonths <= bucket.max).length,
  }));

  const margins = products
    .filter((p) => p.supplierPrice > 0 && p.sellingPrice !== null)
    .map((p) => (p.sellingPrice - p.supplierPrice) / p.supplierPrice);

  // Fixed percentage bands rather than data-driven ones, so the chart reads
  // the same way from one day to the next as the catalogue grows.
  const MARGIN_BANDS = [
    { key: 'neg', label: 'Below 0%', min: -Infinity, max: 0 },
    { key: '0-20', label: '0–20%', min: 0, max: 0.2 },
    { key: '20-40', label: '20–40%', min: 0.2, max: 0.4 },
    { key: '40-60', label: '40–60%', min: 0.4, max: 0.6 },
    { key: '60-100', label: '60–100%', min: 0.6, max: 1 },
    { key: '100+', label: 'Over 100%', min: 1, max: Infinity },
  ];
  const marginDistribution = MARGIN_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    count: margins.filter((m) => m >= band.min && m < band.max).length,
  }));

  // A 14-day window of how many products were created vs. touched each day
  // — the one chart here that shows change over time rather than a
  // snapshot.
  const ACTIVITY_DAYS = 14;
  const dayKey = (iso) => iso.slice(0, 10);
  const activity = [];
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * DAY);
    const key = date.toISOString().slice(0, 10);
    activity.push({
      date: key,
      added: products.filter((p) => dayKey(p.createdAt) === key).length,
      updated: products.filter((p) => dayKey(p.updatedAt) === key && dayKey(p.updatedAt) !== dayKey(p.createdAt))
        .length,
    });
  }

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
    bySupplier,
    byWarranty,
    marginDistribution,
    activity,
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
import { PRODUCT_COLUMNS, CATEGORY_COLUMNS, SUPPLIER_COLUMNS } from './schema.js';

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const int = (v) => {
  const n = num(v);
  return n === null ? 0 : Math.trunc(n);
};

function toObject(columns, row) {
  const out = {};
  columns.forEach((col, i) => {
    out[col] = row[i] ?? '';
  });
  return out;
}

function toRow(columns, obj) {
  return columns.map((col) => {
    const value = obj[col];
    if (value === null || value === undefined) return '';
    return value;
  });
}

export function parseProduct(row, rowNumber) {
  const r = toObject(PRODUCT_COLUMNS, row);
  if (!text(r.id)) return null;
  return {
    id: text(r.id),
    rowNumber,
    myProductCode: text(r.my_product_code),
    supplierProductCode: text(r.supplier_product_code),
    name: text(r.name),
    categoryId: text(r.category_id),
    type: text(r.type),
    description: text(r.description),
    specifications: text(r.specifications),
    warrantyMonths: int(r.warranty_months),
    warrantyNote: text(r.warranty_note),
    supplierPrice: num(r.supplier_price),
    sellingPrice: num(r.selling_price),
    currency: text(r.currency),
    supplierImageUrl: text(r.supplier_image_url),
    myImageUrl: text(r.my_image_url),
    notes: text(r.notes),
    status: text(r.status) || 'active',
    createdAt: text(r.created_at),
    updatedAt: text(r.updated_at),
    deletedAt: text(r.deleted_at) || null,
    supplierId: text(r.supplier_id),
  };
}

export function serialiseProduct(p) {
  return toRow(PRODUCT_COLUMNS, {
    id: p.id,
    my_product_code: p.myProductCode,
    supplier_product_code: p.supplierProductCode,
    name: p.name,
    category_id: p.categoryId,
    type: p.type,
    description: p.description,
    specifications: p.specifications,
    warranty_months: p.warrantyMonths,
    warranty_note: p.warrantyNote,
    supplier_price: p.supplierPrice,
    selling_price: p.sellingPrice,
    currency: p.currency,
    supplier_image_url: p.supplierImageUrl,
    my_image_url: p.myImageUrl,
    notes: p.notes,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    deleted_at: p.deletedAt,
    supplier_id: p.supplierId,
  });
}

export function parseCategory(row, rowNumber) {
  const r = toObject(CATEGORY_COLUMNS, row);
  if (!text(r.id)) return null;
  return {
    id: text(r.id),
    rowNumber,
    name: text(r.name),
    code: text(r.code).toUpperCase(),
    description: text(r.description),
    sortOrder: int(r.sort_order),
    createdAt: text(r.created_at),
    updatedAt: text(r.updated_at),
    deletedAt: text(r.deleted_at) || null,
  };
}

export function serialiseCategory(c) {
  return toRow(CATEGORY_COLUMNS, {
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description,
    sort_order: c.sortOrder,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    deleted_at: c.deletedAt,
  });
}

export function parseSupplier(row, rowNumber) {
  const r = toObject(SUPPLIER_COLUMNS, row);
  if (!text(r.id)) return null;
  return {
    id: text(r.id),
    rowNumber,
    name: text(r.name),
    description: text(r.description),
    sortOrder: int(r.sort_order),
    createdAt: text(r.created_at),
    updatedAt: text(r.updated_at),
    deletedAt: text(r.deleted_at) || null,
  };
}

export function serialiseSupplier(sup) {
  return toRow(SUPPLIER_COLUMNS, {
    id: sup.id,
    name: sup.name,
    description: sup.description,
    sort_order: sup.sortOrder,
    created_at: sup.createdAt,
    updated_at: sup.updatedAt,
    deleted_at: sup.deletedAt,
  });
}

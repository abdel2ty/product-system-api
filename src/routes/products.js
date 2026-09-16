import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { productInput, productUpdate } from '../validation/schemas.js';
import * as products from '../services/productService.js';
import { audit } from '../integrations/mongo/models/AuditLog.js';
import { store } from '../store/ProductStore.js';

const router = Router();

const listQuery = z.object({
  q: z.string().trim().max(120).optional().default(''),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  supplier: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.string().optional().default(''),
  warranty: z.string().optional().default(''),
  hasImages: z.enum(['', 'both', 'supplier', 'mine', 'none']).optional().default(''),
  incomplete: z.enum(['true', 'false']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.string().optional().default('updated_at'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(50),
});

router.get('/', async (req, res, next) => {
  try {
    const parsed = listQuery.parse(req.query);
    const result = await products.queryProducts({
      ...parsed,
      category: parsed.category ? [].concat(parsed.category) : [],
      supplier: parsed.supplier ? [].concat(parsed.supplier) : [],
      incomplete: parsed.incomplete === 'true',
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/check-code', async (req, res, next) => {
  try {
    res.json({
      data: await products.checkCode({
        myCode: req.query.myCode,
        supplierCode: req.query.supplierCode,
        supplierId: req.query.supplierId,
        excludeId: req.query.excludeId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/next-code', async (req, res, next) => {
  try {
    res.json({ data: await products.suggestNextCode(String(req.query.categoryId ?? '')) });
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (req, res, next) => {
  try {
    const { data } = await products.queryProducts({ ...req.query, pageSize: 200, page: 1 });
    const headers = ['My code', 'Supplier code', 'Name', 'Category', 'Type', 'Supplier price', 'Selling price', 'Warranty (months)', 'Updated'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = data.map((p) =>
      [p.myProductCode, p.supplierProductCode, p.name, p.categoryName, p.type, p.supplierPrice, p.sellingPrice, p.warrantyMonths, p.updatedAt]
        .map(escape)
        .join(','),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.send([headers.map(escape).join(','), ...rows].join('\n'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json({ data: await products.getProduct(req.params.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/', validateBody(productInput), async (req, res, next) => {
  try {
    const product = await products.createProduct(req.valid);
    audit('product.create', { entityId: product.id, meta: { code: product.myProductCode }, ip: req.ip });
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateBody(productUpdate), async (req, res, next) => {
  try {
    const product = await products.updateProduct(req.params.id, req.valid);
    audit('product.update', { entityId: product.id, meta: { code: product.myProductCode }, ip: req.ip });
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const previous = store.products.get(req.params.id);
    const result = await products.deleteProduct(req.params.id);
    audit('product.delete', { entityId: req.params.id, meta: { code: previous?.myProductCode }, ip: req.ip });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    res.json({ data: await products.restoreProduct(req.params.id) });
  } catch (error) {
    next(error);
  }
});

export default router;

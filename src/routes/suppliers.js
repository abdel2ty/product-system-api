import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { supplierInput } from '../validation/schemas.js';
import * as suppliers from '../services/supplierService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await suppliers.listSuppliers() });
  } catch (error) {
    next(error);
  }
});

router.post('/', validateBody(supplierInput), async (req, res, next) => {
  try {
    res.status(201).json({ data: await suppliers.createSupplier(req.valid) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateBody(supplierInput.partial()), async (req, res, next) => {
  try {
    res.json({ data: await suppliers.updateSupplier(req.params.id, req.valid) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/merge', validateBody(z.object({ targetId: z.string().min(1) })), async (req, res, next) => {
  try {
    res.json({ data: await suppliers.mergeSupplier(req.params.id, req.valid.targetId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json({ data: await suppliers.deleteSupplier(req.params.id) });
  } catch (error) {
    next(error);
  }
});

export default router;

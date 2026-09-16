import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { categoryInput } from '../validation/schemas.js';
import * as categories from '../services/categoryService.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await categories.listCategories() });
  } catch (error) {
    next(error);
  }
});

router.post('/', validateBody(categoryInput), async (req, res, next) => {
  try {
    res.status(201).json({ data: await categories.createCategory(req.valid) });
  } catch (error) {
    next(error);
  }
});

router.put('/reorder', validateBody(z.object({ ids: z.array(z.string()).min(1) })), async (req, res, next) => {
  try {
    res.json({ data: await categories.reorderCategories(req.valid.ids) });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateBody(categoryInput.partial()), async (req, res, next) => {
  try {
    res.json({ data: await categories.updateCategory(req.params.id, req.valid) });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/merge', validateBody(z.object({ targetId: z.string().min(1) })), async (req, res, next) => {
  try {
    res.json({ data: await categories.mergeCategory(req.params.id, req.valid.targetId) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    res.json({ data: await categories.deleteCategory(req.params.id) });
  } catch (error) {
    next(error);
  }
});

export default router;

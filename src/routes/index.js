import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import authRoutes from './auth.js';
import productRoutes from './products.js';
import categoryRoutes from './categories.js';
import supplierRoutes from './suppliers.js';
import systemRoutes from './system.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', requireAuth, productRoutes);
router.use('/categories', requireAuth, categoryRoutes);
router.use('/suppliers', requireAuth, supplierRoutes);
router.use('/', requireAuth, systemRoutes);

export default router;

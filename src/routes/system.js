import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { settingsInput } from '../validation/schemas.js';
import { dashboardStats } from '../services/statsService.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { store } from '../store/ProductStore.js';
import { mongoStatus } from '../integrations/mongo/connection.js';

const router = Router();

router.get('/dashboard/stats', async (req, res, next) => {
  try {
    res.json({ data: await dashboardStats() });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    res.json({ data: await getSettings() });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', validateBody(settingsInput), async (req, res, next) => {
  try {
    res.json({ data: await updateSettings(req.valid) });
  } catch (error) {
    next(error);
  }
});

router.post('/system/refresh', async (req, res, next) => {
  try {
    await store.load();
    res.json({ data: { refreshedAt: new Date(store.lastSyncedAt).toISOString(), products: store.live().length } });
  } catch (error) {
    next(error);
  }
});

router.get('/system/health', (req, res) => {
  res.json({
    data: {
      sheets: store.lastSyncedAt ? 'up' : 'unknown',
      mongo: mongoStatus(),
      lastSyncedAt: store.lastSyncedAt ? new Date(store.lastSyncedAt).toISOString() : null,
      productCount: store.products.size,
    },
  });
});

export default router;

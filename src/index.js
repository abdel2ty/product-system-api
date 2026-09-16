import { env } from './config/env.js';
import { createApp } from './app.js';
import { connectMongo } from './integrations/mongo/connection.js';
import { store } from './store/ProductStore.js';

async function start() {
  await connectMongo();
  console.log('[mongo] connected');

  // Warm the store so the first request is instant. A failure here is not fatal:
  // the API starts anyway and reports 503 until the spreadsheet is reachable.
  try {
    await store.load();
    console.log(`[sheets] loaded ${store.products.size} products, ${store.categories.size} categories`);
  } catch {
    console.warn('[sheets] could not load at boot; will retry on first request');
  }

  createApp().listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start:', error.message);
  process.exit(1);
});

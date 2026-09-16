import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { requestId } from './middleware/requestId.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestId);

  // A plain 200 for hosting platforms that health-check the root path.
  app.get('/', (req, res) => res.json({ status: 'ok' }));

  app.use('/api', apiLimiter, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

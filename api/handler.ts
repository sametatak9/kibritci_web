import express from 'express';
import { registerApiRoutes } from '../src/server/registerApiRoutes';

const app = express();

/** GET'te JSON parser gövde bekleyip Vercel'de asılı kalmasın. */
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  express.json({ limit: '50mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
});
registerApiRoutes(app);
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: 'API yolu bulunamadı' });
});

/**
 * Vercel Node zaten Node req/res verir. serverless-http Lambda event bekler;
 * gövde akışını tüketmeden bekleyince FUNCTION_INVOCATION_TIMEOUT (504) oluşuyordu.
 */
export const config = {
  api: { bodyParser: false as const },
  maxDuration: 60,
};

export default app;

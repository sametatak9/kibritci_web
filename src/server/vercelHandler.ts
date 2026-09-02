import type { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';
import { registerApiRoutes } from './registerApiRoutes';

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
 * Vercel Node zaten Node req/res verir. Express uygulamasını doğrudan çağır.
 * serverless-http Lambda event bekleyince FUNCTION_INVOCATION_TIMEOUT oluşuyordu.
 * Bu dosya api/ altında DEĞİL — Vercel onu ayrı fonksiyon sanmasın.
 */
export function vercelExpressHandler(req: IncomingMessage, res: ServerResponse): void {
  app(req as express.Request, res as express.Response);
}

export default vercelExpressHandler;

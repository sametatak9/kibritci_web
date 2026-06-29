import express from 'express';
import { registerApiRoutes } from '../src/server/registerApiRoutes';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
registerApiRoutes(app);

// CJS interop — serverless-http ESM'de cold start'ta patlayabiliyor
// eslint-disable-next-line @typescript-eslint/no-require-imports
const serverlessHttp = require('serverless-http');
const slsHandler =
  typeof serverlessHttp === 'function'
    ? serverlessHttp(app, {
        binary: ['image/*', 'application/pdf', 'application/octet-stream'],
      })
    : serverlessHttp.default(app, {
        binary: ['image/*', 'application/pdf', 'application/octet-stream'],
      });

/** Vercel runtime açık (req, res) handler bekler — bare export crash verir */
export default function vercelHandler(
  req: express.Request,
  res: express.Response
): Promise<unknown> | void {
  try {
    return slsHandler(req, res);
  } catch (err: unknown) {
    console.error('Vercel API crash:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

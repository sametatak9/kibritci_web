import express from 'express';
import serverless from 'serverless-http';
import dotenv from 'dotenv';
import path from 'path';
import { registerApiRoutes } from '../src/server/registerApiRoutes';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
registerApiRoutes(app);

/** Vercel /api/* isteklerini Express rotalarına iletir */
const handler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream'],
});

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

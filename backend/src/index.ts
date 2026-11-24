import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { env, validateEnv } from './lib/env';
import logger from './lib/logger';
import { errorHandler } from './middleware/error-handler';

// Validate environment variables
validateEnv();

const app = new Hono();

// Global middleware
app.use('*', honoLogger());
app.use(
  '*',
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

// Health check endpoint
app.get('/health', (c: Context) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 routes will be mounted here
app.get('/api', (c: Context) => {
  return c.json({ message: 'Legacy Switch API - Phase 1 (Planning Complete)' });
});

// 404 handler
app.all('*', (c: Context) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handling
app.onError(errorHandler);

// Start server
const port = env.PORT;
logger.info(`Starting Legacy Switch backend on port ${port}...`);

export default {
  port,
  fetch: app.fetch.bind(app) as (request: Request) => Promise<Response>,
};

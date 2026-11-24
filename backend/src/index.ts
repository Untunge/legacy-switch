import { createServer } from 'http';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import * as cron from 'node-cron';
import { env, validateEnv } from './lib/env';
import logger from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { runTimerJobs } from './services/timer-service';
import { runEmailJobs } from './services/email-service';
import authRoutes from './routes/auth';
import capsuleRoutes from './routes/capsules';
import checkinRoutes from './routes/checkin';
import contactRoutes from './routes/contacts';
import releaseRoutes from './routes/releases';

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

// API v1 routes
app.get('/api', (c: Context) => {
  return c.json({ message: 'Legacy Switch API - Phase 2 Backend' });
});

// Auth routes
app.route('/auth', authRoutes);

// Capsule routes
app.route('/capsules', capsuleRoutes);

// Check-in routes
app.route('/checkin', checkinRoutes);

// Contact routes
app.route('/capsules', contactRoutes);

// Release routes
app.route('/releases', releaseRoutes);

// 404 handler
app.all('*', (c: Context) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handling
app.onError(errorHandler);

// Start server
const port = env.PORT;

// Schedule background jobs
// Timer check every 60 seconds
cron.schedule('*/1 * * * *', async () => {
  try {
    await runTimerJobs();
  } catch (err) {
    logger.error(err, 'Timer job failed');
  }
});

// Email processing every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await runEmailJobs();
  } catch (err) {
    logger.error(err, 'Email job failed');
  }
});

logger.info('Background jobs scheduled');

// Create and start HTTP server
const server = createServer(async (req, res) => {
  // Convert Node.js request to Web API Request
  const url = new URL(`http://${req.headers.host}${req.url}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  // Buffer the request body first: passing the Node stream directly as a
  // fetch body crashes Node (undici requires duplex: 'half' for streams).
  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const buffered = Buffer.concat(chunks);
    body = buffered.length > 0 ? buffered : undefined;
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
  });

  try {
    const response = await app.fetch(request);
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
    });
    res.end(await response.text());
  } catch (error) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  logger.info(`Server listening on http://localhost:${port}`);
});

export default app;

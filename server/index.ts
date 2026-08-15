import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessToken } from 'livekit-server-sdk';

// Load the repository-root .env so one file configures server and worker alike.
// dotenv.config() alone resolves against process.cwd(), which is server/, and
// silently found nothing — the server booted fine and only /token broke.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 8080;
const workerUrl = process.env.WORKER_URL || 'http://localhost:8000';

// Origins allowed to call this API. Defaults to the local Vite dev server;
// set ALLOWED_ORIGINS (comma-separated) when deploying anywhere else.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Optional shared secret for /token. Unset means open, which is fine on a
// laptop and indefensible on a network — set TOKEN_API_KEY before exposing.
const tokenApiKey = process.env.TOKEN_API_KEY;
const tokenTtl = process.env.TOKEN_TTL || '15m';

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin/curl requests, which send no Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Withhold the CORS headers rather than throwing: the browser then blocks
    // the response, and the server log isn't polluted with 500s.
    callback(null, false);
  },
}));
app.use(express.json({ limit: '16kb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.error(`Status: ${res.statusCode} | Method: ${req.method} | URL: ${req.originalUrl} | Time: ${duration}ms`);
    } else {
      console.log(`Status: ${res.statusCode} | Method: ${req.method} | URL: ${req.originalUrl} | Time: ${duration}ms`);
    }
  });
  next();
});

// --- Helpers ---

/** Strip control characters and cap length before anything reaches the log. */
function sanitizeForLog(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, maxLength);
}

/** Fixed-window rate limiter, per IP. In-memory by design — one process. */
function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Try again shortly.' });
      return;
    }

    entry.count += 1;
    next();
  };
}

/** Reject /token requests without the shared secret, when one is configured. */
function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!tokenApiKey) return next();
  const provided = req.get('x-api-key');
  if (provided !== tokenApiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

async function fetchWorkerHealth(): Promise<any | null> {
  try {
    const res = await fetch(`${workerUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// --- API Routes ---

app.get('/health', async (req, res) => {
  const worker = await fetchWorkerHealth();
  const workerStatus = !worker ? 'offline' : worker.model_loaded ? 'online' : 'loading';

  res.json({
    status: 'ok',
    server: 'online',
    worker: workerStatus,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/validate-all', async (req, res) => {
  const worker = await fetchWorkerHealth();

  const checks = {
    server: true,
    worker: !!worker && worker.status === 'ok' && !!worker.model_loaded,
    livekit: !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    timestamp: new Date().toISOString()
  };

  const allPassed = checks.server && checks.worker;
  res.status(allPassed ? 200 : 503).json(checks);
});

app.get('/token', rateLimit(20, 60_000), requireApiKey, async (req, res) => {
  const roomName = (req.query.room as string) || 'vox-nexus';
  const participantName = (req.query.name as string) || `user-${Math.floor(Math.random() * 10000)}`;

  // Identity and room names end up inside a signed grant; keep them tame.
  if (!/^[\w-]{1,64}$/.test(roomName) || !/^[\w-]{1,64}$/.test(participantName)) {
    res.status(400).json({ error: 'Room and name must be 1-64 characters of letters, numbers, hyphen or underscore.' });
    return;
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: tokenTtl,
    });

    at.addGrant({ roomJoin: true, room: roomName });

    const token = await at.toJwt();
    console.log(`🔑 Token generated for ${participantName} in ${roomName}`);
    res.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// --- Debug / Stats Routes (Optional) ---

app.post('/api/stats/mic', (req, res) => {
  const status = sanitizeForLog(req.body?.status, 32);
  const participant = sanitizeForLog(req.body?.participant, 64);
  console.log(`🎙️ [MIC] ${participant}: ${status}`);
  res.json({ status: 'logged' });
});

app.post('/api/logs', (req, res) => {
  const level = sanitizeForLog(req.body?.level, 16);
  const message = sanitizeForLog(req.body?.message, 500);
  const component = sanitizeForLog(req.body?.component, 32);
  const prefix = component ? `[${component.toUpperCase()}]` : '[LOG]';
  console.log(`${prefix} ${message} (${level})`);
  res.json({ status: 'received' });
});

app.listen(port, () => {
  console.log(`
    🚀 VOXORA SERVER ONLINE
    ==================================================
    ► Port:      ${port}
    ► Mode:      ${process.env.NODE_ENV || 'development'}
    ► Worker:    ${workerUrl}
    ► Origins:   ${allowedOrigins.join(', ')}
    ► /token:    ${tokenApiKey ? 'API key required' : 'OPEN — set TOKEN_API_KEY before exposing'}
    ► Token TTL: ${tokenTtl}
    ==================================================
    `);
});

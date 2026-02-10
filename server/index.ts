import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📡 [${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// --- New Stats APIs ---

app.post('/api/stats/mic', (req, res) => {
  const { status, participant, timestamp } = req.body;

  // Log clearly for "porplery logs" requirement
  console.log(`\n🎙️ [MIC_EVENT] ${participant || 'Unknown'} -> ${status?.toUpperCase()} @ ${new Date().toISOString()}`);
  if (timestamp) {
    console.log(`   Timestamp: ${new Date(timestamp).toLocaleTimeString()}`);
  }
  console.log(`   (Event persisted to logs)\n`);

  res.json({ status: 'logged' });
});

app.post('/api/logs', (req, res) => {
  const { level, message, component, meta } = req.body;
  const prefix = component ? `[${component.toUpperCase()}]` : '[LOG]';

  // Structured logging to stdout
  const logMsg = `${prefix} ${message}`;
  if (level === 'error') console.error(`❌ ${logMsg}`, meta || '');
  else if (level === 'warn') console.warn(`⚠️ ${logMsg}`, meta || '');
  else console.log(`ℹ️ ${logMsg}`, meta || '');

  res.json({ status: 'received' });
});

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  process.exit(1);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/token', async (req, res) => {
  const roomName = (req.query.room as string) || 'vox-nexus';
  const participantName = (req.query.name as string) || `user-${Math.floor(Math.random() * 1000)}`;

  console.log(`🔑 Generating token for Room: "${roomName}", Participant: "${participantName}"`);

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    ttl: '1h',
  });

  at.addGrant({ roomJoin: true, room: roomName });

  const token = await at.toJwt();
  res.json({ token });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port} (all interfaces)`);
});

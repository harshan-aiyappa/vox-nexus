import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

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

// --- API Routes ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/token', async (req, res) => {
  const roomName = (req.query.room as string) || 'vox-nexus';
  const participantName = (req.query.name as string) || `user-${Math.floor(Math.random() * 10000)}`;

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
      ttl: '1h',
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
  const { status, participant } = req.body;
  console.log(`🎙️ [MIC] ${participant}: ${status}`);
  res.json({ status: 'logged' });
});

app.post('/api/logs', (req, res) => {
  const { level, message, component } = req.body;
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
    ► System:    Ready for Neural Uplink
    ==================================================
    `);
});

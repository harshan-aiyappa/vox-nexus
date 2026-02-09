import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';

dotenv.config();

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

if (!apiKey || !apiSecret) {
  console.error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  process.exit(1);
}

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

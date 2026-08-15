# VoxNexus

Real-time interactive voice AI application with ultra-low latency streaming speech transcription.

## 🏗️ Architecture

- **Client**: React + Vite + Tailwind CSS (Local)
- **Server**: Node.js + Express + LiveKit SDK (Local)
- **Worker**: Python + LiveKit Agents + Faster-Whisper (Docker)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- LiveKit Cloud account

### Setup

1. **Configure environment**:
```bash
# Edit .env with your LiveKit credentials
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_secret
MODEL_SIZE=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE=int8
```

2. **Install dependencies**:
```bash
# Client
cd client && npm install

# Server
cd server && npm install
```

3. **Start all services** — three terminals:
```bash
# Terminal 1: Worker (Python + Whisper)
cd worker && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python main.py

# Terminal 2: Server
cd server && npm run dev

# Terminal 3: Client
cd client && npm run dev
```

Or run the worker in Docker instead of a local venv:
```bash
docker compose up --build
```

This will start:
- **Worker**: Python + Whisper AI on port 8000
- **Server** (Local): Node.js backend on port 8080
- **Client** (Local): React frontend on port 5173

The worker downloads ~460MB of model weights on first run and takes
roughly 15 seconds to become ready. `/health` reports `model_loaded`
once it can transcribe.

Without LiveKit credentials, set `DISABLE_AGENT_BOT=true` — the worker
exits at boot otherwise. Direct mode works fully without them.

## 📋 Features

### ✅ Phase 1 — Core POC
- Real-time audio streaming
- LiveKit integration
- Whisper transcription (CPU/int8)
- Modern light theme UI

### ✅ Phase 2 — Stability
- iOS compatibility (Safari audio resume, 48kHz lock)
- Auto-reconnection (exponential backoff)
- Audio buffering (2s sliding window)
- Connection quality monitoring

### ✅ Phase 3 — Performance
- Real-time latency measurement
- Packet loss monitoring
- Whisper CPU optimization (int8)
- VAD (Voice Activity Detection)

## 🎨 UI Design

Modern light theme with:
- Vibrant gradients (Blue → Indigo → Purple)
- Clean white cards with shadows
- Professional UI/UX principles
- Smooth animations and hover effects
- 3D card tilt effects

## 🔧 Development

### Run Locally
### Access URLs
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080
- **Worker**: http://localhost:8000

### Modes
- **Direct**: browser → WebSocket → Whisper. No LiveKit, no cloud cost.
- **Agent**: LiveKit room; the worker joins as a bot and publishes
  transcripts back as data packets. Needs LiveKit credentials.

## 📦 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v3, Framer Motion, LiveKit Client
- **Backend**: Node.js, Express, LiveKit Server SDK, TypeScript
- **AI Worker**: Python, LiveKit Agents, Faster-Whisper
- **Infrastructure**: Docker

## 🔐 Security

- Environment variables for secrets; `.env` is gitignored
- LiveKit tokens are short-lived (`TOKEN_TTL`, default 15m)
- CORS restricted to `ALLOWED_ORIGINS` (default: the local dev server)
- `GET /token` is rate-limited per IP

**Before exposing this beyond localhost**, set `TOKEN_API_KEY`. Without
it `/token` is unauthenticated, and anyone who can reach the server can
mint LiveKit credentials billed to your account.

## 📄 License

MIT License

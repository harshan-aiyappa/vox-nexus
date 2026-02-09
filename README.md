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

3. **Start all services**:
```bash
start-local.bat
```

This will start:
- **Worker** (Docker): Python + Whisper AI
- **Server** (Local): Node.js backend on port 8080
- **Client** (Local): React frontend on port 5173

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
```bash
# Terminal 1: Worker (Docker)
docker-compose up

# Terminal 2: Server
cd server && npm run dev

# Terminal 3: Client
cd client && npm run dev
```

### Access URLs
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8080

## 📦 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v3, Framer Motion, LiveKit Client
- **Backend**: Node.js, Express, LiveKit Server SDK, TypeScript
- **AI Worker**: Python, LiveKit Agents, Faster-Whisper
- **Infrastructure**: Docker

## 🔐 Security

- Environment variables for secrets
- Short-lived LiveKit tokens
- CORS configured for local development

## 📄 License

MIT License

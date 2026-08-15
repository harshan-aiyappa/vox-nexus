import asyncio
import base64
import json
import logging
import time
import os
import signal
import threading
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from livekit import rtc, api
from dotenv import load_dotenv

# Import our singleton STT service
from stt_service import stt_service, SUPPORTED_LANGUAGES

# --- Configuration ---
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
BUFFER_SIZE_BYTES = int(SAMPLE_RATE * 3.0 * BYTES_PER_SAMPLE) # 3.0 second chunks for better VAD

# Look for a quiet point to cut at within the final quarter of the window,
# so that a word straddling the boundary is not severed mid-syllable.
CUT_SEARCH_FRACTION = 0.25
CUT_FRAME_BYTES = int(SAMPLE_RATE * 0.02) * BYTES_PER_SAMPLE  # 20ms
# Shortest trailing buffer still worth transcribing when a session ends.
MIN_FLUSH_BYTES = int(SAMPLE_RATE * 0.4 * BYTES_PER_SAMPLE)   # 400ms


def find_cut_point(buf: bytearray) -> int:
    """Return an even byte offset at which to split `buf`.

    Rather than always cutting at exactly BUFFER_SIZE_BYTES, scan the final
    quarter of the window for the lowest-energy 20ms frame and cut there. This
    keeps words intact across chunk boundaries without the duplication that an
    overlapping window would introduce.
    """
    if len(buf) < BUFFER_SIZE_BYTES:
        return (len(buf) // 2) * 2

    arr = np.frombuffer(bytes(buf[:BUFFER_SIZE_BYTES]), dtype=np.int16)
    search_start = int(BUFFER_SIZE_BYTES * (1.0 - CUT_SEARCH_FRACTION))

    best_offset, best_energy = BUFFER_SIZE_BYTES, None
    for off in range(search_start, BUFFER_SIZE_BYTES - CUT_FRAME_BYTES + 1, CUT_FRAME_BYTES):
        start = off // BYTES_PER_SAMPLE
        end = start + (CUT_FRAME_BYTES // BYTES_PER_SAMPLE)
        if end > len(arr):
            break
        energy = float(np.abs(arr[start:end]).mean())
        if best_energy is None or energy < best_energy:
            best_energy, best_offset = energy, off + CUT_FRAME_BYTES

    return (min(best_offset, BUFFER_SIZE_BYTES) // 2) * 2


async def transcribe_segment(segment: bytes, language: str, min_peak: int):
    """Run STT over one segment. Returns (text, seconds) or None if skipped."""
    arr = np.frombuffer(segment, dtype=np.int16)
    if arr.size == 0:
        return None
    if np.abs(arr).max() < min_peak:   # silence gate
        return None

    float_arr = arr.astype(np.float32) / 32768.0
    started = time.time()
    loop = asyncio.get_running_loop()
    text = await loop.run_in_executor(
        None, lambda: stt_service.transcribe(float_arr, language=language)
    )
    if not text:
        return None
    return text, time.time() - started

# --- Setup ---
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: [%(name)s] %(message)s")
logger = logging.getLogger("SYSTEM")
agent_logger = logging.getLogger("AGENT-MODE")
direct_logger = logging.getLogger("DIRECT-MODE")

# --- Shared State ---
# Since we are now in a SINGLE process with threads, we can share state if needed.
# However, STT Service is already a singleton module.

# --- 🔌 Direct Mode Logic (FastAPI Server) ---
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "component": "worker", "model_loaded": stt_service.model is not None}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    direct_logger.info("🔌 Client connected")
    audio_buffer = bytearray()
    current_language = "en"

    async def emit(segment: bytes, reason: str):
        result = await transcribe_segment(segment, current_language, min_peak=500)
        if not result:
            return
        text, duration = result
        direct_logger.info(f"📝 '{text}' (TAT: {duration:.3f}s, {reason})")
        await websocket.send_json({
            "type": "transcription",
            "text": text,
            "isFinal": True,
            "latency_ms": int(duration * 1000),
        })

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get('type')

            if msg_type == 'set_language':
                code = message.get('code', 'en')
                if code not in SUPPORTED_LANGUAGES:
                    direct_logger.warning(f"⚠️ Unsupported language '{code}', keeping '{current_language}'")
                    await websocket.send_json({
                        "type": "error",
                        "code": "unsupported_language",
                        "message": f"Language '{code}' is not supported. Still using '{current_language}'.",
                    })
                    continue
                current_language = code
                direct_logger.info(f"🌐 Language set to '{current_language}'")
                continue

            # Let the client force a flush when the user stops speaking.
            if msg_type == 'end_utterance':
                if len(audio_buffer) >= MIN_FLUSH_BYTES:
                    even = (len(audio_buffer) // 2) * 2
                    await emit(bytes(audio_buffer[:even]), "end_utterance")
                audio_buffer.clear()
                continue

            if msg_type == 'audio':
                audio_buffer.extend(base64.b64decode(message['data']))

                while len(audio_buffer) >= BUFFER_SIZE_BYTES:
                    cut = find_cut_point(audio_buffer)
                    segment = bytes(audio_buffer[:cut])
                    del audio_buffer[:cut]
                    await emit(segment, "window")

    except WebSocketDisconnect:
        # The socket is already gone, so there is nobody to send a late
        # transcript to. Clients should send 'end_utterance' before closing;
        # log the shortfall so a client that forgets is visible rather than
        # silently losing the tail of every session.
        if len(audio_buffer) >= MIN_FLUSH_BYTES:
            dropped = len(audio_buffer) / (SAMPLE_RATE * BYTES_PER_SAMPLE)
            direct_logger.warning(
                f"⚠️ Disconnected with {dropped:.1f}s unprocessed — "
                f"send 'end_utterance' before closing to capture it"
            )
        direct_logger.info("🔌 Client disconnected")
    except Exception as e:
        direct_logger.error(f"❌ Message error: {e}")

def run_fastapi_thread():
    """Starts the FastAPI server in a separate thread."""
    direct_logger.info("🚀 Starting Direct Mode (WebSocket) server on port 8000...")
    # uvicorn.run is blocking, so we run it in this thread
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")


# --- 🛰️ LiveKit Agent Mode (Async Loop) ---

async def transcribe_track(track: rtc.RemoteAudioTrack, participant: rtc.RemoteParticipant, room: rtc.Room, state: dict):
    """Processes a single remote audio track."""
    identity = participant.identity
    agent_logger.info(f"🎤 Starting for {identity} (track {track.sid})")
    
    audio_buffer = bytearray()
    
    # AudioStream defaults to 48kHz; the buffer math and Whisper both assume SAMPLE_RATE
    async for audio_frame in rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=1):
        # Stop immediately if room is disconnected
        if room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            break
            
        audio_buffer.extend(audio_frame.frame.data.tobytes())

        while len(audio_buffer) >= BUFFER_SIZE_BYTES:
            cut = find_cut_point(audio_buffer)
            segment = bytes(audio_buffer[:cut])
            del audio_buffer[:cut]

            try:
                lang = state.get(identity, state.get("default", "en"))
                # Higher gate than Direct mode: a muted mic still emits frames.
                result = await transcribe_segment(segment, lang, min_peak=800)
                if not result:
                    continue

                text, duration = result
                agent_logger.info(f"📝 '{text}' (TAT: {duration:.3f}s)")
                payload = json.dumps({
                    "type": "transcription",
                    "text": text,
                    "participant": "agent",
                    "latency_ms": int(duration * 1000)
                })
                await room.local_participant.publish_data(payload.encode('utf-8'), reliable=True)
            except Exception as e:
                agent_logger.error(f"❌ Transcription error: {e}")

async def run_agent_main_loop():
    """Main loop for the Agent, polling for participants."""
    
    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    room_name = "vox-nexus"
    
    if not all([url, api_key, api_secret]):
        agent_logger.error("❌ Missing credentials. Agent Mode Disabled.")
        return

    # Using the correct API Client
    lk_api_client = api.LiveKitAPI(url, api_key, api_secret)
    session_state = {"default": "en"}

    agent_logger.info("💤 DORMANT. Polling for humans...")

    while True:
        try:
            # --- Smart Attendance Check ---
            try:
                # Correct API usage to list participants
                participants = await lk_api_client.room.list_participants(api.ListParticipantsRequest(room=room_name))
                humans_present = len([p for p in participants.participants if not p.identity.startswith("agent-")])
            except Exception as e:
                # Iterate gently if API fails
                await asyncio.sleep(5)
                continue

            if humans_present == 0:
                await asyncio.sleep(5)
                continue

            agent_logger.info(f"👥 Detected {humans_present} humans. Attempting to join...")
            
            import random
            bot_id = f"agent-bot-{random.randint(1000, 9999)}"
            
            # Create a Token for the Bot
            token = api.AccessToken(api_key, api_secret) \
                .with_grants(api.VideoGrants(room_join=True, room=room_name)) \
                .with_identity(bot_id) \
                .to_jwt()
            
            room = rtc.Room()
            
            @room.on("track_subscribed")
            def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
                if track.kind == rtc.TrackKind.KIND_AUDIO:
                    agent_logger.info(f"🎤 Catching audio from {participant.identity}")
                    asyncio.create_task(transcribe_track(track, participant, room, session_state))

            @room.on("data_received")
            def on_data_received(data_packet: rtc.DataPacket):
                try:
                    payload = json.loads(data_packet.data.decode('utf-8'))
                    if payload.get('type') == 'set_language':
                        identity = data_packet.participant.identity if data_packet.participant else "default"
                        lang = payload.get('code', 'en')
                        if lang not in SUPPORTED_LANGUAGES:
                            agent_logger.warning(f"⚠️ Unsupported language '{lang}' from {identity}, ignoring")
                            return
                        session_state[identity] = lang
                        agent_logger.info(f"🌐 Language set to '{lang}' for {identity}")
                except Exception:
                    pass

            await room.connect(url, token)
            agent_logger.info("✅ Connected and Listening.")
            
            # Catch existing tracks
            for participant in room.remote_participants.values():
                 for publication in participant.track_publications.values():
                    if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                        asyncio.create_task(transcribe_track(publication.track, participant, room, session_state))
            
            # Stay connected as long as humans are there
            while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(5)
                humans = [p for p in room.remote_participants.values() if not p.identity.startswith("agent-")]
                if not humans:
                    agent_logger.info("👋 Room Empty. Returning to DORMANT state.")
                    await room.disconnect()
                    break
                
        except Exception as e:
            agent_logger.error(f"❌ Agent Loop Error: {e}")
            await asyncio.sleep(5)


# --- 🏛️ Main Entry Point ---

if __name__ == "__main__":
    logger.info("💎 VoxNexus Engine Starting (Single Process / Multi-Threaded)...")
    
    # 1. Load Whisper Once (Global Memory)
    logger.info("🧠 Loading Whisper Model (Shared Memory)...")
    stt_service.load_model()
    logger.info("✅ Whisper Model Ready.")

    # 2. Start FastAPI in a background Thread
    # Daemon thread ensures it dies when main thread exits
    t_fastapi = threading.Thread(target=run_fastapi_thread, daemon=True)
    t_fastapi.start()
    
    # 3. Start Agent Loop in Main Thread (Asyncio)
    disable_agent = os.getenv("DISABLE_AGENT_BOT", "false").lower() == "true"
    
    if not disable_agent:
        try:
            asyncio.run(run_agent_main_loop())
        except KeyboardInterrupt:
            logger.info("👋 Shutting down...")
    else:
        logger.info("🚫 Agent Mode Disabled. Keeping main thread alive for WebSocket...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("👋 Shutting down...")

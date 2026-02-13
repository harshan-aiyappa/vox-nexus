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
from stt_service import stt_service

# --- Configuration ---
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2 
BUFFER_SIZE_BYTES = int(SAMPLE_RATE * 3.0 * BYTES_PER_SAMPLE) # 3.0 second chunks for better VAD

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
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get('type') == 'set_language':
                current_language = message.get('code', 'en')
                direct_logger.info(f"🌐 Language set to '{current_language}'")
                continue

            if message.get('type') == 'audio':
                chunk = base64.b64decode(message['data'])
                audio_buffer.extend(chunk)
                
                if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                    start_time = time.time()
                    # Process chunks of exactly buffer size
                    even_length = (len(audio_buffer) // 2) * 2
                    current_segment = audio_buffer[:even_length]
                    remainder = audio_buffer[even_length:]
                    
                    full_arr_view = np.frombuffer(current_segment, dtype=np.int16)
                    peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
                    
                    # Silence Gate
                    if peak_vol < 500: 
                        audio_buffer = remainder
                        continue
                    
                    audio_buffer = remainder
                    float_arr = full_arr_view.astype(np.float32) / 32768.0
                    
                    # Run STT in the main Executor (Thread Pool available to FastAPI)
                    loop = asyncio.get_running_loop()
                    text = await loop.run_in_executor(None, lambda: stt_service.transcribe(float_arr, language=current_language))
                    inference_duration = time.time() - start_time
                    
                    if text:
                        direct_logger.info(f"📝 '{text}' (TAT: {inference_duration:.3f}s)")
                        await websocket.send_json({
                            "type": "transcription",
                            "text": text,
                            "isFinal": True,
                            "latency_ms": int(inference_duration * 1000)
                        })
    except WebSocketDisconnect:
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
    
    async for audio_frame in rtc.AudioStream(track):
        # Stop immediately if room is disconnected
        if room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            break
            
        audio_buffer.extend(audio_frame.frame.data.tobytes())

        if len(audio_buffer) >= BUFFER_SIZE_BYTES:
             start_time = time.time()
             even_length = (len(audio_buffer) // 2) * 2
             current_segment = audio_buffer[:even_length]
             remainder = audio_buffer[even_length:]
             
             full_arr_view = np.frombuffer(current_segment, dtype=np.int16)
             peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
             
             # Skip processing if audio is too quiet (mic muted or silence)
             if peak_vol < 800:  # Increased threshold - only process actual speech
                 audio_buffer = remainder
                 continue
             
             float_arr = full_arr_view.astype(np.float32) / 32768.0
             audio_buffer = remainder
             
             try:
                 lang = state.get(identity, state.get("default", "en"))
                 
                 # Access the SAME stt_service instance (Thread-safe enough for inference)
                 loop = asyncio.get_running_loop()
                 text = await loop.run_in_executor(None, lambda: stt_service.transcribe(float_arr, language=lang))
                 inference_duration = time.time() - start_time
                 
                 if text:
                     agent_logger.info(f"📝 '{text}' (TAT: {inference_duration:.3f}s)")
                     payload = json.dumps({
                         "type": "transcription", 
                         "text": text, 
                         "participant": "agent", 
                         "latency_ms": int(inference_duration * 1000)
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

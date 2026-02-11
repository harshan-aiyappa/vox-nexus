import asyncio
import base64
import json
import logging
import time
import os
import signal
import numpy as np
import uvicorn
from multiprocessing import Process
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from livekit.agents import WorkerOptions, JobContext
from livekit import rtc
from dotenv import load_dotenv

# Import our singleton STT service
from stt_service import stt_service

# --- Configuration ---
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SECONDS = 1.0 
BYTES_PER_SAMPLE = 2 
BUFFER_SIZE_BYTES = int(SAMPLE_RATE * CHUNK_SECONDS * BYTES_PER_SAMPLE)

# --- Setup ---
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path if os.path.exists(env_path) else None)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus-unified")

# --- 🛰️ LiveKit Agent Mode (Sub-Process) ---

async def transcribe_track(track: rtc.RemoteAudioTrack, room: rtc.Room):
    """Handles audio stream from a LiveKit participant."""
    logger.info(f"🎤 [AGENT_STREAM] Starting for track {track.sid}")
    audio_stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
    audio_buffer = bytearray()
    
    async for event in audio_stream:
        audio_buffer.extend(event.frame.data.tobytes())

        if len(audio_buffer) >= BUFFER_SIZE_BYTES:
             start_time = time.time()
             even_length = (len(audio_buffer) // 2) * 2
             current_segment = audio_buffer[:even_length]
             remainder = audio_buffer[even_length:]
             
             full_arr_view = np.frombuffer(current_segment, dtype=np.int16)
             peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
             
             if peak_vol < 50: 
                 audio_buffer = remainder
                 continue
             
             float_arr = full_arr_view.astype(np.float32) / 32768.0
             audio_buffer = remainder
             
             try:
                 # In Agent Mode, we run in an executor
                 loop = asyncio.get_running_loop()
                 text = await loop.run_in_executor(None, lambda: stt_service.transcribe(float_arr))
                 inference_duration = time.time() - start_time
                 
                 if text:
                     logger.info(f"📝 [AGENT] '{text}' (TAT: {inference_duration:.3f}s)")
                     payload = json.dumps({
                         "type": "transcription", 
                         "text": text, 
                         "participant": "agent", 
                         "latency_ms": int(inference_duration * 1000)
                     })
                     await room.local_participant.publish_data(payload, reliable=True)
             except Exception as e:
                 logger.error(f"❌ [AGENT] Transcription error: {e}")

async def agent_entrypoint(ctx: JobContext):
    logger.info(f"🚀 [AGENT] Job Started! Room: {ctx.room.name}")
    stt_service.load_model()

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(track, ctx.room))

    await ctx.connect(auto_subscribe=True)
    while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(1)

def run_livekit_worker():
    """Starts the LiveKit worker in a separate process."""
    from livekit.agents import cli
    # Note: cli.run_app handles the full worker lifecycle correctly on Windows
    logger.info("📡 Starting LiveKit Agent Worker subprocess...")
    # Update sys.argv to simulate a 'start' command
    import sys
    sys.argv = [sys.argv[0], "start"]
    cli.run_app(WorkerOptions(entrypoint_fnc=agent_entrypoint, load_threshold=3.0))

# --- 🔌 Direct Mode Logic (FastAPI Process) ---

def run_fastapi_server():
    """Starts the FastAPI WebSocket server in a separate process."""
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        logger.info("🔌 [DIRECT] Client connected")
        audio_buffer = bytearray()
        
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get('type') == 'audio':
                    chunk = base64.b64decode(message['data'])
                    audio_buffer.extend(chunk)
                    
                    if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                        start_time = time.time()
                        even_length = (len(audio_buffer) // 2) * 2
                        current_segment = audio_buffer[:even_length]
                        remainder = audio_buffer[even_length:]
                        
                        full_arr_view = np.frombuffer(current_segment, dtype=np.int16)
                        peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
                        
                        if peak_vol < 50: 
                            audio_buffer = remainder
                            continue
                        
                        audio_buffer = remainder
                        float_arr = full_arr_view.astype(np.float32) / 32768.0
                        
                        # Run in executor to keep WS loop responsive
                        loop = asyncio.get_running_loop()
                        text = await loop.run_in_executor(None, lambda: stt_service.transcribe(float_arr))
                        inference_duration = time.time() - start_time
                        
                        if text:
                            logger.info(f"📝 [DIRECT] '{text}' (TAT: {inference_duration:.3f}s)")
                            await websocket.send_json({
                                "type": "transcription",
                                "text": text,
                                "isFinal": True,
                                "latency_ms": int(inference_duration * 1000)
                            })
        except WebSocketDisconnect:
            logger.info("🔌 [DIRECT] Client disconnected")
        except Exception as e:
            logger.error(f"❌ [DIRECT] Message error: {e}")

    logger.info("🚀 Starting Direct Mode (WebSocket) server on port 8000...")
    stt_service.load_model() # Pre-load before starting server
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")

# --- 🏛️ Unified Master Runner ---

if __name__ == "__main__":
    # We use multiprocessing to run both services independently
    # This prevents Windows Event Loop conflicts and ensures low latency
    p1 = Process(target=run_livekit_worker)
    p2 = Process(target=run_fastapi_server)
    
    p1.start()
    p2.start()
    
    logger.info("💎 VoxNexus Unified Engine Started!")
    logger.info("  - Process 1: LiveKit Agent Mode (Port 8082 Health)")
    logger.info("  - Process 2: Direct Stream Mode (Port 8000 WS)")
    
    try:
        p1.join()
        p2.join()
    except KeyboardInterrupt:
        logger.info("👋 Shutting down VoxNexus...")
        p1.terminate()
        p2.terminate()

import asyncio
import os
import sys
import io
import json
import logging
import numpy as np
import traceback
from livekit.agents import JobContext, WorkerOptions, cli
from livekit import rtc
from dotenv import load_dotenv

# Try importing faster_whisper
try:
    from faster_whisper import WhisperModel
except ImportError:
    print("❌ faster_whisper not installed. STT will not work.")
    WhisperModel = None

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agent")

# Initialize Whisper (Moved to entrypoint to prevent spawn timeout)
model = None

async def entrypoint(ctx: JobContext):
    global model
    
    print(f"🚀 Job Started! Room: {ctx.room.name}", flush=True)

    # Initialize model if not loaded (per process)
    if not model and WhisperModel:
        try:
            print("🧠 Loading Whisper Model (small)...")
            model = WhisperModel("small", device="cpu", compute_type="int8")
            print("✅ Whisper Model Loaded Successfully!")
        except Exception as e:
            print(f"❌ Failed to load Whisper Model: {e}", flush=True)

    # State for dynamic language (per room/job)
    current_language = "en"

    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        nonlocal current_language
        try:
            # data is DataPacket object? Has .data (bytes)
            # In livekit-python < 0.8 it might be simpler.
            # Assuming data is the payload bytes.
            
            # Check if data has .data attribute
            payload_bytes = data.data if hasattr(data, "data") else data
            
            payload = json.loads(payload_bytes.decode("utf-8"))
            if payload.get("type") == "set_language":
                code = payload.get("code", "en")
                if code != current_language:
                    current_language = code
                    print(f"🌍 Language switched to: {current_language}", flush=True)
                    # Acknowledge?
                    asyncio.create_task(ctx.room.local_participant.publish_data(
                        json.dumps({"type": "status", "message": f"Language set to {current_language}"}), reliable=True))
        
        except Exception as e:
            print(f"⚠️ Error handling data packet: {e}", flush=True)

    async def transcribe_track(track: rtc.RemoteAudioTrack, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        print(f"🎧 Started transcribing audio from {participant.identity} (sid: {participant.sid})", flush=True)
        # Use LiveKit's internal resampling to get 16k mono directly
        audio_stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        
        # Buffer accumulation
        accumulated_data = [] 
        accumulated_samples = 0
        peak_vol = 0
        SAMPLE_RATE = 16000
        CHUNK_SECONDS = 3.0
        BUFFER_SIZE = int(SAMPLE_RATE * CHUNK_SECONDS)
        
        async for event in audio_stream:
            frame = event.frame
            
            # Debug sample rate once
            if accumulated_samples == 0:
                 sys.stdout.write(f"🔍 Audio Frame: {frame.sample_rate}Hz, Channels: {frame.num_channels}, {len(frame.data)} bytes\n")
                 sys.stdout.flush()

            # Convert to numpy (Already 16k Mono)
            arr = np.frombuffer(frame.data, dtype=np.int16)
            
            # Update Peak Volume
            current_max = np.abs(arr).max() if len(arr) > 0 else 0
            if current_max > peak_vol:
                peak_vol = current_max

            accumulated_data.append(arr)
            accumulated_samples += len(arr)

            # periodically transcribe (every 3 seconds)
            if accumulated_samples >= BUFFER_SIZE:
                 sys.stdout.write(f"📊 Audio Chunk - Peak Volume: {peak_vol}\n")
                 sys.stdout.flush()
                 
                 # Merge
                 full_arr = np.concatenate(accumulated_data)
                 
                 # Convert to float32 for Whisper
                 float_arr = full_arr.astype(np.float32) / 32768.0
                 
                 # Transcribe with DYNAMIC LANGUAGE
                 if model:
                     try:
                         # Use current_language
                         segments, info = model.transcribe(float_arr, beam_size=5, language=current_language, condition_on_previous_text=False)
                         
                         text = " ".join([segment.text for segment in segments]).strip()
                         
                         if text:
                             sys.stdout.write(f"📝 Transcription ({current_language}): {text}\n")
                             sys.stdout.flush()
                             # Send to Room
                             payload = json.dumps({"type": "transcription", "text": text, "participant": "agent", "language": current_language})
                             await ctx.room.local_participant.publish_data(payload, reliable=True)
                             
                     except Exception as e:
                         sys.stdout.write(f"❌ Transcription error: {e}\n")
                         sys.stdout.flush()
                 
                 # Reset buffer
                 accumulated_data = []
                 accumulated_samples = 0
                 peak_vol = 0
                 
        print("🔇 Audio stream ended", flush=True)

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        print(f"🛰️ Track Published: {publication.sid} ({publication.kind}) from {participant.identity}", flush=True)

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        print(f"✅ Track Subscribed: {publication.sid} from {participant.identity} ({track.kind})", flush=True)
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(track, publication, participant))

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        print(f"👤 Participant connected: {participant.identity}", flush=True)

    await ctx.connect(auto_subscribe=True)
    print(f"✅ Successfully joined room: {ctx.room.name}", flush=True)
    
    # Process existing tracks with improved logic
    print(f"🔍 Checking for existing participants... ({len(ctx.room.remote_participants)})", flush=True)
    for participant in ctx.room.remote_participants.values():
        print(f"  - Found participant: {participant.identity} with {len(participant.track_publications)} tracks", flush=True)
        for sid, publication in participant.track_publications.items():
            print(f"    - Track {sid}: kind={publication.kind}, subscribed={publication.subscribed}, track={publication.track}", flush=True)
            
            if publication.kind == rtc.TrackKind.KIND_AUDIO:
                 if publication.track:
                     print(f"    - Found existing audio track from {participant.identity}, starting transcribe...", flush=True)
                     asyncio.create_task(transcribe_track(publication.track, publication, participant))
                 elif not publication.subscribed:
                     print(f"    - Track not subscribed. Force subscribing...", flush=True)
                     publication.set_subscribed(True)
    
    # Keep alive
    await asyncio.sleep(3600*24) 

if __name__ == "__main__":
    print("🚀 Launching LiveKit agent...", flush=True)
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

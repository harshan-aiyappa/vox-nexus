import asyncio
import time
import os
import json
import logging
import numpy as np
from typing import Optional, Set
from livekit.agents import JobContext, WorkerOptions, cli
from livekit import rtc
from dotenv import load_dotenv

# --- Configuration & Constants ---
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SECONDS = 2.0 
BYTES_PER_SAMPLE = 2  # int16
BUFFER_SIZE_BYTES = int(SAMPLE_RATE * CHUNK_SECONDS * BYTES_PER_SAMPLE)
VAD_MIN_SPEECH_DURATION_MS = 150
VAD_NO_SPEECH_THRESHOLD = 0.6

# Hallucination Blocklist (Common Whisper artifacts)
HALLUCINATIONS: Set[str] = {
    "Thank you.", "Thanks for watching.", "You", 
    "MBC", "Amara.org", "Subtitles by", "Subtitles",
    "Copyright", "©"
}

# --- Setup ---
# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus")

# Try importing faster_whisper
try:
    from faster_whisper import WhisperModel
except ImportError:
    logger.error("❌ faster_whisper not installed. STT will not work.")
    WhisperModel = None

# Global Model Instance (Lazy loaded)
model: Optional['WhisperModel'] = None

# --- Helper Functions ---

def filter_hallucinations(text: str) -> str:
    """Filters out common Whisper hallucinations."""
    if not text: 
        return ""
    
    cleaned = text.strip()
    if not cleaned: 
        return ""
    
    cleaned_lower = cleaned.lower()
    
    # Exact match check
    for h in HALLUCINATIONS:
        if cleaned_lower == h.lower():
            return ""
    
    # Prefix check for "Thank you" artifacts
    if cleaned_lower.startswith("thank you") and len(cleaned_lower) < 15:
        return ""
        
    return cleaned

def load_model():
    """Loads the Whisper model if not already loaded."""
    global model
    if not model and WhisperModel:
        try:
            logger.info("🧠 Loading Whisper Model (tiny)...")
            model = WhisperModel("tiny", device="cpu", compute_type="int8")
            logger.info("✅ Whisper Model (tiny) Loaded Successfully!")
        except Exception as e:
            logger.error(f"❌ Failed to load Whisper Model: {e}")
    elif model:
        logger.info("🧠 Model already loaded (cached).")

# --- Core Logic ---

async def transcribe_track(track: rtc.RemoteAudioTrack, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant, room: rtc.Room, current_language_ref: dict):
    """
    Handles audio stream from a participant, buffers it, and runs transcription.
    """
    logger.info(f"🎧 [START_STREAM] {participant.identity} (sid: {participant.sid})")
    audio_stream = rtc.AudioStream(track, sample_rate=SAMPLE_RATE, num_channels=CHANNELS)
    
    # Optimization: Use bytearray for O(1) appends
    audio_buffer = bytearray()
    
    async for event in audio_stream:
        # Fast append (low overhead)
        audio_buffer.extend(event.frame.data.tobytes())

        if len(audio_buffer) >= BUFFER_SIZE_BYTES:
             start_time = time.time()
             
             # Create Read-Only View to avoid copy
             # IMPORTANT: np.frombuffer locks the buffer. We must rebind buffer instead of clearing it.
             full_arr_view = np.frombuffer(audio_buffer, dtype=np.int16)
             
             # Quick volume check
             peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
             
             # Optimization: specific check to skip silence efficiently
             if peak_vol < 100: 
                 audio_buffer = bytearray() # Rebind to new buffer
                 continue
             
             # Log only in debug to reduce noise
             logger.debug(f"📊 [PROCESS_CHUNK] Peak: {peak_vol:.4f} | Size: {len(audio_buffer)}")

             # Create float array (this performs a copy and type conversion)
             float_arr = full_arr_view.astype(np.float32) / 32768.0
             
             # Rebind to new buffer to avoid BufferError
             audio_buffer = bytearray()
             
             if model:
                 try:
                     current_lang = current_language_ref.get("code", "en")
                     # Log VAD/Inference start
                     logger.debug(f"🤖 [INFERENCE_START] Language: {current_lang}")
                     
                     loop = asyncio.get_running_loop()
                     
                     def run_inference():
                         segments, _ = model.transcribe(
                             float_arr, 
                             beam_size=1, 
                             language=current_lang, 
                             condition_on_previous_text=False,
                             vad_filter=True,
                             vad_parameters=dict(min_speech_duration_ms=VAD_MIN_SPEECH_DURATION_MS),
                             no_speech_threshold=VAD_NO_SPEECH_THRESHOLD
                         )
                         return " ".join([segment.text for segment in segments]).strip()

                     text = await loop.run_in_executor(None, run_inference)
                     
                     cleaned_text = filter_hallucinations(text)
                     inference_duration = time.time() - start_time
                     
                     if cleaned_text:
                         logger.info(f"📝 [TRANSCRIPTION] '{cleaned_text}' (Lat: {inference_duration:.3f}s)")
                         payload = json.dumps({
                             "type": "transcription", 
                             "text": cleaned_text, 
                             "participant": "agent", 
                             "language": current_lang,
                             "latency_ms": int(inference_duration * 1000)
                         })
                         await room.local_participant.publish_data(payload, reliable=True)
                     elif text:
                         logger.debug(f"🗑️ [FILTERED] '{text}'")
                         
                 except Exception as e:
                     logger.error(f"❌ [ERROR] Transcription failed: {e}")
             
    logger.info(f"🔇 [END_STREAM] {participant.identity}")

async def entrypoint(ctx: JobContext):
    
    logger.info(f"🚀 Job Started! Room: {ctx.room.name}")

    # Initialize model
    load_model()

    # State for dynamic language (per room/job)
    # Using a dict to pass by reference to the coroutine
    current_language_ref = {"code": "en"}

    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        try:
            payload_bytes = data.data if hasattr(data, "data") else data
            payload = json.loads(payload_bytes.decode("utf-8"))
            if payload.get("type") == "set_language":
                code = payload.get("code", "en")
                if code != current_language_ref["code"]:
                    current_language_ref["code"] = code
                    logger.info(f"🌍 Language switched to: {code}")
                    # Acknowledge
                    asyncio.create_task(ctx.room.local_participant.publish_data(
                        json.dumps({"type": "status", "message": f"Language set to {code}"}), reliable=True))
        except Exception as e:
            logger.error(f"⚠️ Error handling data packet: {e}")

    @ctx.room.on("track_published")
    def on_track_published(publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"📄 [TRACK_PUBLISHED] {publication.sid} from {participant.identity} ({publication.kind})")
        # Ensure we subscribe if auto_subscribe didn't catch it for some reason
        if not publication.subscribed:
            publication.set_subscribed(True)

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        try:
            logger.info(f"✅ [TRACK_SUBSCRIBED] {publication.sid} from {participant.identity} ({track.kind})")
            if track.kind == rtc.TrackKind.KIND_AUDIO:
                logger.info(f"🎤 Starting transcription for audio track {track.sid}")
                asyncio.create_task(transcribe_track(track, publication, participant, ctx.room, current_language_ref))
            else:
                logger.info(f"ℹ️ Skipping non-audio track: {track.kind}")
        except Exception as e:
            logger.error(f"❌ Error in on_track_subscribed: {e}")

    @ctx.room.on("track_muted")
    def on_track_muted(participant: rtc.RemoteParticipant, publication: rtc.RemoteTrackPublication):
        # Simply logging, logic can be extended
        identity = participant.identity if participant else "Unknown"
        logger.info(f"🔇 [MIC_OFF] {identity} muted track {publication.sid}")
        
        asyncio.create_task(ctx.room.local_participant.publish_data(
            json.dumps({"type": "mic_status", "status": "muted", "participant": identity}), reliable=True))

    @ctx.room.on("track_unmuted")
    def on_track_unmuted(participant: rtc.RemoteParticipant, publication: rtc.RemoteTrackPublication):
        identity = participant.identity if participant else "Unknown"
        logger.info(f"🎤 [MIC_ON] {identity} unmuted track {publication.sid}")

        asyncio.create_task(ctx.room.local_participant.publish_data(
            json.dumps({"type": "mic_status", "status": "active", "participant": identity}), reliable=True))

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"👤 [USER_CONNECTED] {participant.identity}")

    await ctx.connect(auto_subscribe=True)
    logger.info(f"✅ [JOINED] Room: {ctx.room.name}")

    # Check for existing participants/tracks with detailed logging
    logger.info(f"🔍 Checking for {len(ctx.room.remote_participants)} existing participants...")
    for p_sid, participant in ctx.room.remote_participants.items():
        logger.info(f"  - Participant: {participant.identity} ({p_sid})")
        for pub_sid, publication in participant.track_publications.items():
             logger.info(f"    - Track: {pub_sid} (Kind: {publication.kind}, Subscribed: {publication.subscribed})")
             if publication.kind == rtc.TrackKind.KIND_AUDIO:
                 if not publication.subscribed:
                     logger.info(f"    ⚠️ Found unsubscribed audio track {pub_sid}, subscribing...")
                     publication.set_subscribed(True)
                 
                 if publication.track:
                      logger.info(f"    ▶️ manually starting transcription for {pub_sid}")
                      asyncio.create_task(transcribe_track(publication.track, publication, participant, ctx.room, current_language_ref))
                 else:
                      logger.warning(f"    ⚠️ Published audio track {pub_sid} has no track object (pending subscription?)")

    # Keep the worker alive until the room is closed or disconnected
    try:
         # Wait until the room is disconnected
         while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
             await asyncio.sleep(1)
    except asyncio.CancelledError:
        logger.info("Job cancelled")
    except Exception as e:
        logger.error(f"Job failed: {e}")
    finally:
        logger.info("Job finished")

if __name__ == "__main__":
    # Use 'start' (prod mode) to avoid the watcher/dev reloader issues on Windows
    # This prevents the IncompleteReadError from the IPC pipe
    import sys
    if "dev" in sys.argv:
        sys.argv.remove("dev")
    sys.argv.append("start")
    
    print("🚀 Launching LiveKit agent (Stable Mode)...", flush=True)
    # Increase load_threshold to 0.9 to accept jobs even under heavier local load
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, load_threshold=0.9))

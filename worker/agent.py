import asyncio
import time
import os
import json
import logging
import numpy as np
from livekit.agents import JobContext, WorkerOptions, cli
from livekit import rtc
from dotenv import load_dotenv

# Try importing faster_whisper
try:
    from faster_whisper import WhisperModel
except ImportError:
    logging.error("❌ faster_whisper not installed. STT will not work.")
    WhisperModel = None

# Load environment variables from root directory if not found in worker directory
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


# Configure logging
logger = logging.getLogger("vox-nexus")
logger.setLevel(logging.INFO)

# Initialize Whisper (Moved to entrypoint to prevent spawn timeout)
model = None

async def entrypoint(ctx: JobContext):
    global model
    
    logger.info(f"🚀 Job Started! Room: {ctx.room.name}")

    # Initialize model if not loaded (per process)
    if not model and WhisperModel:
        try:
            logger.info("🧠 Loading Whisper Model (small)...")
            model = WhisperModel("small", device="cpu", compute_type="int8")
            logger.info("✅ Whisper Model Loaded Successfully!")
        except Exception as e:
            logger.error(f"❌ Failed to load Whisper Model: {e}")

    # State for dynamic language (per room/job)
    current_language = "en"

    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        nonlocal current_language
        try:
            payload_bytes = data.data if hasattr(data, "data") else data
            payload = json.loads(payload_bytes.decode("utf-8"))
            if payload.get("type") == "set_language":
                code = payload.get("code", "en")
                if code != current_language:
                    current_language = code
                    logger.info(f"🌍 Language switched to: {current_language}")
                    # Acknowledge
                    asyncio.create_task(ctx.room.local_participant.publish_data(
                        json.dumps({"type": "status", "message": f"Language set to {current_language}"}), reliable=True))
        except Exception as e:
            logger.error(f"⚠️ Error handling data packet: {e}")

    # Hallucination Blocklist (Common Whisper artifacts)
    HALLUCINATIONS = {
        "Thank you.", "Thanks for watching.", "You", 
        "MBC", "Amara.org", "Subtitles by", "Subtitles",
        "Copyright", "©"
    }

    def filter_hallucinations(text: str) -> str:
        if not text: return ""
        cleaned = text.strip().lower()
        if not cleaned: return ""
        
        # Exact match check
        for h in HALLUCINATIONS:
            if cleaned == h.lower():
                return ""
        
        # Prefix check for "Thank you" artifacts
        if cleaned.startswith("thank you") and len(cleaned) < 15:
            return ""
        return text

    async def transcribe_track(track: rtc.RemoteAudioTrack, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        logger.info(f"🎧 [START_STREAM] {participant.identity} (sid: {participant.sid})")
        audio_stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        
        # Optimization: Use bytearray for O(1) appends
        audio_buffer = bytearray()
        
        SAMPLE_RATE = 16000
        CHUNK_SECONDS = 2.0 
        BYTES_PER_SAMPLE = 2 # int16
        BUFFER_SIZE_BYTES = int(SAMPLE_RATE * CHUNK_SECONDS * BYTES_PER_SAMPLE)
        
        async for event in audio_stream:
            audio_buffer.extend(event.frame.data.tobytes())

            if len(audio_buffer) >= BUFFER_SIZE_BYTES:
                 start_time = time.time()
                 
                 # Create Read-Only View
                 # IMPORTANT: This view is tied to audio_buffer. We must process or copy before clearing buffer.
                 full_arr_view = np.frombuffer(audio_buffer, dtype=np.int16)
                 
                 peak_vol = np.abs(full_arr_view).max() if len(full_arr_view) > 0 else 0
                 logger.info(f"📊 [PROCESS_CHUNK] Peak: {peak_vol:.4f} | Size: {len(audio_buffer)}")
                 
                 # Optimization: specific check to skip silence efficiently
                 if peak_vol < 100: 
                     audio_buffer.clear()
                     continue

                 # Create float array (this performs a copy and type conversion, safe to clear buffer after)
                 float_arr = full_arr_view.astype(np.float32) / 32768.0
                 
                 # Now safe to clear buffer
                 audio_buffer.clear()
                 
                 if model:
                     try:
                         # Log VAD/Inference start
                         logger.info(f"🤖 [INFERENCE_START] Language: {current_language}")
                         
                         loop = asyncio.get_running_loop()
                         
                         def run_inference():
                             segments, info = model.transcribe(
                                 float_arr, 
                                 beam_size=1, 
                                 language=current_language, 
                                 condition_on_previous_text=False,
                                 vad_filter=True,
                                 vad_parameters=dict(min_speech_duration_ms=150),
                                 no_speech_threshold=0.6
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
                                 "language": current_language,
                                 "latency_ms": int(inference_duration * 1000)
                             })
                             await ctx.room.local_participant.publish_data(payload, reliable=True)
                         elif text:
                             logger.info(f"🗑️ [FILTERED] '{text}'")
                             
                     except Exception as e:
                         logger.error(f"❌ [ERROR] Transcription failed: {e}")
                 
        logger.info(f"🔇 [END_STREAM] {participant.identity}")

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        logger.info(f"hw_event_mic: 🛰️ [TRACK_PUBLISHED] {publication.sid} ({publication.kind}) from {participant.identity}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        logger.info(f"hw_event_mic: ✅ [TRACK_SUBSCRIBED] {publication.sid} from {participant.identity} ({track.kind})")
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            asyncio.create_task(transcribe_track(track, publication, participant))

    @ctx.room.on("track_muted")
    def on_track_muted(*args):
        logger.info(f"🔍 [DEBUG_ARGS] track_muted received {len(args)} args: {[type(a).__name__ for a in args]}")
        
        participant = None
        publication = None

        # Introspect arguments to find the right objects
        for arg in args:
            if hasattr(arg, "identity"): # Likely RemoteParticipant
                participant = arg
            elif hasattr(arg, "sid") and hasattr(arg, "kind"): # Likely RemoteTrackPublication
                publication = arg
        
        # Fallback: if we have publication but no participant
        if publication and not participant:
             # Try to find participant who owns this publication
             for p in ctx.room.remote_participants.values():
                 if publication.sid in p.track_publications:
                     participant = p
                     break
        
        identity = participant.identity if participant else "Unknown"
        sid = publication.sid if publication else "Unknown"
        
        logger.info(f"hw_event_mic: 🔇 [MIC_OFF] {identity} muted track {sid}")
        
        if participant:
            asyncio.create_task(ctx.room.local_participant.publish_data(
                json.dumps({"type": "mic_status", "status": "muted", "participant": identity}), reliable=True))

    @ctx.room.on("track_unmuted")
    def on_track_unmuted(*args):
        logger.info(f"🔍 [DEBUG_ARGS] track_unmuted received {len(args)} args: {[type(a).__name__ for a in args]}")

        participant = None
        publication = None

        for arg in args:
            if hasattr(arg, "identity"):
                participant = arg
            elif hasattr(arg, "sid") and hasattr(arg, "kind"):
                publication = arg
        
        if publication and not participant:
             for p in ctx.room.remote_participants.values():
                 if publication.sid in p.track_publications:
                     participant = p
                     break

        identity = participant.identity if participant else "Unknown"
        sid = publication.sid if publication else "Unknown"
        
        logger.info(f"hw_event_mic: 🎤 [MIC_ON] {identity} unmuted track {sid}")

        if participant:
            asyncio.create_task(ctx.room.local_participant.publish_data(
                json.dumps({"type": "mic_status", "status": "active", "participant": identity}), reliable=True))

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"👤 [USER_CONNECTED] {participant.identity}")

    await ctx.connect(auto_subscribe=True)
    logger.info(f"✅ [JOINED] Room: {ctx.room.name}")
    
    logger.info(f"🔍 [CHECK_PARTICIPANTS] Count: {len(ctx.room.remote_participants)}")
    for participant in ctx.room.remote_participants.values():
        logger.info(f"  - Found: {participant.identity}")
        for sid, publication in participant.track_publications.items():
            if publication.kind == rtc.TrackKind.KIND_AUDIO:
                 if publication.track:
                     asyncio.create_task(transcribe_track(publication.track, publication, participant))
                 elif not publication.subscribed:
                     publication.set_subscribed(True)
    
    await asyncio.sleep(3600*24) 

if __name__ == "__main__":
    print("🚀 Launching LiveKit agent...", flush=True)
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

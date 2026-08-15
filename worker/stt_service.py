import logging
import os
import queue
import re
import time
import threading
from typing import Optional, Set

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus-stt")

try:
    from faster_whisper import WhisperModel
except ImportError:
    logger.error("❌ faster_whisper not installed. STT will not work.")
    WhisperModel = None

# Hallucination Blocklist (Common Whisper artifacts)
HALLUCINATIONS: Set[str] = {
    "Thank you.", "Thanks for watching.", "Thank you for watching.", "You", 
    "MBC", "Amara.org", "Subtitles by", "Subtitles",
    "Copyright", "©", "The end", "Silence", "audio", "noise",
    "Music", "Violin music", "Eerie music", "Dramatic music",
    "Watching", "Sous-titres",
    # The initial_prompt itself, which Whisper echoes back on unclear audio
    "Use simple English",
}

# Whisper's own supported language set, so an unknown code fails loudly
try:
    from faster_whisper.tokenizer import _LANGUAGE_CODES as SUPPORTED_LANGUAGES
except ImportError:
    SUPPORTED_LANGUAGES = {"en", "es", "fr", "hi"}

class WhisperService:
    """Holds a small pool of Whisper instances.

    A single model behind one global lock serialised every speaker: two
    concurrent clients measured ~2.4x the solo latency, and there was no path
    to a third. Each pooled instance is still used by one thread at a time
    (CTranslate2 models are not safe to share concurrently), but independent
    instances run in parallel.

    Each instance costs roughly its model size in RAM, so the pool stays small
    and is configurable via STT_POOL_SIZE.
    """

    def __init__(self):
        self.model: Optional['WhisperModel'] = None   # first instance; also the readiness flag
        self._pool: "queue.Queue[WhisperModel]" = queue.Queue()
        self._pool_size = 0
        self._lock = threading.Lock()   # guards load_model only
    
    def load_model(self):
        """Loads the Whisper model pool if not already loaded."""
        with self._lock:
            if self.model:
                logger.info("🧠 Model already loaded (cached).")
                return
            if not WhisperModel:
                return

            size = os.getenv("MODEL_SIZE", "small")
            device = os.getenv("WHISPER_DEVICE", "cpu")
            compute = os.getenv("WHISPER_COMPUTE", "int8")
            try:
                pool_size = max(1, int(os.getenv("STT_POOL_SIZE", "2")))
            except ValueError:
                pool_size = 2

            # CTranslate2 defaults to every available core per instance, so a
            # pool of them thrashes rather than scaling. Divide the cores.
            cores = os.cpu_count() or 4
            cpu_threads = max(1, cores // pool_size)

            try:
                logger.info(
                    f"🧠 Loading Whisper Model ({size}, {device}/{compute}) "
                    f"x{pool_size}, {cpu_threads} threads each of {cores} cores..."
                )
                for i in range(pool_size):
                    instance = WhisperModel(size, device=device, compute_type=compute,
                                            cpu_threads=cpu_threads, download_root=None)
                    self._pool.put(instance)
                    if self.model is None:
                        self.model = instance   # readiness flag for /health
                    logger.info(f"   instance {i + 1}/{pool_size} ready")
                self._pool_size = pool_size
                logger.info(f"✅ Whisper Model ({size}) Loaded Successfully! Pool size {pool_size}.")
            except Exception as e:
                logger.error(f"❌ Failed to load Whisper Model: {e}")

    @staticmethod
    def _normalize(text: str) -> str:
        """Lowercase and strip punctuation/whitespace so that blocklist matching
        is not defeated by a trailing '!' instead of a '.'."""
        return re.sub(r"[^\w\s]", "", text.lower()).strip()

    def filter_hallucinations(self, text: str) -> str:
        """Filters out common Whisper hallucinations."""
        if not text: return ""
        cleaned = text.strip()
        if not cleaned: return ""
        cleaned_norm = self._normalize(cleaned)
        if not cleaned_norm: return ""

        for h in HALLUCINATIONS:
            h_norm = self._normalize(h)
            if not h_norm:
                continue
            # Exact match for short artifacts to avoid blocking valid sentences
            if len(h_norm) < 10:
                if cleaned_norm == h_norm: return ""
            # Partial match for longer artifact strings
            elif h_norm in cleaned_norm:
                return ""

        # Catch "Thank you" variants specifically
        if "thank you" in cleaned_norm and len(cleaned_norm) < 20:
            return ""

        return cleaned

    def transcribe(self, float_arr, language="en", vad_threshold=0.6):
        if not self.model:
            return ""

        # Borrow an instance; blocks only when every one is busy, rather than
        # serialising all speakers behind a single lock.
        try:
            model = self._pool.get(timeout=30)
        except queue.Empty:
            logger.warning("⚠️ All STT instances busy for 30s; dropping segment")
            return ""

        try:
            segments, _ = model.transcribe(
                    float_arr, 
                    beam_size=3, 
                    language=language, 
                    condition_on_previous_text=False,
                    vad_filter=True, 
                    vad_parameters=dict(
                        min_silence_duration_ms=1000,  # Increased from 500ms
                        threshold=0.3  # Lowered from default 0.5
                    ),
                    initial_prompt="Use simple English."
            )
            text = " ".join([segment.text for segment in segments]).strip()
            return self.filter_hallucinations(text)
        except Exception as e:
            logger.error(f"❌ Transcription error: {e}")
            return ""
        finally:
            self._pool.put(model)

# Singleton instance
stt_service = WhisperService()

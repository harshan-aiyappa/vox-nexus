import logging
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
    "Watching", "Sous-titres"
}

class WhisperService:
    def __init__(self):
        self.model: Optional['WhisperModel'] = None
        self._lock = threading.Lock()
    
    def load_model(self):
        """Loads the Whisper model if not already loaded."""
        if not self.model and WhisperModel:
            try:
                logger.info("🧠 Loading Whisper Model (small)...")
                self.model = WhisperModel("small", device="cpu", compute_type="int8", download_root=None)
                logger.info("✅ Whisper Model (small) Loaded Successfully!")
            except Exception as e:
                logger.error(f"❌ Failed to load Whisper Model: {e}")
        elif self.model:
            logger.info("🧠 Model already loaded (cached).")

    def filter_hallucinations(self, text: str) -> str:
        """Filters out common Whisper hallucinations."""
        if not text: return ""
        cleaned = text.strip()
        if not cleaned: return ""
        cleaned_lower = cleaned.lower()
        
        for h in HALLUCINATIONS:
            h_low = h.lower()
            # Exact match for short artifacts to avoid blocking valid sentences
            if len(h_low) < 10:
                if cleaned_lower == h_low: return ""
            # Partial match for longer artifact strings
            elif h_low in cleaned_lower:
                return ""
        
        # Catch "Thank you" variants specifically
        if "thank you" in cleaned_lower and len(cleaned_lower) < 20:
            return ""
            
        return cleaned

    def transcribe(self, float_arr, language="en", vad_threshold=0.6):
        if not self.model:
            return ""
        
        try:
            with self._lock:
                segments, _ = self.model.transcribe(
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

# Singleton instance
stt_service = WhisperService()

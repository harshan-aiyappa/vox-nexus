import logging
import time
from typing import Optional, Set

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus-core")

try:
    from faster_whisper import WhisperModel
except ImportError:
    logger.error("❌ faster_whisper not installed. STT will not work.")
    WhisperModel = None

# Hallucination Blocklist (Common Whisper artifacts)
HALLUCINATIONS: Set[str] = {
    "Thank you.", "Thanks for watching.", "You", 
    "MBC", "Amara.org", "Subtitles by", "Subtitles",
    "Copyright", "©"
}

class WhisperService:
    def __init__(self):
        self.model: Optional['WhisperModel'] = None
    
    def load_model(self):
        """Loads the Whisper model if not already loaded."""
        if not self.model and WhisperModel:
            try:
                logger.info("🧠 Loading Whisper Model (tiny)...")
                self.model = WhisperModel("tiny", device="cpu", compute_type="int8")
                logger.info("✅ Whisper Model (tiny) Loaded Successfully!")
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
            if cleaned_lower == h.lower(): return ""
        
        if cleaned_lower.startswith("thank you") and len(cleaned_lower) < 15:
            return ""
            
        return cleaned

    def transcribe(self, float_arr, language="en", vad_min_ms=150, vad_threshold=0.6):
        if not self.model:
            return ""
        
        try:
            segments, _ = self.model.transcribe(
                float_arr, 
                beam_size=1, 
                language=language, 
                condition_on_previous_text=False,
                vad_filter=True,
                vad_parameters=dict(min_speech_duration_ms=vad_min_ms),
                no_speech_threshold=vad_threshold
            )
            text = " ".join([segment.text for segment in segments]).strip()
            return self.filter_hallucinations(text)
        except Exception as e:
            logger.error(f"❌ Transcription error: {e}")
            return ""

# Singleton instance
whisper_service = WhisperService()

import asyncio
import base64
import json
import logging
import uvicorn
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from core_whisper import whisper_service

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus-direct")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model on startup
@app.on_event("startup")
async def startup_event():
    whisper_service.load_model()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("🔌 Client connected to Direct Mode WebSocket")
    
    # Audio buffer for this connection
    audio_buffer = bytearray()
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                if message['type'] == 'audio':
                    # Decode Base64 audio chunk
                    chunk = base64.b64decode(message['data'])
                    audio_buffer.extend(chunk)
                    
                    # Process every 1 second (approx 32000 bytes at 16kHz)
                    if len(audio_buffer) >= 32000:
                        # Convert to numpy array
                        full_arr_view = np.frombuffer(audio_buffer, dtype=np.int16)
                        
                        # Normalize to float32
                        float_arr = full_arr_view.astype(np.float32) / 32768.0
                        
                        # Run Inference
                        text = whisper_service.transcribe(float_arr)
                        
                        if text:
                            logger.info(f"📝 [DIRECT] Transcription: {text}")
                            await websocket.send_json({
                                "type": "transcription",
                                "text": text,
                                "isFinal": True
                            })
                        
                        # Clear buffer
                        audio_buffer = bytearray()

            except json.JSONDecodeError:
                logger.error("❌ Invalid JSON received")
            except Exception as e:
                logger.error(f"❌ Error processing message: {e}")

    except WebSocketDisconnect:
        logger.info("🔌 Client disconnected")
    except Exception as e:
        logger.error(f"❌ WebSocket error: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

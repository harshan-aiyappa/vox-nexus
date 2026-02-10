
import asyncio
import logging
import os
import uvicorn
from dotenv import load_dotenv
from livekit.agents import WorkerOptions
from livekit.agents.worker import AgentServer   # Fixed import

# Imports from sibling modules
# Ensure these modules are in the python path or same directory
from direct import app
from agent import entrypoint
from core_whisper import whisper_service

# Load Env
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("vox-nexus-main")

async def main():
    logger.info("🚀 Starting VoxNexus Unified Worker...")
    logger.info("=======================================")

    # 1. Initialize Shared Resources
    # We load the model once here. Subsequent calls in sub-modules will see it's already loaded.
    logger.info("🧠 Initializing Core AI Models...")
    whisper_service.load_model()

    # 2. Configure Direct Mode Server (FastAPI/Uvicorn)
    # Using uvicorn programmatically allows us to run it in the same event loop
    config = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    server = uvicorn.Server(config)

    # 3. Configure Agent Mode Worker (LiveKit)
    # Wraps the connection logic to LiveKit Cloud
    # We use port 8082 for the health check to avoid conflicts with other 8081 processes
    lk_worker = AgentServer.from_server_options(WorkerOptions(
        entrypoint_fnc=entrypoint,
        load_threshold=0.9,
        port=8082
    ))

    # 4. Run Concurrently
    logger.info("✅ Services Initialized. Entering Event Loop.")
    
    try:
        # TaskGroup ensures both run forever, or both cancel if one fails
        async with asyncio.TaskGroup() as tg:
            logger.info("🔌 Launching Direct Mode WebSocket Server on :8000")
            tg.create_task(server.serve())
            
            logger.info("📡 Launching LiveKit Agent Worker")
            tg.create_task(lk_worker.run())
            
    except asyncio.CancelledError:
        logger.info("🛑 Worker shutting down...")
    except Exception as e:
        logger.error(f"❌ Critical Worker Error: {e}")
        # In case of error, we might want to shut down
        raise e

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 User interrupted. Exiting.")

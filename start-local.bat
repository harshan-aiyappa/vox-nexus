@echo off
echo ========================================
echo   Starting VoxNexus (Local Mode)
echo ========================================
echo.

REM Start Whisper Worker (Docker)
echo [1/3] Starting Whisper Worker (Docker)...
start "VoxNexus Worker" cmd /k "docker-compose up"
timeout /t 5 /nobreak >nul

REM Start Backend Server (Local)
echo [2/3] Starting Backend Server (Local)...
start "VoxNexus Server" cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Frontend (Local)
echo [3/3] Starting Frontend (Local)...
start "VoxNexus Client" cmd /k "cd client && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo.
echo Architecture:
echo   - Frontend: Local (http://localhost:5173)
echo   - Backend:  Local (http://localhost:8080)
echo   - Worker:   Docker (Whisper AI)
echo.
echo Press any key to exit...
pause >nul

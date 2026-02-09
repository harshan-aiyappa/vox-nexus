@echo off
echo Starting VoxNexus with Ngrok tunnels...
echo.

REM Start Docker services
echo [1/4] Starting Docker services (Server + Worker)...
start "Docker Services" cmd /k "docker-compose up"
timeout /t 5 /nobreak >nul

REM Start Frontend
echo [2/4] Starting Frontend (Vite)...
start "Frontend" cmd /k "cd client && npm run dev"
timeout /t 5 /nobreak >nul

REM Start Ngrok tunnels
echo [3/4] Starting Ngrok tunnels...
start "Ngrok Tunnels" cmd /k "ngrok start --all --config ngrok.yml"
timeout /t 3 /nobreak >nul

echo [4/4] All services started!
echo.
echo ========================================
echo   VoxNexus is now running!
echo ========================================
echo.
echo Local URLs:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8080
echo.
echo Public URLs (check Ngrok window):
echo   Ngrok Dashboard: http://localhost:4040
echo.
echo Press any key to open Ngrok dashboard...
pause >nul
start http://localhost:4040

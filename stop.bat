@echo off
echo Stopping all VoxNexus services...
echo.

REM Stop Docker services
echo [1/3] Stopping Docker services...
docker-compose down

REM Kill Node processes (Frontend)
echo [2/3] Stopping Frontend...
taskkill /F /IM node.exe 2>nul

REM Kill Ngrok processes
echo [3/3] Stopping Ngrok tunnels...
taskkill /F /IM ngrok.exe 2>nul

echo.
echo All services stopped!
pause

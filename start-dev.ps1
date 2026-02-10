$ErrorActionPreference = "Stop"

Write-Host "Starting Ngrok..."
try {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok start --all --config=ngrok.yml"
} catch {
    Write-Warning "Failed to start Ngrok. Ensure 'ngrok' is in your PATH."
}

Write-Host "Waiting for Ngrok to initialize..."
$maxRetries = 20
$retryCount = 0
$ngrokReady = $false

while (-not $ngrokReady -and $retryCount -lt $maxRetries) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ngrokReady = $true
        }
    } catch {
        Start-Sleep -Seconds 1
        $retryCount++
        Write-Host "." -NoNewline
    }
}

if ($ngrokReady) {
    Write-Host "`nNgrok is ready! Running setup script..."
    try {
        node setup-ngrok.js
    } catch {
        Write-Warning "Failed to run setup-ngrok.js"
    }
} else {
    Write-Host "`nNgrok failed to start or is not responding within 20 seconds. Skipping automatic setup."
}

Write-Host "Starting Backend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm run dev"

Write-Host "Starting Python Worker..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd worker; if (Test-Path venv) { .\venv\Scripts\Activate.ps1 } else { Write-Host 'Venv not found!' }; python agent.py dev"

Write-Host "Starting Frontend Client..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"

Write-Host "All services launch commands issued."

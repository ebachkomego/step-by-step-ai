Write-Host "Starting StepByStep AI Backend..." -ForegroundColor Cyan
Set-Location -Path $PSScriptRoot
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} else {
    py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

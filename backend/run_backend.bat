@echo off
echo Starting StepByStep AI Backend...
cd /d "%~dp0"
set PYTHONPATH=%~dp0
if exist ".\venv\Scripts\python.exe" (
    ".\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else if exist ".\venv\Scripts\activate.bat" (
    call .\venv\Scripts\activate.bat
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) else (
    py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
)
pause

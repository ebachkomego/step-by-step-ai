@echo off
echo ========================================================
echo        Запуск StepByStep AI (Backend + Frontend)
echo ========================================================

start "StepByStep AI Backend" cmd /k "cd /d "%~dp0backend" && run_backend.bat"
timeout /t 2 /nobreak >nul
start "StepByStep AI Frontend" cmd /k "cd /d "%~dp0frontend" && run_frontend.bat"

echo.
echo [OK] Бэкенд и Фронтенд запускаются в отдельных окнах!
echo Бэкенд: http://localhost:8000
echo Документация API Swagger: http://localhost:8000/docs
echo Фронтенд: http://localhost:5173
echo ========================================================
pause

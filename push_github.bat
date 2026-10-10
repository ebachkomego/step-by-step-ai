@echo off
echo ========================================================
echo   Отправка проекта на GitHub: ebachkomego/step-by-step-ai
echo ========================================================
cd /d "%~dp0"
echo 1. Убедитесь, что репозиторий создан на https://github.com/new с именем step-by-step-ai
echo 2. Запускаем push в ветку main...
git push -u origin main
echo ========================================================
pause

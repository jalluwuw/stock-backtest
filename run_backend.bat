@echo off
cd /d "%~dp0backend"
echo ========================================================
echo   Menjalankan Backend FastAPI di http://localhost:8000
echo ========================================================
python main.py
pause

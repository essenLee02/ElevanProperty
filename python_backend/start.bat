@echo off
REM ============================================================================
REM  start.bat — jalankan python_backend dengan bersih.
REM
REM  Selalu membersihkan sisa proses DULU (stop.bat), supaya tidak pernah lagi
REM  ketemu "[Errno 10048] port in use" atau "ERR_NGROK_334 already online"
REM  yang sebenarnya cuma sisa instance sendiri.
REM
REM  ⚠️ SEBELUM MENJALANKAN, PASTIKAN MODE-nya BENAR (lihat python_backend\.env):
REM
REM   (a) NODE.js yang membalas customer  -> PYTHON_AI_REPLY_ENABLED=false
REM                                          ENABLE_NGROK=false
REM       Node.js jalan & pegang domain; Python cuma mengamati lewat mirror.
REM
REM   (b) PYTHON yang membalas customer   -> PYTHON_AI_REPLY_ENABLED=true
REM                                          ENABLE_NGROK=true
REM       Node.js WAJIB DIMATIKAN, kalau tidak customer dapat DUA balasan.
REM ============================================================================

cd /d "%~dp0"

call "%~dp0stop.bat"

echo [START] Menjalankan python_backend...
echo.
".venv\Scripts\python.exe" main.py

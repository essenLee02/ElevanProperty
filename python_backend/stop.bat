@echo off
REM ============================================================================
REM  stop.bat — hentikan python_backend DAN ngrok anaknya dengan bersih.
REM
REM  KENAPA PERLU SKRIP SENDIRI:
REM  Menutup jendela / Ctrl+C sering menyisakan DUA proses hidup:
REM    1. python.exe yang masih memegang port 5056  -> start berikutnya gagal
REM       "[Errno 10048] only one usage of each socket address"
REM    2. ngrok.exe (proses ANAK pyngrok) yang masih memegang domain -> start
REM       berikutnya gagal "ERR_NGROK_334 endpoint already online"
REM  Keduanya membingungkan karena pesannya seolah ada instance lain, padahal
REM  itu sisa proses milik sendiri.
REM
REM  ⚠️ JANGAN pakai perintah `shutdown` untuk membebaskan port — di Windows
REM     `shutdown` adalah perintah MEMATIKAN KOMPUTER, bukan menutup port.
REM
REM  Catatan: memakai path LENGKAP ke tool Windows (%SystemRoot%\System32\...)
REM  supaya tidak tertukar dengan `find`/`timeout` versi Unix bila Git Bash
REM  atau WSL ada di PATH — tertukar begitu membuat skrip ini gagal diam-diam.
REM ============================================================================

setlocal
set "SYS=%SystemRoot%\System32"

echo.
echo [STOP] Mencari proses yang memegang port 5056...

set "FOUND="
REM ⚠️ Tanda kurung WAJIB di-escape sebagai ^) di dalam blok `for ... do (...)`.
REM Tanpa escape, `)` menutup blok LEBIH AWAL sehingga taskkill jalan di luar
REM loop tanpa %%P — proses tidak pernah benar-benar dimatikan, padahal skrip
REM terlihat "berhasil". Bug ini nyata dan sempat lolos di versi pertama.
for /f "tokens=5" %%P in ('%SYS%\netstat.exe -ano ^| %SYS%\findstr.exe /R /C:":5056 .*LISTENING"') do (
    echo [STOP] Menghentikan PID %%P ^(port 5056^)
    %SYS%\taskkill.exe /F /PID %%P >nul 2>&1
    set "FOUND=1"
)
if not defined FOUND echo [STOP] Tidak ada yang memegang port 5056.

echo [STOP] Menghentikan ngrok.exe (bila ada)...
%SYS%\taskkill.exe /F /IM ngrok.exe >nul 2>&1
if errorlevel 1 (
    echo [STOP] ngrok.exe tidak berjalan.
) else (
    echo [STOP] ngrok.exe dihentikan.
)

REM Jeda ~2 detik tanpa `timeout` (portable, tidak bergantung PATH).
%SYS%\ping.exe -n 3 127.0.0.1 >nul 2>&1

echo.
echo [STOP] Status akhir:
%SYS%\netstat.exe -ano | %SYS%\findstr.exe /R /C:":5056 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [OK] Port 5056 BEBAS - siap start.
) else (
    echo   [!!] Port 5056 MASIH terpakai.
    echo        Cek manual: netstat -ano ^| findstr :5056
)
echo.
endlocal

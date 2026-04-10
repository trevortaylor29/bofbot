@echo off
setlocal EnableExtensions

rem ---------------------------------------------------------------------------
rem BofBot — one double-click: worker + Next.js + browser
rem Requires: python on PATH, Node/npm in PATH
rem   Worker deps install automatically below (uvicorn, fastapi, …).
rem   (from web/) npm install — run once for Next.js
rem ---------------------------------------------------------------------------

if /i "%~1"=="worker" goto :run_worker
if /i "%~1"=="web" goto :run_web

set "ROOT=%~dp0"
rem Drop trailing backslash for cleaner joins (optional)
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "WEB=%ROOT%\web"
set "MEDIA=%WEB%\.data\media"

if not exist "%MEDIA%" mkdir "%MEDIA%" 2>nul
if not exist "%MEDIA%\raw" mkdir "%MEDIA%\raw" 2>nul
if not exist "%MEDIA%\out" mkdir "%MEDIA%\out" 2>nul

echo Starting BofBot...
echo   Worker:  http://127.0.0.1:8000  ^(binds 127.0.0.1 only, media: %MEDIA%^)
echo   Next.js: http://127.0.0.1:3000  (wait for "Ready" in that window)
echo.

start "BofBot Worker" cmd /k call "%~f0" worker
start "BofBot Next.js" cmd /k call "%~f0" web

rem First compile can take longer than 5s; browser may load before Ready — refresh if needed
timeout /t 8 /nobreak >nul
rem Use 127.0.0.1 to avoid Windows localhost / IPv6 resolution issues
start "" "http://127.0.0.1:3000/"

echo.
echo Two windows should have opened. Browser launched to localhost:3000
echo You can close this launcher; worker and Next.js keep running in their windows.
timeout /t 3 >nul
exit /b 0

:run_worker
cd /d "%~dp0"
set "BOFBOT_MEDIA_ROOT=%~dp0web\.data\media"
set "TIKTOKED_MEDIA_ROOT=%BOFBOT_MEDIA_ROOT%"
set "REQ=%~dp0requirements-worker.txt"
title BofBot Worker (uvicorn :8000)
echo BOFBOT_MEDIA_ROOT=%BOFBOT_MEDIA_ROOT%
echo.
echo Installing worker Python packages if missing ^(uvicorn, fastapi, …^)...
python -m pip install -r "%REQ%"
if errorlevel 1 (
  echo.
  echo pip failed. Try: python -m pip install -r "%REQ%"
  pause
  exit /b 1
)
echo.
python -m uvicorn worker.app:app --host 127.0.0.1 --port 8000
echo.
echo Worker exited. 
pause
exit /b 0

:run_web
cd /d "%~dp0web"
set "WORKER_URL=http://127.0.0.1:8000"
set "BOFBOT_MEDIA_ROOT=%~dp0web\.data\media"
set "LOCAL_MEDIA_ROOT=%BOFBOT_MEDIA_ROOT%"
title BofBot Next.js (localhost:3000)
echo WORKER_URL=%WORKER_URL%
echo BOFBOT_MEDIA_ROOT=%BOFBOT_MEDIA_ROOT%
echo.
call npm run dev
echo.
echo Next.js exited.
pause
exit /b 0

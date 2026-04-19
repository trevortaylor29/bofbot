@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM One double-click release:
REM   1) bump patch in package.json
REM   2) build Windows installer (no electron-builder publish — we use gh)
REM   3) copy to BofBot-Setup.exe for stable download URL
REM   4) patch latest.yml to reference BofBot-Setup.exe (auto-updater)
REM   5) zip .exe for browsers that block downloads; gh release create + upload .exe + .zip + latest.yml
REM
REM Requires: Node/npm, GitHub CLI (gh) logged in (`gh auth login`).

echo.
echo === BofBot desktop release ===
echo.

for /f "delims=" %%V in ('node scripts\bump-patch-version.cjs') do set "NEW_VER=%%V"
if errorlevel 1 (
  echo Failed to bump version in package.json.
  exit /b 1
)
if not defined NEW_VER (
  echo Could not read new version.
  exit /b 1
)

echo New version: %NEW_VER%
echo.

call npm run build:win:release
if errorlevel 1 (
  echo Build failed. Fix errors, then restore package.json if needed.
  exit /b 1
)

set "BUILT=release\BofBot-Setup-%NEW_VER%.exe"
set "STABLE=release\BofBot-Setup.exe"
if not exist "%BUILT%" (
  echo Expected installer not found: %BUILT%
  echo Check electron-builder output under release\
  exit /b 1
)

copy /Y "%BUILT%" "%STABLE%" >nul
echo Stable installer: %STABLE%
echo.

set "ZIP_WIN=release\BofBot-Setup-Windows.zip"
powershell -NoProfile -Command "Compress-Archive -Path '%STABLE%' -DestinationPath '%ZIP_WIN%' -Force"
if errorlevel 1 (
  echo Failed to create %ZIP_WIN%
  exit /b 1
)
if not exist "%ZIP_WIN%" (
  echo Expected zip not found: %ZIP_WIN%
  exit /b 1
)
echo Created %ZIP_WIN%
echo.

set "LATEST_YML=release\latest.yml"
if not exist "%LATEST_YML%" (
  echo Missing %LATEST_YML% ^(electron-builder should emit this^).
  exit /b 1
)
node scripts\patch-latest-yml-stable.cjs %NEW_VER%
if errorlevel 1 exit /b 1
echo Patched latest.yml for stable exe name
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo GitHub CLI ^(gh^) not found. Install: https://cli.github.com/
  echo Installer is ready at %STABLE%
  exit /b 1
)

gh release create "v%NEW_VER%" "%STABLE%" "%ZIP_WIN%" "%LATEST_YML%" --title "BofBot %NEW_VER%" --generate-notes
if errorlevel 1 (
  echo gh release create failed.
  exit /b 1
)

echo.
echo Done. Release includes BofBot-Setup.exe + BofBot-Setup-Windows.zip + latest.yml ^(auto-update + website^).
echo.
echo Mac: run the GitHub Action "Build Mac DMG" ^(.github/workflows/build-mac.yml^) to produce
echo       BofBot-Setup.dmg + BofBot-Setup.zip + latest-mac.yml. Upload DMG, ZIP, and yml to this
echo       release ^(ZIP is required for Mac auto-update; DMG is for first-time installs^).
echo       For stable URLs in latest-mac.yml: node scripts/patch-latest-mac-yml-stable.cjs %NEW_VER%
echo       then upload the patched yml plus BofBot-Setup.dmg and BofBot-Setup.zip.
echo.
echo Commit the bump: git add package.json ^&^& git commit -m "desktop v%NEW_VER%" ^&^& git push
echo.
endlocal

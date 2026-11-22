@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo [DesktopBoard] Building single-file DesktopBoard.exe
echo ========================================================

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment .venv not found!
    exit /b 1
)

echo [1/3] Generating default tray icon (icon.ico)...
".venv\Scripts\python.exe" -c "import tray; tray.create_or_load_tray_icon()"

echo [2/3] Running PyInstaller (--noconsole --onefile --collect-submodules webview)...
".venv\Scripts\pyinstaller.exe" --noconfirm --clean DesktopBoard.spec

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed!
    exit /b 1
)

echo [3/3] Verifying output...
if exist "dist\DesktopBoard.exe" (
    echo [SUCCESS] Built: %~dp0dist\DesktopBoard.exe
) else (
    echo [ERROR] dist\DesktopBoard.exe not found!
    exit /b 1
)

endlocal

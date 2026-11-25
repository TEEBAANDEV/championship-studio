@echo off
title Championship Studio
cd /d "%~dp0"
taskkill /F /IM championship-studio.exe >nul 2>&1
if exist "src-tauri\target\release\championship-studio.exe" (
    start "" "%~dp0src-tauri\target\release\championship-studio.exe"
) else (
    npm start
)

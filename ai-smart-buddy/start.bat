@echo off
echo.
echo ========================================
echo   AI Smart Buddy - Quill
echo ========================================
echo.

cd /d "%~dp0"

echo Starting server...
echo.
echo Access the app at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js

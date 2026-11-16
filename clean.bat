@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en el PATH.
  pause
  exit /b 1
)

node scripts/clean.mjs %*
set "EXIT_CODE=%ERRORLEVEL%"

if /i "%~1"=="--force" exit /b %EXIT_CODE%

echo.
pause
exit /b %EXIT_CODE%

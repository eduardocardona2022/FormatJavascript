@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo  FormatJavascript - Inicio de la aplicacion
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en el PATH.
  echo Instala Node.js 22.12 o superior desde https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm no esta disponible en el PATH.
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error('Se requiere Node.js 22.12 o superior. Version actual: ' + process.versions.node); process.exit(1); }"
if errorlevel 1 (
  pause
  exit /b 1
)

echo Instalando o verificando dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo [ERROR] No se pudieron instalar las dependencias.
  pause
  exit /b 1
)

if /i "%~1"=="--prod" goto prod

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3000,5173 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo [ERROR] Los puertos 3000 o 5173 ya estan en uso.
  echo Ejecuta clean.bat para detener una instancia anterior o cierra el proceso que los ocupa.
  pause
  exit /b 1
)

echo.
echo Iniciando API y frontend en una nueva ventana...
start "FormatJavascript Dev" cmd /k "npm run dev"

echo Esperando a que la aplicacion responda...
node scripts/wait-ready.mjs --dev
if errorlevel 1 (
  echo.
  echo [ERROR] La aplicacion no respondio. Revisa la ventana "FormatJavascript Dev".
  pause
  exit /b 1
)

echo.
echo Listo. La aplicacion se abrio en el navegador.
exit /b 0

:prod
echo.
echo Generando build de produccion...
call npm run build
if errorlevel 1 (
  echo [ERROR] El build de produccion fallo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo [ERROR] El puerto 3000 ya esta en uso.
  echo Ejecuta clean.bat para detener una instancia anterior o cierra el proceso que lo ocupa.
  pause
  exit /b 1
)

echo.
echo Iniciando servidor de produccion...
start "FormatJavascript" cmd /k "npm start"

echo Esperando a que la aplicacion responda...
node scripts/wait-ready.mjs --prod
if errorlevel 1 (
  echo.
  echo [ERROR] La aplicacion no respondio. Revisa la ventana "FormatJavascript".
  pause
  exit /b 1
)

echo.
echo Listo. La aplicacion se abrio en el navegador.
exit /b 0

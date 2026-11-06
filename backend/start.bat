@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   OficiosYa - Backend
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Descargalo desde: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias.
    pause
    exit /b 1
  )
)

echo API: http://localhost:3000/api
echo Presiona Ctrl+C para detenerlo.
echo.

call npm run dev

pause

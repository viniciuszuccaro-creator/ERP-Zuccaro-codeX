@echo off
setlocal
cd /d "%~dp0"
set "VITE_LOCAL_ONLY=true"
set "ERP_HOST=localhost"
set "ERP_PORT=5173"
set "LOCAL_NODE=C:\Users\cpaba\tools\node-v24.15.0-win-x64"

if exist "%LOCAL_NODE%\npm.cmd" (
  set "PATH=%LOCAL_NODE%;%PATH%"
  set "NPM_CMD=%LOCAL_NODE%\npm.cmd"
) else if exist "C:\Program Files\nodejs\npm.cmd" (
  set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
) else (
  set "NPM_CMD=npm.cmd"
)

echo Iniciando ERP Zuccaro em http://localhost:%ERP_PORT%/
echo Endereco alternativo: http://127.0.0.1:%ERP_PORT%/
echo Pasta: %CD%
echo.
"%NPM_CMD%" run dev -- --host %ERP_HOST% --port %ERP_PORT%
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o servidor local. Verifique se o Node.js esta instalado.
  pause
)

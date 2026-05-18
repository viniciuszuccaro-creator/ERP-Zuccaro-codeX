@echo off
cd /d "%~dp0"
echo Iniciando ERP Integra local...
echo.
echo URL: http://localhost:5173/
echo Para fechar o servidor, feche esta janela.
echo.
".\node_modules\.bin\vite.cmd" --host 0.0.0.0 --port 5173

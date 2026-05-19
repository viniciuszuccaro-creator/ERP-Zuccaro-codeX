@echo off
cd /d "%~dp0"
set "PATH=C:\Users\cpaba\tools\node-v24.15.0-win-x64;%PATH%"
set "VITE_LOCAL_ONLY=true"
"C:\Users\cpaba\tools\node-v24.15.0-win-x64\npm.cmd" run dev -- --host 127.0.0.1
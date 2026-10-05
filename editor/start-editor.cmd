@echo off
cd /d "%~dp0.."
if not exist node_modules (
  call npm install --cache "%TEMP%\paper-reading-log-npm" --registry https://registry.npmjs.org
  if errorlevel 1 exit /b 1
)
start "" http://127.0.0.1:4317
call npm start

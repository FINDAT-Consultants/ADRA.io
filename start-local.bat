@echo off
setlocal
cd /d "%~dp0"
if not exist .env (
  copy /Y .env.example .env >nul
  echo Created .env from .env.example.
  echo Edit .env and set a fresh OPENAI_API_KEY, then run this file again.
  pause
  exit /b 1
)
set "OPENAI_KEY="
for /f "tokens=1,* delims==" %%A in ('findstr /B /C:"OPENAI_API_KEY=" .env') do set "OPENAI_KEY=%%B"
if "%OPENAI_KEY%"=="" (
  echo OPENAI_API_KEY is empty in .env. Add a fresh server-side project key first.
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
npm start

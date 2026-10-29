@echo off
title CaseLedger Launcher
color 0A
cd /d "%~dp0"

echo =====================================================
echo   CaseLedger - Blockchain Case Management System
echo =====================================================
echo.
echo  This will open 3 windows:
echo    [1] Hardhat blockchain node
echo    [2] Contract deploy + seed (auto-closes)
echo    [3] Web app  ^>  http://localhost:5173
echo.
echo  Starting in 3 seconds...
echo.
timeout /t 3 /nobreak >nul

:: ── Window 1: Start Hardhat node in a new window ──────────────────────
echo [1/3] Starting Hardhat blockchain node...
start "Blockchain Node - KEEP OPEN" cmd /k "cd /d %~dp0 && npx hardhat node"

:: ── Wait for node to be ready (10 seconds) ────────────────────────────
echo       Waiting 10 seconds for node to start...
timeout /t 10 /nobreak >nul

:: ── Window 2: Deploy + seed (runs and closes) ─────────────────────────
echo [2/3] Deploying contract and seeding demo data...
start "Deploying..." cmd /c "cd /d %~dp0 && npx hardhat run scripts/deploy.ts --network localhost && npx hardhat run scripts/seed.ts --network localhost && echo. && echo SUCCESS - Contract deployed and seeded! && timeout /t 5 /nobreak >nul"

:: ── Wait for deploy + seed to finish (20 seconds) ─────────────────────
echo       Waiting 20 seconds for deployment to finish...
timeout /t 20 /nobreak >nul

:: ── Window 3: Start frontend ──────────────────────────────────────────
echo [3/3] Starting web application...
start "Web App - KEEP OPEN" cmd /k "cd /d %~dp0frontend && npm run dev"

:: ── Done ──────────────────────────────────────────────────────────────
echo.
echo =====================================================
echo   All done! Open your browser:
echo   http://localhost:5173
echo.
echo   MetaMask settings:
echo   RPC URL  : http://127.0.0.1:8545
echo   Chain ID : 31337
echo =====================================================
echo.
echo  You can close THIS window now.
echo  Keep the Blockchain Node and Web App windows open.
echo.
pause

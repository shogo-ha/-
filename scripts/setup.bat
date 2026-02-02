@echo off
echo ================================
echo SurveyApp Setup
echo ================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node -v
echo.

echo Installing packages...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Package installation failed
    pause
    exit /b 1
)

echo.
echo ================================
echo Setup completed!
echo ================================
echo.
echo Commands:
echo   npm start       ... Run in dev mode
echo   npm run build   ... Create exe file
echo.
pause

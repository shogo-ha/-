@echo off
echo ================================
echo SurveyApp Build
echo ================================
echo.

echo Building exe file...
call npm run build

if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo.
echo ================================
echo Build completed!
echo ================================
echo.
echo Output: dist/SurveyApp.exe
echo.
pause

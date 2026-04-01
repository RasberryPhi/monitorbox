@echo off
echo ╔══════════════════════════════════════╗
echo ║        BOX-MONITOR starten           ║
echo ╚══════════════════════════════════════╝
echo.

:: Python prüfen
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python nicht gefunden!
    echo    Bitte von https://python.org/downloads installieren
    echo    Wichtig: "Add python.exe to PATH" ankreuzen!
    pause
    exit /b 1
)

:: Abhängigkeiten installieren
echo 📦 Installiere Abhängigkeiten...
python -m pip install -r backend\requirements.txt -q

:: Modell prüfen
if not exist "backend\models\best.pt" (
    echo ❌ backend\models\best.pt nicht gefunden!
    echo    Bitte best.pt in backend\models\ ablegen.
    pause
    exit /b 1
)

:: Backend starten
echo.
echo 🚀 Starte Box-Monitor...
echo    Stoppen: Strg+C
echo.
python backend\inference.py --model backend\models\best.pt
pause

@echo off
REM Build script para gerar o executável do Backend Controller
REM Execute este arquivo dentro da pasta controller_app

REM Ative sua venv antes, se desejar:
REM call ..\backend\venv\Scripts\activate

pip install --upgrade pip
pip install psutil pyinstaller

pyinstaller --clean --onefile --noconsole --name BackendController backend_controller.py

echo.
echo Build finalizado. O executavel esta em: .\dist\BackendController.exe
pause

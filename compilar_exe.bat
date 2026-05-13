@echo off
echo ==========================================
echo   AIRpipe DRAW - Generador de Ejecutable
echo ==========================================
echo.

echo [1/3] Asegurando que el programa este cerrado...
:: Intentamos cerrar cualquier instancia previa para evitar errores de "Acceso denegado"
taskkill /f /im AIRpipe_DRAW.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Actualizando herramientas de Python...
python -m pip install --upgrade pip
python -m pip install pyinstaller

echo.
echo [3/3] Compilando aplicacion...
echo (Esto tardara un poco, no cierres esta ventana)
echo.

:: Usamos --noconfirm para que no pida confirmacion al borrar carpetas
python -m PyInstaller --noconsole ^
 --onedir ^
 --noconfirm ^
 --name "AIRpipe_DRAW" ^
 --workpath "desktop_build" ^
 --distpath "desktop_dist" ^
 --add-data "index.html;." ^
 --add-data "logo_airpipe.png;." ^
 --add-data "js;js" ^
 --add-data "core;core" ^
 --add-data "generators;generators" ^
 --add-data "routers;routers" ^
 --add-data "models.py;." ^
 --add-data "extensions.py;." ^
 --add-data "schemas.py;." ^
 --add-data "server_uploads;server_uploads" ^
 desktop_app.py

echo.
echo ==========================================
echo   PROCESO FINALIZADO
echo ==========================================
if exist desktop_dist\AIRpipe_DRAW\AIRpipe_DRAW.exe (
    echo.
    echo EXITO: El ejecutable se encuentra en: 
    echo desktop_dist\AIRpipe_DRAW\AIRpipe_DRAW.exe
) else (
    echo.
    echo ERROR: No se pudo generar el .exe. 
    echo Asegurate de que ningun proceso de AIRpipe este abierto.
)
echo.
pause

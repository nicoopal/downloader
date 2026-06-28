@echo off
title Pal's Downloader - YouTube (no cerrar esta ventana)
cd /d "%~dp0"

:loop
"%~dp0venv\Scripts\python.exe" run.py
echo.
echo ---------------------------------------------
echo  El servicio de YouTube se detuvo o se cayo.
echo  Reiniciando en 5 segundos...
echo  (cerra esta ventana para apagarlo del todo)
echo ---------------------------------------------
timeout /t 5 >nul
goto loop

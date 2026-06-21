@echo off
title Pal's Downloader - YouTube (no cerrar esta ventana)
cd /d "%~dp0"
"%~dp0venv\Scripts\python.exe" run.py
echo.
echo ---------------------------------------------
echo  El servicio de YouTube se detuvo.
echo  Podes cerrar esta ventana.
echo ---------------------------------------------
pause

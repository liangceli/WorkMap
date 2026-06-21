@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-workmap-agent.ps1"
if errorlevel 1 pause

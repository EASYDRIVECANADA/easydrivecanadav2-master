@echo off
setlocal

set "INSTALLER_URL=https://easydrivecanada.com/downloads/facebook-assistant/install.ps1"
set "INSTALLER_PATH=%TEMP%\easy-drive-facebook-assistant-install.ps1"

echo EasyDrive Facebook Assistant installer
echo.
echo Downloading installer from:
echo %INSTALLER_URL%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit -Command "try { Invoke-WebRequest -Uri '%INSTALLER_URL%' -OutFile '%INSTALLER_PATH%'; & '%INSTALLER_PATH%' } catch { Write-Host ''; Write-Host 'Install failed:' -ForegroundColor Red; Write-Host $_ -ForegroundColor Red }"

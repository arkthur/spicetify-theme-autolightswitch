@echo off
rem Builds SystemThemeWatcher.exe, starts it and registers it to run at login (current user only, no admin).
rem
rem   install.bat [xpui-folder]    xpui-folder defaults to the one from "spicetify -c"
rem   install.bat /uninstall

setlocal EnableExtensions
set "INSTALL_DIR=%LOCALAPPDATA%\AutoLightSwitch"
set "EXE=%INSTALL_DIR%\SystemThemeWatcher.exe"
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AutoLightSwitch Watcher.lnk"
set "ALSW_UNINSTALL="
set "XPUI="

if /i "%~1"=="/uninstall" set "ALSW_UNINSTALL=1"
if /i "%~1"=="/uninstall" shift
if not "%~1"=="" set "XPUI=%~1"

if not defined XPUI for /f "delims=" %%c in ('spicetify -c 2^>nul') do set "SPICETIFY_CONFIG=%%c"
if not defined XPUI if defined SPICETIFY_CONFIG for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"spotify_path" "%SPICETIFY_CONFIG%"') do set "SPOTIFY_PATH=%%b"
if not defined XPUI if defined SPOTIFY_PATH for /f "tokens=*" %%p in ("%SPOTIFY_PATH%") do set "XPUI=%%p\Apps\xpui"
if not defined XPUI set "XPUI=%APPDATA%\Spotify\Apps\xpui"

taskkill /f /im SystemThemeWatcher.exe >nul 2>&1

if defined ALSW_UNINSTALL del /q "%SHORTCUT%" 2>nul
if defined ALSW_UNINSTALL del /q "%XPUI%\system-theme.txt" 2>nul
if defined ALSW_UNINSTALL rd /s /q "%INSTALL_DIR%" 2>nul
if defined ALSW_UNINSTALL echo AutoLightSwitch watcher removed.
if defined ALSW_UNINSTALL exit /b 0

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" echo .NET Framework compiler not found: %CSC%& exit /b 1

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
"%CSC%" /nologo /target:winexe /optimize /out:"%EXE%" "%~dp0SystemThemeWatcher.cs"
if errorlevel 1 echo Build failed.& exit /b 1

set "ALSW_EXE=%EXE%"
set "ALSW_ARGS="%XPUI%\system-theme.txt""
set "ALSW_SHORTCUT=%SHORTCUT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:ALSW_SHORTCUT); $s.TargetPath = $env:ALSW_EXE; $s.Arguments = $env:ALSW_ARGS; $s.WindowStyle = 7; $s.Save()"
if errorlevel 1 echo Could not create the startup shortcut.& exit /b 1

start "" "%EXE%" "%XPUI%\system-theme.txt"
echo AutoLightSwitch watcher installed. It writes the Windows theme to:
echo   %XPUI%\system-theme.txt
echo It starts at login. Remove it with uninstall.bat.
exit /b 0

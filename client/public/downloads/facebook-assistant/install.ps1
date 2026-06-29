param(
  [string]$BaseUrl = "https://easydrivecanada.com",
  [string]$TaskName = "EasyDrive Facebook Assistant",
  [int]$Port = 4777,
  [string]$Browser = "msedge",
  [string]$ProfileDir = ".facebook-assist-profile"
)

$ErrorActionPreference = "Stop"

$AssistantDir = Join-Path $env:LOCALAPPDATA "EasyDrive\FacebookAssistant"
$LogDir = Join-Path $AssistantDir "logs"
$RunnerPath = Join-Path $AssistantDir "facebook-marketplace-assist-runner.mjs"
$PackagePath = Join-Path $AssistantDir "package.json"
$LauncherPath = Join-Path $AssistantDir "start-facebook-assistant.ps1"
$LogFile = Join-Path $LogDir "facebook-assistant.log"
$DownloadRoot = $BaseUrl.TrimEnd("/") + "/downloads/facebook-assistant"
$StartupShortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\EasyDrive Facebook Assistant.cmd"

function Stop-FacebookAssistantOnPort {
  param([int]$Port)

  $Pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $ProcessIds = @(netstat -ano | ForEach-Object {
    if ($_ -match $Pattern) {
      [int]$Matches[1]
    }
  } | Select-Object -Unique)

  foreach ($ProcessId in $ProcessIds) {
    try {
      $Process = Get-Process -Id $ProcessId -ErrorAction Stop
      if ($Process.ProcessName -in @("node", "powershell", "pwsh")) {
        Stop-Process -Id $ProcessId -Force -ErrorAction Stop
        Write-Host "Stopped existing Facebook assistant process on port $Port."
      } else {
        Write-Warning "Port $Port is already used by $($Process.ProcessName). Close that app before using the assistant."
      }
    } catch {
      Write-Warning "Could not stop existing process on port $Port. $($_.Exception.Message)"
    }
  }
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (!$NodeCommand) {
  throw "Node.js is required. Install Node.js from https://nodejs.org, then run this installer again."
}

$NpmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (!$NpmCommand) {
  throw "npm is required. Install Node.js from https://nodejs.org, then run this installer again."
}

New-Item -ItemType Directory -Force -Path $AssistantDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Invoke-WebRequest -Uri "$DownloadRoot/facebook-marketplace-assist-runner.mjs" -OutFile $RunnerPath
Invoke-WebRequest -Uri "$DownloadRoot/package.json" -OutFile $PackagePath

Push-Location $AssistantDir
try {
  npm install --omit=dev
} finally {
  Pop-Location
}

$LauncherContent = @"
Set-Location -LiteralPath '$AssistantDir'
node '$RunnerPath' --port $Port --browser '$Browser' --profile-dir '$ProfileDir' *> '$LogFile'
"@
Set-Content -LiteralPath $LauncherPath -Value $LauncherContent -Encoding UTF8

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StartupShortcutPath) | Out-Null
Set-Content -LiteralPath $StartupShortcutPath -Encoding ASCII -Value "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPath`"`r`n"
Stop-FacebookAssistantOnPort -Port $Port
Start-Process powershell.exe -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $LauncherPath)

Write-Host "Installed $TaskName."
Write-Host "The Facebook assistant will start automatically when this Windows user logs in."
Write-Host "Health check: http://127.0.0.1:$Port/health"
Write-Host "Install folder: $AssistantDir"
Write-Host "Logs: $LogFile"
Write-Host "Startup shortcut: $StartupShortcutPath"

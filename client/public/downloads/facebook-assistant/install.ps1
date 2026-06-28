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

$Action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$LauncherPath`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 12)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Starts the EasyDrive Facebook Marketplace assistant when this Windows user logs in." `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host "Installed $TaskName."
Write-Host "The Facebook assistant will start automatically when this Windows user logs in."
Write-Host "Health check: http://127.0.0.1:$Port/health"
Write-Host "Install folder: $AssistantDir"
Write-Host "Logs: $LogFile"

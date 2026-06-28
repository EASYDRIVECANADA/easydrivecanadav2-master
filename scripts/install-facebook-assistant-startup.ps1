param(
  [string]$TaskName = "EasyDrive Facebook Assistant",
  [int]$Port = 4777,
  [string]$Browser = "msedge",
  [string]$ProfileDir = ".facebook-assist-profile"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$RunnerPath = Join-Path $RepoRoot "scripts\facebook-marketplace-assist-runner.mjs"
$AssistantDir = Join-Path $env:LOCALAPPDATA "EasyDrive\FacebookAssistant"
$LogDir = Join-Path $AssistantDir "logs"
$LogFile = Join-Path $LogDir "facebook-assistant.log"
$LauncherPath = Join-Path $AssistantDir "start-facebook-assistant.ps1"

if (!(Test-Path $RunnerPath)) {
  throw "Could not find runner script at $RunnerPath"
}

$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (!$NodeCommand) {
  throw "Node.js is required. Install Node.js, then run this installer again."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$LauncherContent = @"
Set-Location -LiteralPath '$RepoRoot'
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
Write-Host "Logs: $LogFile"
Write-Host "Launcher: $LauncherPath"

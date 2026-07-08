# kibritci-erp — Gunluk Firestore yedek (Windows Gorev Zamanlayicisi)
# Yonetici PowerShell'de bir kez calistirin:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\scripts\register-daily-backup-task.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Error "node bulunamadi. Node.js kurulu olmali."
}

$TaskName = "KibritciERP-FirestoreBackup"
$Action = New-ScheduledTaskAction -Execute $Node -Argument "scripts\firestore-backup-local.mjs" -WorkingDirectory $Root
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force

Write-Host "Gorev kaydedildi: $TaskName (her gun 02:00)"
Write-Host "Manuel test: cd $Root ; npm run backup:firestore"

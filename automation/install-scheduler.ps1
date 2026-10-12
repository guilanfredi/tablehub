<#
.SYNOPSIS
  Registra o despachante no Agendador de Tarefas do Windows (a cada N minutos, só com o usuário logado).
  Para remover: automation\uninstall-scheduler.ps1
#>
param([int]$EveryMinutes = 5)

$ErrorActionPreference = 'Stop'
$TaskName = 'TableHub Agentes'
$script = Join-Path $PSScriptRoot 'dispatcher.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 3) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Despachante do time de agentes do TableHub (automation/dispatcher.ps1).' -Force | Out-Null

Write-Host "Tarefa '$TaskName' registrada: roda a cada $EveryMinutes min enquanto você estiver logado."
Write-Host "Logs: $(Join-Path $PSScriptRoot 'logs')"

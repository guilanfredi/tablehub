<#
.SYNOPSIS
  Registra o despachante contínuo no Agendador de Tarefas do Windows: inicia no logon, fica rodando
  e é reiniciado se cair. Substitui a tarefa antiga (a cada 5 min) de mesmo nome.
  Para remover: automation\uninstall-scheduler.ps1
#>
$ErrorActionPreference = 'Stop'
$TaskName = 'TableHub Agentes'
$script = Join-Path $PSScriptRoot 'dispatcher\index.mjs'
$node = (Get-Command node -ErrorAction Stop).Source

# para a versão anterior (tarefa antiga ou despachante já rodando) antes de registrar
& (Join-Path $PSScriptRoot 'uninstall-scheduler.ps1') -Quiet

# janela oculta: o node herda o console escondido do PowerShell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory (Split-Path $PSScriptRoot -Parent) `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"& '$node' '$script'; exit `$LASTEXITCODE`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Despachante contínuo do time de agentes do TableHub (automation/dispatcher).' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Tarefa '$TaskName' registrada e iniciada: roda continuamente enquanto você estiver logado."
Write-Host "Logs: $(Join-Path $PSScriptRoot 'logs\dispatcher.log')"

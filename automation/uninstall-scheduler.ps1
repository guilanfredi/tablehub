<#
.SYNOPSIS
  Para e remove o despachante do Agendador de Tarefas. Execuções em andamento continuam até terminar;
  no próximo início, o despachante retoma o acompanhamento delas.
#>
param([switch]$Quiet)
$TaskName = 'TableHub Agentes'
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# o Agendador encerra o PowerShell, mas o node pode sobreviver: encerra pelo PID registrado
$daemonFile = Join-Path $PSScriptRoot 'state\daemon.json'
if (Test-Path $daemonFile) {
  $daemon = Get-Content $daemonFile -Raw | ConvertFrom-Json
  $proc = Get-Process -Id $daemon.pid -ErrorAction SilentlyContinue
  if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $daemon.pid -Force }
  Remove-Item $daemonFile -Force -ErrorAction SilentlyContinue
}
if (-not $Quiet) { Write-Host "Tarefa '$TaskName' removida e despachante parado." }

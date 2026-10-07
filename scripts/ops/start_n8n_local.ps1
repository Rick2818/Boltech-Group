$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$env:N8N_USER_FOLDER = Join-Path $taskWorkspace 'scratch\commercial-scale\n8n-runtime'
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_HOST = 'localhost'
$env:N8N_PORT = '5678'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_SECURE_COOKIE = 'false'
$env:GENERIC_TIMEZONE = 'America/El_Salvador'
$taskNode = 'C:\Users\Ricardo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$taskN8n = 'C:\Users\Ricardo\AppData\Roaming\npm\node_modules\n8n\bin\n8n'
if (-not (Test-Path -LiteralPath $taskNode) -or -not (Test-Path -LiteralPath $taskN8n)) { throw 'N8N_RUNTIME_MISSING' }
if (Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue) { Write-Output 'n8n ya escucha en el puerto 5678; verificar http://localhost:5678/healthz.'; exit }
Start-Process -FilePath $taskNode -ArgumentList $taskN8n,'start' -WindowStyle Hidden -WorkingDirectory $taskWorkspace -RedirectStandardOutput (Join-Path $env:N8N_USER_FOLDER 'stdout.log') -RedirectStandardError (Join-Path $env:N8N_USER_FOLDER 'stderr.log') | Out-Null
Write-Output 'Inicio solicitado. Verificar healthz y el webhook antes de considerar n8n operativo.'

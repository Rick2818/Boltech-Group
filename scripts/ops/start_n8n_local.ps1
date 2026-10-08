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
try {
  $taskHealth = Invoke-WebRequest -Uri 'http://127.0.0.1:5678/healthz' -UseBasicParsing -TimeoutSec 5
  if ($taskHealth.StatusCode -eq 200) { Write-Output 'n8n ya responde en healthz; no se inicia otra instancia.'; exit 0 }
} catch { }
$taskPort = New-Object System.Net.Sockets.TcpClient
try { $taskPort.Connect('127.0.0.1',5678); throw 'N8N_PORT_OCCUPIED_WITHOUT_HEALTH_CONFIRMATION' }
catch { if ($_.Exception.Message -eq 'N8N_PORT_OCCUPIED_WITHOUT_HEALTH_CONFIRMATION') { throw } }
finally { $taskPort.Dispose() }
New-Item -ItemType Directory -Path $env:N8N_USER_FOLDER -Force | Out-Null
Start-Process -FilePath $taskNode -ArgumentList $taskN8n,'start' -WindowStyle Hidden -WorkingDirectory $taskWorkspace -RedirectStandardOutput (Join-Path $env:N8N_USER_FOLDER 'stdout.log') -RedirectStandardError (Join-Path $env:N8N_USER_FOLDER 'stderr.log') | Out-Null
Write-Output 'Inicio solicitado en segundo plano con los datos existentes. Verificar healthz y el webhook antes de considerar n8n operativo.'

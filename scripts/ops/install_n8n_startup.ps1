$ErrorActionPreference = 'Stop'
$taskWorkspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$taskLauncher = Join-Path $taskWorkspace 'scripts\ops\start_n8n_local.ps1'
$taskPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskStartup = [Environment]::GetFolderPath('Startup')
if (-not $taskStartup -or -not (Test-Path -LiteralPath $taskLauncher) -or -not (Test-Path -LiteralPath $taskPowerShell)) { throw 'STARTUP_TARGET_MISSING' }
$taskShortcutPath = Join-Path $taskStartup 'Boltech n8n.lnk'
$taskShell = New-Object -ComObject WScript.Shell
$taskShortcut = $taskShell.CreateShortcut($taskShortcutPath)
$taskShortcut.TargetPath = $taskPowerShell
$taskShortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $taskLauncher + '"'
$taskShortcut.WorkingDirectory = $taskWorkspace
$taskShortcut.WindowStyle = 7
$taskShortcut.Description = 'Iniciar n8n Boltech al ingresar a la sesion de Ricardo, con su base existente.'
$taskShortcut.Save()
$taskVerified = $taskShell.CreateShortcut($taskShortcutPath)
if ($taskVerified.TargetPath -ne $taskPowerShell -or $taskVerified.Arguments -notlike ('*' + $taskLauncher + '*') -or -not (Test-Path -LiteralPath $taskShortcutPath)) { throw 'STARTUP_LINK_UNVERIFIED' }
@{ installed=$true; trigger='RICARDO_WINDOWS_SIGN_IN'; shortcut=$taskShortcutPath; launcher=$taskLauncher; hidden=$true; restartPerformed=$false } | ConvertTo-Json -Compress

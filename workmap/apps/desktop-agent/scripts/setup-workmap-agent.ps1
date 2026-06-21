param(
  [string]$Code,
  [string]$ApiUrl = "https://workmap-api.onrender.com"
)

$ErrorActionPreference = "Stop"
if (-not $Code) {
  $Code = Read-Host "Enter the one-time WorkMap Desktop Agent code"
}
$Code = $Code.Trim().ToUpperInvariant()
if ($Code -notmatch '^[A-Z2-9]{4}-[A-Z2-9]{4}$') {
  throw "The pairing code must look like ABCD-2345."
}
if ($ApiUrl -notmatch '^https://') {
  throw "The WorkMap API URL must use HTTPS."
}

$runner = Join-Path $PSScriptRoot "run-workmap-agent.cmd"
$installer = Join-Path $PSScriptRoot "install-workmap-agent.ps1"
& $runner pair --code $Code --api $ApiUrl
if ($LASTEXITCODE -ne 0) {
  throw "Pairing failed. Generate a new code in WorkMap and try again."
}

& $installer -StartNow
Write-Output "Setup complete. WorkMap Desktop Agent will start automatically at each Windows sign-in."

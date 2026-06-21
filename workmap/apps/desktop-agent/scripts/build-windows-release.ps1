param(
  [string]$NodeExecutable = (Get-Command node).Source
)

$ErrorActionPreference = "Stop"
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repoRoot = (Resolve-Path (Join-Path $packageRoot "..\..")).Path
$release = Join-Path $repoRoot "artifacts"
if (-not (Test-Path -LiteralPath $NodeExecutable)) {
  throw "Node runtime was not found."
}

$temporaryRoot = Join-Path $env:TEMP "WorkMapDesktopAgentRelease-$PID"
$temporaryDist = Join-Path $temporaryRoot "dist"
$staging = Join-Path $temporaryRoot "WorkMap Desktop Agent"
$runtime = Join-Path $staging "runtime"
try {
  New-Item -ItemType Directory -Path $temporaryDist -Force | Out-Null
  Push-Location $packageRoot
  try {
    & pnpm exec tsc --project tsconfig.json --outDir $temporaryDist
    if ($LASTEXITCODE -ne 0) { throw "Desktop Agent TypeScript compilation failed." }
  } finally {
    Pop-Location
  }

  New-Item -ItemType Directory -Path (Join-Path $staging "dist") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $staging "scripts") -Force | Out-Null
  New-Item -ItemType Directory -Path $runtime -Force | Out-Null
  Copy-Item -Path (Join-Path $temporaryDist "*") -Destination (Join-Path $staging "dist") -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "windows-foreground.ps1") -Destination (Join-Path $staging "scripts\windows-foreground.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "credential-protection.ps1") -Destination (Join-Path $staging "scripts\credential-protection.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "install-workmap-agent.ps1") -Destination (Join-Path $staging "install-workmap-agent.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "uninstall-workmap-agent.ps1") -Destination (Join-Path $staging "uninstall-workmap-agent.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "setup-workmap-agent.ps1") -Destination (Join-Path $staging "setup-workmap-agent.ps1") -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "setup-workmap-agent.cmd") -Destination (Join-Path $staging "setup-workmap-agent.cmd") -Force
  Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $runtime "node.exe") -Force

  $runner = @'
@echo off
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0dist\index.js" %*
'@
  Set-Content -LiteralPath (Join-Path $staging "run-workmap-agent.cmd") -Value $runner -Encoding ASCII
  Set-Content -LiteralPath (Join-Path $staging "package.json") -Value '{"name":"workmap-desktop-agent-windows","private":true,"type":"module"}' -Encoding ASCII

  New-Item -ItemType Directory -Path $release -Force | Out-Null
  $archive = Join-Path $release "WorkMap-Desktop-Agent-Windows-x64.zip"
  Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
  Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -CompressionLevel Optimal
  Write-Output "Windows release created: $archive"
} finally {
  Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}

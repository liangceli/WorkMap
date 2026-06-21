param(
  [switch]$StartNow
)

$ErrorActionPreference = "Stop"
$bundledNode = Join-Path $PSScriptRoot "runtime\node.exe"
if (-not (Test-Path -LiteralPath $bundledNode)) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "This development package has no bundled runtime. Use the WorkMap Windows release package or install Node.js 22+."
  }
  $nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
  if ($nodeMajor -lt 22) {
    throw "WorkMap Desktop Agent requires Node.js 22 or newer."
  }
}

$source = (Resolve-Path $PSScriptRoot).Path
$target = Join-Path $env:LOCALAPPDATA "Programs\WorkMap Desktop Agent"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$launcher = Join-Path $target "start-workmap-agent.ps1"

if ($source -ne $target) {
  $programsRoot = (Resolve-Path (Join-Path $env:LOCALAPPDATA "Programs")).Path
  $resolvedTarget = Resolve-Path $target -ErrorAction SilentlyContinue
  if ($resolvedTarget -and $resolvedTarget.Path.StartsWith($programsRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedTarget.Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  Copy-Item -Path (Join-Path $source "*") -Destination $target -Recurse -Force
}

$launcherContent = @'
$agent = Join-Path $PSScriptRoot "run-workmap-agent.cmd"
Start-Process -FilePath $agent -ArgumentList "run" -WindowStyle Hidden
'@
Set-Content -LiteralPath $launcher -Value $launcherContent -Encoding UTF8

$runCommand = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`""
New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name "WorkMapDesktopAgent" -Value $runCommand -PropertyType String -Force | Out-Null

Write-Output "WorkMap Desktop Agent installed for the current Windows user."
Write-Output "Install path: $target"
Write-Output "The agent will start automatically at the next sign-in."

if ($StartNow) {
  & $launcher
  Write-Output "WorkMap Desktop Agent started."
}

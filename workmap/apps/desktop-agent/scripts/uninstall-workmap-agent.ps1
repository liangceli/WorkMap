param(
  [switch]$RemoveLocalData
)

$ErrorActionPreference = "Stop"
$target = Join-Path $env:LOCALAPPDATA "Programs\WorkMap Desktop Agent"
$data = Join-Path $env:LOCALAPPDATA "WorkMap\DesktopAgent"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

Remove-ItemProperty -Path $runKey -Name "WorkMapDesktopAgent" -ErrorAction SilentlyContinue

$resolvedTarget = Resolve-Path $target -ErrorAction SilentlyContinue
$allowedRoot = (Resolve-Path (Join-Path $env:LOCALAPPDATA "Programs")).Path
if ($resolvedTarget -and $resolvedTarget.Path.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  Remove-Item -LiteralPath $resolvedTarget.Path -Recurse -Force
}

if ($RemoveLocalData) {
  $resolvedData = Resolve-Path $data -ErrorAction SilentlyContinue
  $localRoot = (Resolve-Path $env:LOCALAPPDATA).Path
  if ($resolvedData -and $resolvedData.Path.StartsWith($localRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $resolvedData.Path -Recurse -Force
  }
}

Write-Output "WorkMap Desktop Agent auto-start and installed files were removed."
if (-not $RemoveLocalData) {
  Write-Output "Paired credentials and queued data were retained. Use -RemoveLocalData to remove them."
}

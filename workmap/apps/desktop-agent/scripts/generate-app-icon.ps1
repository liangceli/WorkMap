$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildDirectory = Join-Path $packageRoot "build"
$iconPath = Join-Path $buildDirectory "icon.png"
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null

$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 52, 79))
$graphics.FillRectangle($background, 0, 0, 256, 256)
$font = New-Object System.Drawing.Font "Segoe UI", 72, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$foreground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 253, 248))
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString("WM", $font, $foreground, (New-Object System.Drawing.RectangleF 0, 0, 256, 244), $format)

$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$format.Dispose()
$foreground.Dispose()
$font.Dispose()
$background.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated WorkMap application icon: $iconPath"

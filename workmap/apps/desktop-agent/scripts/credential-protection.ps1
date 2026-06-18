param([Parameter(Mandatory=$true)][ValidateSet('Protect','Unprotect')][string]$Mode)

Add-Type -AssemblyName System.Security
$inputValue = [Console]::In.ReadToEnd()
if ($Mode -eq 'Protect') {
  $bytes = [Text.Encoding]::UTF8.GetBytes($inputValue)
  $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Convert]::ToBase64String($protected)
} else {
  $bytes = [Convert]::FromBase64String($inputValue)
  $plain = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Text.Encoding]::UTF8.GetString($plain)
}

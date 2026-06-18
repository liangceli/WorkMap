param([int]$IdleThresholdSeconds = 300)

$source = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class WorkMapWindowsActivity {
  [StructLayout(LayoutKind.Sequential)]
  private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  [DllImport("user32.dll", SetLastError=true)] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);

  public static string ProcessName() {
    uint processId;
    var handle = GetForegroundWindow();
    if (handle == IntPtr.Zero) return null;
    GetWindowThreadProcessId(handle, out processId);
    if (processId == 0) return null;
    try { return Process.GetProcessById((int)processId).ProcessName; } catch { return null; }
  }

  public static double IdleSeconds() {
    var info = new LASTINPUTINFO();
    info.cbSize = (uint)Marshal.SizeOf(info);
    if (!GetLastInputInfo(ref info)) return 0;
    var elapsed = unchecked((uint)Environment.TickCount - info.dwTime);
    return elapsed / 1000.0;
  }

  public static bool IsLocked() {
    const uint DESKTOP_SWITCHDESKTOP = 0x0100;
    var desktop = OpenInputDesktop(0, false, DESKTOP_SWITCHDESKTOP);
    if (desktop == IntPtr.Zero) return true;
    CloseDesktop(desktop);
    return false;
  }
}
'@

Add-Type -TypeDefinition $source -ErrorAction Stop
$processName = [WorkMapWindowsActivity]::ProcessName()
$idleSeconds = [WorkMapWindowsActivity]::IdleSeconds()
$locked = [WorkMapWindowsActivity]::IsLocked() -or $processName -in @('LockApp', 'LogonUI')
[ordered]@{
  processName = $processName
  idleSeconds = $idleSeconds
  idle = $idleSeconds -ge $IdleThresholdSeconds
  locked = $locked
  observedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress

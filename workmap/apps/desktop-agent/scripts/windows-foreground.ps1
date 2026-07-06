param([int]$IdleThresholdSeconds = 300)

$source = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class WorkMapWindowsActivity {
  [StructLayout(LayoutKind.Sequential)]
  private struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }

  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hWnd, uint command);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  [DllImport("user32.dll", SetLastError=true)] private static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
  [DllImport("user32.dll")] private static extern bool CloseDesktop(IntPtr desktop);

  public static string AppName() {
    uint processId;
    var handle = GetForegroundWindow();
    if (handle == IntPtr.Zero || IsIconic(handle) || !IsWindowVisible(handle)) return null;
    GetWindowThreadProcessId(handle, out processId);
    if (processId == 0) return null;
    try {
      var process = ResolveApplicationProcess(handle, processId);
      try {
        var version = process.MainModule.FileVersionInfo;
        if (!String.IsNullOrWhiteSpace(version.ProductName)) return version.ProductName;
        if (!String.IsNullOrWhiteSpace(version.FileDescription)) return version.FileDescription;
      } catch {}
      return process.ProcessName;
    } catch { return null; }
  }

  private static Process ResolveApplicationProcess(IntPtr foregroundWindow, uint foregroundProcessId) {
    var foregroundProcess = Process.GetProcessById((int)foregroundProcessId);
    if (!String.Equals(foregroundProcess.ProcessName, "ApplicationFrameHost", StringComparison.OrdinalIgnoreCase)) {
      return foregroundProcess;
    }

    const uint GW_CHILD = 5;
    const uint GW_HWNDNEXT = 2;
    var child = GetWindow(foregroundWindow, GW_CHILD);
    while (child != IntPtr.Zero) {
      uint childProcessId;
      GetWindowThreadProcessId(child, out childProcessId);
      if (childProcessId != 0 && childProcessId != foregroundProcessId) {
        try { return Process.GetProcessById((int)childProcessId); } catch {}
      }
      child = GetWindow(child, GW_HWNDNEXT);
    }
    return foregroundProcess;
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
$appName = [WorkMapWindowsActivity]::AppName()
$idleSeconds = [WorkMapWindowsActivity]::IdleSeconds()
$locked = [WorkMapWindowsActivity]::IsLocked() -or $appName -in @('LockApp', 'LogonUI')
[ordered]@{
  appName = $appName
  idleSeconds = $idleSeconds
  idle = $idleSeconds -ge $IdleThresholdSeconds
  locked = $locked
  observedAt = [DateTime]::UtcNow.ToString('o')
} | ConvertTo-Json -Compress

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace WorkMap.WindowsActivityHost;

internal static class Program
{
    [STAThread]
    private static int Main()
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("WorkMap Windows activity host requires Windows.");
            return 2;
        }

        try
        {
            using var host = new ActivityHost();
            host.Run();
            return 0;
        }
        catch (Exception error)
        {
            SafeJsonWriter.Write(new
            {
                protocolVersion = 1,
                eventType = "health",
                monotonicMs = Native.GetTickCount64(),
                state = "ERROR",
                errorCode = "HOST_START_FAILED",
                detail = error.GetType().Name,
            });
            return 1;
        }
    }
}

internal sealed class ActivityHost : IDisposable
{
    private const uint EventSystemForeground = 0x0003;
    private const uint WineventOutOfContext = 0x0000;
    private const uint WmDestroy = 0x0002;
    private const uint WmTimer = 0x0113;
    private const uint WmPowerBroadcast = 0x0218;
    private const uint WmWtsSessionChange = 0x02B1;
    private const uint WmForegroundChanged = 0x8001;
    private const uint PbtApmSuspend = 0x0004;
    private const uint PbtApmResumeSuspend = 0x0007;
    private const uint PbtApmResumeAutomatic = 0x0012;
    private const int WtsConsoleConnect = 0x1;
    private const int WtsConsoleDisconnect = 0x2;
    private const int WtsRemoteConnect = 0x3;
    private const int WtsRemoteDisconnect = 0x4;
    private const int WtsSessionLock = 0x7;
    private const int WtsSessionUnlock = 0x8;
    private const int NotifyForThisSession = 0;
    private const uint InputPollTimer = 1;
    private const uint InputPollMs = 100;
    private const ulong InteractionPulseMinIntervalMs = 1_000;
    private const ulong ForegroundReconcileMs = 1_000;
    private const ulong DesktopReconcileMs = 1_000;
    private const ulong WtsRetryMs = 5_000;
    private const ulong MaximumTrustedInputAgeMs = 24 * 60 * 60 * 1_000;

    private readonly Native.WndProc windowProcedure;
    private readonly Native.WinEventDelegate foregroundProcedure;
    private readonly string windowClassName = $"WorkMapActivityHost-{Environment.ProcessId}";
    private IntPtr module;
    private IntPtr window;
    private IntPtr foregroundHook;
    private bool wtsRegistered;
    private bool disposed;
    private bool sessionLocked;
    private bool inputBaselineSet;
    private bool? inputDesktopAvailable;
    private uint lastInputTick;
    private ulong lastInputMonotonicMs;
    private ulong? pendingInputPulseMonotonicMs;
    private ulong lastInputPulseEmittedAtMs;
    private ulong lastForegroundReconcileMs;
    private ulong lastDesktopReconcileMs;
    private ulong lastWtsAttemptMs;
    private AppIdentity? currentApp;

    public ActivityHost()
    {
        windowProcedure = WindowProc;
        foregroundProcedure = ForegroundChanged;
    }

    public void Run()
    {
        module = Native.GetModuleHandle(null);
        RegisterWindowClass();
        window = Native.CreateWindowEx(
            0,
            windowClassName,
            "WorkMap Windows Activity Host",
            0,
            0,
            0,
            0,
            0,
            IntPtr.Zero,
            IntPtr.Zero,
            module,
            IntPtr.Zero);
        if (window == IntPtr.Zero) throw new InvalidOperationException("CreateWindowEx failed.");

        foregroundHook = Native.SetWinEventHook(
            EventSystemForeground,
            EventSystemForeground,
            IntPtr.Zero,
            foregroundProcedure,
            0,
            0,
            WineventOutOfContext);
        if (foregroundHook == IntPtr.Zero) throw new InvalidOperationException("SetWinEventHook failed.");
        if (Native.SetTimer(window, InputPollTimer, InputPollMs, IntPtr.Zero) == UIntPtr.Zero)
            throw new InvalidOperationException("SetTimer failed.");

        TryRegisterWts();
        PrimeInputBaseline();
        ReconcileForeground(true);
        ReconcileDesktop(true);
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType = "health",
            monotonicMs = Native.GetTickCount64(),
            state = "HEALTHY",
            adapterVersion = "1.0.1",
            errorCode = wtsRegistered ? "NONE" : "WTS_REGISTRATION_PENDING",
        });

        while (Native.GetMessage(out var message, IntPtr.Zero, 0, 0) > 0)
        {
            Native.TranslateMessage(ref message);
            Native.DispatchMessage(ref message);
        }
    }

    private void RegisterWindowClass()
    {
        var windowClass = new Native.WndClassEx
        {
            cbSize = (uint)Marshal.SizeOf<Native.WndClassEx>(),
            lpfnWndProc = Marshal.GetFunctionPointerForDelegate(windowProcedure),
            hInstance = module,
            lpszClassName = windowClassName,
        };
        if (Native.RegisterClassEx(ref windowClass) == 0)
            throw new InvalidOperationException("RegisterClassEx failed.");
    }

    private IntPtr WindowProc(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam)
    {
        switch (message)
        {
            case WmForegroundChanged:
                ReconcileForeground(false);
                return IntPtr.Zero;
            case WmTimer:
                Poll();
                return IntPtr.Zero;
            case WmWtsSessionChange:
                HandleSessionChange(unchecked((int)wParam.ToUInt64()));
                return IntPtr.Zero;
            case WmPowerBroadcast:
                HandlePowerBroadcast(unchecked((uint)wParam.ToUInt64()));
                return new IntPtr(1);
            case WmDestroy:
                Native.PostQuitMessage(0);
                return IntPtr.Zero;
            default:
                return Native.DefWindowProc(hwnd, message, wParam, lParam);
        }
    }

    private void ForegroundChanged(
        IntPtr hook,
        uint eventType,
        IntPtr hwnd,
        int objectId,
        int childId,
        uint eventThread,
        uint eventTime)
    {
        if (window != IntPtr.Zero) Native.PostMessage(window, WmForegroundChanged, UIntPtr.Zero, IntPtr.Zero);
    }

    private void Poll()
    {
        var now = Native.GetTickCount64();
        PollInput(now);
        if (now - lastForegroundReconcileMs >= ForegroundReconcileMs) ReconcileForeground(false);
        if (now - lastDesktopReconcileMs >= DesktopReconcileMs) ReconcileDesktop(false);
        EmitPendingInputPulse(now);
        if (!wtsRegistered && now - lastWtsAttemptMs >= WtsRetryMs) TryRegisterWts();
    }

    private void PrimeInputBaseline()
    {
        var input = new Native.LastInputInfo { cbSize = (uint)Marshal.SizeOf<Native.LastInputInfo>() };
        if (!Native.GetLastInputInfo(ref input)) return;
        lastInputTick = input.dwTime;
        lastInputMonotonicMs = MapInputTick(input.dwTime, Native.GetTickCount64()) ?? 0;
        inputBaselineSet = true;
    }

    private void PollInput(ulong now)
    {
        var input = new Native.LastInputInfo { cbSize = (uint)Marshal.SizeOf<Native.LastInputInfo>() };
        if (!Native.GetLastInputInfo(ref input)) return;
        if (!inputBaselineSet)
        {
            lastInputTick = input.dwTime;
            lastInputMonotonicMs = MapInputTick(input.dwTime, now) ?? 0;
            inputBaselineSet = true;
            return;
        }
        if (input.dwTime == lastInputTick) return;

        var mapped = MapInputTick(input.dwTime, now);
        lastInputTick = input.dwTime;
        if (mapped is null || mapped.Value <= lastInputMonotonicMs)
        {
            SafeJsonWriter.Write(new
            {
                protocolVersion = 1,
                eventType = "health",
                monotonicMs = now,
                state = "LIMITED",
                errorCode = "INPUT_CLOCK_UNTRUSTED",
            });
            return;
        }
        lastInputMonotonicMs = mapped.Value;
        pendingInputPulseMonotonicMs = mapped.Value;
    }

    private void EmitPendingInputPulse(ulong now)
    {
        if (sessionLocked || inputDesktopAvailable == false)
        {
            pendingInputPulseMonotonicMs = null;
            return;
        }
        if (pendingInputPulseMonotonicMs is null) return;
        if (
            lastInputPulseEmittedAtMs > 0 &&
            now - lastInputPulseEmittedAtMs < InteractionPulseMinIntervalMs)
        {
            return;
        }
        var observedInputMonotonicMs = pendingInputPulseMonotonicMs.Value;
        pendingInputPulseMonotonicMs = null;
        lastInputPulseEmittedAtMs = now;
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType = "interaction_pulse",
            // Coalescing reduces transport/disk pressure while preserving the
            // exact Windows last-input timestamp used for idle boundaries.
            monotonicMs = observedInputMonotonicMs,
            evidence = "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND",
        });
    }

    internal static ulong? MapInputTick(uint inputTick, ulong now)
    {
        var nowLow = unchecked((uint)now);
        var age = unchecked(nowLow - inputTick);
        if ((ulong)age > MaximumTrustedInputAgeMs) return null;
        return now - age;
    }

    private void ReconcileForeground(bool force)
    {
        var now = Native.GetTickCount64();
        lastForegroundReconcileMs = now;
        var hwnd = Native.GetForegroundWindow();
        var next = hwnd == IntPtr.Zero ? null : AppIdentityResolver.Resolve(hwnd);
        if (!force && AppIdentity.Same(currentApp, next)) return;
        currentApp = next;
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType = "foreground_changed",
            monotonicMs = now,
            app = next,
        });
    }

    private void ReconcileDesktop(bool force)
    {
        var now = Native.GetTickCount64();
        lastDesktopReconcileMs = now;
        var desktop = Native.OpenInputDesktop(0, false, 0x0100);
        var available = desktop != IntPtr.Zero;
        if (desktop != IntPtr.Zero) Native.CloseDesktop(desktop);
        if (!force && inputDesktopAvailable == available) return;
        inputDesktopAvailable = available;
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType = "desktop_switched",
            monotonicMs = now,
            inputDesktopAvailable = available,
        });
        if (available) ReconcileForeground(true);
    }

    private void HandleSessionChange(int change)
    {
        var now = Native.GetTickCount64();
        var eventType = change switch
        {
            WtsSessionLock => "session_locked",
            WtsSessionUnlock => "session_unlocked",
            WtsConsoleConnect or WtsRemoteConnect => "session_connected",
            WtsConsoleDisconnect or WtsRemoteDisconnect => "session_disconnected",
            _ => null,
        };
        if (eventType is null) return;
        if (change == WtsSessionLock) sessionLocked = true;
        if (change == WtsSessionUnlock) sessionLocked = false;
        if (change is WtsSessionLock or WtsConsoleDisconnect or WtsRemoteDisconnect)
            pendingInputPulseMonotonicMs = null;
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType,
            monotonicMs = now,
            sessionLocked,
        });
        if (change is WtsSessionUnlock or WtsConsoleConnect or WtsRemoteConnect)
            ReconcileForeground(true);
    }

    private void HandlePowerBroadcast(uint change)
    {
        var eventType = change switch
        {
            PbtApmSuspend => "suspend",
            PbtApmResumeSuspend or PbtApmResumeAutomatic => "resume",
            _ => null,
        };
        if (eventType is null) return;
        if (change == PbtApmSuspend) pendingInputPulseMonotonicMs = null;
        SafeJsonWriter.Write(new
        {
            protocolVersion = 1,
            eventType,
            monotonicMs = Native.GetTickCount64(),
        });
        if (eventType == "resume") ReconcileForeground(true);
    }

    private void TryRegisterWts()
    {
        if (window == IntPtr.Zero || wtsRegistered) return;
        lastWtsAttemptMs = Native.GetTickCount64();
        wtsRegistered = Native.WTSRegisterSessionNotification(window, NotifyForThisSession);
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        if (window != IntPtr.Zero) Native.KillTimer(window, InputPollTimer);
        if (wtsRegistered && window != IntPtr.Zero)
        {
            Native.WTSUnRegisterSessionNotification(window);
            wtsRegistered = false;
        }
        if (foregroundHook != IntPtr.Zero)
        {
            Native.UnhookWinEvent(foregroundHook);
            foregroundHook = IntPtr.Zero;
        }
        if (window != IntPtr.Zero)
        {
            Native.DestroyWindow(window);
            window = IntPtr.Zero;
        }
        if (module != IntPtr.Zero) Native.UnregisterClass(windowClassName, module);
    }
}

internal sealed record AppIdentity(string SubjectKey, string DisplayName)
{
    public static bool Same(AppIdentity? left, AppIdentity? right) =>
        left?.SubjectKey == right?.SubjectKey;
}

internal static class AppIdentityResolver
{
    public static AppIdentity? Resolve(IntPtr hwnd)
    {
        Native.GetWindowThreadProcessId(hwnd, out var processId);
        if (processId == 0 || processId == Environment.ProcessId) return null;
        processId = ResolveHostedProcess(hwnd, processId);
        try
        {
            using var process = Process.GetProcessById(processId);
            var processName = process.ProcessName.Trim();
            if (string.IsNullOrWhiteSpace(processName) || IsShellOnly(processName)) return null;
            string? product = null;
            string? company = null;
            string? original = null;
            try
            {
                var version = process.MainModule?.FileVersionInfo;
                product = Clean(version?.ProductName);
                company = Clean(version?.CompanyName);
                original = Clean(version?.OriginalFilename);
            }
            catch
            {
                // Elevated processes can deny metadata. The executable identity remains usable.
            }

            var displayName = NormalizeDisplayName(product ?? processName);
            var stableMaterial = $"{company ?? "unknown"}|{product ?? processName}|{original ?? processName}".ToLowerInvariant();
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(stableMaterial))).ToLowerInvariant();
            return new AppIdentity($"app:{hash[..32]}", displayName);
        }
        catch
        {
            return new AppIdentity("app:unknown", "Unknown application");
        }
    }

    private static int ResolveHostedProcess(IntPtr hwnd, int processId)
    {
        try
        {
            using var process = Process.GetProcessById(processId);
            if (!process.ProcessName.Equals("ApplicationFrameHost", StringComparison.OrdinalIgnoreCase))
                return processId;
        }
        catch
        {
            return processId;
        }

        var hosted = processId;
        Native.EnumChildWindows(hwnd, (child, _) =>
        {
            Native.GetWindowThreadProcessId(child, out var childProcessId);
            if (childProcessId != 0 && childProcessId != processId) hosted = childProcessId;
            return hosted == processId;
        }, IntPtr.Zero);
        return hosted;
    }

    private static bool IsShellOnly(string processName) =>
        processName.Equals("explorer", StringComparison.OrdinalIgnoreCase) ||
        processName.Equals("ShellExperienceHost", StringComparison.OrdinalIgnoreCase) ||
        processName.Equals("SearchHost", StringComparison.OrdinalIgnoreCase) ||
        processName.Equals("StartMenuExperienceHost", StringComparison.OrdinalIgnoreCase) ||
        processName.Equals("LockApp", StringComparison.OrdinalIgnoreCase);

    private static string NormalizeDisplayName(string value)
    {
        var trimmed = value.Trim();
        return trimmed.ToLowerInvariant() switch
        {
            "msedge" => "Microsoft Edge",
            "chrome" => "Google Chrome",
            "code" => "Visual Studio Code",
            "applicationframehost" => "Windows application",
            _ => trimmed.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
                ? trimmed[..^4]
                : trimmed,
        };
    }

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

internal static class SafeJsonWriter
{
    private static readonly object Gate = new();
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static void Write(object value)
    {
        lock (Gate)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
            Console.Out.Flush();
        }
    }
}

internal static class Native
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct WndClassEx
    {
        public uint cbSize;
        public uint style;
        public IntPtr lpfnWndProc;
        public int cbClsExtra;
        public int cbWndExtra;
        public IntPtr hInstance;
        public IntPtr hIcon;
        public IntPtr hCursor;
        public IntPtr hbrBackground;
        public string? lpszMenuName;
        public string lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct Message
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct LastInputInfo
    {
        public uint cbSize;
        public uint dwTime;
    }

    internal delegate IntPtr WndProc(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
    internal delegate void WinEventDelegate(
        IntPtr hook,
        uint eventType,
        IntPtr hwnd,
        int objectId,
        int childId,
        uint eventThread,
        uint eventTime);
    internal delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    internal static extern IntPtr GetModuleHandle(string? moduleName);
    [DllImport("kernel32.dll")]
    internal static extern ulong GetTickCount64();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern ushort RegisterClassEx(ref WndClassEx windowClass);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern bool UnregisterClass(string className, IntPtr instance);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    internal static extern IntPtr CreateWindowEx(
        uint extendedStyle,
        string className,
        string windowName,
        uint style,
        int x,
        int y,
        int width,
        int height,
        IntPtr parent,
        IntPtr menu,
        IntPtr instance,
        IntPtr parameter);
    [DllImport("user32.dll")]
    internal static extern bool DestroyWindow(IntPtr hwnd);
    [DllImport("user32.dll")]
    internal static extern IntPtr DefWindowProc(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    internal static extern sbyte GetMessage(out Message message, IntPtr hwnd, uint minimum, uint maximum);
    [DllImport("user32.dll")]
    internal static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll")]
    internal static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("user32.dll")]
    internal static extern void PostQuitMessage(int exitCode);
    [DllImport("user32.dll")]
    internal static extern bool PostMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")]
    internal static extern UIntPtr SetTimer(IntPtr hwnd, uint timerId, uint milliseconds, IntPtr callback);
    [DllImport("user32.dll")]
    internal static extern bool KillTimer(IntPtr hwnd, uint timerId);
    [DllImport("user32.dll")]
    internal static extern IntPtr SetWinEventHook(
        uint eventMinimum,
        uint eventMaximum,
        IntPtr eventHookModule,
        WinEventDelegate callback,
        uint processId,
        uint threadId,
        uint flags);
    [DllImport("user32.dll")]
    internal static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")]
    internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    internal static extern uint GetWindowThreadProcessId(IntPtr hwnd, out int processId);
    [DllImport("user32.dll")]
    internal static extern bool GetLastInputInfo(ref LastInputInfo lastInputInfo);
    [DllImport("user32.dll")]
    internal static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr parameter);
    [DllImport("user32.dll")]
    internal static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint desiredAccess);
    [DllImport("user32.dll")]
    internal static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("wtsapi32.dll")]
    internal static extern bool WTSRegisterSessionNotification(IntPtr hwnd, int flags);
    [DllImport("wtsapi32.dll")]
    internal static extern bool WTSUnRegisterSessionNotification(IntPtr hwnd);
}

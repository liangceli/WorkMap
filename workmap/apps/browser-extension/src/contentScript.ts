declare const chrome: {
  runtime: { sendMessage(message: Record<string, unknown>, callback?: () => void): void; lastError?: unknown };
};

const workMapWindow = window as Window & { __workmapDomainActivityInstalled?: boolean };

if (!workMapWindow.__workmapDomainActivityInstalled) {
  workMapWindow.__workmapDomainActivityInstalled = true;
  const isTopFrame = window === window.top;
  const throttleMs = 250;
  let lastSentAt = 0;
  let latestActivityAt = 0;
  let trailingTimer: number | undefined;
  let idleTimer: number | undefined;

  const send = (message: Record<string, unknown>) => {
    try {
      chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
    } catch {
      // The extension may have been disabled or reloaded; page instrumentation stops silently.
    }
  };

  const sendLatestActivity = () => {
    if (!latestActivityAt || latestActivityAt <= lastSentAt) return;
    lastSentAt = latestActivityAt;
    send({ type: "workmap:domain-activity", activityAt: latestActivityAt });
  };

  const scheduleIdleBoundary = () => {
    if (idleTimer !== undefined) window.clearTimeout(idleTimer);
    const expectedLastInputAt = latestActivityAt;
    idleTimer = window.setTimeout(() => {
      sendLatestActivity();
      send({
        type: "workmap:domain-idle",
        lastInputAt: expectedLastInputAt,
        idleAt: expectedLastInputAt + 30_000,
      });
    }, Math.max(0, expectedLastInputAt + 30_000 - Date.now()));
  };

  const observeTrustedActivity = (event: Event) => {
    if (!event.isTrusted) return;
    if (document.visibilityState !== "visible") return;
    if (event.type === "pointermove" && !document.hasFocus()) return;
    latestActivityAt = Date.now();
    scheduleIdleBoundary();
    if (latestActivityAt - lastSentAt >= throttleMs) sendLatestActivity();
    else {
      if (trailingTimer !== undefined) window.clearTimeout(trailingTimer);
      trailingTimer = window.setTimeout(sendLatestActivity, throttleMs);
    }
  };

  for (const eventName of ["keydown", "pointerdown", "pointermove", "wheel", "touchstart", "touchmove"] as const) {
    window.addEventListener(eventName, observeTrustedActivity, { capture: true, passive: true });
  }

  if (isTopFrame) {
    const stopPageFocus = () => {
      sendLatestActivity();
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      send({ type: "workmap:domain-blur", observedAt: Date.now() });
    };
    window.addEventListener("blur", stopPageFocus, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") stopPageFocus();
      else send({ type: "workmap:domain-checkpoint", observedAt: Date.now() });
    }, true);
    window.setInterval(() => {
      if (document.visibilityState === "visible") send({ type: "workmap:domain-checkpoint", observedAt: Date.now() });
    }, 10_000);
  }
}

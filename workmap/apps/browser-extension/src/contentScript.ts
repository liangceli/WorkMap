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

  const observeTrustedActivity = (event: Event) => {
    if (!event.isTrusted) return;
    if (document.visibilityState !== "visible") return;
    if (event.type === "pointermove" && !document.hasFocus()) return;
    latestActivityAt = Date.now();
    if (latestActivityAt - lastSentAt >= throttleMs) sendLatestActivity();
    else {
      if (trailingTimer !== undefined) window.clearTimeout(trailingTimer);
      trailingTimer = window.setTimeout(sendLatestActivity, throttleMs);
    }
  };

  for (const eventName of [
    "keydown",
    "pointerdown",
    "pointermove",
    "wheel",
    "touchstart",
    "touchmove",
    "input",
    "change",
  ] as const) {
    window.addEventListener(eventName, observeTrustedActivity, { capture: true, passive: true });
  }
  document.addEventListener("selectionchange", observeTrustedActivity, {
    capture: true,
    passive: true,
  });

  if (isTopFrame) {
    const stopPageFocus = () => {
      sendLatestActivity();
      send({ type: "workmap:domain-blur", observedAt: Date.now() });
    };
    window.addEventListener("blur", stopPageFocus, true);
    window.addEventListener("focus", () => {
      send({ type: "workmap:domain-checkpoint", observedAt: Date.now() });
    }, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") stopPageFocus();
      else send({ type: "workmap:domain-checkpoint", observedAt: Date.now() });
    }, true);
  }
}

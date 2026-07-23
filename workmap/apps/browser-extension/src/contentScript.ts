declare const chrome: {
  runtime: {
    sendMessage(message: Record<string, unknown>, callback?: () => void): void;
    onMessage: {
      addListener(
        listener: (
          message: Record<string, unknown>,
          sender: unknown,
          sendResponse: (response: Record<string, unknown>) => void,
        ) => void,
      ): void;
    };
    lastError?: unknown;
  };
};

// A registered content script and the recovery injection can legitimately run
// in the same document. Keep every lexical binding inside a fresh function
// scope so the second classic-script execution can reach the page marker
// instead of failing during parsing with a duplicate `const` declaration.
(() => {
  const workMapWindow = window as Window & { __workmapDomainActivityInstalled?: boolean };

  if (workMapWindow.__workmapDomainActivityInstalled) return;
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
    "mousedown",
    "wheel",
    "touchstart",
    "input",
    "change",
  ] as const) {
    window.addEventListener(eventName, observeTrustedActivity, { capture: true, passive: true });
  }
  if (isTopFrame) {
    const sendPageCheckpoint = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      send({ type: "workmap:domain-checkpoint", observedAt: Date.now() });
    };
    const stopPageFocus = () => {
      sendLatestActivity();
      send({ type: "workmap:domain-blur", observedAt: Date.now() });
    };
    window.addEventListener("blur", stopPageFocus, true);
    window.addEventListener("focus", sendPageCheckpoint, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") stopPageFocus();
      else sendPageCheckpoint();
    }, true);
    chrome.runtime.onMessage.addListener((message, _sender, respond) => {
      if (message.type !== "workmap:domain-probe") return;
      respond({
        type: "workmap:domain-probe-result",
        visible: document.visibilityState === "visible",
        focused: document.hasFocus(),
      });
    });
    queueMicrotask(sendPageCheckpoint);
  }
})();

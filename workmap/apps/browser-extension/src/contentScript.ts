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
  let mediaTimer: number | undefined;
  const activeMedia = new Set<HTMLMediaElement>();
  const MEDIA_START_FROM_INTERACTION_MS = 5_000;
  const MEDIA_SIGNAL_INTERVAL_MS = 10_000;

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
    const pageCanReportMedia = () => document.visibilityState === "visible" && document.hasFocus();
    const stopMediaSignals = () => {
      activeMedia.clear();
      if (mediaTimer !== undefined) {
        window.clearInterval(mediaTimer);
        mediaTimer = undefined;
      }
    };
    const sendMediaActivity = () => {
      if (activeMedia.size === 0 || !pageCanReportMedia()) return;
      // This only says that a user-initiated media surface remains active. It
      // never includes media metadata, page content, title, or URL details.
      send({ type: "workmap:domain-media-activity", activityAt: Date.now() });
    };
    const startMediaSignals = () => {
      sendMediaActivity();
      if (mediaTimer === undefined) mediaTimer = window.setInterval(sendMediaActivity, MEDIA_SIGNAL_INTERVAL_MS);
    };
    const onMediaPlay = (event: Event) => {
      const media = event.composedPath().find((entry): entry is HTMLMediaElement => entry instanceof HTMLMediaElement);
      if (!media) return;
      // Ignore autoplay and background media. A user must have interacted with
      // this visible, focused page immediately before playback began.
      if (!pageCanReportMedia() || Date.now() - latestActivityAt > MEDIA_START_FROM_INTERACTION_MS) return;
      activeMedia.add(media);
      startMediaSignals();
    };
    const onMediaStop = (event: Event) => {
      const media = event.composedPath().find((entry): entry is HTMLMediaElement => entry instanceof HTMLMediaElement);
      if (media) activeMedia.delete(media);
      if (activeMedia.size === 0) stopMediaSignals();
    };
    for (const eventName of ["play", "pause", "ended", "emptied"] as const) {
      document.addEventListener(eventName, eventName === "play" ? onMediaPlay : onMediaStop, true);
    }
    const stopPageFocus = () => {
      sendLatestActivity();
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      stopMediaSignals();
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

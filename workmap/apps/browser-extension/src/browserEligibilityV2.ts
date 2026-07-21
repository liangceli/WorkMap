import { readDomainFromUrl } from "./domainTracking.js";
import { isExcludedHostname } from "./hostnameExclusions.js";

export type BrowserTabObservationV2 = {
  id?: number;
  url?: string;
  active?: boolean;
  windowId?: number;
  incognito?: boolean;
  splitViewId?: number;
};

export type BrowserWindowObservationV2 = {
  id?: number;
  focused?: boolean;
  incognito?: boolean;
  state?: "normal" | "minimized" | "maximized" | "fullscreen";
  type?: "normal" | "popup" | "panel" | "app" | "devtools";
};

export function eligibleDomainForTab(
  tab: BrowserTabObservationV2 | null | undefined,
  exclusions: readonly string[] | undefined,
) {
  if (!tab || tab.incognito === true) return null;
  const domain = readDomainFromUrl(tab.url);
  return domain && !isExcludedHostname(domain, exclusions) ? domain : null;
}

export function isUsableFocusedWindow(
  window: BrowserWindowObservationV2 | null | undefined,
) {
  return Boolean(
    window?.focused &&
      window.id !== undefined &&
      window.incognito !== true &&
      window.state !== "minimized" &&
      window.type !== "devtools",
  );
}

export function messageCanOwnFocus(input: {
  senderTab: BrowserTabObservationV2;
  focusedWindowId: number | null;
  activeTabs: BrowserTabObservationV2[];
}) {
  const sender = input.senderTab;
  if (
    sender.id === undefined ||
    sender.windowId === undefined ||
    sender.windowId !== input.focusedWindowId ||
    sender.incognito === true
  ) {
    return false;
  }

  if (input.activeTabs.some((tab) => tab.id === sender.id)) return true;

  // Chrome 140+ exposes splitViewId. A trusted event from the visible peer is
  // stronger evidence than the tab strip's single `active` bit, but it is only
  // accepted when an active tab in the focused window proves the same Split View.
  const splitViewId = sender.splitViewId;
  return Boolean(
    Number.isInteger(splitViewId) &&
      splitViewId! >= 0 &&
      input.activeTabs.some(
        (tab) =>
          tab.windowId === sender.windowId &&
          tab.splitViewId === splitViewId,
      ),
  );
}

export function chooseSingleActiveTab(
  tabs: BrowserTabObservationV2[],
  previousTabId: number | null,
) {
  if (tabs.length === 1) return tabs[0]!;
  if (tabs.length === 0) return null;
  return tabs.find((tab) => tab.id === previousTabId) ?? null;
}

"use client";

const PENDING_INVITE_STORAGE_KEY = "workmap.pendingInviteToken";

export function savePendingInviteToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
}

export function getPendingInviteToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PENDING_INVITE_STORAGE_KEY);
}

export function clearPendingInviteToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
}

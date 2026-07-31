"use client";

import { getCognitoSession, hasStoredCognitoSession } from "./cognitoSession";

const PUBLIC_PATHS = new Set(["/", "/login", "/login/callback"]);

export function redirectToLoginForMissingCognitoSession() {
  if (typeof window === "undefined" || getCognitoSession() || hasStoredCognitoSession()) return false;

  return replaceProtectedPathWithPublicHome();
}

export function redirectToHomeForEndedCognitoSession() {
  if (typeof window === "undefined") return false;

  return replaceProtectedPathWithPublicHome();
}

function replaceProtectedPathWithPublicHome() {
  const pathname = window.location.pathname;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/invite/")) return false;

  window.location.replace("/");
  return true;
}

export function getRequestedPostLoginPath(search?: string) {
  if (typeof window === "undefined" && search === undefined) return null;

  const requested = new URLSearchParams(search ?? window.location.search).get("next")?.trim();
  if (!requested || !requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) return null;
  if (PUBLIC_PATHS.has(requested)) return null;
  return requested;
}

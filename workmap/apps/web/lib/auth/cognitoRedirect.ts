"use client";

import { getCognitoSession } from "./cognitoSession";

const PUBLIC_PATHS = new Set(["/", "/login", "/login/callback"]);

export function redirectToRootForMissingCognitoSession() {
  if (typeof window === "undefined" || getCognitoSession()) return false;

  const pathname = window.location.pathname;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/invite/")) return false;

  window.location.replace("/");
  return true;
}

import type { StoredCognitoSession } from "./cognitoSession";

export function deriveDisplayNameFromCognito(session: StoredCognitoSession | null | undefined) {
  const claimName = sanitizeDisplayName(session?.claims.displayName);

  if (claimName) {
    return claimName;
  }

  const username = sanitizeDisplayName(session?.claims.username);

  if (username) {
    return username;
  }

  return deriveDisplayNameFromEmail(session?.claims.email);
}

export function deriveDisplayNameFromEmail(email: string | null | undefined) {
  const localPart = typeof email === "string" ? email.split("@")[0] : "";
  const words = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1));

  return sanitizeDisplayName(words.join(" ")) ?? "";
}

export function sanitizeDisplayName(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

  if (normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  return normalized;
}

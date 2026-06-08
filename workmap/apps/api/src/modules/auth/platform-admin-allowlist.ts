import type { VerifiedCognitoIdentity } from "./cognito-identity.js";

export function isPlatformAdminIdentity(identity: VerifiedCognitoIdentity) {
  const allowedEmails = readCsvEnv("WORKMAP_PLATFORM_ADMIN_EMAILS").map((item) => item.toLowerCase());
  const allowedCognitoSubs = readCsvEnv("WORKMAP_PLATFORM_ADMIN_COGNITO_SUBS");

  return allowedEmails.includes(identity.email.toLowerCase()) || allowedCognitoSubs.includes(identity.sub);
}

function readCsvEnv(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

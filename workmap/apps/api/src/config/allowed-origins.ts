const LOCAL_WEB_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function getAllowedOrigins() {
  const configured = process.env.WORKMAP_ALLOWED_ORIGINS ?? process.env.WORKMAP_ALLOWED_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    for (const origin of LOCAL_WEB_ORIGINS) {
      if (!origins.includes(origin)) {
        origins.push(origin);
      }
    }
  }

  return origins;
}

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.includes(origin.replace(/\/+$/, ""));
}

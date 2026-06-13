#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 10_000;
const API_URL_ENV = "WORKMAP_SMOKE_API_URL";
const APP_URL_ENV = "WORKMAP_SMOKE_APP_URL";
const ORIGIN_ENV = "WORKMAP_SMOKE_ORIGIN";
const TIMEOUT_ENV = "WORKMAP_SMOKE_TIMEOUT_MS";
const ALLOW_LOCAL_ENV = "WORKMAP_SMOKE_ALLOW_LOCAL";

async function main() {
  const apiUrl = readUrlEnv(API_URL_ENV);
  const appUrl = readUrlEnv(APP_URL_ENV);
  const originUrl = readUrlEnv(ORIGIN_ENV) ?? appUrl;
  const timeoutMs = readTimeout();
  const allowLocal = process.env[ALLOW_LOCAL_ENV] === "1";

  if (!apiUrl || !appUrl) {
    printManualActionRequired([
      `${API_URL_ENV}: deployed Render API origin, for example https://<api>.onrender.com`,
      `${APP_URL_ENV}: deployed Vercel app origin, for example https://<app>.vercel.app`,
      `${ORIGIN_ENV}: optional browser Origin to test CORS; defaults to ${APP_URL_ENV}`,
    ]);
    process.exitCode = 2;
    return;
  }

  if (!allowLocal && (isLocalUrl(apiUrl) || isLocalUrl(appUrl) || isLocalUrl(originUrl))) {
    printManualActionRequired([
      "Use deployed HTTPS Vercel/Render origins for real alpha smoke.",
      `Set ${ALLOW_LOCAL_ENV}=1 only when intentionally testing a local smoke run.`,
    ]);
    process.exitCode = 2;
    return;
  }

  const checks = [
    () => checkJson("API liveness", new URL("/health", apiUrl), timeoutMs, (body) => body?.status === "ok"),
    () =>
      checkJson(
        "API readiness",
        new URL("/health/readiness", apiUrl),
        timeoutMs,
        (body) => body?.status === "ready" && body?.checks?.database === "ok",
      ),
    () => checkCors("API CORS allowlist", new URL("/health", apiUrl), originUrl, timeoutMs),
    () => checkPage("Frontend home", new URL("/", appUrl), timeoutMs),
    () => checkPage("Frontend login", new URL("/login", appUrl), timeoutMs),
    () => checkPage("Frontend virtual office route", new URL("/virtual-office", appUrl), timeoutMs),
    () => checkPage("Frontend platform admin route", new URL("/platform-admin", appUrl), timeoutMs),
  ];

  const results = [];

  for (const check of checks) {
    results.push(await check());
  }

  const failures = results.filter((result) => !result.ok);
  const realtimeUrl = deriveRealtimeUrl(apiUrl);

  console.log("");
  console.log("WorkMap real alpha smoke summary");
  console.log(`API origin: ${apiUrl.origin}`);
  console.log(`App origin: ${appUrl.origin}`);
  console.log(`CORS origin tested: ${originUrl.origin}`);
  console.log(`Derived realtime endpoint: ${realtimeUrl}`);
  console.log("");

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.message}`);
  }

  console.log("");
  console.log("Manual smoke still required: Cognito owner login, owner workspace creation, invite acceptance, two-user WSS movement, reports/activity hardening, and platform admin privacy checks.");

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function readUrlEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function readTimeout() {
  const parsed = Number(process.env[TIMEOUT_ENV]);

  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 60_000) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

async function checkJson(name, url, timeoutMs, isExpectedBody) {
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, timeoutMs);
    const body = await readJson(response);

    if (!response.ok) {
      return fail(name, `HTTP ${response.status}`);
    }

    if (!isExpectedBody(body)) {
      return fail(name, "response body did not match expected safe status");
    }

    return pass(name, `HTTP ${response.status}`);
  } catch (error) {
    return fail(name, formatError(error));
  }
}

async function checkCors(name, url, originUrl, timeoutMs) {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/json",
          Origin: originUrl.origin,
        },
      },
      timeoutMs,
    );
    const allowedOrigin = response.headers.get("access-control-allow-origin");

    if (!response.ok) {
      return fail(name, `HTTP ${response.status}`);
    }

    if (allowedOrigin !== originUrl.origin) {
      return fail(name, `expected access-control-allow-origin ${originUrl.origin}, received ${allowedOrigin ?? "none"}`);
    }

    return pass(name, `allowlist returned ${allowedOrigin}`);
  } catch (error) {
    return fail(name, formatError(error));
  }
}

async function checkPage(name, url, timeoutMs) {
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: "text/html" } }, timeoutMs);

    if (response.status >= 500) {
      return fail(name, `HTTP ${response.status}`);
    }

    return pass(name, `HTTP ${response.status}`);
  } catch (error) {
    return fail(name, formatError(error));
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function deriveRealtimeUrl(apiUrl) {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/virtual-office/realtime";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isLocalUrl(url) {
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function pass(name, message) {
  return { ok: true, name, message };
}

function fail(name, message) {
  return { ok: false, name, message };
}

function formatError(error) {
  return error instanceof Error ? error.message : "request failed";
}

function printManualActionRequired(items) {
  console.log("Manual Action Required");
  console.log("");
  console.log("Set these environment variables in your shell before running real alpha smoke.");
  console.log("Use platform URLs only; do not paste secrets or bearer tokens into chat.");
  console.log("");

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

await main();

import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import net from "node:net";

const API_BASE_URL = process.env.WORKMAP_STAGE4_SMOKE_API_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";
const WS_ORIGIN = process.env.WORKMAP_STAGE4_SMOKE_ORIGIN ?? "http://localhost:3002";
const DEMO_COMPANY_SLUG = "workmap-demo-company";
const OWNER_EMAIL = "owner@workmap.demo";
const ENGINEER_EMAIL = "engineer@workmap.demo";

const prisma = new PrismaClient();
const runId = `stage4-${Date.now()}`;
const smoke = {
  apiBaseUrl: API_BASE_URL,
  origin: WS_ORIGIN,
  tracking: {},
  reports: {},
  permissions: {},
  realtime: {},
};

try {
  await assertApiHealth();
  const owner = await createDevToken(OWNER_EMAIL, DEMO_COMPANY_SLUG);
  const engineer = await createDevToken(ENGINEER_EMAIL, DEMO_COMPANY_SLUG);
  const otherTenant = await createTemporaryTenant(runId);
  const otherOwner = await createDevToken(otherTenant.email, otherTenant.slug);

  const engineerDevice = await registerDevice(engineer.accessToken, {
    hostname: `WM-STAGE4-ENGINEER-${runId}`,
    os: "WINDOWS",
    agentVersion: "stage4-smoke/0.1.0",
  });
  const ownerDevice = await registerDevice(owner.accessToken, {
    hostname: `WM-STAGE4-OWNER-${runId}`,
    os: "MACOS",
    agentVersion: "stage4-smoke/0.1.0",
  });
  const otherDevice = await registerDevice(otherOwner.accessToken, {
    hostname: `WM-STAGE4-OTHER-${runId}`,
    os: "LINUX",
    agentVersion: "stage4-smoke/0.1.0",
  });

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - 120000);
  const appName = `WorkMap Stage4 Smoke App ${runId}`;
  const domain = `${runId}.example.com`;
  const appEvent = {
    deviceId: engineerDevice.id,
    appName,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    isIdle: false,
  };
  const domainEvent = {
    deviceId: engineerDevice.id,
    domain: `https://${domain}/private/path?ignored=true`,
    browserName: "CHROME",
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    isIdle: false,
  };

  const appAccepted = await postJson("/activity/app-usage", engineer.accessToken, appEvent);
  const appDuplicate = await postJson("/activity/app-usage", engineer.accessToken, appEvent);
  const domainAccepted = await postJson("/activity/domain-usage", engineer.accessToken, domainEvent);
  const domainDuplicate = await postJson("/activity/domain-usage", engineer.accessToken, domainEvent);

  smoke.tracking = {
    appAccepted: appAccepted.accepted,
    appDuplicateAccepted: appDuplicate.accepted,
    domainAccepted: domainAccepted.accepted,
    domainDuplicateAccepted: domainDuplicate.accepted,
  };

  assertEqual(appAccepted.accepted, 1, "app event should be accepted once");
  assertEqual(appDuplicate.accepted, 0, "duplicate app event should not be counted twice");
  assertEqual(domainAccepted.accepted, 1, "domain event should be accepted once");
  assertEqual(domainDuplicate.accepted, 0, "duplicate domain event should not be counted twice");

  const engineerReport = await getJson("/reports/usage-summary", engineer.accessToken);
  const ownerCompanyReport = await getJson("/reports/usage-summary?scope=company", owner.accessToken);
  const engineerApp = engineerReport.apps.find((row) => row.appName === appName);
  const engineerDomain = engineerReport.websites.find((row) => row.domain === domain);
  const companyApp = ownerCompanyReport.apps.find((row) => row.appName === appName);
  const companyDomain = ownerCompanyReport.websites.find((row) => row.domain === domain);

  assertEqual(engineerApp?.activeSeconds, 120, "employee own report should show ingested app duration once");
  assertEqual(engineerDomain?.activeSeconds, 120, "employee own report should show normalized domain duration once");
  assertEqual(companyApp?.activeSeconds, 120, "owner company report should show ingested app duration once");
  assertEqual(companyDomain?.activeSeconds, 120, "owner company report should show ingested domain duration once");

  smoke.reports = {
    employeeOwnAppSeconds: engineerApp?.activeSeconds,
    employeeOwnDomainSeconds: engineerDomain?.activeSeconds,
    ownerCompanyAppSeconds: companyApp?.activeSeconds,
    ownerCompanyDomainSeconds: companyDomain?.activeSeconds,
  };

  const unauthActivity = await request("POST", "/activity/app-usage", undefined, appEvent);
  const employeeCompanyReport = await request("GET", "/reports/usage-summary?scope=company", engineer.accessToken);
  const employeeOwnerReport = await request("GET", `/reports/usage-summary?userId=${owner.user.id}`, engineer.accessToken);
  const otherOwnerEngineerReport = await request("GET", `/reports/usage-summary?userId=${engineer.user.id}`, otherOwner.accessToken);
  const crossTenantIngest = await request("POST", "/activity/app-usage", engineer.accessToken, {
    ...appEvent,
    deviceId: otherDevice.id,
    appName: `${appName} Cross Tenant`,
  });
  const crossUserHeartbeat = await request("POST", "/devices/heartbeat", engineer.accessToken, {
    deviceId: ownerDevice.id,
    agentVersion: "stage4-smoke/0.1.0",
  });
  const platformWithTenantToken = await request("GET", "/platform/tenants", owner.accessToken);

  assertStatus(unauthActivity.status, 401, "unauthenticated activity ingestion should be rejected");
  assertStatus(employeeCompanyReport.status, 403, "employee company report should be rejected");
  assertStatus(employeeOwnerReport.status, 403, "employee cross-user report should be rejected");
  assertStatus(otherOwnerEngineerReport.status, 404, "cross-tenant report target should not be visible");
  assertStatus(crossTenantIngest.status, 403, "cross-tenant device ingestion should be rejected");
  assertStatus(crossUserHeartbeat.status, 403, "cross-user heartbeat should be rejected");
  if (platformWithTenantToken.status === 200) {
    throw new Error("tenant bearer token should not access platform tenant list");
  }

  smoke.permissions = {
    unauthActivityStatus: unauthActivity.status,
    employeeCompanyReportStatus: employeeCompanyReport.status,
    employeeCrossUserReportStatus: employeeOwnerReport.status,
    crossTenantReportStatus: otherOwnerEngineerReport.status,
    crossTenantIngestStatus: crossTenantIngest.status,
    crossUserHeartbeatStatus: crossUserHeartbeat.status,
    platformWithTenantTokenStatus: platformWithTenantToken.status,
  };

  smoke.realtime = await runRealtimeSmoke(owner, engineer, otherOwner);

  console.log(JSON.stringify({ ok: true, smoke }, null, 2));
} finally {
  await prisma.company.deleteMany({ where: { slug: { startsWith: "stage4-smoke-" } } });
  await prisma.$disconnect();
}

async function assertApiHealth() {
  const response = await request("GET", "/health");
  assertStatus(response.status, 200, "API health should return 200");
}

async function createDevToken(email, companySlug) {
  const response = await request("POST", "/auth/dev-token", undefined, { email, companySlug });
  assertStatus(response.status, 201, `dev token should be available for ${email}`);
  return response.body;
}

async function registerDevice(token, body) {
  const response = await postJson("/devices/register", token, body);
  return response.device;
}

async function postJson(path, token, body) {
  const response = await request("POST", path, token, body);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

async function getJson(path, token) {
  const response = await request("GET", path, token);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${path} returned ${response.status}: ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

async function request(method, path, token, body) {
  const headers = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { text };
    }
  }

  return { status: response.status, body: parsed };
}

async function createTemporaryTenant(id) {
  const slug = `stage4-smoke-${id}`;
  const email = `${slug}@workmap.local`;
  await prisma.company.deleteMany({ where: { slug } });
  const company = await prisma.company.create({
    data: {
      name: `Stage4 Smoke ${id}`,
      slug,
      users: {
        create: {
          email,
          displayName: "Stage4 Smoke Owner",
          role: UserRole.OWNER,
          status: UserStatus.AVAILABLE,
          avatarId: "avatar-stage4-smoke",
        },
      },
      officeMaps: {
        create: {
          name: "Stage4 Smoke Office",
          slug: "default-office",
          width: 1280,
          height: 720,
          tileSize: 32,
          isDefault: true,
          mapData: null,
        },
      },
    },
    include: { users: true, officeMaps: true },
  });

  return {
    slug,
    email,
    companyId: company.id,
    userId: company.users[0].id,
    officeMapId: company.officeMaps[0].id,
  };
}

async function runRealtimeSmoke(owner, engineer, otherOwner) {
  const ownerMap = await getJson("/virtual-office/map", owner.accessToken);
  const otherMap = await getJson("/virtual-office/map", otherOwner.accessToken);
  const received = [];
  const ownerSocket = await openRawWs(owner.accessToken, "owner", received);
  const engineerSocket = await openRawWs(engineer.accessToken, "engineer", received);
  const otherSocket = await openRawWs(otherOwner.accessToken, "otherOwner", received);

  try {
    ownerSocket.send({ event: "office:join", payload: { officeMapId: ownerMap.id } });
    engineerSocket.send({ event: "office:join", payload: { officeMapId: ownerMap.id } });
    otherSocket.send({ event: "office:join", payload: { officeMapId: otherMap.id } });
    await delay(500);

    ownerSocket.send({ event: "teammate:wave", payload: { targetUserId: engineer.user.id } });
    ownerSocket.send({ event: "teammate:message", payload: { targetUserId: engineer.user.id, message: "Stage4 smoke hello" } });
    engineerSocket.send({
      event: "player:move",
      payload: { x: 960, y: 1345, direction: "down", isMoving: false, status: "available" },
    });
    await delay(700);

    ownerSocket.send({ event: "teammate:message", payload: { targetUserId: otherOwner.user.id, message: "Cross tenant should not deliver" } });
    await delay(500);
  } finally {
    ownerSocket.close();
    engineerSocket.close();
    otherSocket.close();
  }

  const engineerEvents = received.filter((item) => item.label === "engineer").map((item) => item.message.event);
  const ownerEvents = received.filter((item) => item.label === "owner").map((item) => item.message.event);
  const otherEvents = received.filter((item) => item.label === "otherOwner").map((item) => item.message.event);
  const ownerErrors = received
    .filter((item) => item.label === "owner" && item.message.event === "office:error")
    .map((item) => item.message.payload?.message);

  if (!engineerEvents.includes("teammate:wave")) {
    throw new Error("engineer did not receive teammate:wave");
  }
  if (!engineerEvents.includes("teammate:message")) {
    throw new Error("engineer did not receive teammate:message");
  }
  if (!ownerEvents.includes("player:state")) {
    throw new Error("owner did not receive engineer movement after wave/message extension");
  }
  if (otherEvents.includes("teammate:message") || otherEvents.includes("teammate:wave")) {
    throw new Error("cross-tenant realtime message was delivered");
  }
  if (!ownerErrors.some((message) => String(message).includes("not currently connected"))) {
    throw new Error("cross-tenant realtime target did not produce sender error");
  }

  return {
    sameTenantEngineerEvents: engineerEvents,
    ownerSawMovement: ownerEvents.includes("player:state"),
    crossTenantOtherEvents: otherEvents,
    crossTenantSenderErrors: ownerErrors,
  };
}

function openRawWs(token, label, received) {
  const url = new URL(API_BASE_URL);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (url.protocol !== "http:") {
    throw new Error("stage4 local raw WebSocket smoke expects an http API URL");
  }

  const socket = net.connect(port, url.hostname);
  let buffer = Buffer.alloc(0);
  let handshakeDone = false;
  const key = randomBytes(16).toString("base64");

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} websocket timeout`)), 5000);

    socket.on("connect", () => {
      const path = `/virtual-office/realtime?token=${encodeURIComponent(token)}`;
      socket.write(
        [
          `GET ${path} HTTP/1.1`,
          `Host: ${url.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${key}`,
          "Sec-WebSocket-Version: 13",
          `Origin: ${WS_ORIGIN}`,
          "",
          "",
        ].join("\r\n"),
      );
    });

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!handshakeDone) {
        const marker = buffer.indexOf("\r\n\r\n");
        if (marker === -1) {
          return;
        }

        const header = buffer.subarray(0, marker).toString("utf8");
        if (!header.includes("101 Switching Protocols")) {
          clearTimeout(timer);
          reject(new Error(`${label} websocket handshake failed: ${header.split("\r\n")[0]}`));
          return;
        }

        handshakeDone = true;
        buffer = buffer.subarray(marker + 4);
        clearTimeout(timer);
        resolve({
          send: (event) => socket.write(encodeClientText(JSON.stringify(event))),
          close: () => socket.destroy(),
        });
      }

      const parsed = readServerFrames(buffer);
      buffer = parsed.rest;
      for (const message of parsed.messages) {
        received.push({ label, message });
      }
    });

    socket.on("error", reject);
  });
}

function encodeClientText(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = randomBytes(4);
  const header = payload.length < 126 ? Buffer.from([0x81, 0x80 | payload.length]) : createMediumClientHeader(payload.length);
  const masked = Buffer.alloc(payload.length);

  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }

  return Buffer.concat([header, mask, masked]);
}

function createMediumClientHeader(length) {
  if (length > 0xffff) {
    throw new Error("WebSocket payload is too large for smoke helper.");
  }

  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 0x80 | 126;
  header.writeUInt16BE(length, 2);
  return header;
}

function readServerFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (buffer.length - offset >= 2) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    let length = secondByte & 0x7f;
    let cursor = offset + 2;

    if (length === 126) {
      if (buffer.length - cursor < 2) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (buffer.length - cursor < 8) break;
      length = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }

    if (buffer.length - cursor < length) break;
    const payload = buffer.subarray(cursor, cursor + length);
    if (opcode === 1) {
      messages.push(JSON.parse(payload.toString("utf8")));
    }
    offset = cursor + length;
  }

  return { messages, rest: buffer.subarray(offset) };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function assertStatus(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

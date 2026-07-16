import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  ActivityEventSource,
  ActivityEventType,
  AgentSessionEndReason,
  DeviceClientType,
  DeviceOS,
  DeviceStatus,
  DeviceStatusConfidence,
  DeviceStatusReason,
} from "@prisma/client";
import { canViewDeviceHealth, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_OS_VALUES = new Set<string>(Object.values(DeviceOS));
const MAX_HOSTNAME_LENGTH = 120;
const MAX_AGENT_VERSION_LENGTH = 80;
const MAX_TIME_ZONE_LENGTH = 80;
const MAX_STATUS_METADATA_KEYS = new Set(["operation", "networkState", "agentVersion", "trackingState"]);
const MAX_STATUS_METADATA_VALUE_LENGTH = 120;
const MAX_CURRENT_ACTIVITY_FUTURE_SKEW_MS = 5 * 60_000;
export const BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS = 90_000;

const DEVICE_STATUS_VALUES = new Set<string>(Object.values(DeviceStatus));
const DEVICE_STATUS_REASON_VALUES = new Set<string>(Object.values(DeviceStatusReason));

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listVisibleDevices(context: RequestContext) {
    const canViewCompanyDevices = canViewDeviceHealth(context);
    const devices = await this.prisma.device.findMany({
      where: {
        companyId: context.companyId,
        ...(canViewCompanyDevices ? {} : { userId: context.userId }),
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ lastSeenAt: "desc" }, { updatedAt: "desc" }],
    });

    return devices.map((device) => ({
      id: device.id,
      os: device.os,
      hostname: device.hostname,
      agentVersion: device.agentVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
      user: device.user,
    }));
  }

  async registerDevice(context: RequestContext, input: unknown) {
    const body = readObject(input, "Device registration body must be an object.");
    const requestedDeviceId = readOptionalUuid(body.deviceId, "deviceId");
    const data = {
      companyId: context.companyId,
      userId: context.userId,
      os: readDeviceOs(body.os),
      hostname: sanitizeOptionalText(body.hostname, MAX_HOSTNAME_LENGTH),
      agentVersion: sanitizeOptionalText(body.agentVersion, MAX_AGENT_VERSION_LENGTH),
      lastSeenAt: new Date(),
      revokedAt: null,
    };

    if (requestedDeviceId) {
      const existingDevice = await this.prisma.device.findUnique({ where: { id: requestedDeviceId } });

      if (existingDevice && (existingDevice.companyId !== context.companyId || existingDevice.userId !== context.userId)) {
        throw new ForbiddenException("Device is already bound to another WorkMap user or tenant.");
      }

      const device = existingDevice
        ? await this.prisma.device.update({ where: { id: requestedDeviceId }, data })
        : await this.prisma.device.create({ data: { id: requestedDeviceId, ...data } });

      return toDeviceRegistrationResponse(device);
    }

    const device = await this.prisma.device.create({ data });
    return toDeviceRegistrationResponse(device);
  }

  async recordHeartbeat(context: RequestContext, input: unknown, clientType?: DeviceClientType) {
    const body = readObject(input, "Device heartbeat body must be an object.");
    const deviceId = readRequiredUuid(body.deviceId, "deviceId");
    const sessionId = readOptionalUuid(body.sessionId, "sessionId");
    const currentActivity = sessionId ? readCurrentActivity(body.currentActivity) : null;
    const sequenceNumber = readOptionalSequenceNumber(body.sequenceNumber);
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        companyId: context.companyId,
        userId: context.userId,
        revokedAt: null,
      },
    });

    if (!device) {
      throw new ForbiddenException("Device is not registered for this WorkMap user and tenant.");
    }

    const heartbeatAt = new Date();
    const previousLastSeenAt = device.lastSeenAt;
    const updatedDevice = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: heartbeatAt,
        agentVersion: sanitizeOptionalText(body.agentVersion, MAX_AGENT_VERSION_LENGTH) ?? device.agentVersion,
      },
    });

    if (
      clientType === DeviceClientType.BROWSER_EXTENSION
      && previousLastSeenAt
      && heartbeatAt.getTime() - previousLastSeenAt.getTime() > BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS
    ) {
      const coverageLostAt = new Date(previousLastSeenAt.getTime() + BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS);
      await this.prisma.activityEvent.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          source: ActivityEventSource.BROWSER_EXTENSION,
          eventType: ActivityEventType.HEARTBEAT,
          isIdle: false,
          isActiveWindow: false,
          startedAt: coverageLostAt,
          endedAt: heartbeatAt,
          durationSeconds: Math.max(1, Math.round((heartbeatAt.getTime() - coverageLostAt.getTime()) / 1000)),
        },
      });
    }

    if (sessionId) {
      const session = await this.prisma.agentSession.findFirst({
        where: {
          id: sessionId,
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          endedAt: null,
        },
        select: { id: true },
      });
      if (!session) throw new ForbiddenException("Agent session is not active for this device.");

      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          lastHeartbeatAt: new Date(),
          currentAppName: currentActivity?.appName ?? null,
          currentAppStartedAt: currentActivity?.startedAt ?? null,
          currentAppLastObservedAt: currentActivity?.lastObservedAt ?? null,
          currentAppIsIdle: currentActivity?.isIdle ?? false,
          timeZone: readOptionalTimeZone(body.timeZone) ?? undefined,
        },
      });
      if (sequenceNumber !== null) {
        await this.prisma.agentSession.updateMany({
          where: {
            id: session.id,
            OR: [
              { lastSequenceNumber: null },
              { lastSequenceNumber: { lt: sequenceNumber } },
            ],
          },
          data: { lastSequenceNumber: sequenceNumber },
        });
      }
    }

    return { ...toDeviceRegistrationResponse(updatedDevice), sessionId: sessionId ?? null };
  }

  async startAgentSession(context: RequestContext, input: unknown) {
    const body = readObject(input, "Agent session body must be an object.");
    const deviceId = readRequiredUuid(body.deviceId, "deviceId");
    const device = await this.findActiveDevice(context, deviceId);
    const now = new Date();
    const clientSessionId = readOptionalUuid(body.clientSessionId, "clientSessionId");

    const session = await this.prisma.$transaction(async (tx) => {
      const existing = clientSessionId
        ? await tx.agentSession.findFirst({
          where: {
            companyId: context.companyId,
            userId: context.userId,
            deviceId,
            clientSessionId,
            endedAt: null,
          },
          select: { id: true, startedAt: true },
        })
        : null;
      if (existing) return existing;

      const previous = await tx.agentSession.findFirst({
        where: { companyId: context.companyId, userId: context.userId, deviceId, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true, lastHeartbeatAt: true },
      });
      if (previous) {
        await tx.agentSession.update({
          where: { id: previous.id },
          data: { endedAt: previous.lastHeartbeatAt, endReason: AgentSessionEndReason.UNKNOWN_INTERRUPTED },
        });
        await tx.deviceStatusEvent.create({
          data: {
            companyId: context.companyId,
            userId: context.userId,
            deviceId,
            agentSessionId: previous.id,
            status: DeviceStatus.UNKNOWN_INTERRUPTED,
            reason: DeviceStatusReason.AGENT_RESTART,
            startedAt: previous.lastHeartbeatAt,
            endedAt: previous.lastHeartbeatAt,
            lastHeartbeatAt: previous.lastHeartbeatAt,
            recordedAt: now,
            source: DeviceClientType.DESKTOP_AGENT,
            confidence: DeviceStatusConfidence.INFERRED,
          },
        });
      }
      const created = await tx.agentSession.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          agentVersion: sanitizeOptionalText(body.agentVersion, MAX_AGENT_VERSION_LENGTH) ?? device.agentVersion,
          clientSessionId,
          timeZone: readOptionalTimeZone(body.timeZone),
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
      await tx.deviceStatusEvent.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          agentSessionId: created.id,
          status: previous ? DeviceStatus.RESTARTED : DeviceStatus.RUNNING,
          reason: previous ? DeviceStatusReason.AGENT_RESTART : DeviceStatusReason.AGENT_STARTED,
          startedAt: now,
          lastHeartbeatAt: now,
          recordedAt: now,
          source: DeviceClientType.DESKTOP_AGENT,
          timeZone: created.timeZone,
          confidence: DeviceStatusConfidence.CONFIRMED,
        },
      });
      return created;
    });

    return { sessionId: session.id, startedAt: session.startedAt.toISOString() };
  }

  async stopAgentSession(context: RequestContext, input: unknown) {
    const body = readObject(input, "Agent session body must be an object.");
    const deviceId = readRequiredUuid(body.deviceId, "deviceId");
    const sessionId = readRequiredUuid(body.sessionId, "sessionId");
    await this.findActiveDevice(context, deviceId);
    const session = await this.prisma.agentSession.findFirst({
      where: { id: sessionId, companyId: context.companyId, userId: context.userId, deviceId },
    });
    if (!session) throw new ForbiddenException("Agent session is not visible for this device.");
    if (session.endedAt) return { sessionId, endedAt: session.endedAt.toISOString(), endReason: session.endReason };

    const endedAt = new Date();
    const stop = readStopReason(body.reason);
    const updated = await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        endedAt,
        lastHeartbeatAt: endedAt,
        endReason: stop.endReason,
        currentAppName: null,
        currentAppStartedAt: null,
        currentAppLastObservedAt: null,
        currentAppIsIdle: false,
      },
    });
    await this.prisma.deviceStatusEvent.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId,
        agentSessionId: session.id,
        status: stop.status,
        reason: stop.reason,
        startedAt: endedAt,
        endedAt,
        lastHeartbeatAt: endedAt,
        recordedAt: endedAt,
        source: DeviceClientType.DESKTOP_AGENT,
        timeZone: readOptionalTimeZone(body.timeZone) ?? session.timeZone,
        confidence: stop.confidence,
      },
    });
    return { sessionId, endedAt: updated.endedAt?.toISOString() ?? endedAt.toISOString(), endReason: updated.endReason };
  }

  async recordDeviceStatus(context: RequestContext, input: unknown, clientType: DeviceClientType) {
    const body = readObject(input, "Device status body must be an object.");
    const deviceId = readRequiredUuid(body.deviceId, "deviceId");
    await this.findActiveDevice(context, deviceId);
    const status = readDeviceStatus(body.status);
    const reason = readDeviceStatusReason(body.reason);
    const now = new Date();
    const recordedAt = readOptionalDate(body.recordedAt, "recordedAt") ?? now;
    const startedAt = readOptionalDate(body.startedAt, "startedAt") ?? recordedAt;
    const endedAt = readOptionalDate(body.endedAt, "endedAt");
    const lastHeartbeatAt = readOptionalDate(body.lastHeartbeatAt, "lastHeartbeatAt");
    assertStatusTiming({ now, startedAt, endedAt, recordedAt, lastHeartbeatAt });
    const agentSessionId = readOptionalUuid(body.sessionId, "sessionId");
    const clientEventId = readOptionalUuid(body.clientEventId, "clientEventId");
    const metadata = readStatusMetadata(body.metadata);

    const session = agentSessionId
      ? await this.prisma.agentSession.findFirst({
        where: { id: agentSessionId, companyId: context.companyId, userId: context.userId, deviceId },
        select: { id: true, endedAt: true, endReason: true },
      })
      : null;
    if (agentSessionId && !session) throw new ForbiddenException("Agent session is not visible for this device.");

    const latestTransition = await this.prisma.deviceStatusEvent.findFirst({
      where: { companyId: context.companyId, deviceId, source: clientType },
      orderBy: { recordedAt: "desc" },
    });
    if (
      latestTransition
      && latestTransition.status === status
      && latestTransition.reason === reason
      && latestTransition.agentSessionId === agentSessionId
      && hasSameTrackingState(latestTransition.metadata, metadata)
    ) {
      return toStatusEventResponse(latestTransition);
    }

    let event;
    try {
      event = await this.prisma.deviceStatusEvent.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          agentSessionId,
          clientEventId,
          status,
          reason,
          startedAt,
          endedAt,
          lastHeartbeatAt,
          recordedAt,
          source: clientType,
          timeZone: readOptionalTimeZone(body.timeZone),
          confidence: body.confidence === "INFERRED" ? DeviceStatusConfidence.INFERRED : DeviceStatusConfidence.CONFIRMED,
          metadata,
        },
      });
    } catch (error) {
      if (!clientEventId || !isPrismaUniqueError(error)) throw error;
      const existing = await this.prisma.deviceStatusEvent.findFirst({
        where: { companyId: context.companyId, source: clientType, clientEventId },
      });
      if (!existing) throw error;
      event = existing;
    }

    // Tracking-access diagnostics describe Extension capability, not a fresh device
    // heartbeat. They must not make Reports show a client as connected ahead of a
    // queued activity checkpoint.
    if (
      (status === DeviceStatus.RUNNING || status === DeviceStatus.RECONNECTED)
      && metadata?.operation !== "tracking-access"
    ) {
      await this.prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: now } });
    }

    const endReason = sessionEndReasonForDeviceStatus(status);
    if (session && endReason && (!session.endedAt || session.endReason === AgentSessionEndReason.UNKNOWN_INTERRUPTED)) {
      const finalAt = endedAt ?? recordedAt;
      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          endedAt: session.endedAt ?? finalAt,
          lastHeartbeatAt: session.endedAt ? undefined : lastHeartbeatAt ?? finalAt,
          endReason,
          currentAppName: null,
          currentAppStartedAt: null,
          currentAppLastObservedAt: null,
          currentAppIsIdle: false,
        },
      });
    }

    return toStatusEventResponse(event);
  }

  private async findActiveDevice(context: RequestContext, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, companyId: context.companyId, userId: context.userId, revokedAt: null },
    });
    if (!device) throw new ForbiddenException("Device is not registered for this WorkMap user and tenant.");
    return device;
  }
}

function toDeviceRegistrationResponse(device: {
  id: string;
  os: DeviceOS;
  hostname: string | null;
  agentVersion: string | null;
  lastSeenAt: Date | null;
  revokedAt?: Date | null;
}) {
  return {
    device: {
      id: device.id,
      os: device.os,
      hostname: device.hostname,
      agentVersion: device.agentVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
    },
  };
}

function readObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }

  return value as Record<string, unknown>;
}

function readDeviceOs(value: unknown): DeviceOS {
  if (typeof value !== "string") {
    return DeviceOS.UNKNOWN;
  }

  const normalized = value.trim().toUpperCase();
  return DEVICE_OS_VALUES.has(normalized) ? (normalized as DeviceOS) : DeviceOS.UNKNOWN;
}

function readOptionalUuid(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return readRequiredUuid(value, label);
}

function readOptionalSequenceNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new BadRequestException("sequenceNumber must be a non-negative integer.");
  }
  return value;
}

function readRequiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID.`);
  }

  return value;
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new BadRequestException("Text fields must be strings.");
  }

  const sanitized = replaceControlCharacters(value).replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, maxLength) : undefined;
}

function readOptionalTimeZone(value: unknown) {
  const timeZone = sanitizeOptionalText(value, MAX_TIME_ZONE_LENGTH);
  if (!timeZone) return undefined;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return timeZone;
  } catch {
    throw new BadRequestException("timeZone must be a valid IANA time zone.");
  }
}

function readOptionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  return readRequiredDate(value, label);
}

function readDeviceStatus(value: unknown) {
  if (typeof value !== "string" || !DEVICE_STATUS_VALUES.has(value)) {
    throw new BadRequestException("status must be a supported device status.");
  }
  return value as DeviceStatus;
}

function readDeviceStatusReason(value: unknown) {
  if (typeof value !== "string" || !DEVICE_STATUS_REASON_VALUES.has(value)) {
    throw new BadRequestException("reason must be a supported device status reason.");
  }
  return value as DeviceStatusReason;
}

function readStatusMetadata(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const body = readObject(value, "metadata must be an object.");
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(body)) {
    if (!MAX_STATUS_METADATA_KEYS.has(key) || typeof entry !== "string") continue;
    const safe = sanitizeOptionalText(entry, MAX_STATUS_METADATA_VALUE_LENGTH);
    if (safe) metadata[key] = safe;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function hasSameTrackingState(previous: unknown, next: Record<string, string> | undefined) {
  const previousState = typeof previous === "object" && previous !== null && !Array.isArray(previous)
    ? (previous as Record<string, unknown>).trackingState
    : undefined;
  return previousState === next?.trackingState;
}

function assertStatusTiming(input: {
  now: Date;
  startedAt: Date;
  endedAt: Date | null;
  recordedAt: Date;
  lastHeartbeatAt: Date | null;
}) {
  const maxFutureMs = input.now.getTime() + 5 * 60_000;
  const minAgeMs = input.now.getTime() - 31 * 24 * 60 * 60 * 1_000;
  for (const value of [input.startedAt, input.endedAt, input.recordedAt, input.lastHeartbeatAt]) {
    if (!value) continue;
    if (value.getTime() < minAgeMs || value.getTime() > maxFutureMs) {
      throw new BadRequestException("Device status timestamp is outside the accepted clock window.");
    }
  }
  if (input.endedAt && input.endedAt.getTime() < input.startedAt.getTime()) {
    throw new BadRequestException("Device status endedAt cannot precede startedAt.");
  }
}

function sessionEndReasonForDeviceStatus(status: DeviceStatus) {
  switch (status) {
    case DeviceStatus.STOPPED_BY_USER: return AgentSessionEndReason.USER_STOP;
    case DeviceStatus.DEVICE_SHUTDOWN: return AgentSessionEndReason.DEVICE_SHUTDOWN;
    case DeviceStatus.AGENT_CRASHED: return AgentSessionEndReason.AGENT_CRASHED;
    case DeviceStatus.AGENT_TERMINATED: return AgentSessionEndReason.AGENT_TERMINATED;
    case DeviceStatus.UNKNOWN_INTERRUPTED: return AgentSessionEndReason.UNKNOWN_INTERRUPTED;
    default: return null;
  }
}

function readStopReason(value: unknown) {
  switch (value) {
    case "USER_STOP":
      return {
        endReason: AgentSessionEndReason.USER_STOP,
        status: DeviceStatus.STOPPED_BY_USER,
        reason: DeviceStatusReason.USER_STOP,
        confidence: DeviceStatusConfidence.CONFIRMED,
      };
    case "DEVICE_SHUTDOWN":
      return {
        endReason: AgentSessionEndReason.DEVICE_SHUTDOWN,
        status: DeviceStatus.DEVICE_SHUTDOWN,
        reason: DeviceStatusReason.SYSTEM_SHUTDOWN,
        confidence: DeviceStatusConfidence.CONFIRMED,
      };
    case "SUSPENDED":
      return {
        endReason: AgentSessionEndReason.SUSPENDED,
        status: DeviceStatus.SLEEPING,
        reason: DeviceStatusReason.SYSTEM_SUSPEND,
        confidence: DeviceStatusConfidence.CONFIRMED,
      };
    case "AGENT_CRASHED":
      return {
        endReason: AgentSessionEndReason.AGENT_CRASHED,
        status: DeviceStatus.AGENT_CRASHED,
        reason: DeviceStatusReason.PROCESS_CRASH,
        confidence: DeviceStatusConfidence.CONFIRMED,
      };
    case "AGENT_TERMINATED":
      return {
        endReason: AgentSessionEndReason.AGENT_TERMINATED,
        status: DeviceStatus.AGENT_TERMINATED,
        reason: DeviceStatusReason.PROCESS_TERMINATED,
        confidence: DeviceStatusConfidence.CONFIRMED,
      };
    default:
      return {
        endReason: AgentSessionEndReason.GRACEFUL_SHUTDOWN,
        status: DeviceStatus.UNKNOWN_INTERRUPTED,
        reason: DeviceStatusReason.UNKNOWN,
        confidence: DeviceStatusConfidence.INFERRED,
      };
  }
}

function toStatusEventResponse(event: {
  id: string;
  status: DeviceStatus;
  reason: DeviceStatusReason;
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
  recordedAt: Date;
  receivedAt: Date;
  source: DeviceClientType;
  timeZone: string | null;
  confidence: DeviceStatusConfidence;
}) {
  return {
    statusEvent: {
      id: event.id,
      status: event.status,
      reason: event.reason,
      startedAt: event.startedAt.toISOString(),
      endedAt: event.endedAt?.toISOString() ?? null,
      lastHeartbeatAt: event.lastHeartbeatAt?.toISOString() ?? null,
      recordedAt: event.recordedAt.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
      source: event.source,
      timeZone: event.timeZone,
      confidence: event.confidence,
    },
  };
}

function isPrismaUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function readCurrentActivity(value: unknown, now = new Date()) {
  if (value === undefined || value === null) return null;
  const body = readObject(value, "currentActivity must be an object or null.");
  const appName = sanitizeOptionalText(body.appName, 120);
  if (!appName) return null;
  let startedAt = readRequiredDate(body.startedAt, "currentActivity.startedAt");
  let lastObservedAt = readRequiredDate(body.lastObservedAt, "currentActivity.lastObservedAt");
  if (lastObservedAt < startedAt) throw new BadRequestException("Current activity observation cannot precede its start.");
  const futureSkewMs = lastObservedAt.getTime() - now.getTime();
  if (futureSkewMs > MAX_CURRENT_ACTIVITY_FUTURE_SKEW_MS) {
    throw new BadRequestException("Current activity observation is too far in the future.");
  }
  if (futureSkewMs > 0) {
    startedAt = new Date(startedAt.getTime() - futureSkewMs);
    lastObservedAt = now;
  }
  return { appName, startedAt, lastObservedAt, isIdle: body.isIdle === true };
}

function readRequiredDate(value: unknown, label: string) {
  if (typeof value !== "string") throw new BadRequestException(`${label} must be an ISO timestamp.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${label} must be an ISO timestamp.`);
  return parsed;
}

function replaceControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
}

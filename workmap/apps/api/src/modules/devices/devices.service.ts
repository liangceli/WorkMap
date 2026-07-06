import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ActivityEventSource, ActivityEventType, AgentSessionEndReason, DeviceClientType, DeviceOS } from "@prisma/client";
import { canViewDeviceHealth, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_OS_VALUES = new Set<string>(Object.values(DeviceOS));
const MAX_HOSTNAME_LENGTH = 120;
const MAX_AGENT_VERSION_LENGTH = 80;
export const BROWSER_EXTENSION_SIGNAL_LOST_AFTER_MS = 90_000;

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

    const sessionId = readOptionalUuid(body.sessionId, "sessionId");
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

      const currentActivity = readCurrentActivity(body.currentActivity);
      await this.prisma.agentSession.update({
        where: { id: session.id },
        data: {
          lastHeartbeatAt: new Date(),
          currentAppName: currentActivity?.appName ?? null,
          currentAppStartedAt: currentActivity?.startedAt ?? null,
          currentAppLastObservedAt: currentActivity?.lastObservedAt ?? null,
          currentAppIsIdle: currentActivity?.isIdle ?? false,
        },
      });
    }

    return { ...toDeviceRegistrationResponse(updatedDevice), sessionId: sessionId ?? null };
  }

  async startAgentSession(context: RequestContext, input: unknown) {
    const body = readObject(input, "Agent session body must be an object.");
    const deviceId = readRequiredUuid(body.deviceId, "deviceId");
    const device = await this.findActiveDevice(context, deviceId);
    const now = new Date();

    const session = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.agentSession.findFirst({
        where: { companyId: context.companyId, userId: context.userId, deviceId, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true, lastHeartbeatAt: true },
      });
      if (previous) {
        await tx.agentSession.update({
          where: { id: previous.id },
          data: { endedAt: previous.lastHeartbeatAt, endReason: AgentSessionEndReason.UNEXPECTED_STOP },
        });
      }
      return tx.agentSession.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId,
          agentVersion: sanitizeOptionalText(body.agentVersion, MAX_AGENT_VERSION_LENGTH) ?? device.agentVersion,
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
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
    const updated = await this.prisma.agentSession.update({
      where: { id: session.id },
      data: {
        endedAt,
        lastHeartbeatAt: endedAt,
        endReason: AgentSessionEndReason.GRACEFUL_SHUTDOWN,
        currentAppName: null,
        currentAppStartedAt: null,
        currentAppLastObservedAt: null,
        currentAppIsIdle: false,
      },
    });
    return { sessionId, endedAt: updated.endedAt?.toISOString() ?? endedAt.toISOString(), endReason: updated.endReason };
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

function readCurrentActivity(value: unknown) {
  if (value === undefined || value === null) return null;
  const body = readObject(value, "currentActivity must be an object or null.");
  const appName = sanitizeOptionalText(body.appName, 120);
  if (!appName) return null;
  const startedAt = readRequiredDate(body.startedAt, "currentActivity.startedAt");
  const lastObservedAt = readRequiredDate(body.lastObservedAt, "currentActivity.lastObservedAt");
  if (lastObservedAt < startedAt) throw new BadRequestException("Current activity observation cannot precede its start.");
  if (lastObservedAt.getTime() > Date.now() + 60_000) throw new BadRequestException("Current activity observation is too far in the future.");
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

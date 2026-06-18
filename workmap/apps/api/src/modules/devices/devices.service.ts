import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { DeviceOS } from "@prisma/client";
import { canViewDeviceHealth, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_OS_VALUES = new Set<string>(Object.values(DeviceOS));
const MAX_HOSTNAME_LENGTH = 120;
const MAX_AGENT_VERSION_LENGTH = 80;

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

  async recordHeartbeat(context: RequestContext, input: unknown) {
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

    const updatedDevice = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        agentVersion: sanitizeOptionalText(body.agentVersion, MAX_AGENT_VERSION_LENGTH) ?? device.agentVersion,
      },
    });

    return toDeviceRegistrationResponse(updatedDevice);
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

function replaceControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
}

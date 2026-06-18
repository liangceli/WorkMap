import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { DeviceClientType, DeviceOS } from "@prisma/client";
import { canViewDeviceHealth, type RequestContext, type WorkMapRole } from "@workmap/auth";
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DeviceRequestContext } from "./device-context.js";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const CREDENTIAL_PREFIX = "wmdev_";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLIENT_TYPES = new Set<string>(Object.values(DeviceClientType));
const OS_VALUES = new Set<string>(Object.values(DeviceOS));

@Injectable()
export class DevicePairingService {
  constructor(private readonly prisma: PrismaService) {}

  async createPairingCode(context: RequestContext, input: unknown) {
    const body = readObject(input, "Pairing code body must be an object.");
    const clientType = readClientType(body.clientType);
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rawCode = createReadableCode();
      try {
        await this.prisma.devicePairingCode.create({
          data: {
            companyId: context.companyId,
            userId: context.userId,
            clientType,
            codeHash: hashPairingCode(rawCode),
            expiresAt,
          },
        });

        return { code: formatCode(rawCode), clientType, expiresAt: expiresAt.toISOString() };
      } catch (error) {
        if (!isPrismaUniqueError(error) || attempt === 3) {
          throw error;
        }
      }
    }

    throw new BadRequestException("Unable to create a unique pairing code.");
  }

  async exchangePairingCode(input: unknown) {
    const body = readObject(input, "Pairing request must be an object.");
    const normalizedCode = normalizeCode(readRequiredString(body.code, "code"));
    const codeHash = hashPairingCode(normalizedCode);
    const pairing = await this.prisma.devicePairingCode.findUnique({ where: { codeHash } });
    const now = new Date();

    if (!pairing || pairing.usedAt || pairing.expiresAt <= now) {
      throw new UnauthorizedException("Pairing code is invalid, expired, or already used.");
    }

    const credential = `${CREDENTIAL_PREFIX}${randomBytes(32).toString("base64url")}`;
    const tokenHash = hashCredential(credential);
    const os = readDeviceOs(body.os);
    const hostname = sanitizeOptionalText(body.hostname, 120);
    const agentVersion = sanitizeOptionalText(body.agentVersion, 80);

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.devicePairingCode.updateMany({
        where: { id: pairing.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new UnauthorizedException("Pairing code is invalid, expired, or already used.");
      }

      const device = await tx.device.create({
        data: {
          companyId: pairing.companyId,
          userId: pairing.userId,
          os,
          hostname,
          agentVersion,
          lastSeenAt: now,
        },
      });
      const storedCredential = await tx.deviceCredential.create({
        data: {
          companyId: pairing.companyId,
          userId: pairing.userId,
          deviceId: device.id,
          clientType: pairing.clientType,
          tokenHash,
        },
      });
      await tx.devicePairingCode.update({ where: { id: pairing.id }, data: { deviceId: device.id } });
      return { device, credentialId: storedCredential.id };
    });

    return {
      credential,
      credentialType: "Device",
      clientType: pairing.clientType,
      device: {
        id: result.device.id,
        os: result.device.os,
        hostname: result.device.hostname,
        agentVersion: result.device.agentVersion,
        lastSeenAt: result.device.lastSeenAt?.toISOString() ?? null,
      },
    };
  }

  async resolveDeviceAuthorization(authorization: string | undefined): Promise<DeviceRequestContext> {
    const credential = readDeviceAuthorization(authorization);
    const tokenHash = hashCredential(credential);
    const stored = await this.prisma.deviceCredential.findUnique({
      where: { tokenHash },
      include: {
        device: { select: { id: true, companyId: true, userId: true, revokedAt: true } },
        user: { select: { role: true } },
      },
    });
    const now = new Date();

    if (!stored || stored.revokedAt || stored.device.revokedAt || (stored.expiresAt && stored.expiresAt <= now)) {
      throw new UnauthorizedException("Device credential is invalid or revoked.");
    }

    if (stored.companyId !== stored.device.companyId || stored.userId !== stored.device.userId) {
      throw new UnauthorizedException("Device credential binding is invalid.");
    }

    await this.prisma.deviceCredential.update({ where: { id: stored.id }, data: { lastUsedAt: now } });

    return {
      companyId: stored.companyId,
      userId: stored.userId,
      role: stored.user.role as WorkMapRole,
      deviceId: stored.deviceId,
      credentialId: stored.id,
      clientType: stored.clientType,
    };
  }

  async revokeDevice(context: RequestContext, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, companyId: context.companyId },
      select: { id: true, userId: true, revokedAt: true },
    });

    if (!device) {
      throw new ForbiddenException("Device is not visible in this tenant.");
    }
    if (device.userId !== context.userId && !canViewDeviceHealth(context)) {
      throw new ForbiddenException("Only the device owner or an authorised device administrator can revoke it.");
    }

    const revokedAt = device.revokedAt ?? new Date();
    await this.prisma.$transaction([
      this.prisma.device.update({ where: { id: device.id }, data: { revokedAt } }),
      this.prisma.deviceCredential.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt },
      }),
    ]);

    return { deviceId: device.id, revokedAt: revokedAt.toISOString() };
  }
}

function readDeviceAuthorization(value: string | undefined) {
  if (!value) {
    throw new UnauthorizedException("Device credential is required.");
  }
  const match = /^Device\s+(.+)$/i.exec(value.trim());
  if (!match?.[1]?.startsWith(CREDENTIAL_PREFIX)) {
    throw new UnauthorizedException("Device credential is invalid.");
  }
  return match[1];
}

function hashCredential(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPairingCode(value: string) {
  const pepper = process.env.WORKMAP_DEVICE_PAIRING_PEPPER?.trim() || process.env.WORKMAP_JWT_SECRET?.trim() || "workmap-local-pairing";
  return createHmac("sha256", pepper).update(normalizeCode(value)).digest("hex");
}

function createReadableCode() {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function formatCode(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

function normalizeCode(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length !== 8) {
    throw new BadRequestException("Pairing code must contain 8 letters or numbers.");
  }
  return normalized;
}

function readObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function readClientType(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CLIENT_TYPES.has(normalized)) {
    throw new BadRequestException("clientType must be DESKTOP_AGENT or BROWSER_EXTENSION.");
  }
  return normalized as DeviceClientType;
}

function readDeviceOs(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "UNKNOWN";
  return OS_VALUES.has(normalized) ? (normalized as DeviceOS) : DeviceOS.UNKNOWN;
}

function sanitizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new BadRequestException("Text fields must be strings.");
  const sanitized = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, maxLength) : undefined;
}

function isPrismaUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

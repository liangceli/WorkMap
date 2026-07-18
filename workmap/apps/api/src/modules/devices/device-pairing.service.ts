import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  BrowserName,
  DeviceClientType,
  DeviceOS,
  Prisma,
  WorkstationPairingMode,
} from "@prisma/client";
import { canViewDeviceHealth, type RequestContext, type WorkMapRole } from "@workmap/auth";
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DeviceRequestContext } from "./device-context.js";

const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
const CREDENTIAL_PREFIX = "wmdev_";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLIENT_TYPES = new Set<string>(Object.values(DeviceClientType));
const OS_VALUES = new Set<string>(Object.values(DeviceOS));
const BROWSER_NAMES = new Set<string>([BrowserName.CHROME, BrowserName.EDGE]);
const WORKSTATION_MODES = new Set<string>(Object.values(WorkstationPairingMode));
const PAIRING_CODE_PEPPER =
  process.env.WORKMAP_DEVICE_PAIRING_PEPPER?.trim() ||
  process.env.WORKMAP_JWT_SECRET?.trim() ||
  randomBytes(32).toString("base64url");

@Injectable()
export class DevicePairingService {
  constructor(private readonly prisma: PrismaService) {}

  async createPairingCode(context: RequestContext, input: unknown) {
    const body = readObject(input, "Pairing code body must be an object.");
    const clientType = readClientType(body.clientType);
    const workstationMode = readWorkstationMode(body.workstationMode, clientType);
    const workstationId = readOptionalUuid(body.workstationId, "workstationId");
    const expectedDesktopDeviceId = readOptionalUuid(
      body.expectedDesktopDeviceId,
      "expectedDesktopDeviceId",
    );
    await this.validatePairingIntent(
      context,
      clientType,
      workstationMode,
      workstationId,
      expectedDesktopDeviceId,
    );
    const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const rawCode = createReadableCode();
      try {
        const created = await this.prisma.devicePairingCode.create({
          data: {
            companyId: context.companyId,
            userId: context.userId,
            clientType,
            workstationMode,
            workstationId,
            expectedDesktopDeviceId,
            codeHash: hashPairingCode(rawCode),
            expiresAt,
          },
        });

        return {
          id: created.id,
          code: formatCode(rawCode),
          clientType,
          workstationMode,
          workstationId,
          status: "pending" as const,
          expiresAt: expiresAt.toISOString(),
        };
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
    const requestedClientType = readClientType(body.clientType);
    if (requestedClientType !== pairing.clientType) {
      throw new UnauthorizedException("Pairing code is not valid for this client type.");
    }

    const credential = `${CREDENTIAL_PREFIX}${randomBytes(32).toString("base64url")}`;
    const tokenHash = hashCredential(credential);
    const os = readDeviceOs(body.os);
    const hostname = sanitizeOptionalText(body.hostname, 120);
    const agentVersion = sanitizeOptionalText(body.agentVersion, 80);
    const browserName = pairing.clientType === DeviceClientType.BROWSER_EXTENSION
      ? readBrowserName(body.browserName ?? body.hostname)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      if ("$queryRaw" in tx) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "DevicePairingCode" WHERE "id" = ${pairing.id}::uuid FOR UPDATE`,
        );
      }
      const claimed = await tx.devicePairingCode.updateMany({
        where: { id: pairing.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new UnauthorizedException("Pairing code is invalid, expired, or already used.");
      }

      const workstationId = await this.resolvePairingWorkstation(tx, pairing, {
        hostname,
        workstationName: sanitizeOptionalText(body.workstationName, 120),
      });

      if (
        pairing.clientType === DeviceClientType.DESKTOP_AGENT &&
        pairing.workstationMode === WorkstationPairingMode.EXISTING &&
        workstationId
      ) {
        const activeDesktop = await tx.device.findFirst({
          where: {
            workstationId,
            clientType: DeviceClientType.DESKTOP_AGENT,
            revokedAt: null,
          },
          select: { id: true },
        });
        if (
          !pairing.expectedDesktopDeviceId ||
          activeDesktop?.id !== pairing.expectedDesktopDeviceId
        ) {
          throw new ForbiddenException(
            "The Desktop replacement target changed. Create a new pairing code.",
          );
        }
        await tx.device.update({
          where: { id: activeDesktop.id },
          data: { revokedAt: now },
        });
        await tx.deviceCredential.updateMany({
          where: { deviceId: activeDesktop.id, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      const device = await tx.device.create({
        data: {
          companyId: pairing.companyId,
          userId: pairing.userId,
          os,
          hostname,
          agentVersion,
          clientType: pairing.clientType,
          browserName,
          workstationId,
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
        clientType: result.device.clientType,
        browserName: result.device.browserName,
        workstationId: result.device.workstationId,
        lastSeenAt: result.device.lastSeenAt?.toISOString() ?? null,
      },
    };
  }

  async listWorkstations(context: RequestContext) {
    const workstations = await this.prisma.workstation.findMany({
      where: {
        companyId: context.companyId,
        userId: context.userId,
        revokedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        devices: {
          where: { revokedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            clientType: true,
            browserName: true,
            hostname: true,
            agentVersion: true,
            lastSeenAt: true,
          },
        },
      },
    });

    return {
      workstations: workstations.map((workstation) => ({
        id: workstation.id,
        displayName: workstation.displayName,
        activeDesktopDeviceId:
          workstation.devices.find(
            (device) => device.clientType === DeviceClientType.DESKTOP_AGENT,
          )?.id ?? null,
        devices: workstation.devices.map((device) => ({
          ...device,
          lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        })),
      })),
    };
  }

  async getPairingStatus(context: RequestContext, pairingId: string) {
    const pairing = await this.prisma.devicePairingCode.findFirst({
      where: { id: pairingId, companyId: context.companyId, userId: context.userId },
      select: {
        id: true,
        clientType: true,
        workstationMode: true,
        workstationId: true,
        expiresAt: true,
        usedAt: true,
        deviceId: true,
      },
    });
    if (!pairing) throw new ForbiddenException("Pairing request is not visible to this user and tenant.");
    const status = pairing.usedAt ? "paired" : pairing.expiresAt <= new Date() ? "expired" : "pending";
    return {
      id: pairing.id,
      clientType: pairing.clientType,
      workstationMode: pairing.workstationMode,
      workstationId: pairing.workstationId,
      status,
      expiresAt: pairing.expiresAt.toISOString(),
      deviceId: status === "paired" ? pairing.deviceId : null,
    };
  }

  async resolveDeviceAuthorization(authorization: string | undefined): Promise<DeviceRequestContext> {
    const credential = readDeviceAuthorization(authorization);
    const tokenHash = hashCredential(credential);
    const stored = await this.prisma.deviceCredential.findUnique({
      where: { tokenHash },
      include: {
        device: {
          select: {
            id: true,
            companyId: true,
            userId: true,
            revokedAt: true,
            clientType: true,
            browserName: true,
            workstationId: true,
            protocolActivatedAt: true,
          },
        },
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
    if (stored.device.clientType && stored.clientType !== stored.device.clientType) {
      throw new UnauthorizedException("Device credential client binding is invalid.");
    }

    await this.prisma.deviceCredential.update({ where: { id: stored.id }, data: { lastUsedAt: now } });

    return {
      companyId: stored.companyId,
      userId: stored.userId,
      role: stored.user.role as WorkMapRole,
      deviceId: stored.deviceId,
      credentialId: stored.id,
      clientType: stored.clientType,
      browserName: stored.device.browserName,
      workstationId: stored.device.workstationId,
      protocolActivatedAt: stored.device.protocolActivatedAt,
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

  private async validatePairingIntent(
    context: RequestContext,
    clientType: DeviceClientType,
    workstationMode: WorkstationPairingMode,
    workstationId: string | null,
    expectedDesktopDeviceId: string | null,
  ) {
    if (
      clientType === DeviceClientType.DESKTOP_AGENT &&
      workstationMode === WorkstationPairingMode.STANDALONE
    ) {
      throw new BadRequestException("Desktop Agent cannot use STANDALONE pairing.");
    }
    if (
      clientType === DeviceClientType.BROWSER_EXTENSION &&
      workstationMode === WorkstationPairingMode.CREATE_NEW
    ) {
      throw new BadRequestException(
        "Browser Extension must use an existing workstation or STANDALONE pairing.",
      );
    }
    if (workstationMode !== WorkstationPairingMode.EXISTING) {
      if (workstationId || expectedDesktopDeviceId) {
        throw new BadRequestException(
          "workstationId and expectedDesktopDeviceId require EXISTING pairing.",
        );
      }
      return;
    }
    if (!workstationId) {
      throw new BadRequestException("workstationId is required for EXISTING pairing.");
    }

    const workstation = await this.prisma.workstation.findFirst({
      where: {
        id: workstationId,
        companyId: context.companyId,
        userId: context.userId,
        revokedAt: null,
      },
      include: {
        devices: {
          where: {
            clientType: DeviceClientType.DESKTOP_AGENT,
            revokedAt: null,
          },
          select: { id: true },
        },
      },
    });
    if (!workstation) {
      throw new ForbiddenException("Workstation is not visible to this user and tenant.");
    }

    if (clientType === DeviceClientType.DESKTOP_AGENT) {
      const activeDesktopId = workstation.devices[0]?.id ?? null;
      if (!activeDesktopId || activeDesktopId !== expectedDesktopDeviceId) {
        throw new BadRequestException(
          "expectedDesktopDeviceId must identify the current active Desktop device.",
        );
      }
    } else if (expectedDesktopDeviceId) {
      throw new BadRequestException(
        "expectedDesktopDeviceId is only valid for Desktop replacement.",
      );
    }
  }

  private async resolvePairingWorkstation(
    tx: Prisma.TransactionClient,
    pairing: {
      companyId: string;
      userId: string;
      clientType: DeviceClientType;
      workstationId: string | null;
      workstationMode: WorkstationPairingMode | null;
    },
    metadata: { hostname?: string; workstationName?: string },
  ) {
    const workstationMode =
      pairing.workstationMode ??
      (pairing.clientType === DeviceClientType.DESKTOP_AGENT
        ? WorkstationPairingMode.CREATE_NEW
        : WorkstationPairingMode.STANDALONE);

    if (workstationMode === WorkstationPairingMode.STANDALONE) {
      return null;
    }
    if (workstationMode === WorkstationPairingMode.EXISTING) {
      if (!pairing.workstationId) {
        throw new UnauthorizedException("Pairing code has no workstation binding.");
      }
      const workstation = await tx.workstation.findFirst({
        where: {
          id: pairing.workstationId,
          companyId: pairing.companyId,
          userId: pairing.userId,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!workstation) {
        throw new UnauthorizedException("Pairing workstation is unavailable.");
      }
      return workstation.id;
    }

    if (pairing.clientType !== DeviceClientType.DESKTOP_AGENT) {
      throw new UnauthorizedException("Only Desktop Agent can create a workstation.");
    }
    const workstation = await tx.workstation.create({
      data: {
        companyId: pairing.companyId,
        userId: pairing.userId,
        displayName:
          metadata.workstationName ??
          metadata.hostname ??
          "Windows workstation",
      },
      select: { id: true },
    });
    return workstation.id;
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
  return createHmac("sha256", PAIRING_CODE_PEPPER).update(normalizeCode(value)).digest("hex");
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

function readWorkstationMode(
  value: unknown,
  clientType: DeviceClientType,
): WorkstationPairingMode {
  if (value === undefined || value === null || value === "") {
    return clientType === DeviceClientType.DESKTOP_AGENT
      ? WorkstationPairingMode.CREATE_NEW
      : WorkstationPairingMode.STANDALONE;
  }
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!WORKSTATION_MODES.has(normalized)) {
    throw new BadRequestException(
      "workstationMode must be CREATE_NEW, EXISTING, or STANDALONE.",
    );
  }
  return normalized as WorkstationPairingMode;
}

function readOptionalUuid(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new BadRequestException(`${label} must be a UUID.`);
  }
  return value.toLowerCase();
}

function readBrowserName(value: unknown): BrowserName {
  const normalized = typeof value === "string"
    ? value.trim().toUpperCase().replace(/[^A-Z]/g, "_")
    : "";
  const browserName = normalized.includes("EDGE")
    ? BrowserName.EDGE
    : normalized.includes("CHROME")
      ? BrowserName.CHROME
      : normalized;
  if (!BROWSER_NAMES.has(browserName)) {
    throw new BadRequestException(
      "browserName must identify CHROME or EDGE for Browser Extension pairing.",
    );
  }
  return browserName as BrowserName;
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrowserName,
  DeviceClientType,
  TrackingProtocolActivationState,
} from "@prisma/client";
import {
  FOCUS_IDLE_THRESHOLD_MS,
  type TrackingPolicyUtcWindowV2,
} from "@workmap/shared-types";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DeviceRequestContext } from "./device-context.js";

const POLICY_LEASE_MS = 24 * 60 * 60 * 1000;
const REUSE_LEASE_MIN_REMAINING_MS = 5 * 60 * 1000;
const ACTIVATION_LEAD_MS = 2_000;
const ACTIVATION_SKEW_MS = 1_000;

type DeviceTrackingPolicy = {
  policyId: string;
  policyVersion: string;
  effectiveAt: string;
  policyLeaseId: string | null;
  policyLeaseIssuedAt: string | null;
  policyLeaseExpiresAt: string | null;
  serverTime: string;
  scheduleTimeZone: string | null;
  scheduleTimeZoneState: "CONFIRMED" | "TIMEZONE_REQUIRED";
  allowedUtcWindows: TrackingPolicyUtcWindowV2[];
  allowedUtcWindowsHash: string | null;
  workHoursOnly: boolean;
  workdayStart: string;
  workdayEnd: string;
  idleThresholdMs: number;
  collectAppFocus: boolean;
  collectDomainFocus: boolean;
  collectOpenRuntime: boolean;
  acknowledgementState: "ACKNOWLEDGED" | "REQUIRED";
  acknowledgedAt: string | null;
};

@Injectable()
export class TrackingV2PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrackingPolicy(
    context: DeviceRequestContext,
  ): Promise<DeviceTrackingPolicy> {
    const now = new Date();
    const identity = await this.requireV2DeviceIdentity(context);
    const policy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId: context.companyId,
        activeFrom: { lte: now },
      },
      orderBy: [{ activeFrom: "desc" }, { id: "desc" }],
    });
    if (!policy) {
      throw new NotFoundException("Active monitoring policy not found.");
    }

    const acknowledgement =
      await this.prisma.policyAcknowledgement.findUnique({
        where: {
          userId_monitoringPolicyId: {
            userId: context.userId,
            monitoringPolicyId: policy.id,
          },
        },
        select: { acknowledgedAt: true },
      });
    const sourceAllowed =
      identity.clientType === DeviceClientType.DESKTOP_AGENT
        ? policy.collectAppUsage
        : policy.collectWebsiteDomain;
    const policyAuthorised = Boolean(
      acknowledgement &&
      policy.scheduleTimeZone &&
      sourceAllowed,
    );

    let lease: {
      id: string;
      issuedAt: Date;
      expiresAt: Date;
      allowedUtcWindows: unknown;
      windowSetHash: string;
    } | null = null;
    if (policyAuthorised && policy.scheduleTimeZone) {
      lease = await this.getOrCreatePolicyLease(
        context,
        policy,
        policy.scheduleTimeZone,
        now,
      );
    }

    return {
      policyId: policy.id,
      policyVersion: policy.policyVersion,
      effectiveAt: policy.activeFrom.toISOString(),
      policyLeaseId: lease?.id ?? null,
      policyLeaseIssuedAt: lease?.issuedAt.toISOString() ?? null,
      policyLeaseExpiresAt: lease?.expiresAt.toISOString() ?? null,
      serverTime: now.toISOString(),
      scheduleTimeZone: policy.scheduleTimeZone,
      scheduleTimeZoneState: policy.scheduleTimeZone
        ? "CONFIRMED"
        : "TIMEZONE_REQUIRED",
      allowedUtcWindows: lease
        ? readStoredWindows(lease.allowedUtcWindows)
        : [],
      allowedUtcWindowsHash: lease?.windowSetHash ?? null,
      workHoursOnly: policy.workHoursOnly,
      workdayStart: policy.workdayStart,
      workdayEnd: policy.workdayEnd,
      idleThresholdMs: FOCUS_IDLE_THRESHOLD_MS,
      collectAppFocus: policy.collectAppUsage,
      collectDomainFocus: policy.collectWebsiteDomain,
      collectOpenRuntime:
        identity.clientType === DeviceClientType.DESKTOP_AGENT &&
        policy.collectOpenRuntime,
      acknowledgementState: acknowledgement ? "ACKNOWLEDGED" : "REQUIRED",
      acknowledgedAt: acknowledgement?.acknowledgedAt.toISOString() ?? null,
    };
  }

  async prepareActivation(context: DeviceRequestContext) {
    if (context.protocolActivatedAt) {
      return {
        activationId: null,
        state: "CONFIRMED" as const,
        protocolActivatedAt: context.protocolActivatedAt.toISOString(),
        serverTime: new Date().toISOString(),
        policy: await this.getTrackingPolicy(context),
      };
    }
    const policy = await this.getTrackingPolicy(context);
    if (!policy.policyLeaseId || policy.allowedUtcWindows.length === 0) {
      throw new ConflictException(
        "Tracking policy is not ready for protocol v2 activation.",
      );
    }
    const serverTime = new Date();
    const proposedActivatedAt = new Date(
      serverTime.getTime() + ACTIVATION_LEAD_MS,
    );

    const existing = await this.prisma.deviceProtocolActivation.findUnique({
      where: { deviceId: context.deviceId },
      include: { policyLease: true },
    });
    if (existing) {
      if (existing.state === TrackingProtocolActivationState.CONFIRMED) {
        return {
          activationId: existing.id,
          state: existing.state,
          proposedActivatedAt: existing.proposedActivatedAt.toISOString(),
          protocolActivatedAt:
            existing.confirmedActivatedAt?.toISOString() ?? null,
          serverTime: serverTime.toISOString(),
          policy,
        };
      }
      const preparedActivationExpired =
        existing.policyLease.expiresAt <= serverTime ||
        existing.proposedActivatedAt.getTime() <
          serverTime.getTime() - ACTIVATION_SKEW_MS;
      const policyChanged =
        existing.policyLeaseId !== policy.policyLeaseId;
      const prepared =
        preparedActivationExpired || policyChanged
          ? await this.prisma.deviceProtocolActivation.update({
              where: { id: existing.id },
              data: {
                policyLeaseId: policy.policyLeaseId,
                proposedActivatedAt,
                preparedAt: serverTime,
              },
            })
          : existing;
      return {
        activationId: prepared.id,
        state: prepared.state,
        proposedActivatedAt: prepared.proposedActivatedAt.toISOString(),
        protocolActivatedAt:
          prepared.confirmedActivatedAt?.toISOString() ?? null,
        serverTime: serverTime.toISOString(),
        policy,
      };
    }

    const activation = await this.prisma.deviceProtocolActivation.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
        policyLeaseId: policy.policyLeaseId,
        proposedActivatedAt,
      },
    });
    return {
      activationId: activation.id,
      state: activation.state,
      proposedActivatedAt: activation.proposedActivatedAt.toISOString(),
      protocolActivatedAt: null,
      serverTime: serverTime.toISOString(),
      policy,
    };
  }

  async confirmActivation(
    context: DeviceRequestContext,
    input: unknown,
  ) {
    const body = readObject(input);
    const activationId = readRequiredString(body.activationId, "activationId");
    const requestedAt = readDate(
      body.protocolActivatedAt,
      "protocolActivatedAt",
    );
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Device"
        WHERE "id" = ${context.deviceId}::uuid
        FOR UPDATE
      `;
      const activation = await tx.deviceProtocolActivation.findFirst({
        where: {
          id: activationId,
          deviceId: context.deviceId,
          companyId: context.companyId,
          userId: context.userId,
        },
        include: { policyLease: true },
      });
      if (!activation) {
        throw new ForbiddenException(
          "Protocol activation is not bound to this device.",
        );
      }
      if (activation.state === TrackingProtocolActivationState.CONFIRMED) {
        return {
          activationId: activation.id,
          state: activation.state,
          protocolActivatedAt:
            activation.confirmedActivatedAt!.toISOString(),
          serverTime: now.toISOString(),
        };
      }
      if (
        Math.abs(
          requestedAt.getTime() -
            activation.proposedActivatedAt.getTime(),
        ) > ACTIVATION_SKEW_MS
      ) {
        throw new BadRequestException(
          "protocolActivatedAt does not match the prepared boundary.",
        );
      }
      if (
        requestedAt < activation.policyLease.issuedAt ||
        requestedAt >= activation.policyLease.expiresAt
      ) {
        throw new BadRequestException(
          "Protocol activation is outside the policy lease.",
        );
      }

      const device = await tx.device.findUnique({
        where: { id: context.deviceId },
        select: {
          protocolActivatedAt: true,
          clientType: true,
          browserName: true,
          workstationId: true,
        },
      });
      if (!device) {
        throw new ForbiddenException("Device is unavailable.");
      }
      assertCompleteV2Identity(device);
      if (
        device.protocolActivatedAt &&
        device.protocolActivatedAt.getTime() !== requestedAt.getTime()
      ) {
        throw new ConflictException(
          "Device already has a different protocol activation boundary.",
        );
      }

      await tx.device.update({
        where: { id: context.deviceId },
        data: { protocolActivatedAt: requestedAt },
      });
      const confirmed = await tx.deviceProtocolActivation.update({
        where: { id: activation.id },
        data: {
          state: TrackingProtocolActivationState.CONFIRMED,
          confirmedActivatedAt: requestedAt,
          confirmedAt: now,
        },
      });
      return {
        activationId: confirmed.id,
        state: confirmed.state,
        protocolActivatedAt: requestedAt.toISOString(),
        serverTime: now.toISOString(),
      };
    });
  }

  async requireV2DeviceIdentity(context: DeviceRequestContext) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: context.deviceId,
        companyId: context.companyId,
        userId: context.userId,
        revokedAt: null,
      },
      select: {
        id: true,
        clientType: true,
        browserName: true,
        workstationId: true,
        protocolActivatedAt: true,
      },
    });
    if (!device) {
      throw new ForbiddenException("Device is unavailable.");
    }
    assertCompleteV2Identity(device);
    if (device.clientType !== context.clientType) {
      throw new ForbiddenException("Device client identity does not match its credential.");
    }
    return device;
  }

  private async getOrCreatePolicyLease(
    context: DeviceRequestContext,
    policy: {
      id: string;
      policyVersion: string;
      workHoursOnly: boolean;
      workdayStart: string;
      workdayEnd: string;
      activeFrom: Date;
    },
    scheduleTimeZone: string,
    now: Date,
  ) {
    const reusable = await this.prisma.devicePolicyLease.findFirst({
      where: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
        monitoringPolicyId: policy.id,
        policyVersion: policy.policyVersion,
        scheduleTimeZone,
        expiresAt: {
          gt: new Date(now.getTime() + REUSE_LEASE_MIN_REMAINING_MS),
        },
      },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        issuedAt: true,
        expiresAt: true,
        allowedUtcWindows: true,
        windowSetHash: true,
      },
    });
    if (
      reusable &&
      leaseWindowSetMatchesPolicy(reusable, {
        scheduleTimeZone,
        workHoursOnly: policy.workHoursOnly,
        workdayStart: policy.workdayStart,
        workdayEnd: policy.workdayEnd,
      })
    ) {
      return reusable;
    }

    const issuedAt = new Date(
      Math.max(now.getTime(), policy.activeFrom.getTime()),
    );
    const expiresAt = new Date(issuedAt.getTime() + POLICY_LEASE_MS);
    const allowedUtcWindows = buildAllowedUtcWindows({
      issuedAt,
      expiresAt,
      scheduleTimeZone,
      workHoursOnly: policy.workHoursOnly,
      workdayStart: policy.workdayStart,
      workdayEnd: policy.workdayEnd,
    });
    const windowSetHash = hashWindows(allowedUtcWindows);

    return this.prisma.devicePolicyLease.create({
      data: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
        monitoringPolicyId: policy.id,
        policyVersion: policy.policyVersion,
        issuedAt,
        expiresAt,
        scheduleTimeZone,
        allowedUtcWindows,
        windowSetHash,
      },
      select: {
        id: true,
        issuedAt: true,
        expiresAt: true,
        allowedUtcWindows: true,
        windowSetHash: true,
      },
    });
  }
}

function assertCompleteV2Identity(device: {
  clientType: DeviceClientType | null;
  browserName: BrowserName | null;
  workstationId: string | null;
}) {
  if (!device.clientType) {
    throw new HttpException(
      "Device identity is ambiguous and must be re-paired before protocol v2 activation.",
      426,
    );
  }
  if (
    device.clientType === DeviceClientType.DESKTOP_AGENT &&
    !device.workstationId
  ) {
    throw new HttpException(
      "Desktop Agent requires a workstation binding before protocol v2 activation.",
      426,
    );
  }
  if (
    device.clientType === DeviceClientType.BROWSER_EXTENSION &&
    device.browserName !== BrowserName.CHROME &&
    device.browserName !== BrowserName.EDGE
  ) {
    throw new HttpException(
      "Browser Extension requires an immutable Chrome or Edge identity before protocol v2 activation.",
      426,
    );
  }
}

export function buildAllowedUtcWindows(input: {
  issuedAt: Date;
  expiresAt: Date;
  scheduleTimeZone: string;
  workHoursOnly: boolean;
  workdayStart: string;
  workdayEnd: string;
}): TrackingPolicyUtcWindowV2[] {
  if (!input.workHoursOnly) {
    return [{
      startsAt: input.issuedAt.toISOString(),
      endsAt: input.expiresAt.toISOString(),
    }];
  }
  const startTime = parseClockTime(input.workdayStart, "workdayStart");
  const endTime = parseClockTime(input.workdayEnd, "workdayEnd");
  const firstLocalDate = addLocalDays(
    localDateForInstant(input.issuedAt, input.scheduleTimeZone),
    -1,
  );
  const lastLocalDate = addLocalDays(
    localDateForInstant(input.expiresAt, input.scheduleTimeZone),
    1,
  );
  const windows: Array<{ startsAtMs: number; endsAtMs: number }> = [];
  for (
    let date = firstLocalDate;
    compareLocalDates(date, lastLocalDate) <= 0;
    date = addLocalDays(date, 1)
  ) {
    const endDate =
      endTime.totalMinutes <= startTime.totalMinutes
        ? addLocalDays(date, 1)
        : date;
    const startsAtMs = zonedLocalToUtcMs(
      { ...date, hour: startTime.hour, minute: startTime.minute },
      input.scheduleTimeZone,
    );
    const endsAtMs = zonedLocalToUtcMs(
      { ...endDate, hour: endTime.hour, minute: endTime.minute },
      input.scheduleTimeZone,
    );
    const clippedStart = Math.max(startsAtMs, input.issuedAt.getTime());
    const clippedEnd = Math.min(endsAtMs, input.expiresAt.getTime());
    if (clippedEnd > clippedStart) {
      windows.push({ startsAtMs: clippedStart, endsAtMs: clippedEnd });
    }
  }
  windows.sort(
    (left, right) =>
      left.startsAtMs - right.startsAtMs ||
      left.endsAtMs - right.endsAtMs,
  );
  const merged: Array<{ startsAtMs: number; endsAtMs: number }> = [];
  for (const window of windows) {
    const previous = merged.at(-1);
    if (previous && window.startsAtMs <= previous.endsAtMs) {
      previous.endsAtMs = Math.max(previous.endsAtMs, window.endsAtMs);
    } else {
      merged.push({ ...window });
    }
  }
  return merged.map((window) => ({
    startsAt: new Date(window.startsAtMs).toISOString(),
    endsAt: new Date(window.endsAtMs).toISOString(),
  }));
}

function parseClockTime(value: string, label: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new BadRequestException(`${label} must use HH:mm.`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return { hour, minute, totalMinutes: hour * 60 + minute };
}

type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number };

function localDateForInstant(value: Date, timeZone: string): LocalDate {
  const parts = localPartsForInstant(value, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function localPartsForInstant(
  value: Date,
  timeZone: string,
): LocalDateTime & { second: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function addLocalDays(value: LocalDate, days: number): LocalDate {
  const shifted = new Date(
    Date.UTC(value.year, value.month - 1, value.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function compareLocalDates(left: LocalDate, right: LocalDate) {
  return (
    Date.UTC(left.year, left.month - 1, left.day) -
    Date.UTC(right.year, right.month - 1, right.day)
  );
}

function zonedLocalToUtcMs(value: LocalDateTime, timeZone: string) {
  const targetLocalMs = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
  );
  let candidateMs = targetLocalMs;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = localPartsForInstant(new Date(candidateMs), timeZone);
    const actualLocalMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = targetLocalMs - actualLocalMs;
    if (adjustment === 0) break;
    candidateMs += adjustment;
  }
  return candidateMs;
}

function hashWindows(windows: TrackingPolicyUtcWindowV2[]) {
  return createHash("sha256")
    .update(JSON.stringify(windows))
    .digest("hex");
}

export function leaseWindowSetMatchesPolicy(
  lease: {
    issuedAt: Date;
    expiresAt: Date;
    allowedUtcWindows: unknown;
    windowSetHash: string;
  },
  policy: {
    scheduleTimeZone: string;
    workHoursOnly: boolean;
    workdayStart: string;
    workdayEnd: string;
  },
) {
  const expected = buildAllowedUtcWindows({
    issuedAt: lease.issuedAt,
    expiresAt: lease.expiresAt,
    ...policy,
  });
  const expectedHash = hashWindows(expected);
  const storedHash = hashWindows(readStoredWindows(lease.allowedUtcWindows));

  return lease.windowSetHash === expectedHash && storedHash === expectedHash;
}

function readStoredWindows(value: unknown): TrackingPolicyUtcWindowV2[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      typeof entry === "object" &&
      entry !== null &&
      !Array.isArray(entry) &&
      typeof (entry as Record<string, unknown>).startsAt === "string" &&
      typeof (entry as Record<string, unknown>).endsAt === "string"
    ) {
      return [{
        startsAt: (entry as Record<string, string>).startsAt,
        endsAt: (entry as Record<string, string>).endsAt,
      }];
    }
    return [];
  });
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("Protocol activation body must be an object.");
  }
  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} is required.`);
  }
  return value.trim();
}

function readDate(value: unknown, label: string) {
  const normalized = readRequiredString(value, label);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} must be an ISO timestamp.`);
  }
  return parsed;
}

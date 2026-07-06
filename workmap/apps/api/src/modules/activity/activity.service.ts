import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ActivityEventSource, ActivityEventType, BrowserName, Prisma } from "@prisma/client";
import type { RequestContext } from "@workmap/auth";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_SIZE = 50;
const MAX_APP_NAME_LENGTH = 120;
const MAX_DOMAIN_LENGTH = 253;
const MAX_EVENT_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_DURATION_SECONDS = 12 * 60 * 60;
const BROWSER_VALUES = new Set<string>(Object.values(BrowserName));

type ParsedTiming = {
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
};

type ParsedEventBase = ParsedTiming & {
  deviceId: string;
  clientEventId: string | null;
  isIdle: boolean;
  isActiveWindow: boolean;
};

type ParsedAppUsageEvent = ParsedEventBase & {
  appName: string;
};

type ParsedDomainUsageEvent = ParsedEventBase & {
  domain: string;
  browserName: BrowserName;
};

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestAppUsage(context: RequestContext, input: unknown) {
    const events = readEventBatch(input).map(readAppUsageEvent);
    let accepted = 0;

    for (const event of events) {
      await this.assertDeviceBoundToContext(context, event.deviceId);
      for (const fragment of splitUsageEventByUtcDay(event)) {
        accepted += (await this.storeAppUsageEvent(context, fragment)) ? 1 : 0;
      }
    }

    return {
      accepted,
      source: ActivityEventSource.DESKTOP_AGENT,
      eventType: ActivityEventType.APP,
    };
  }

  async ingestDomainUsage(context: RequestContext, input: unknown) {
    const events = readEventBatch(input).map(readDomainUsageEvent);
    let accepted = 0;

    for (const event of events) {
      await this.assertDeviceBoundToContext(context, event.deviceId);
      for (const fragment of splitUsageEventByUtcDay(event)) {
        accepted += (await this.storeDomainUsageEvent(context, fragment)) ? 1 : 0;
      }
    }

    return {
      accepted,
      source: ActivityEventSource.BROWSER_EXTENSION,
      eventType: ActivityEventType.BROWSER,
    };
  }

  private async assertDeviceBoundToContext(context: RequestContext, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        companyId: context.companyId,
        userId: context.userId,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!device) {
      throw new ForbiddenException("Device is not registered for this WorkMap user and tenant.");
    }
  }

  private async storeAppUsageEvent(context: RequestContext, event: ParsedAppUsageEvent) {
    if (await this.hasDuplicateAppUsageEvent(context, event)) {
      return false;
    }

    const usageDate = toUtcDateOnly(event.startedAt);
    const activeSeconds = !event.isIdle && event.isActiveWindow ? event.durationSeconds : 0;
    const idleSeconds = event.isIdle && event.isActiveWindow ? event.durationSeconds : 0;
    const category = categorizeApp(event.appName);
    const productivityLabel = category ? "PRODUCTIVE" : "UNCATEGORISED";

    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.activityEvent.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId: event.deviceId,
          clientEventId: event.clientEventId,
          source: ActivityEventSource.DESKTOP_AGENT,
          eventType: ActivityEventType.APP,
          appName: event.appName,
          isIdle: event.isIdle,
          isActiveWindow: event.isActiveWindow,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          durationSeconds: event.durationSeconds,
        },
      }),
      this.prisma.device.update({
        where: { id: event.deviceId },
        data: { lastSeenAt: new Date() },
      }),
    ];

    if (activeSeconds > 0 || idleSeconds > 0) {
      operations.splice(1, 0, this.prisma.appUsageSummary.upsert({
        where: {
          companyId_userId_date_appName: {
            companyId: context.companyId,
            userId: context.userId,
            date: usageDate,
            appName: event.appName,
          },
        },
        update: {
          category,
          productivityLabel,
          activeSeconds: { increment: activeSeconds },
          idleSeconds: { increment: idleSeconds },
        },
        create: {
          companyId: context.companyId,
          userId: context.userId,
          date: usageDate,
          appName: event.appName,
          category,
          productivityLabel,
          activeSeconds,
          idleSeconds,
        },
      }));
    }

    try {
      await this.prisma.$transaction(operations);
    } catch (error) {
      if (event.clientEventId && isPrismaUniqueError(error)) return false;
      throw error;
    }

    return true;
  }

  private async storeDomainUsageEvent(context: RequestContext, event: ParsedDomainUsageEvent) {
    if (await this.hasDuplicateDomainUsageEvent(context, event)) {
      return false;
    }

    const usageDate = toUtcDateOnly(event.startedAt);
    const activeSeconds = event.isIdle ? 0 : event.durationSeconds;
    const idleSeconds = event.isIdle ? event.durationSeconds : 0;
    const category = categorizeDomain(event.domain);
    const productivityLabel = category ? "PRODUCTIVE" : "UNCATEGORISED";

    try {
      await this.prisma.$transaction([
      this.prisma.activityEvent.create({
        data: {
          companyId: context.companyId,
          userId: context.userId,
          deviceId: event.deviceId,
          clientEventId: event.clientEventId,
          source: ActivityEventSource.BROWSER_EXTENSION,
          eventType: ActivityEventType.BROWSER,
          browserName: event.browserName,
          domain: event.domain,
          isIdle: event.isIdle,
          isActiveWindow: !event.isIdle,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          durationSeconds: event.durationSeconds,
        },
      }),
      this.prisma.websiteUsageSummary.upsert({
        where: {
          companyId_userId_date_domain_browserName: {
            companyId: context.companyId,
            userId: context.userId,
            date: usageDate,
            domain: event.domain,
            browserName: event.browserName,
          },
        },
        update: {
          category,
          productivityLabel,
          activeSeconds: { increment: activeSeconds },
          idleSeconds: { increment: idleSeconds },
        },
        create: {
          companyId: context.companyId,
          userId: context.userId,
          date: usageDate,
          domain: event.domain,
          browserName: event.browserName,
          category,
          productivityLabel,
          activeSeconds,
          idleSeconds,
        },
      }),
      this.prisma.device.update({
        where: { id: event.deviceId },
        data: { lastSeenAt: new Date() },
      }),
      ]);
    } catch (error) {
      if (event.clientEventId && isPrismaUniqueError(error)) return false;
      throw error;
    }

    return true;
  }

  private async hasDuplicateAppUsageEvent(context: RequestContext, event: ParsedAppUsageEvent) {
    const existing = await this.prisma.activityEvent.findFirst({
      where: {
        companyId: context.companyId,
        ...(event.clientEventId
          ? { source: ActivityEventSource.DESKTOP_AGENT, clientEventId: event.clientEventId }
          : {
              userId: context.userId,
              deviceId: event.deviceId,
              source: ActivityEventSource.DESKTOP_AGENT,
              eventType: ActivityEventType.APP,
              appName: event.appName,
              isIdle: event.isIdle,
              isActiveWindow: event.isActiveWindow,
              startedAt: event.startedAt,
              endedAt: event.endedAt,
              durationSeconds: event.durationSeconds,
            }),
      },
      select: { id: true },
    });

    return Boolean(existing);
  }

  private async hasDuplicateDomainUsageEvent(context: RequestContext, event: ParsedDomainUsageEvent) {
    const existing = await this.prisma.activityEvent.findFirst({
      where: {
        companyId: context.companyId,
        ...(event.clientEventId
          ? { source: ActivityEventSource.BROWSER_EXTENSION, clientEventId: event.clientEventId }
          : {
              userId: context.userId,
              deviceId: event.deviceId,
              source: ActivityEventSource.BROWSER_EXTENSION,
              eventType: ActivityEventType.BROWSER,
              browserName: event.browserName,
              domain: event.domain,
              isIdle: event.isIdle,
              startedAt: event.startedAt,
              endedAt: event.endedAt,
              durationSeconds: event.durationSeconds,
            }),
      },
      select: { id: true },
    });

    return Boolean(existing);
  }
}

function readEventBatch(input: unknown): Record<string, unknown>[] {
  const body = readObject(input, "Activity payload must be an object.");
  const events = Array.isArray(body.events) ? body.events : [body];

  if (events.length === 0) {
    throw new BadRequestException("Activity payload must contain at least one event.");
  }

  if (events.length > MAX_BATCH_SIZE) {
    throw new BadRequestException(`Activity batch cannot exceed ${MAX_BATCH_SIZE} events.`);
  }

  return events.map((event) => readObject(event, "Each activity event must be an object."));
}

function readAppUsageEvent(input: Record<string, unknown>): ParsedAppUsageEvent {
  return {
    ...readCommonEvent(input),
    appName: sanitizeRequiredText(input.appName, "appName", MAX_APP_NAME_LENGTH),
  };
}

function readDomainUsageEvent(input: Record<string, unknown>): ParsedDomainUsageEvent {
  return {
    ...readCommonEvent(input),
    domain: sanitizeDomain(input.domain),
    browserName: readBrowserName(input.browserName),
  };
}

function readCommonEvent(input: Record<string, unknown>): ParsedEventBase {
  return {
    deviceId: readRequiredUuid(input.deviceId, "deviceId"),
    clientEventId: readOptionalClientEventId(input.clientEventId),
    isIdle: readBoolean(input.isIdle, false) || readBoolean(input.active, true) === false,
    isActiveWindow: readBoolean(input.isActiveWindow, true),
    ...readTiming(input),
  };
}

function readOptionalClientEventId(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new BadRequestException("clientEventId must be a UUID when provided.");
  }
  return value.toLowerCase();
}

function readTiming(input: Record<string, unknown>): ParsedTiming {
  const startedAt = readRequiredDate(input.startedAt, "startedAt");
  const durationSecondsFromInput = readDurationSeconds(input.durationSeconds, input.durationMs);
  const endedAtFromInput = readOptionalDate(input.endedAt, "endedAt");
  const endedAt = endedAtFromInput ?? (durationSecondsFromInput ? new Date(startedAt.getTime() + durationSecondsFromInput * 1000) : null);

  if (!endedAt) {
    throw new BadRequestException("Activity event must include endedAt or duration.");
  }

  const durationSeconds = durationSecondsFromInput ?? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

  if (endedAt.getTime() <= startedAt.getTime()) {
    throw new BadRequestException("Activity endedAt must be after startedAt.");
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    throw new BadRequestException(`Activity duration must be between 1 second and ${MAX_DURATION_SECONDS} seconds.`);
  }

  const now = Date.now();
  if (startedAt.getTime() < now - MAX_EVENT_AGE_MS) {
    throw new BadRequestException("Activity event is too old.");
  }

  if (startedAt.getTime() > now + MAX_FUTURE_SKEW_MS || endedAt.getTime() > now + MAX_FUTURE_SKEW_MS) {
    throw new BadRequestException("Activity event timestamp is too far in the future.");
  }

  return {
    startedAt,
    endedAt,
    durationSeconds,
  };
}

function readDurationSeconds(durationSeconds: unknown, durationMs: unknown) {
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.round(durationSeconds);
  }

  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return Math.round(durationMs / 1000);
  }

  return null;
}

function readObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }

  return value as Record<string, unknown>;
}

function readRequiredUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID.`);
  }

  return value;
}

function readRequiredDate(value: unknown, label: string) {
  const date = readOptionalDate(value, label);

  if (!date) {
    throw new BadRequestException(`${label} must be an ISO timestamp.`);
  }

  return date;
}

function readOptionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${label} must be an ISO timestamp.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid ISO timestamp.`);
  }

  return date;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeRequiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") {
    throw new BadRequestException(`${label} must be a string.`);
  }

  const sanitized = replaceControlCharacters(value).replace(/\s+/g, " ").trim();

  if (!sanitized) {
    throw new BadRequestException(`${label} is required.`);
  }

  return sanitized.slice(0, maxLength);
}

function sanitizeDomain(value: unknown) {
  const rawDomain = sanitizeRequiredText(value, "domain", 512).toLowerCase();
  let candidate = rawDomain;

  try {
    candidate = new URL(rawDomain.includes("://") ? rawDomain : `https://${rawDomain}`).hostname;
  } catch {
    candidate = rawDomain.split(/[/?#]/)[0] ?? "";
  }

  const domain = candidate.replace(/:\d+$/, "").replace(/\.$/, "").slice(0, MAX_DOMAIN_LENGTH);

  if (!domain || !isSafeDomain(domain)) {
    throw new BadRequestException("domain must be a hostname only; full URLs, paths, queries, and private content are not stored.");
  }

  return domain;
}

function isSafeDomain(domain: string) {
  if (domain === "localhost") {
    return true;
  }

  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

function readBrowserName(value: unknown): BrowserName {
  if (typeof value !== "string") {
    return BrowserName.UNKNOWN;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "_");

  if (BROWSER_VALUES.has(normalized)) {
    return normalized as BrowserName;
  }

  if (normalized.includes("EDGE")) {
    return BrowserName.EDGE;
  }

  if (normalized.includes("CHROME")) {
    return BrowserName.CHROME;
  }

  if (normalized.includes("FIREFOX")) {
    return BrowserName.FIREFOX;
  }

  if (normalized.includes("SAFARI")) {
    return BrowserName.SAFARI;
  }

  return BrowserName.UNKNOWN;
}

function toUtcDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function splitUsageEventByUtcDay<T extends ParsedEventBase>(event: T): T[] {
  const fragments: T[] = [];
  let cursor = event.startedAt;
  let index = 0;
  while (cursor < event.endedAt) {
    const nextDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
    const endedAt = event.endedAt < nextDay ? event.endedAt : nextDay;
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - cursor.getTime()) / 1000));
    fragments.push({
      ...event,
      clientEventId: event.clientEventId && (index > 0 || endedAt < event.endedAt)
        ? deriveFragmentEventId(event.clientEventId, index)
        : event.clientEventId,
      startedAt: cursor,
      endedAt,
      durationSeconds,
    });
    cursor = endedAt;
    index += 1;
  }
  return fragments;
}

function deriveFragmentEventId(clientEventId: string, index: number) {
  const hex = createHash("sha256").update(`${clientEventId}:${index}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4] ?? "8";
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function categorizeApp(appName: string) {
  const normalized = appName.toLowerCase();

  if (["code", "visual studio", "excel", "outlook", "teams", "slack", "figma"].some((value) => normalized.includes(value))) {
    return "Work app";
  }

  return null;
}

function categorizeDomain(domain: string) {
  if (["github.com", "docs.google.com", "slack.com", "office.com", "figma.com"].some((value) => domain.endsWith(value))) {
    return "Work domain";
  }

  return null;
}

function replaceControlCharacters(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
}

function isPrismaUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

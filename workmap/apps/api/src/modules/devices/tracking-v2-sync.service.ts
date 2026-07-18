import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  BrowserName,
  DeviceClientType,
  Prisma,
  TrackingActivityMetric,
  TrackingActivitySource,
  TrackingActivityStream,
  TrackingCollectorState,
  TrackingConnectionState,
  TrackingEvidenceKind,
  TrackingFocusState,
  TrackingHealthErrorCode,
  TrackingMigrationState,
  TrackingPolicyState,
} from "@prisma/client";
import {
  MAX_TRACKING_SYNC_BYTES,
  MAX_TRACKING_SYNC_INTERVALS,
  TRACKING_CANONICALIZATION_VERSION_V1,
  TRACKING_PROTOCOL_VERSION_V2,
  canBootstrapFirstStateProvisionalV2,
  canonicalizeActivityIntervalV2,
  computeTrackingSequenceCoverageV2,
  isIntervalInsidePolicyWindowsV2,
  normalizeActivityIntervalV2,
  validateActivityIntervalV2,
  type ActivityIntervalV2,
  type ClientHealthV2,
  type LiveFocusSnapshotV2,
  type TrackingSequenceDispositionV2,
  type TrackingSyncCursorV2,
  type TrackingSyncItemResultV2,
  type TrackingSyncRequestV2,
} from "@workmap/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DeviceRequestContext } from "./device-context.js";
import { TrackingV2PolicyService } from "./tracking-v2-policy.service.js";
import {
  TrackingV2ReconciliationService,
  type TrackingReconciliationTargetKey,
} from "./tracking-v2-reconciliation.service.js";

const MAX_EVENT_AGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_SUBJECT_KEY_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 120;
const MAX_IDENTITY_LENGTH = 160;

type StoredPolicyLease = {
  id: string;
  companyId: string;
  userId: string;
  deviceId: string;
  policyVersion: string;
  issuedAt: Date;
  expiresAt: Date;
  allowedUtcWindows: unknown;
  monitoringPolicy: {
    collectAppUsage: boolean;
    collectWebsiteDomain: boolean;
  };
};

type CandidateInterval = {
  index: number;
  interval: ActivityIntervalV2;
  payloadHash: string;
  rejectionCode: string | null;
};

type StoredIntervalIdentity = {
  id: string;
  clientEventId: string;
  sequenceNumber: number;
  source: TrackingActivitySource;
  stream: TrackingActivityStream;
  clockEpochId: string;
  payloadHash: string;
  startedAt: Date;
  endedAt: Date;
  activitySessionId: string;
  policyLeaseId: string;
};

@Injectable()
export class TrackingV2SyncService {
  private readonly logger = new Logger(TrackingV2SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: TrackingV2PolicyService,
    private readonly reconciliation: TrackingV2ReconciliationService,
  ) {}

  async sync(context: DeviceRequestContext, input: unknown) {
    const request = parseSyncRequest(input);
    const identity = await this.policyService.requireV2DeviceIdentity(context);
    if (!identity.protocolActivatedAt) {
      throw new HttpException(
        "Protocol v2 has not been activated for this device.",
        426,
      );
    }
    const protocolActivatedAt = identity.protocolActivatedAt;
    if (
      new Date(request.protocolActivatedAt).getTime() !==
      protocolActivatedAt.getTime()
    ) {
      throw new HttpException(
        "Protocol activation boundary does not match this device.",
        426,
      );
    }

    const expectedSource =
      context.clientType === DeviceClientType.DESKTOP_AGENT
        ? TrackingActivitySource.DESKTOP_APP
        : TrackingActivitySource.BROWSER_DOMAIN;
    assertHealthBinding(request.health, context.clientType);
    if (
      request.focusSnapshot &&
      request.focusSnapshot.source !== expectedSource
    ) {
      throw new ForbiddenException(
        "Focus snapshot source does not match the device credential.",
      );
    }

    const candidateIntervals = request.intervals.map(
      (rawInterval, index) =>
        parseCandidateInterval(rawInterval, index, expectedSource),
    );
    const policyLeaseIds = new Set(
      candidateIntervals.map((candidate) => candidate.interval.policyLeaseId),
    );
    if (request.focusSnapshot) {
      policyLeaseIds.add(request.focusSnapshot.policyLeaseId);
    }
    const leases = await this.prisma.devicePolicyLease.findMany({
      where: {
        id: { in: [...policyLeaseIds] },
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
      },
      include: {
        monitoringPolicy: {
          select: {
            collectAppUsage: true,
            collectWebsiteDomain: true,
          },
        },
      },
    });
    const leaseById = new Map(leases.map((lease) => [lease.id, lease]));
    const now = new Date();
    for (const candidate of candidateIntervals) {
      candidate.rejectionCode ??= validateCandidatePolicyAndIdentity({
        candidate,
        context,
        expectedSource,
        browserName: identity.browserName,
        protocolActivatedAt,
        lease: leaseById.get(candidate.interval.policyLeaseId),
        now,
      });
    }
    if (request.focusSnapshot) {
      validateSnapshot(
        request.focusSnapshot,
        expectedSource,
        identity.browserName,
        protocolActivatedAt,
        leaseById.get(request.focusSnapshot.policyLeaseId),
        now,
      );
    }

    const transactionResult = await this.prisma.$transaction(
      async (tx) => {
        const laneKeys = collectLaneKeys(
          candidateIntervals,
          request.focusSnapshot,
          expectedSource,
        );
        await lockWriteLanes(tx, context, identity.workstationId, laneKeys);

        const persistedIdentity = await loadPersistedIdentities(
          tx,
          context.deviceId,
          candidateIntervals,
        );
        const overlapRows = await loadPotentialOverlaps(
          tx,
          context.deviceId,
          candidateIntervals.filter(
            (candidate) => candidate.rejectionCode === null,
          ),
        );
        const results: TrackingSyncItemResultV2[] = [];
        const accepted: CandidateInterval[] = [];
        const tombstones: Array<{
          candidate: CandidateInterval;
          code: string;
        }> = [];

        for (const candidate of candidateIntervals) {
          const eventExisting = persistedIdentity.byEvent.get(
            candidate.interval.clientEventId,
          );
          const sequenceExisting = persistedIdentity.bySequence.get(
            sequenceKey(candidate.interval),
          );
          const tombstoneExisting = persistedIdentity.tombstones.get(
            sequenceKey(candidate.interval),
          );
          const existing = eventExisting ?? sequenceExisting;
          if (existing) {
            const sameIdentity =
              existing.clientEventId === candidate.interval.clientEventId &&
              existing.sequenceNumber === candidate.interval.sequenceNumber &&
              existing.source === candidate.interval.source &&
              existing.stream === candidate.interval.stream &&
              existing.clockEpochId === candidate.interval.clockEpochId;
            if (sameIdentity && existing.payloadHash === candidate.payloadHash) {
              results[candidate.index] = {
                clientEventId: candidate.interval.clientEventId,
                status: "DUPLICATE",
              };
            } else {
              results[candidate.index] = {
                clientEventId: candidate.interval.clientEventId,
                status: "REJECTED",
                rejectionCode: eventExisting
                  ? "IDEMPOTENCY_CONFLICT"
                  : "SEQUENCE_CONFLICT",
                terminal: true,
              };
            }
            continue;
          }
          if (tombstoneExisting) {
            results[candidate.index] = {
              clientEventId: candidate.interval.clientEventId,
              status: "REJECTED",
              rejectionCode: tombstoneExisting.rejectionCode,
              terminal: true,
            };
            continue;
          }
          if (candidate.rejectionCode) {
            results[candidate.index] = {
              clientEventId: candidate.interval.clientEventId,
              status: "REJECTED",
              rejectionCode: candidate.rejectionCode,
              terminal: true,
            };
            tombstones.push({
              candidate,
              code: candidate.rejectionCode,
            });
            continue;
          }
          if (
            overlapsAny(
              candidate.interval,
              overlapRows,
              accepted.map((item) => ({
                deviceId: context.deviceId,
                source: item.interval.source as TrackingActivitySource,
                stream: item.interval.stream as TrackingActivityStream,
                startedAt: new Date(item.interval.startedAt),
                endedAt: new Date(item.interval.endedAt),
              })),
            )
          ) {
            const rejectionCode =
              candidate.interval.stream === "FOCUS"
                ? "FOCUS_OVERLAP"
                : "RUNTIME_OVERLAP";
            results[candidate.index] = {
              clientEventId: candidate.interval.clientEventId,
              status: "REJECTED",
              rejectionCode,
              terminal: true,
            };
            tombstones.push({ candidate, code: rejectionCode });
            continue;
          }
          accepted.push(candidate);
          results[candidate.index] = {
            clientEventId: candidate.interval.clientEventId,
            status: "ACCEPTED",
          };
        }

        if (tombstones.length > 0) {
          await tx.clientSequenceTombstone.createMany({
            data: tombstones.map(({ candidate, code }) => ({
              id: randomUUID(),
              companyId: context.companyId,
              userId: context.userId,
              deviceId: context.deviceId,
              clientEventId: candidate.interval.clientEventId,
              source: candidate.interval.source as TrackingActivitySource,
              stream: candidate.interval.stream as TrackingActivityStream,
              clockEpochId: candidate.interval.clockEpochId,
              sequenceNumber: candidate.interval.sequenceNumber,
              rejectionCode: code,
              payloadHash: candidate.payloadHash,
            })),
            skipDuplicates: true,
          });
        }

        const inserted = await insertAcceptedIntervals(
          tx,
          context,
          identity.workstationId,
          accepted,
        );
        const cursorKeys = uniqueCursorKeys(candidateIntervals);
        const cursors = await refreshCursors(
          tx,
          context,
          cursorKeys,
        );
        const acceptedSnapshotSequence = request.focusSnapshot
          ? await storeFocusSnapshot({
              tx,
              context,
              snapshot: request.focusSnapshot,
              browserName: identity.browserName,
              workstationId: identity.workstationId,
              protocolActivatedAt,
              lease: leaseById.get(request.focusSnapshot.policyLeaseId)!,
              cursors,
            })
          : null;
        await storeClientHealth(
          tx,
          context,
          expectedSource,
          identity.workstationId,
          request.health,
          now,
        );
        await tx.device.update({
          where: { id: context.deviceId },
          data: { lastSeenAt: now },
        });

        return {
          results,
          cursors,
          acceptedSnapshotSequence,
          insertedIntervalIds: inserted.intervals.map((row) => row.id),
          dirtyTargets: inserted.dirtyTargets,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    const activePolicy = await this.prisma.monitoringPolicy.findFirst({
      where: {
        companyId: context.companyId,
        activeFrom: { lte: now },
      },
      orderBy: [{ activeFrom: "desc" }, { id: "desc" }],
      select: { policyVersion: true },
    });
    const activeLease = leases.find(
      (lease) => lease.policyVersion === activePolicy?.policyVersion,
    );
    if (transactionResult.dirtyTargets.length > 0) {
      try {
        await this.reconciliation.reconcileTargets(
          transactionResult.dirtyTargets,
        );
      } catch {
        this.logger.warn(
          "Tracking v2 reconciliation was deferred; dirty targets remain retryable.",
        );
      }
    }
    return {
      results: transactionResult.results,
      cursors: transactionResult.cursors,
      acceptedSnapshotSequence:
        transactionResult.acceptedSnapshotSequence,
      serverTime: now.toISOString(),
      activePolicyVersion: activePolicy?.policyVersion ?? "",
      activePolicyLeaseId: activeLease?.id ?? null,
    };
  }
}

function parseSyncRequest(input: unknown): TrackingSyncRequestV2 {
  const body = readObject(input, "Tracking sync payload must be an object.");
  assertOnlyKeys(body, [
    "protocolVersion",
    "protocolActivatedAt",
    "clientInstanceId",
    "sentAt",
    "intervals",
    "focusSnapshot",
    "health",
  ], "sync");
  const size = Buffer.byteLength(JSON.stringify(body), "utf8");
  if (size > MAX_TRACKING_SYNC_BYTES) {
    throw new BadRequestException(
      `Tracking sync payload cannot exceed ${MAX_TRACKING_SYNC_BYTES} bytes.`,
    );
  }
  if (body.protocolVersion !== TRACKING_PROTOCOL_VERSION_V2) {
    throw new HttpException("Protocol v2 is required.", 426);
  }
  const protocolActivatedAt = readIso(body.protocolActivatedAt, "protocolActivatedAt");
  const sentAt = readIso(body.sentAt, "sentAt");
  if (sentAt.getTime() > Date.now() + MAX_FUTURE_SKEW_MS) {
    throw new BadRequestException("sentAt is too far in the future.");
  }
  const clientInstanceId = readBoundedString(
    body.clientInstanceId,
    "clientInstanceId",
    MAX_IDENTITY_LENGTH,
  );
  if (!Array.isArray(body.intervals)) {
    throw new BadRequestException("intervals must be an array.");
  }
  if (body.intervals.length > MAX_TRACKING_SYNC_INTERVALS) {
    throw new BadRequestException(
      `Tracking sync cannot exceed ${MAX_TRACKING_SYNC_INTERVALS} intervals.`,
    );
  }
  const intervals = body.intervals.map((interval) =>
    readObject(interval, "Each interval must be an object."),
  ) as ActivityIntervalV2[];
  const focusSnapshot =
    body.focusSnapshot === undefined
      ? undefined
      : parseSnapshot(body.focusSnapshot);
  const health = parseHealth(body.health);
  return {
    protocolVersion: TRACKING_PROTOCOL_VERSION_V2,
    protocolActivatedAt: protocolActivatedAt.toISOString(),
    clientInstanceId,
    sentAt: sentAt.toISOString(),
    intervals,
    ...(focusSnapshot ? { focusSnapshot } : {}),
    health,
  };
}

function parseCandidateInterval(
  rawInterval: ActivityIntervalV2,
  index: number,
  expectedSource: TrackingActivitySource,
): CandidateInterval {
  const issues = validateActivityIntervalV2(rawInterval);
  let interval: ActivityIntervalV2;
  try {
    interval = normalizeActivityIntervalV2(rawInterval);
  } catch {
    interval = {
      ...rawInterval,
      clientEventId:
        typeof rawInterval.clientEventId === "string"
          ? rawInterval.clientEventId.trim()
          : `invalid-${index}`,
    };
  }
  const payloadHash = safePayloadHash(interval);
  let rejectionCode: string | null = issues[0]?.code ?? null;
  if (!rejectionCode && interval.source !== expectedSource) {
    rejectionCode = "SOURCE_MISMATCH";
  }
  if (
    !Number.isInteger(interval.sequenceNumber) ||
    interval.sequenceNumber < 1 ||
    !interval.clientEventId ||
    !interval.clockEpochId
  ) {
    throw new BadRequestException(
      `Interval ${index} must have a valid event, epoch, and sequence identity.`,
    );
  }
  return { index, interval, payloadHash, rejectionCode };
}

function validateCandidatePolicyAndIdentity(input: {
  candidate: CandidateInterval;
  context: DeviceRequestContext;
  expectedSource: TrackingActivitySource;
  browserName: BrowserName | null;
  protocolActivatedAt: Date;
  lease: StoredPolicyLease | undefined;
  now: Date;
}) {
  const { interval } = input.candidate;
  if (input.candidate.rejectionCode) {
    return input.candidate.rejectionCode;
  }
  if (
    interval.subjectKey.length > MAX_SUBJECT_KEY_LENGTH ||
    interval.displayName.length > MAX_DISPLAY_NAME_LENGTH
  ) {
    return "INVALID_SUBJECT";
  }
  if (
    interval.stream !== "FOCUS" ||
    (interval.metric !== "FOCUS_ACTIVE" &&
      interval.metric !== "FOCUS_IDLE")
  ) {
    return "OPEN_RUNTIME_NOT_ENABLED";
  }
  if (
    interval.source === "BROWSER_DOMAIN" &&
    interval.browserName !== input.browserName
  ) {
    return "BROWSER_IDENTITY_MISMATCH";
  }
  if (
    interval.source === "DESKTOP_APP" &&
    interval.browserName !== undefined
  ) {
    return "BROWSER_IDENTITY_MISMATCH";
  }
  const startedAt = new Date(interval.startedAt);
  const endedAt = new Date(interval.endedAt);
  if (startedAt < input.protocolActivatedAt) {
    return "PRE_ACTIVATION_INTERVAL";
  }
  if (startedAt.getTime() < input.now.getTime() - MAX_EVENT_AGE_MS) {
    return "INTERVAL_TOO_OLD";
  }
  if (
    startedAt.getTime() > input.now.getTime() + MAX_FUTURE_SKEW_MS ||
    endedAt.getTime() > input.now.getTime() + MAX_FUTURE_SKEW_MS
  ) {
    return "INTERVAL_IN_FUTURE";
  }
  const lease = input.lease;
  if (
    !lease ||
    lease.companyId !== input.context.companyId ||
    lease.userId !== input.context.userId ||
    lease.deviceId !== input.context.deviceId ||
    lease.policyVersion !== interval.policyVersion
  ) {
    return "POLICY_REJECTED";
  }
  const sourceAllowed =
    input.expectedSource === TrackingActivitySource.DESKTOP_APP
      ? lease.monitoringPolicy.collectAppUsage
      : lease.monitoringPolicy.collectWebsiteDomain;
  if (
    !sourceAllowed ||
    !isIntervalInsidePolicyWindowsV2(
      interval,
      readPolicyWindows(lease.allowedUtcWindows),
    )
  ) {
    return "POLICY_REJECTED";
  }
  return null;
}

function validateSnapshot(
  snapshot: LiveFocusSnapshotV2,
  expectedSource: TrackingActivitySource,
  browserName: BrowserName | null,
  protocolActivatedAt: Date,
  lease: StoredPolicyLease | undefined,
  now: Date,
) {
  if (snapshot.source !== expectedSource || snapshot.stream !== "FOCUS") {
    throw new ForbiddenException(
      "Focus snapshot source does not match the device credential.",
    );
  }
  if (
    (snapshot.source === "BROWSER_DOMAIN" &&
      snapshot.browserName !== browserName) ||
    (snapshot.source === "DESKTOP_APP" &&
      snapshot.browserName !== undefined)
  ) {
    throw new ForbiddenException(
      "Focus snapshot browser identity does not match the paired device.",
    );
  }
  if (
    !lease ||
    lease.policyVersion !== snapshot.policyVersion ||
    lease.id !== snapshot.policyLeaseId
  ) {
    throw new BadRequestException(
      "Focus snapshot policy lease is invalid.",
    );
  }
  const observedAt = readIso(snapshot.lastObservedAt, "lastObservedAt");
  if (
    observedAt < protocolActivatedAt ||
    observedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS
  ) {
    throw new BadRequestException(
      "Focus snapshot observation time is invalid.",
    );
  }
  if (
    snapshot.state !== "NONE" &&
    (!snapshot.stateStartedAt ||
      !isIntervalInsidePolicyWindowsV2(
        {
          startedAt: snapshot.stateStartedAt,
          endedAt: snapshot.lastObservedAt,
        },
        readPolicyWindows(lease.allowedUtcWindows),
      ))
  ) {
    throw new BadRequestException(
      "Focus snapshot is outside its policy window.",
    );
  }
}

async function lockWriteLanes(
  tx: Prisma.TransactionClient,
  context: DeviceRequestContext,
  workstationId: string | null,
  laneKeys: Array<{
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
  }>,
) {
  const laneIds: string[] = [];
  for (const lane of laneKeys) {
    const row = await tx.clientWriteLane.upsert({
      where: {
        deviceId_source_stream: {
          deviceId: context.deviceId,
          source: lane.source,
          stream: lane.stream,
        },
      },
      update: {
        companyId: context.companyId,
        userId: context.userId,
        workstationId,
      },
      create: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
        workstationId,
        source: lane.source,
        stream: lane.stream,
      },
      select: { id: true },
    });
    laneIds.push(row.id);
  }
  if (laneIds.length === 0) return;
  await tx.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "ClientWriteLane"
      WHERE "id" IN (${Prisma.join(laneIds)})
      ORDER BY "id"
      FOR UPDATE
    `,
  );
}

async function loadPersistedIdentities(
  tx: Prisma.TransactionClient,
  deviceId: string,
  candidates: CandidateInterval[],
) {
  const eventIds = candidates.map(
    (candidate) => candidate.interval.clientEventId,
  );
  const sequenceClauses = candidates.map((candidate) => ({
    source: candidate.interval.source as TrackingActivitySource,
    stream: candidate.interval.stream as TrackingActivityStream,
    clockEpochId: candidate.interval.clockEpochId,
    sequenceNumber: candidate.interval.sequenceNumber,
  }));
  const intervals = await tx.activityInterval.findMany({
    where: {
      deviceId,
      OR: [
        { clientEventId: { in: eventIds } },
        ...sequenceClauses,
      ],
    },
    select: {
      id: true,
      clientEventId: true,
      sequenceNumber: true,
      source: true,
      stream: true,
      clockEpochId: true,
      payloadHash: true,
      startedAt: true,
      endedAt: true,
      activitySessionId: true,
      policyLeaseId: true,
    },
  });
  const tombstoneRows = await tx.clientSequenceTombstone.findMany({
    where: {
      deviceId,
      OR: sequenceClauses,
    },
    select: {
      source: true,
      stream: true,
      clockEpochId: true,
      sequenceNumber: true,
      rejectionCode: true,
    },
  });
  return {
    byEvent: new Map(
      intervals.map((interval) => [
        interval.clientEventId,
        interval as StoredIntervalIdentity,
      ]),
    ),
    bySequence: new Map(
      intervals.map((interval) => [
        sequenceKey(interval),
        interval as StoredIntervalIdentity,
      ]),
    ),
    tombstones: new Map(
      tombstoneRows.map((row) => [sequenceKey(row), row]),
    ),
  };
}

async function loadPotentialOverlaps(
  tx: Prisma.TransactionClient,
  deviceId: string,
  candidates: CandidateInterval[],
) {
  if (candidates.length === 0) return [];
  const earliest = new Date(
    Math.min(
      ...candidates.map((candidate) =>
        Date.parse(candidate.interval.startedAt),
      ),
    ),
  );
  const latest = new Date(
    Math.max(
      ...candidates.map((candidate) =>
        Date.parse(candidate.interval.endedAt),
      ),
    ),
  );
  const streams = [
    ...new Set(
      candidates.map(
        (candidate) =>
          candidate.interval.stream as TrackingActivityStream,
      ),
    ),
  ];
  const sources = [
    ...new Set(
      candidates.map(
        (candidate) =>
          candidate.interval.source as TrackingActivitySource,
      ),
    ),
  ];
  return tx.activityInterval.findMany({
    where: {
      deviceId,
      source: { in: sources },
      stream: { in: streams },
      startedAt: { lt: latest },
      endedAt: { gt: earliest },
    },
    select: {
      deviceId: true,
      source: true,
      stream: true,
      startedAt: true,
      endedAt: true,
    },
  });
}

function overlapsAny(
  interval: ActivityIntervalV2,
  stored: Array<{
    deviceId: string;
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
    startedAt: Date;
    endedAt: Date;
  }>,
  pending: Array<{
    deviceId: string;
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
    startedAt: Date;
    endedAt: Date;
  }>,
) {
  const startedAt = Date.parse(interval.startedAt);
  const endedAt = Date.parse(interval.endedAt);
  return [...stored, ...pending].some(
    (row) =>
      row.source === interval.source &&
      row.stream === interval.stream &&
      row.startedAt.getTime() < endedAt &&
      row.endedAt.getTime() > startedAt,
  );
}

async function insertAcceptedIntervals(
  tx: Prisma.TransactionClient,
  context: DeviceRequestContext,
  workstationId: string | null,
  accepted: CandidateInterval[],
) {
  if (accepted.length === 0) {
    return {
      intervals: [],
      dirtyTargets: [] as TrackingReconciliationTargetKey[],
    };
  }
  const subjectInputs = [
    ...new Map(
      accepted.map((candidate) => [
        `${candidate.interval.source}:${candidate.interval.subjectKey}`,
        {
          id: randomUUID(),
          companyId: context.companyId,
          source:
            candidate.interval.source as TrackingActivitySource,
          subjectKey: candidate.interval.subjectKey,
          displayName: candidate.interval.displayName,
        },
      ]),
    ).values(),
  ];
  await tx.activitySubject.createMany({
    data: subjectInputs,
    skipDuplicates: true,
  });
  const subjects = await tx.activitySubject.findMany({
    where: {
      companyId: context.companyId,
      OR: subjectInputs.map((subject) => ({
        source: subject.source,
        subjectKey: subject.subjectKey,
      })),
    },
    select: {
      id: true,
      source: true,
      subjectKey: true,
      displayName: true,
    },
  });
  const subjectByKey = new Map(
    subjects.map((subject) => [
      `${subject.source}:${subject.subjectKey}`,
      subject,
    ]),
  );
  for (const subject of subjects) {
    const incoming = subjectInputs.find(
      (item) =>
        item.source === subject.source &&
        item.subjectKey === subject.subjectKey,
    );
    if (incoming && incoming.displayName !== subject.displayName) {
      await tx.activitySubject.update({
        where: { id: subject.id },
        data: {
          displayName: incoming.displayName,
          displayAliases: mergeDisplayAlias(
            subject.displayName,
            incoming.displayName,
          ),
        },
      });
    }
  }

  const inserted = accepted.map((candidate) => {
    const subject = subjectByKey.get(
      `${candidate.interval.source}:${candidate.interval.subjectKey}`,
    );
    if (!subject) {
      throw new Error("Activity subject resolution failed.");
    }
    return {
      id: randomUUID(),
      companyId: context.companyId,
      userId: context.userId,
      deviceId: context.deviceId,
      workstationId,
      activitySubjectId: subject.id,
      policyLeaseId: candidate.interval.policyLeaseId,
      clientEventId: candidate.interval.clientEventId,
      activitySessionId: candidate.interval.activitySessionId,
      sequenceNumber: candidate.interval.sequenceNumber,
      source: candidate.interval.source as TrackingActivitySource,
      stream: candidate.interval.stream as TrackingActivityStream,
      metric: candidate.interval.metric as TrackingActivityMetric,
      subjectKey: candidate.interval.subjectKey,
      displayName: candidate.interval.displayName,
      browserName:
        candidate.interval.browserName as BrowserName | undefined,
      startedAt: new Date(candidate.interval.startedAt),
      endedAt: new Date(candidate.interval.endedAt),
      clockEpochId: candidate.interval.clockEpochId,
      startedMonotonicMs:
        candidate.interval.startedMonotonicMs === undefined
          ? null
          : BigInt(candidate.interval.startedMonotonicMs),
      endedMonotonicMs:
        candidate.interval.endedMonotonicMs === undefined
          ? null
          : BigInt(candidate.interval.endedMonotonicMs),
      durationMs: BigInt(candidate.interval.durationMs),
      policyVersion: candidate.interval.policyVersion,
      payloadHash: candidate.payloadHash,
      canonicalizationVersion:
        TRACKING_CANONICALIZATION_VERSION_V1,
    };
  });
  await tx.activityInterval.createMany({ data: inserted });

  const fragments = inserted.flatMap((interval) =>
    splitIntervalByUtcDay(interval),
  );
  if (fragments.length > 0) {
    await tx.activityIntervalDayFragment.createMany({
      data: fragments,
    });
  }
  const dirtyTargets = [
    ...new Map(
      fragments.map((fragment) => [
        [
          fragment.companyId,
          fragment.userId,
          fragment.source,
          fragment.utcDate.toISOString(),
        ].join(":"),
        {
          companyId: fragment.companyId,
          userId: fragment.userId,
          source: fragment.source,
          utcDate: fragment.utcDate,
        },
      ]),
    ).values(),
  ];
  for (const target of dirtyTargets) {
    await tx.usageReconciliationTarget.upsert({
      where: {
        companyId_userId_source_utcDate: target,
      },
      update: {
        state: "DIRTY",
        version: { increment: 1 },
        dirtyAt: new Date(),
        lastErrorCode: null,
      },
      create: target,
    });
  }
  await incrementDeviceSubjectSummaries(
    tx,
    fragments,
  );
  return {
    intervals: inserted,
    dirtyTargets,
  };
}

async function incrementDeviceSubjectSummaries(
  tx: Prisma.TransactionClient,
  fragments: Array<{
    companyId: string;
    userId: string;
    deviceId: string;
    activitySubjectId: string;
    source: TrackingActivitySource;
    metric: TrackingActivityMetric;
    utcDate: Date;
    durationMs: bigint;
  }>,
) {
  const receivedAt = new Date();
  const grouped = new Map<string, {
    companyId: string;
    userId: string;
    deviceId: string;
    activitySubjectId: string;
    source: TrackingActivitySource;
    utcDate: Date;
    focusActiveMs: bigint;
    focusedIdleMs: bigint;
    openRuntimeMs: bigint;
    latestReceivedAt: Date;
  }>();
  for (const fragment of fragments) {
    const key = [
      fragment.deviceId,
      fragment.source,
      fragment.activitySubjectId,
      fragment.utcDate.toISOString(),
    ].join(":");
    const current = grouped.get(key) ?? {
      companyId: fragment.companyId,
      userId: fragment.userId,
      deviceId: fragment.deviceId,
      activitySubjectId: fragment.activitySubjectId,
      source: fragment.source,
      utcDate: fragment.utcDate,
      focusActiveMs: 0n,
      focusedIdleMs: 0n,
      openRuntimeMs: 0n,
      latestReceivedAt: receivedAt,
    };
    if (fragment.metric === TrackingActivityMetric.FOCUS_ACTIVE) {
      current.focusActiveMs += fragment.durationMs;
    } else if (fragment.metric === TrackingActivityMetric.FOCUS_IDLE) {
      current.focusedIdleMs += fragment.durationMs;
    } else {
      current.openRuntimeMs += fragment.durationMs;
    }
    grouped.set(key, current);
  }
  for (const value of grouped.values()) {
    await tx.deviceSubjectDailySummary.upsert({
      where: {
        deviceId_source_activitySubjectId_utcDate: {
          deviceId: value.deviceId,
          source: value.source,
          activitySubjectId: value.activitySubjectId,
          utcDate: value.utcDate,
        },
      },
      update: {
        focusActiveMs: { increment: value.focusActiveMs },
        focusedIdleMs: { increment: value.focusedIdleMs },
        openRuntimeMs: { increment: value.openRuntimeMs },
        latestReceivedAt: value.latestReceivedAt,
      },
      create: value,
    });
  }
}

async function refreshCursors(
  tx: Prisma.TransactionClient,
  context: DeviceRequestContext,
  keys: Array<{
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
    clockEpochId: string;
  }>,
): Promise<TrackingSyncCursorV2[]> {
  if (keys.length === 0) return [];
  const where = keys.map((key) => ({
    source: key.source,
    stream: key.stream,
    clockEpochId: key.clockEpochId,
  }));
  const [intervals, tombstones] = await Promise.all([
    tx.activityInterval.findMany({
      where: { deviceId: context.deviceId, OR: where },
      select: {
        source: true,
        stream: true,
        clockEpochId: true,
        sequenceNumber: true,
        endedAt: true,
      },
    }),
    tx.clientSequenceTombstone.findMany({
      where: { deviceId: context.deviceId, OR: where },
      select: {
        source: true,
        stream: true,
        clockEpochId: true,
        sequenceNumber: true,
        rejectionCode: true,
      },
    }),
  ]);
  const response: TrackingSyncCursorV2[] = [];
  for (const key of keys) {
    const dispositions: TrackingSequenceDispositionV2[] = [
      ...intervals
        .filter((row) => sameCursorKey(row, key))
        .map((row) => ({
          sequenceNumber: row.sequenceNumber,
          status: "ACCEPTED" as const,
          endedAt: row.endedAt.toISOString(),
        })),
      ...tombstones
        .filter((row) => sameCursorKey(row, key))
        .map((row) => ({
          sequenceNumber: row.sequenceNumber,
          status: "REJECTED" as const,
          terminal: true,
          rejectionCode: row.rejectionCode,
        })),
    ];
    const coverage = computeTrackingSequenceCoverageV2(dispositions);
    await tx.clientSyncCursor.upsert({
      where: {
        deviceId_source_stream_clockEpochId: {
          deviceId: context.deviceId,
          source: key.source,
          stream: key.stream,
          clockEpochId: key.clockEpochId,
        },
      },
      update: {
        contiguousThroughSequence:
          coverage.contiguousThroughSequence,
        latestAcceptedEndedAt: coverage.latestAcceptedEndedAt
          ? new Date(coverage.latestAcceptedEndedAt)
          : null,
        missingRanges: coverage.missingRanges,
        rejectedRanges: coverage.rejectedRanges,
      },
      create: {
        companyId: context.companyId,
        userId: context.userId,
        deviceId: context.deviceId,
        source: key.source,
        stream: key.stream,
        clockEpochId: key.clockEpochId,
        contiguousThroughSequence:
          coverage.contiguousThroughSequence,
        latestAcceptedEndedAt: coverage.latestAcceptedEndedAt
          ? new Date(coverage.latestAcceptedEndedAt)
          : null,
        missingRanges: coverage.missingRanges,
        rejectedRanges: coverage.rejectedRanges,
      },
    });
    response.push({
      source: key.source,
      stream: key.stream,
      clockEpochId: key.clockEpochId,
      ...coverage,
    });
  }
  return response;
}

async function storeFocusSnapshot(input: {
  tx: Prisma.TransactionClient;
  context: DeviceRequestContext;
  snapshot: LiveFocusSnapshotV2;
  browserName: BrowserName | null;
  workstationId: string | null;
  protocolActivatedAt: Date;
  lease: StoredPolicyLease;
  cursors: TrackingSyncCursorV2[];
}) {
  const existing = await input.tx.liveFocusSnapshot.findUnique({
    where: {
      deviceId_source: {
        deviceId: input.context.deviceId,
        source: input.snapshot.source as TrackingActivitySource,
      },
    },
    select: { snapshotSequence: true },
  });
  if (
    existing &&
    existing.snapshotSequence >= input.snapshot.snapshotSequence
  ) {
    return null;
  }
  let subjectId: string | null = null;
  if (input.snapshot.subjectKey && input.snapshot.displayName) {
    const subject = await input.tx.activitySubject.upsert({
      where: {
        companyId_source_subjectKey: {
          companyId: input.context.companyId,
          source:
            input.snapshot.source as TrackingActivitySource,
          subjectKey: input.snapshot.subjectKey,
        },
      },
      update: { displayName: input.snapshot.displayName },
      create: {
        companyId: input.context.companyId,
        source: input.snapshot.source as TrackingActivitySource,
        subjectKey: input.snapshot.subjectKey,
        displayName: input.snapshot.displayName,
      },
      select: { id: true },
    });
    subjectId = subject.id;
  }
  const cursor = input.cursors.find(
    (item) =>
      item.source === input.snapshot.source &&
      item.stream === input.snapshot.stream &&
      item.clockEpochId === input.snapshot.clockEpochId,
  ) ?? {
    source: input.snapshot.source,
    stream: input.snapshot.stream,
    clockEpochId: input.snapshot.clockEpochId,
    contiguousThroughSequence: 0,
    latestAcceptedEndedAt: null,
    missingRanges: [],
    rejectedRanges: [],
  };
  const provisionalFromAt = await resolveProvisionalFromAt({
    ...input,
    cursor,
  });
  const data = {
    companyId: input.context.companyId,
    userId: input.context.userId,
    workstationId: input.workstationId,
    activitySubjectId: subjectId,
    policyLeaseId: input.snapshot.policyLeaseId,
    stream: TrackingActivityStream.FOCUS,
    browserName:
      input.snapshot.browserName as BrowserName | undefined,
    snapshotSequence: input.snapshot.snapshotSequence,
    activitySessionId: input.snapshot.activitySessionId,
    currentStateId: input.snapshot.currentStateId,
    clockEpochId: input.snapshot.clockEpochId,
    policyVersion: input.snapshot.policyVersion,
    subjectKey: input.snapshot.subjectKey,
    displayName: input.snapshot.displayName,
    state: input.snapshot.state as TrackingFocusState,
    sessionStartedAt: optionalDate(input.snapshot.sessionStartedAt),
    stateStartedAt: optionalDate(input.snapshot.stateStartedAt),
    lastActivityEvidenceAt: optionalDate(
      input.snapshot.lastActivityEvidenceAt,
    ),
    activityEvidenceKind:
      input.snapshot.activityEvidenceKind as
        | TrackingEvidenceKind
        | null,
    latestEmittedIntervalSequence:
      input.snapshot.latestEmittedIntervalSequence,
    latestEmittedClientEventId:
      input.snapshot.latestEmittedClientEventId,
    nextIntervalSequence: input.snapshot.nextIntervalSequence,
    lastObservedAt: new Date(input.snapshot.lastObservedAt),
    collectorState:
      input.snapshot.collectorState as TrackingCollectorState,
    provisionalFromAt,
    receivedAt: new Date(),
  };
  await input.tx.liveFocusSnapshot.upsert({
    where: {
      deviceId_source: {
        deviceId: input.context.deviceId,
        source: input.snapshot.source as TrackingActivitySource,
      },
    },
    update: data,
    create: {
      ...data,
      deviceId: input.context.deviceId,
      source: input.snapshot.source as TrackingActivitySource,
    },
  });
  return input.snapshot.snapshotSequence;
}

async function resolveProvisionalFromAt(input: {
  tx: Prisma.TransactionClient;
  context: DeviceRequestContext;
  snapshot: LiveFocusSnapshotV2;
  browserName: BrowserName | null;
  protocolActivatedAt: Date;
  lease: StoredPolicyLease;
  cursor: TrackingSyncCursorV2;
}) {
  const snapshot = input.snapshot;
  if (
    snapshot.state === "NONE" ||
    !snapshot.stateStartedAt ||
    !snapshot.activitySessionId ||
    !snapshot.currentStateId
  ) {
    return null;
  }
  if (
    snapshot.latestEmittedIntervalSequence !== null &&
    snapshot.latestEmittedClientEventId !== null
  ) {
    const latest = await input.tx.activityInterval.findFirst({
      where: {
        deviceId: input.context.deviceId,
        clientEventId: snapshot.latestEmittedClientEventId,
        source: snapshot.source as TrackingActivitySource,
        stream: TrackingActivityStream.FOCUS,
        clockEpochId: snapshot.clockEpochId,
        sequenceNumber:
          snapshot.latestEmittedIntervalSequence,
        activitySessionId: snapshot.activitySessionId,
        policyLeaseId: snapshot.policyLeaseId,
      },
      select: { endedAt: true },
    });
    const stateStartedAt = new Date(snapshot.stateStartedAt);
    if (
      latest &&
      latest.endedAt.getTime() === stateStartedAt.getTime() &&
      snapshot.nextIntervalSequence ===
        snapshot.latestEmittedIntervalSequence + 1 &&
      input.cursor.contiguousThroughSequence >=
        snapshot.latestEmittedIntervalSequence &&
      !input.cursor.missingRanges.some(
        (range) =>
          range.from <= snapshot.latestEmittedIntervalSequence! &&
          range.to >= snapshot.latestEmittedIntervalSequence!,
      )
    ) {
      return latest.endedAt;
    }
    return null;
  }

  const [acceptedCount, tombstoneCount, overlap] = await Promise.all([
    input.tx.activityInterval.count({
      where: {
        deviceId: input.context.deviceId,
        source: snapshot.source as TrackingActivitySource,
        stream: TrackingActivityStream.FOCUS,
        clockEpochId: snapshot.clockEpochId,
      },
    }),
    input.tx.clientSequenceTombstone.count({
      where: {
        deviceId: input.context.deviceId,
        source: snapshot.source as TrackingActivitySource,
        stream: TrackingActivityStream.FOCUS,
        clockEpochId: snapshot.clockEpochId,
      },
    }),
    input.tx.activityInterval.findFirst({
      where: {
        deviceId: input.context.deviceId,
        source: snapshot.source as TrackingActivitySource,
        stream: TrackingActivityStream.FOCUS,
        startedAt: { lt: new Date(snapshot.lastObservedAt) },
        endedAt: { gt: new Date(snapshot.stateStartedAt) },
      },
      select: { id: true },
    }),
  ]);
  const allowed = canBootstrapFirstStateProvisionalV2({
    snapshot,
    contiguousThroughSequence:
      input.cursor.contiguousThroughSequence,
    hasAnyDisposition: acceptedCount + tombstoneCount > 0,
    hasMissingSequence: input.cursor.missingRanges.length > 0,
    hasOverlap: Boolean(overlap),
    protocolActivatedAt: input.protocolActivatedAt.toISOString(),
    clockEpochStartedAt: input.protocolActivatedAt.toISOString(),
    allowedUtcWindows: readPolicyWindows(
      input.lease.allowedUtcWindows,
    ),
    ...(input.browserName === BrowserName.CHROME ||
    input.browserName === BrowserName.EDGE
      ? { expectedBrowserName: input.browserName }
      : {}),
  });
  return allowed ? new Date(snapshot.stateStartedAt) : null;
}

async function storeClientHealth(
  tx: Prisma.TransactionClient,
  context: DeviceRequestContext,
  source: TrackingActivitySource,
  workstationId: string | null,
  health: ClientHealthV2,
  receivedAt: Date,
) {
  const data = {
    companyId: context.companyId,
    userId: context.userId,
    workstationId,
    clientType: health.clientType as DeviceClientType,
    clientVersion: health.clientVersion,
    platform: health.platform,
    connectionState:
      health.connectionState as TrackingConnectionState,
    collectorState:
      health.collectorState as TrackingCollectorState,
    policyState: health.policyState as TrackingPolicyState,
    migrationState:
      health.migrationState as TrackingMigrationState,
    queuePending: health.queue.pending,
    queueReady: health.queue.ready,
    queueDeadLetter: health.queue.deadLetter,
    oldestQueuedAt: optionalDate(health.queue.oldestQueuedAt),
    nextRetryAt: optionalDate(health.queue.nextRetryAt),
    lastSuccessfulHeartbeatAt: optionalDate(
      health.lastSuccessfulHeartbeatAt,
    ),
    lastSuccessfulSyncAt: optionalDate(
      health.lastSuccessfulSyncAt,
    ),
    errorCode: health.errorCode as TrackingHealthErrorCode,
    receivedAt,
  };
  await tx.clientHealthSnapshot.upsert({
    where: {
      deviceId_source: {
        deviceId: context.deviceId,
        source,
      },
    },
    update: data,
    create: {
      ...data,
      deviceId: context.deviceId,
      source,
    },
  });
}

function parseSnapshot(value: unknown): LiveFocusSnapshotV2 {
  const snapshot = readObject(
    value,
    "focusSnapshot must be an object.",
  );
  assertOnlyKeys(snapshot, [
    "snapshotSequence",
    "activitySessionId",
    "currentStateId",
    "source",
    "stream",
    "clockEpochId",
    "policyVersion",
    "policyLeaseId",
    "subjectKey",
    "displayName",
    "browserName",
    "state",
    "sessionStartedAt",
    "stateStartedAt",
    "lastActivityEvidenceAt",
    "activityEvidenceKind",
    "latestEmittedIntervalSequence",
    "latestEmittedClientEventId",
    "nextIntervalSequence",
    "lastObservedAt",
    "collectorState",
  ], "focusSnapshot");
  const parsed = snapshot as LiveFocusSnapshotV2;
  assertEnumValue(
    parsed.source,
    ["DESKTOP_APP", "BROWSER_DOMAIN"],
    "focusSnapshot.source",
  );
  assertEnumValue(parsed.stream, ["FOCUS"], "focusSnapshot.stream");
  assertEnumValue(
    parsed.collectorState,
    ["HEALTHY", "LIMITED", "PAUSED", "ERROR"],
    "focusSnapshot.collectorState",
  );
  if (parsed.browserName !== undefined) {
    assertEnumValue(
      parsed.browserName,
      ["CHROME", "EDGE"],
      "focusSnapshot.browserName",
    );
  }
  if (parsed.activityEvidenceKind !== null) {
    assertEnumValue(
      parsed.activityEvidenceKind,
      [
        "FOCUS_ACQUIRED",
        "WINDOWS_SESSION_INPUT_WHILE_FOREGROUND",
        "TRUSTED_PAGE_INTERACTION",
      ],
      "focusSnapshot.activityEvidenceKind",
    );
  }
  if (
    !Number.isInteger(parsed.snapshotSequence) ||
    parsed.snapshotSequence < 1 ||
    !Number.isInteger(parsed.nextIntervalSequence) ||
    parsed.nextIntervalSequence < 1
  ) {
    throw new BadRequestException(
      "Focus snapshot sequences must be positive integers.",
    );
  }
  readBoundedString(
    parsed.clockEpochId,
    "focusSnapshot.clockEpochId",
    MAX_IDENTITY_LENGTH,
  );
  readBoundedString(
    parsed.policyVersion,
    "focusSnapshot.policyVersion",
    MAX_IDENTITY_LENGTH,
  );
  readBoundedString(
    parsed.policyLeaseId,
    "focusSnapshot.policyLeaseId",
    MAX_IDENTITY_LENGTH,
  );
  readIso(parsed.lastObservedAt, "focusSnapshot.lastObservedAt");
  for (const [label, timestamp] of [
    ["sessionStartedAt", parsed.sessionStartedAt],
    ["stateStartedAt", parsed.stateStartedAt],
    ["lastActivityEvidenceAt", parsed.lastActivityEvidenceAt],
  ] as const) {
    if (timestamp !== null) {
      readIso(timestamp, `focusSnapshot.${label}`);
    }
  }
  for (const [label, identity] of [
    ["activitySessionId", parsed.activitySessionId],
    ["currentStateId", parsed.currentStateId],
  ] as const) {
    if (identity !== null) {
      readBoundedString(
        identity,
        `focusSnapshot.${label}`,
        MAX_IDENTITY_LENGTH,
      );
    }
  }
  if (
    (parsed.latestEmittedIntervalSequence === null) !==
    (parsed.latestEmittedClientEventId === null)
  ) {
    throw new BadRequestException(
      "Focus snapshot latest emitted sequence and event identity must be supplied together.",
    );
  }
  if (
    parsed.latestEmittedIntervalSequence !== null &&
    (!Number.isInteger(parsed.latestEmittedIntervalSequence) ||
      parsed.latestEmittedIntervalSequence < 1 ||
      parsed.latestEmittedIntervalSequence >= parsed.nextIntervalSequence)
  ) {
    throw new BadRequestException(
      "Focus snapshot latest emitted sequence is invalid.",
    );
  }
  if (parsed.latestEmittedClientEventId !== null) {
    readBoundedString(
      parsed.latestEmittedClientEventId,
      "focusSnapshot.latestEmittedClientEventId",
      MAX_IDENTITY_LENGTH,
    );
  }
  if (!["ACTIVE", "IDLE", "NONE"].includes(parsed.state)) {
    throw new BadRequestException("Focus snapshot state is invalid.");
  }
  if (
    parsed.state === "NONE" &&
    (parsed.subjectKey !== null ||
      parsed.displayName !== null ||
      parsed.stateStartedAt !== null)
  ) {
    throw new BadRequestException(
      "A NONE focus snapshot cannot contain an active subject.",
    );
  }
  if (
    parsed.state !== "NONE" &&
    (!parsed.subjectKey ||
      !parsed.displayName ||
      !parsed.stateStartedAt ||
      !parsed.sessionStartedAt)
  ) {
    throw new BadRequestException(
      "An active focus snapshot requires subject and state timing.",
    );
  }
  return parsed;
}

function parseHealth(value: unknown): ClientHealthV2 {
  const health = readObject(value, "health must be an object.");
  assertOnlyKeys(health, [
    "clientType",
    "clientVersion",
    "platform",
    "connectionState",
    "collectorState",
    "policyState",
    "migrationState",
    "queue",
    "lastSuccessfulHeartbeatAt",
    "lastSuccessfulSyncAt",
    "errorCode",
  ], "health");
  const queue = readObject(health.queue, "health.queue must be an object.");
  assertOnlyKeys(queue, [
    "pending",
    "ready",
    "deadLetter",
    "oldestQueuedAt",
    "nextRetryAt",
  ], "health.queue");
  for (const key of ["pending", "ready", "deadLetter"]) {
    if (
      !Number.isInteger(queue[key]) ||
      Number(queue[key]) < 0
    ) {
      throw new BadRequestException(
        `health.queue.${key} must be a non-negative integer.`,
      );
    }
  }
  assertEnumValue(
    health.clientType,
    ["DESKTOP_AGENT", "BROWSER_EXTENSION"],
    "health.clientType",
  );
  assertEnumValue(
    health.platform,
    ["WINDOWS", "CHROME", "EDGE"],
    "health.platform",
  );
  assertEnumValue(
    health.connectionState,
    ["ONLINE", "OFFLINE", "AUTH_REQUIRED", "UPGRADE_REQUIRED", "ERROR"],
    "health.connectionState",
  );
  assertEnumValue(
    health.collectorState,
    ["HEALTHY", "LIMITED", "PAUSED", "ERROR"],
    "health.collectorState",
  );
  assertEnumValue(
    health.policyState,
    ["ACTIVE", "ACKNOWLEDGEMENT_REQUIRED", "TIMEZONE_REQUIRED", "EXPIRED"],
    "health.policyState",
  );
  assertEnumValue(
    health.migrationState,
    ["V1", "PREPARING_V2", "DRAINING_V1", "V2", "ERROR"],
    "health.migrationState",
  );
  assertEnumValue(
    health.errorCode,
    [
      "NONE",
      "NATIVE_HELPER_UNAVAILABLE",
      "INTERACTION_PERMISSION_REQUIRED",
      "QUEUE_PRESSURE",
      "POLICY_UNAVAILABLE",
      "CLOCK_UNTRUSTED",
      "UPGRADE_REQUIRED",
      "UNKNOWN",
    ],
    "health.errorCode",
  );
  readBoundedString(
    health.clientVersion,
    "health.clientVersion",
    80,
  );
  for (const value of [
    health.lastSuccessfulHeartbeatAt,
    health.lastSuccessfulSyncAt,
    queue.oldestQueuedAt,
    queue.nextRetryAt,
  ]) {
    if (value !== null && value !== undefined) {
      readIso(value, "health timestamp");
    }
  }
  return {
    ...(health as Omit<ClientHealthV2, "queue">),
    queue: queue as ClientHealthV2["queue"],
  };
}

function assertHealthBinding(
  health: ClientHealthV2,
  clientType: DeviceClientType,
) {
  if (health.clientType !== clientType) {
    throw new ForbiddenException(
      "Health client type does not match the device credential.",
    );
  }
  const allowedPlatforms =
    clientType === DeviceClientType.DESKTOP_AGENT
      ? ["WINDOWS"]
      : ["CHROME", "EDGE"];
  if (!allowedPlatforms.includes(health.platform)) {
    throw new ForbiddenException(
      "Health platform does not match the device credential.",
    );
  }
}

function collectLaneKeys(
  candidates: CandidateInterval[],
  snapshot: LiveFocusSnapshotV2 | undefined,
  expectedSource: TrackingActivitySource,
) {
  const values = candidates.map((candidate) => ({
    source: candidate.interval.source as TrackingActivitySource,
    stream: candidate.interval.stream as TrackingActivityStream,
  }));
  if (snapshot) {
    values.push({
      source: expectedSource,
      stream: TrackingActivityStream.FOCUS,
    });
  }
  return [
    ...new Map(
      values.map((value) => [
        `${value.source}:${value.stream}`,
        value,
      ]),
    ).values(),
  ].sort(
    (left, right) =>
      left.source.localeCompare(right.source) ||
      left.stream.localeCompare(right.stream),
  );
}

function uniqueCursorKeys(candidates: CandidateInterval[]) {
  return [
    ...new Map(
      candidates.map((candidate) => {
        const value = {
          source:
            candidate.interval.source as TrackingActivitySource,
          stream:
            candidate.interval.stream as TrackingActivityStream,
          clockEpochId: candidate.interval.clockEpochId,
        };
        return [sequenceKey(value), value];
      }),
    ).values(),
  ];
}

function sequenceKey(value: {
  source: string;
  stream: string;
  clockEpochId: string;
  sequenceNumber?: number;
}) {
  return [
    value.source,
    value.stream,
    value.clockEpochId,
    value.sequenceNumber ?? "",
  ].join(":");
}

function sameCursorKey(
  value: {
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
    clockEpochId: string;
  },
  key: {
    source: TrackingActivitySource;
    stream: TrackingActivityStream;
    clockEpochId: string;
  },
) {
  return (
    value.source === key.source &&
    value.stream === key.stream &&
    value.clockEpochId === key.clockEpochId
  );
}

function splitIntervalByUtcDay(interval: {
  id: string;
  companyId: string;
  userId: string;
  deviceId: string;
  activitySubjectId: string;
  source: TrackingActivitySource;
  stream: TrackingActivityStream;
  metric: TrackingActivityMetric;
  startedAt: Date;
  endedAt: Date;
}) {
  const fragments = [];
  let cursor = interval.startedAt;
  let fragmentIndex = 0;
  while (cursor < interval.endedAt) {
    const nextDay = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth(),
        cursor.getUTCDate() + 1,
      ),
    );
    const endedAt =
      interval.endedAt < nextDay ? interval.endedAt : nextDay;
    fragments.push({
      id: randomUUID(),
      activityIntervalId: interval.id,
      companyId: interval.companyId,
      userId: interval.userId,
      deviceId: interval.deviceId,
      activitySubjectId: interval.activitySubjectId,
      source: interval.source,
      stream: interval.stream,
      metric: interval.metric,
      utcDate: new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
        ),
      ),
      fragmentIndex,
      startedAt: cursor,
      endedAt,
      durationMs: BigInt(endedAt.getTime() - cursor.getTime()),
    });
    cursor = endedAt;
    fragmentIndex += 1;
  }
  return fragments;
}

function readPolicyWindows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).startsAt === "string" &&
      typeof (item as Record<string, unknown>).endsAt === "string"
    ) {
      return [{
        startsAt: (item as Record<string, string>).startsAt,
        endsAt: (item as Record<string, string>).endsAt,
      }];
    }
    return [];
  });
}

function safePayloadHash(interval: ActivityIntervalV2) {
  try {
    return createHash("sha256")
      .update(canonicalizeActivityIntervalV2(interval))
      .digest("hex");
  } catch {
    return createHash("sha256")
      .update(JSON.stringify(interval))
      .digest("hex");
  }
}

function mergeDisplayAlias(
  previous: string,
  incoming: string,
): string[] | undefined {
  const values = [...new Set([previous, incoming])].filter(Boolean);
  return values.length > 1 ? values : undefined;
}

function optionalDate(value: string | null) {
  return value ? new Date(value) : null;
}

function readObject(value: unknown, message: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: string[],
  label: string,
) {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(record).find(
    (key) => !allowedSet.has(key),
  );
  if (unexpected) {
    throw new BadRequestException(
      `${label}.${unexpected} is not allowed.`,
    );
  }
}

function readIso(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${label} must be an ISO timestamp.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} must be an ISO timestamp.`);
  }
  return parsed;
}

function readBoundedString(
  value: unknown,
  label: string,
  maximumLength: number,
) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximumLength
  ) {
    throw new BadRequestException(
      `${label} must contain at most ${maximumLength} characters.`,
    );
  }
  return value.trim();
}

function assertEnumValue(
  value: unknown,
  allowed: readonly string[],
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new BadRequestException(`${label} is invalid.`);
  }
}

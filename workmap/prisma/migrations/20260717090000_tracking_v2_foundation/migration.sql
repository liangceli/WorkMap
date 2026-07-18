-- Tracking protocol v2 is additive. Existing v1 activity and summary rows remain readable.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "WorkstationPairingMode" AS ENUM ('CREATE_NEW', 'EXISTING', 'STANDALONE');
CREATE TYPE "TrackingActivitySource" AS ENUM ('DESKTOP_APP', 'BROWSER_DOMAIN');
CREATE TYPE "TrackingActivityStream" AS ENUM ('FOCUS', 'OPEN_RUNTIME');
CREATE TYPE "TrackingActivityMetric" AS ENUM ('FOCUS_ACTIVE', 'FOCUS_IDLE', 'OPEN_RUNTIME');
CREATE TYPE "TrackingCollectorState" AS ENUM ('HEALTHY', 'LIMITED', 'PAUSED', 'ERROR');
CREATE TYPE "TrackingConnectionState" AS ENUM ('ONLINE', 'OFFLINE', 'AUTH_REQUIRED', 'UPGRADE_REQUIRED', 'ERROR');
CREATE TYPE "TrackingPolicyState" AS ENUM ('ACTIVE', 'ACKNOWLEDGEMENT_REQUIRED', 'TIMEZONE_REQUIRED', 'EXPIRED');
CREATE TYPE "TrackingMigrationState" AS ENUM ('V1', 'PREPARING_V2', 'DRAINING_V1', 'V2', 'ERROR');
CREATE TYPE "TrackingHealthErrorCode" AS ENUM (
  'NONE',
  'NATIVE_HELPER_UNAVAILABLE',
  'INTERACTION_PERMISSION_REQUIRED',
  'QUEUE_PRESSURE',
  'POLICY_UNAVAILABLE',
  'CLOCK_UNTRUSTED',
  'UPGRADE_REQUIRED',
  'UNKNOWN'
);
CREATE TYPE "TrackingFocusState" AS ENUM ('ACTIVE', 'IDLE', 'NONE');
CREATE TYPE "TrackingEvidenceKind" AS ENUM (
  'FOCUS_ACQUIRED',
  'WINDOWS_SESSION_INPUT_WHILE_FOREGROUND',
  'TRUSTED_PAGE_INTERACTION'
);
CREATE TYPE "TrackingReconciliationState" AS ENUM ('DIRTY', 'PROCESSING', 'CLEAN', 'FAILED');
CREATE TYPE "TrackingProtocolActivationState" AS ENUM ('PREPARED', 'CONFIRMED');

ALTER TABLE "Device"
  ADD COLUMN "clientType" "DeviceClientType",
  ADD COLUMN "browserName" "BrowserName",
  ADD COLUMN "workstationId" UUID,
  ADD COLUMN "protocolActivatedAt" TIMESTAMPTZ(3);

ALTER TABLE "DevicePairingCode"
  ADD COLUMN "workstationId" UUID,
  ADD COLUMN "workstationMode" "WorkstationPairingMode",
  ADD COLUMN "expectedDesktopDeviceId" UUID;

ALTER TABLE "MonitoringPolicy"
  ADD COLUMN "scheduleTimeZone" TEXT;

-- Legacy identities are backfilled only when retained evidence is unambiguous.
UPDATE "Device" AS device
SET "clientType" = inferred."clientType"::"DeviceClientType"
FROM (
  SELECT
    credential."deviceId",
    MIN(credential."clientType"::TEXT) AS "clientType"
  FROM "DeviceCredential" AS credential
  WHERE credential."revokedAt" IS NULL
  GROUP BY credential."deviceId"
  HAVING COUNT(DISTINCT credential."clientType") = 1
) AS inferred
WHERE device."id" = inferred."deviceId";

UPDATE "Device" AS device
SET "browserName" = inferred."browserName"::"BrowserName"
FROM (
  SELECT
    event."deviceId",
    MIN(event."browserName"::TEXT) AS "browserName"
  FROM "ActivityEvent" AS event
  WHERE event."source" = 'BROWSER_EXTENSION'
    AND event."browserName" IN ('CHROME', 'EDGE')
  GROUP BY event."deviceId"
  HAVING COUNT(DISTINCT event."browserName") = 1
) AS inferred
WHERE device."id" = inferred."deviceId"
  AND device."clientType" = 'BROWSER_EXTENSION';

-- Existing 0.4.x extensions stored their immutable browser identity in hostname.
-- Use it only when it is one of the two supported, unambiguous values.
UPDATE "Device"
SET "browserName" = CASE
  WHEN UPPER("hostname") IN ('CHROME', 'GOOGLE CHROME') THEN 'CHROME'::"BrowserName"
  WHEN UPPER("hostname") IN ('EDGE', 'MICROSOFT EDGE') THEN 'EDGE'::"BrowserName"
  ELSE "browserName"
END
WHERE "clientType" = 'BROWSER_EXTENSION'
  AND "browserName" IS NULL;

CREATE TABLE "Workstation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workstation_pkey" PRIMARY KEY ("id")
);

-- Preserve existing Desktop Agent credentials during the v1 -> v2 upgrade.
-- A legacy desktop Device becomes the stable workstation it already represents.
INSERT INTO "Workstation" (
  "id",
  "companyId",
  "userId",
  "displayName",
  "createdAt",
  "updatedAt"
)
SELECT
  device."id",
  device."companyId",
  device."userId",
  COALESCE(NULLIF(BTRIM(device."hostname"), ''), 'Windows workstation'),
  device."createdAt",
  device."updatedAt"
FROM "Device" AS device
WHERE device."clientType" = 'DESKTOP_AGENT'
ON CONFLICT ("id") DO NOTHING;

UPDATE "Device"
SET "workstationId" = "id"
WHERE "clientType" = 'DESKTOP_AGENT'
  AND "workstationId" IS NULL;

CREATE TABLE "ActivitySubject" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "displayAliases" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivitySubject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DevicePolicyLease" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "monitoringPolicyId" UUID NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "issuedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "scheduleTimeZone" TEXT NOT NULL,
  "allowedUtcWindows" JSONB NOT NULL,
  "windowSetHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DevicePolicyLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceProtocolActivation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "policyLeaseId" UUID NOT NULL,
  "state" "TrackingProtocolActivationState" NOT NULL DEFAULT 'PREPARED',
  "proposedActivatedAt" TIMESTAMPTZ(3) NOT NULL,
  "confirmedActivatedAt" TIMESTAMPTZ(3),
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceProtocolActivation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityInterval" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "workstationId" UUID,
  "activitySubjectId" UUID NOT NULL,
  "policyLeaseId" UUID NOT NULL,
  "clientEventId" TEXT NOT NULL,
  "activitySessionId" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL,
  "metric" "TrackingActivityMetric" NOT NULL,
  "subjectKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "browserName" "BrowserName",
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "endedAt" TIMESTAMPTZ(3) NOT NULL,
  "clockEpochId" TEXT NOT NULL,
  "startedMonotonicMs" BIGINT,
  "endedMonotonicMs" BIGINT,
  "durationMs" BIGINT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "canonicalizationVersion" INTEGER NOT NULL DEFAULT 1,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityInterval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityInterval_positive_duration_check" CHECK ("durationMs" > 0),
  CONSTRAINT "ActivityInterval_positive_range_check" CHECK ("endedAt" > "startedAt"),
  CONSTRAINT "ActivityInterval_stream_metric_check" CHECK (
    ("stream" = 'FOCUS' AND "metric" IN ('FOCUS_ACTIVE', 'FOCUS_IDLE'))
    OR ("stream" = 'OPEN_RUNTIME' AND "metric" = 'OPEN_RUNTIME')
  )
);

CREATE TABLE "ActivityIntervalDayFragment" (
  "id" UUID NOT NULL,
  "activityIntervalId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "activitySubjectId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL,
  "metric" "TrackingActivityMetric" NOT NULL,
  "utcDate" DATE NOT NULL,
  "fragmentIndex" INTEGER NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL,
  "endedAt" TIMESTAMPTZ(3) NOT NULL,
  "durationMs" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityIntervalDayFragment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityIntervalDayFragment_positive_duration_check" CHECK ("durationMs" > 0),
  CONSTRAINT "ActivityIntervalDayFragment_positive_range_check" CHECK ("endedAt" > "startedAt")
);

CREATE TABLE "ClientSequenceTombstone" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "clientEventId" TEXT,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL,
  "clockEpochId" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "rejectionCode" TEXT NOT NULL,
  "payloadHash" TEXT,
  "rejectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientSequenceTombstone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientWriteLane" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "workstationId" UUID,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientWriteLane_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveFocusSnapshot" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "workstationId" UUID,
  "activitySubjectId" UUID,
  "policyLeaseId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL DEFAULT 'FOCUS',
  "browserName" "BrowserName",
  "snapshotSequence" INTEGER NOT NULL,
  "activitySessionId" TEXT,
  "currentStateId" TEXT,
  "clockEpochId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "subjectKey" TEXT,
  "displayName" TEXT,
  "state" "TrackingFocusState" NOT NULL,
  "sessionStartedAt" TIMESTAMPTZ(3),
  "stateStartedAt" TIMESTAMPTZ(3),
  "lastActivityEvidenceAt" TIMESTAMPTZ(3),
  "activityEvidenceKind" "TrackingEvidenceKind",
  "latestEmittedIntervalSequence" INTEGER,
  "latestEmittedClientEventId" TEXT,
  "nextIntervalSequence" INTEGER NOT NULL,
  "lastObservedAt" TIMESTAMPTZ(3) NOT NULL,
  "collectorState" "TrackingCollectorState" NOT NULL,
  "provisionalFromAt" TIMESTAMPTZ(3),
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveFocusSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientHealthSnapshot" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "workstationId" UUID,
  "source" "TrackingActivitySource" NOT NULL,
  "clientType" "DeviceClientType" NOT NULL,
  "clientVersion" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "connectionState" "TrackingConnectionState" NOT NULL,
  "collectorState" "TrackingCollectorState" NOT NULL,
  "policyState" "TrackingPolicyState" NOT NULL,
  "migrationState" "TrackingMigrationState" NOT NULL,
  "queuePending" INTEGER NOT NULL,
  "queueReady" INTEGER NOT NULL,
  "queueDeadLetter" INTEGER NOT NULL,
  "oldestQueuedAt" TIMESTAMPTZ(3),
  "nextRetryAt" TIMESTAMPTZ(3),
  "lastSuccessfulHeartbeatAt" TIMESTAMPTZ(3),
  "lastSuccessfulSyncAt" TIMESTAMPTZ(3),
  "errorCode" "TrackingHealthErrorCode" NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientHealthSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientHealthSnapshot_nonnegative_queue_check" CHECK (
    "queuePending" >= 0 AND "queueReady" >= 0 AND "queueDeadLetter" >= 0
  )
);

CREATE TABLE "ClientSyncCursor" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "stream" "TrackingActivityStream" NOT NULL,
  "clockEpochId" TEXT NOT NULL,
  "contiguousThroughSequence" INTEGER NOT NULL DEFAULT 0,
  "latestAcceptedEndedAt" TIMESTAMPTZ(3),
  "missingRanges" JSONB NOT NULL,
  "rejectedRanges" JSONB NOT NULL,
  "clockDriftMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientSyncCursor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientSyncCursor_nonnegative_sequence_check" CHECK ("contiguousThroughSequence" >= 0)
);

CREATE TABLE "DeviceSubjectDailySummary" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "activitySubjectId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "utcDate" DATE NOT NULL,
  "focusActiveMs" BIGINT NOT NULL DEFAULT 0,
  "focusedIdleMs" BIGINT NOT NULL DEFAULT 0,
  "openRuntimeMs" BIGINT NOT NULL DEFAULT 0,
  "latestReceivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeviceSubjectDailySummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSubjectDailySummary" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "activitySubjectId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "utcDate" DATE NOT NULL,
  "focusActiveMs" BIGINT NOT NULL DEFAULT 0,
  "focusedIdleMs" BIGINT NOT NULL DEFAULT 0,
  "openRuntimeMs" BIGINT NOT NULL DEFAULT 0,
  "reconciliationVersion" INTEGER NOT NULL DEFAULT 0,
  "latestIncludedReceivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSubjectDailySummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserDailyFocusSummary" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "utcDate" DATE NOT NULL,
  "focusActiveMs" BIGINT NOT NULL DEFAULT 0,
  "focusedIdleMs" BIGINT NOT NULL DEFAULT 0,
  "reconciliationVersion" INTEGER NOT NULL DEFAULT 0,
  "latestIncludedReceivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDailyFocusSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyDailyFocusSummary" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "utcDate" DATE NOT NULL,
  "focusActiveMs" BIGINT NOT NULL DEFAULT 0,
  "focusedIdleMs" BIGINT NOT NULL DEFAULT 0,
  "reconciliationVersion" INTEGER NOT NULL DEFAULT 0,
  "latestIncludedReceivedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyDailyFocusSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageReconciliationTarget" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "source" "TrackingActivitySource" NOT NULL,
  "utcDate" DATE NOT NULL,
  "state" "TrackingReconciliationState" NOT NULL DEFAULT 'DIRTY',
  "version" INTEGER NOT NULL DEFAULT 1,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "dirtyAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMPTZ(3),
  "reconciledAt" TIMESTAMPTZ(3),
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageReconciliationTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Device_workstationId_clientType_revokedAt_idx"
  ON "Device"("workstationId", "clientType", "revokedAt");
CREATE INDEX "DevicePairingCode_workstationId_idx" ON "DevicePairingCode"("workstationId");
CREATE INDEX "DevicePairingCode_expectedDesktopDeviceId_idx"
  ON "DevicePairingCode"("expectedDesktopDeviceId");
CREATE INDEX "Workstation_companyId_userId_revokedAt_idx"
  ON "Workstation"("companyId", "userId", "revokedAt");
CREATE UNIQUE INDEX "ActivitySubject_companyId_source_subjectKey_key"
  ON "ActivitySubject"("companyId", "source", "subjectKey");
CREATE INDEX "ActivitySubject_companyId_source_displayName_idx"
  ON "ActivitySubject"("companyId", "source", "displayName");
CREATE INDEX "DevicePolicyLease_companyId_userId_deviceId_expiresAt_idx"
  ON "DevicePolicyLease"("companyId", "userId", "deviceId", "expiresAt");
CREATE INDEX "DevicePolicyLease_monitoringPolicyId_policyVersion_idx"
  ON "DevicePolicyLease"("monitoringPolicyId", "policyVersion");
CREATE UNIQUE INDEX "DeviceProtocolActivation_deviceId_key"
  ON "DeviceProtocolActivation"("deviceId");
CREATE INDEX "DeviceProtocolActivation_companyId_userId_state_idx"
  ON "DeviceProtocolActivation"("companyId", "userId", "state");
CREATE UNIQUE INDEX "ActivityInterval_deviceId_clientEventId_key"
  ON "ActivityInterval"("deviceId", "clientEventId");
CREATE UNIQUE INDEX "ActivityInterval_deviceId_source_stream_clockEpochId_sequenceNumber_key"
  ON "ActivityInterval"("deviceId", "source", "stream", "clockEpochId", "sequenceNumber");
CREATE INDEX "ActivityInterval_companyId_userId_source_startedAt_idx"
  ON "ActivityInterval"("companyId", "userId", "source", "startedAt");
CREATE INDEX "ActivityInterval_companyId_deviceId_source_stream_startedAt_idx"
  ON "ActivityInterval"("companyId", "deviceId", "source", "stream", "startedAt");
CREATE INDEX "ActivityInterval_companyId_activitySubjectId_startedAt_idx"
  ON "ActivityInterval"("companyId", "activitySubjectId", "startedAt");
CREATE INDEX "ActivityInterval_policyLeaseId_idx" ON "ActivityInterval"("policyLeaseId");
CREATE UNIQUE INDEX "ActivityIntervalDayFragment_activityIntervalId_fragmentIndex_key"
  ON "ActivityIntervalDayFragment"("activityIntervalId", "fragmentIndex");
CREATE INDEX "ActivityIntervalDayFragment_companyId_userId_source_utcDate_idx"
  ON "ActivityIntervalDayFragment"("companyId", "userId", "source", "utcDate");
CREATE INDEX "ActivityIntervalDayFragment_deviceId_activitySubjectId_utcDate_idx"
  ON "ActivityIntervalDayFragment"("deviceId", "activitySubjectId", "utcDate");
CREATE UNIQUE INDEX "ClientSequenceTombstone_deviceId_source_stream_clockEpochId_sequenceNumber_key"
  ON "ClientSequenceTombstone"("deviceId", "source", "stream", "clockEpochId", "sequenceNumber");
CREATE INDEX "ClientSequenceTombstone_deviceId_clientEventId_idx"
  ON "ClientSequenceTombstone"("deviceId", "clientEventId");
CREATE INDEX "ClientSequenceTombstone_companyId_userId_rejectedAt_idx"
  ON "ClientSequenceTombstone"("companyId", "userId", "rejectedAt");
CREATE UNIQUE INDEX "ClientWriteLane_deviceId_source_stream_key"
  ON "ClientWriteLane"("deviceId", "source", "stream");
CREATE INDEX "ClientWriteLane_companyId_userId_idx"
  ON "ClientWriteLane"("companyId", "userId");
CREATE UNIQUE INDEX "LiveFocusSnapshot_deviceId_source_key"
  ON "LiveFocusSnapshot"("deviceId", "source");
CREATE INDEX "LiveFocusSnapshot_companyId_userId_source_receivedAt_idx"
  ON "LiveFocusSnapshot"("companyId", "userId", "source", "receivedAt");
CREATE UNIQUE INDEX "ClientHealthSnapshot_deviceId_source_key"
  ON "ClientHealthSnapshot"("deviceId", "source");
CREATE INDEX "ClientHealthSnapshot_companyId_userId_source_receivedAt_idx"
  ON "ClientHealthSnapshot"("companyId", "userId", "source", "receivedAt");
CREATE UNIQUE INDEX "ClientSyncCursor_deviceId_source_stream_clockEpochId_key"
  ON "ClientSyncCursor"("deviceId", "source", "stream", "clockEpochId");
CREATE INDEX "ClientSyncCursor_companyId_userId_source_idx"
  ON "ClientSyncCursor"("companyId", "userId", "source");
CREATE UNIQUE INDEX "DeviceSubjectDailySummary_deviceId_source_activitySubjectId_utcDate_key"
  ON "DeviceSubjectDailySummary"("deviceId", "source", "activitySubjectId", "utcDate");
CREATE INDEX "DeviceSubjectDailySummary_companyId_userId_source_utcDate_idx"
  ON "DeviceSubjectDailySummary"("companyId", "userId", "source", "utcDate");
CREATE UNIQUE INDEX "UserSubjectDailySummary_companyId_userId_source_activitySubjectId_utcDate_key"
  ON "UserSubjectDailySummary"("companyId", "userId", "source", "activitySubjectId", "utcDate");
CREATE INDEX "UserSubjectDailySummary_companyId_userId_source_utcDate_idx"
  ON "UserSubjectDailySummary"("companyId", "userId", "source", "utcDate");
CREATE UNIQUE INDEX "UserDailyFocusSummary_companyId_userId_source_utcDate_key"
  ON "UserDailyFocusSummary"("companyId", "userId", "source", "utcDate");
CREATE INDEX "UserDailyFocusSummary_companyId_source_utcDate_idx"
  ON "UserDailyFocusSummary"("companyId", "source", "utcDate");
CREATE UNIQUE INDEX "CompanyDailyFocusSummary_companyId_source_utcDate_key"
  ON "CompanyDailyFocusSummary"("companyId", "source", "utcDate");
CREATE UNIQUE INDEX "UsageReconciliationTarget_companyId_userId_source_utcDate_key"
  ON "UsageReconciliationTarget"("companyId", "userId", "source", "utcDate");
CREATE INDEX "UsageReconciliationTarget_state_dirtyAt_idx"
  ON "UsageReconciliationTarget"("state", "dirtyAt");

CREATE UNIQUE INDEX "Device_one_active_desktop_per_workstation"
  ON "Device"("workstationId")
  WHERE "clientType" = 'DESKTOP_AGENT'
    AND "revokedAt" IS NULL
    AND "workstationId" IS NOT NULL;

ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_focus_no_overlap"
  EXCLUDE USING gist (
    "deviceId" WITH =,
    "source" WITH =,
    "stream" WITH =,
    tstzrange("startedAt", "endedAt", '[)') WITH &&
  )
  WHERE ("stream" = 'FOCUS');

ALTER TABLE "Device"
  ADD CONSTRAINT "Device_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevicePairingCode"
  ADD CONSTRAINT "DevicePairingCode_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DevicePairingCode"
  ADD CONSTRAINT "DevicePairingCode_expectedDesktopDeviceId_fkey"
  FOREIGN KEY ("expectedDesktopDeviceId") REFERENCES "Device"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workstation"
  ADD CONSTRAINT "Workstation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workstation"
  ADD CONSTRAINT "Workstation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivitySubject"
  ADD CONSTRAINT "ActivitySubject_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePolicyLease"
  ADD CONSTRAINT "DevicePolicyLease_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePolicyLease"
  ADD CONSTRAINT "DevicePolicyLease_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePolicyLease"
  ADD CONSTRAINT "DevicePolicyLease_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePolicyLease"
  ADD CONSTRAINT "DevicePolicyLease_monitoringPolicyId_fkey"
  FOREIGN KEY ("monitoringPolicyId") REFERENCES "MonitoringPolicy"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceProtocolActivation"
  ADD CONSTRAINT "DeviceProtocolActivation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceProtocolActivation"
  ADD CONSTRAINT "DeviceProtocolActivation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceProtocolActivation"
  ADD CONSTRAINT "DeviceProtocolActivation_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceProtocolActivation"
  ADD CONSTRAINT "DeviceProtocolActivation_policyLeaseId_fkey"
  FOREIGN KEY ("policyLeaseId") REFERENCES "DevicePolicyLease"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_activitySubjectId_fkey"
  FOREIGN KEY ("activitySubjectId") REFERENCES "ActivitySubject"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityInterval"
  ADD CONSTRAINT "ActivityInterval_policyLeaseId_fkey"
  FOREIGN KEY ("policyLeaseId") REFERENCES "DevicePolicyLease"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityIntervalDayFragment"
  ADD CONSTRAINT "ActivityIntervalDayFragment_activityIntervalId_fkey"
  FOREIGN KEY ("activityIntervalId") REFERENCES "ActivityInterval"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSequenceTombstone"
  ADD CONSTRAINT "ClientSequenceTombstone_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSequenceTombstone"
  ADD CONSTRAINT "ClientSequenceTombstone_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSequenceTombstone"
  ADD CONSTRAINT "ClientSequenceTombstone_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientWriteLane"
  ADD CONSTRAINT "ClientWriteLane_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientWriteLane"
  ADD CONSTRAINT "ClientWriteLane_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientWriteLane"
  ADD CONSTRAINT "ClientWriteLane_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientWriteLane"
  ADD CONSTRAINT "ClientWriteLane_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_activitySubjectId_fkey"
  FOREIGN KEY ("activitySubjectId") REFERENCES "ActivitySubject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveFocusSnapshot"
  ADD CONSTRAINT "LiveFocusSnapshot_policyLeaseId_fkey"
  FOREIGN KEY ("policyLeaseId") REFERENCES "DevicePolicyLease"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientHealthSnapshot"
  ADD CONSTRAINT "ClientHealthSnapshot_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientHealthSnapshot"
  ADD CONSTRAINT "ClientHealthSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientHealthSnapshot"
  ADD CONSTRAINT "ClientHealthSnapshot_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientHealthSnapshot"
  ADD CONSTRAINT "ClientHealthSnapshot_workstationId_fkey"
  FOREIGN KEY ("workstationId") REFERENCES "Workstation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientSyncCursor"
  ADD CONSTRAINT "ClientSyncCursor_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSyncCursor"
  ADD CONSTRAINT "ClientSyncCursor_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientSyncCursor"
  ADD CONSTRAINT "ClientSyncCursor_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceSubjectDailySummary"
  ADD CONSTRAINT "DeviceSubjectDailySummary_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceSubjectDailySummary"
  ADD CONSTRAINT "DeviceSubjectDailySummary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceSubjectDailySummary"
  ADD CONSTRAINT "DeviceSubjectDailySummary_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceSubjectDailySummary"
  ADD CONSTRAINT "DeviceSubjectDailySummary_activitySubjectId_fkey"
  FOREIGN KEY ("activitySubjectId") REFERENCES "ActivitySubject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubjectDailySummary"
  ADD CONSTRAINT "UserSubjectDailySummary_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubjectDailySummary"
  ADD CONSTRAINT "UserSubjectDailySummary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSubjectDailySummary"
  ADD CONSTRAINT "UserSubjectDailySummary_activitySubjectId_fkey"
  FOREIGN KEY ("activitySubjectId") REFERENCES "ActivitySubject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDailyFocusSummary"
  ADD CONSTRAINT "UserDailyFocusSummary_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDailyFocusSummary"
  ADD CONSTRAINT "UserDailyFocusSummary_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyDailyFocusSummary"
  ADD CONSTRAINT "CompanyDailyFocusSummary_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReconciliationTarget"
  ADD CONSTRAINT "UsageReconciliationTarget_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageReconciliationTarget"
  ADD CONSTRAINT "UsageReconciliationTarget_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

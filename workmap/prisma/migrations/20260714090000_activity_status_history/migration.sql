ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'USER_STOP';
ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'DEVICE_SHUTDOWN';
ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'SUSPENDED';
ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'AGENT_CRASHED';
ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'AGENT_TERMINATED';
ALTER TYPE "AgentSessionEndReason" ADD VALUE IF NOT EXISTS 'UNKNOWN_INTERRUPTED';

CREATE TYPE "DeviceStatus" AS ENUM (
  'RUNNING',
  'STOPPED_BY_USER',
  'NETWORK_OFFLINE',
  'DEVICE_SHUTDOWN',
  'SLEEPING',
  'LOCKED',
  'AGENT_CRASHED',
  'AGENT_TERMINATED',
  'SERVER_UNREACHABLE',
  'UNKNOWN_INTERRUPTED',
  'RECONNECTED',
  'RESTARTED'
);

CREATE TYPE "DeviceStatusReason" AS ENUM (
  'AGENT_STARTED',
  'USER_STOP',
  'SYSTEM_SHUTDOWN',
  'SYSTEM_SUSPEND',
  'SYSTEM_RESUME',
  'SYSTEM_LOCK',
  'SYSTEM_UNLOCK',
  'NETWORK_UNAVAILABLE',
  'SERVER_REQUEST_FAILED',
  'PROCESS_CRASH',
  'PROCESS_TERMINATED',
  'HEARTBEAT_TIMEOUT',
  'AGENT_RESTART',
  'UNKNOWN'
);

CREATE TYPE "DeviceStatusConfidence" AS ENUM ('CONFIRMED', 'INFERRED');

ALTER TABLE "AgentSession"
  ADD COLUMN "clientSessionId" TEXT,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "lastSequenceNumber" INTEGER;

ALTER TABLE "ActivityEvent"
  ADD COLUMN "agentSessionId" UUID,
  ADD COLUMN "clientInstanceId" TEXT,
  ADD COLUMN "sequenceNumber" INTEGER,
  ADD COLUMN "clientMonotonicMs" BIGINT,
  ADD COLUMN "timeZone" TEXT,
  ADD COLUMN "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "DeviceStatusEvent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "agentSessionId" UUID,
  "clientEventId" TEXT,
  "status" "DeviceStatus" NOT NULL,
  "reason" "DeviceStatusReason" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "recordedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "DeviceClientType" NOT NULL,
  "timeZone" TEXT,
  "confidence" "DeviceStatusConfidence" NOT NULL DEFAULT 'CONFIRMED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentSession_companyId_deviceId_clientSessionId_idx"
ON "AgentSession"("companyId", "deviceId", "clientSessionId");

CREATE INDEX "ActivityEvent_companyId_userId_deviceId_agentSessionId_startedAt_idx"
ON "ActivityEvent"("companyId", "userId", "deviceId", "agentSessionId", "startedAt");

CREATE INDEX "ActivityEvent_companyId_deviceId_source_sequenceNumber_idx"
ON "ActivityEvent"("companyId", "deviceId", "source", "sequenceNumber");

CREATE INDEX "DeviceStatusEvent_companyId_userId_recordedAt_idx"
ON "DeviceStatusEvent"("companyId", "userId", "recordedAt");

CREATE INDEX "DeviceStatusEvent_companyId_deviceId_recordedAt_idx"
ON "DeviceStatusEvent"("companyId", "deviceId", "recordedAt");

CREATE INDEX "DeviceStatusEvent_companyId_agentSessionId_recordedAt_idx"
ON "DeviceStatusEvent"("companyId", "agentSessionId", "recordedAt");

CREATE INDEX "DeviceStatusEvent_companyId_status_recordedAt_idx"
ON "DeviceStatusEvent"("companyId", "status", "recordedAt");

CREATE UNIQUE INDEX "DeviceStatusEvent_companyId_source_clientEventId_key"
ON "DeviceStatusEvent"("companyId", "source", "clientEventId");

ALTER TABLE "ActivityEvent"
  ADD CONSTRAINT "ActivityEvent_agentSessionId_fkey"
  FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeviceStatusEvent"
  ADD CONSTRAINT "DeviceStatusEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DeviceStatusEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DeviceStatusEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DeviceStatusEvent_agentSessionId_fkey"
  FOREIGN KEY ("agentSessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

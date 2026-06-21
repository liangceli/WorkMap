CREATE TYPE "AgentSessionEndReason" AS ENUM ('GRACEFUL_SHUTDOWN', 'UNEXPECTED_STOP');

CREATE TABLE "AgentSession" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "agentVersion" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" "AgentSessionEndReason",
    "currentAppName" TEXT,
    "currentAppStartedAt" TIMESTAMP(3),
    "currentAppLastObservedAt" TIMESTAMP(3),
    "currentAppIsIdle" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentSession_companyId_userId_startedAt_idx"
ON "AgentSession"("companyId", "userId", "startedAt");

CREATE INDEX "AgentSession_companyId_deviceId_endedAt_idx"
ON "AgentSession"("companyId", "deviceId", "endedAt");

CREATE INDEX "AgentSession_companyId_lastHeartbeatAt_idx"
ON "AgentSession"("companyId", "lastHeartbeatAt");

ALTER TABLE "AgentSession"
ADD CONSTRAINT "AgentSession_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentSession"
ADD CONSTRAINT "AgentSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentSession"
ADD CONSTRAINT "AgentSession_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

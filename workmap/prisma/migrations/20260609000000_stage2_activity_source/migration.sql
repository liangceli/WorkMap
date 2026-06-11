-- Add explicit activity source so app usage and browser domain usage remain distinguishable.
CREATE TYPE "ActivityEventSource" AS ENUM ('DESKTOP_AGENT', 'BROWSER_EXTENSION');

ALTER TABLE "ActivityEvent"
  ADD COLUMN "source" "ActivityEventSource" NOT NULL DEFAULT 'DESKTOP_AGENT';

UPDATE "ActivityEvent"
SET "source" = 'BROWSER_EXTENSION'
WHERE "eventType" = 'BROWSER';

CREATE INDEX "ActivityEvent_companyId_source_startedAt_idx" ON "ActivityEvent"("companyId", "source", "startedAt");

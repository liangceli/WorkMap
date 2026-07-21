ALTER TABLE "ClientSequenceTombstone"
ADD COLUMN "requestId" VARCHAR(80);

CREATE INDEX "ClientSequenceTombstone_deviceId_rejectedAt_idx"
ON "ClientSequenceTombstone"("deviceId", "rejectedAt" DESC);

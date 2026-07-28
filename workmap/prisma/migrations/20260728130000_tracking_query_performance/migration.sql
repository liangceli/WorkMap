-- Keep Tracking v2 overlap checks and company report coverage reads bounded
-- without changing interval acceptance or report aggregation semantics.
-- Prisma Migrate executes this production migration in a transaction, so the
-- indexes intentionally use regular CREATE INDEX. Apply during the bounded
-- tracking maintenance window documented in the handoff.
CREATE INDEX IF NOT EXISTS "ActivityInterval_companyId_deviceId_source_stream_endedAt_idx"
  ON "ActivityInterval"("companyId", "deviceId", "source", "stream", "endedAt");

CREATE INDEX IF NOT EXISTS "ActivityEvent_companyId_startedAt_userId_idx"
  ON "ActivityEvent"("companyId", "startedAt", "userId");

-- Keep Tracking v2 overlap checks and company report coverage reads bounded
-- without changing interval acceptance or report aggregation semantics.
-- CONCURRENTLY avoids blocking active tracking writes while these additive
-- indexes are built on the deployed PostgreSQL database.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ActivityInterval_companyId_deviceId_source_stream_endedAt_idx"
  ON "ActivityInterval"("companyId", "deviceId", "source", "stream", "endedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ActivityEvent_companyId_startedAt_userId_idx"
  ON "ActivityEvent"("companyId", "startedAt", "userId");

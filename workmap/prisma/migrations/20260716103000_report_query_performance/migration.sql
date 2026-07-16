-- Keep reports responsive without changing activity, tenant, or permission data.
-- These indexes support the existing report filters and the bounded live-browser lookup.
CREATE INDEX IF NOT EXISTS "ActivityEvent_companyId_userId_source_eventType_startedAt_idx"
  ON "ActivityEvent"("companyId", "userId", "source", "eventType", "startedAt");

CREATE INDEX IF NOT EXISTS "ActivityEvent_companyId_source_eventType_startedAt_idx"
  ON "ActivityEvent"("companyId", "source", "eventType", "startedAt");

CREATE INDEX IF NOT EXISTS "ActivityEvent_companyId_deviceId_source_eventType_endedAt_idx"
  ON "ActivityEvent"("companyId", "deviceId", "source", "eventType", "endedAt");

CREATE INDEX IF NOT EXISTS "AppUsageSummary_companyId_userId_date_updatedAt_idx"
  ON "AppUsageSummary"("companyId", "userId", "date", "updatedAt");

CREATE INDEX IF NOT EXISTS "AppUsageSummary_companyId_date_updatedAt_idx"
  ON "AppUsageSummary"("companyId", "date", "updatedAt");

CREATE INDEX IF NOT EXISTS "WebsiteUsageSummary_companyId_userId_date_updatedAt_idx"
  ON "WebsiteUsageSummary"("companyId", "userId", "date", "updatedAt");

CREATE INDEX IF NOT EXISTS "WebsiteUsageSummary_companyId_date_updatedAt_idx"
  ON "WebsiteUsageSummary"("companyId", "date", "updatedAt");

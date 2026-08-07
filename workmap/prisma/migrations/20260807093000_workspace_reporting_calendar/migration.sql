-- Raw ActivityInterval timestamps remain UTC instants. Rebuild only the
-- derived day cache so a report date means the policy/workspace calendar day
-- recorded on the interval's immutable policy lease.
--
-- The physical column name `utcDate` is retained for a backwards-compatible
-- application rollout. Its value after this migration is a reporting calendar
-- date, not a UTC-midnight bucket.

DELETE FROM "CompanyDailyFocusSummary";
DELETE FROM "UserDailyFocusSummary";
DELETE FROM "UserSubjectDailySummary";
DELETE FROM "DeviceSubjectDailySummary";
DELETE FROM "UsageReconciliationTarget";
DELETE FROM "ActivityIntervalDayFragment";

WITH interval_days AS (
  SELECT
    interval_row.*,
    lease."scheduleTimeZone" AS schedule_time_zone,
    (interval_row."startedAt" AT TIME ZONE lease."scheduleTimeZone")::date AS first_report_date,
    ((interval_row."endedAt" - INTERVAL '1 millisecond') AT TIME ZONE lease."scheduleTimeZone")::date AS last_report_date
  FROM "ActivityInterval" interval_row
  INNER JOIN "DevicePolicyLease" lease
    ON lease."id" = interval_row."policyLeaseId"
), report_fragments AS (
  SELECT
    interval_row.*,
    day_offset,
    interval_row.first_report_date + day_offset AS report_date,
    GREATEST(
      interval_row."startedAt",
      (interval_row.first_report_date + day_offset)::timestamp
        AT TIME ZONE interval_row.schedule_time_zone
    ) AS fragment_started_at,
    LEAST(
      interval_row."endedAt",
      (interval_row.first_report_date + day_offset + 1)::timestamp
        AT TIME ZONE interval_row.schedule_time_zone
    ) AS fragment_ended_at
  FROM interval_days interval_row
  CROSS JOIN LATERAL generate_series(
    0,
    interval_row.last_report_date - interval_row.first_report_date
  ) AS generated_day(day_offset)
)
INSERT INTO "ActivityIntervalDayFragment" (
  "id",
  "activityIntervalId",
  "companyId",
  "userId",
  "deviceId",
  "activitySubjectId",
  "source",
  "stream",
  "metric",
  "utcDate",
  "fragmentIndex",
  "startedAt",
  "endedAt",
  "durationMs",
  "createdAt"
)
SELECT
  md5(report_fragments."id"::text || ':report-day:' || report_fragments.day_offset::text)::uuid,
  report_fragments."id",
  report_fragments."companyId",
  report_fragments."userId",
  report_fragments."deviceId",
  report_fragments."activitySubjectId",
  report_fragments."source",
  report_fragments."stream",
  report_fragments."metric",
  report_fragments.report_date,
  report_fragments.day_offset,
  report_fragments.fragment_started_at,
  report_fragments.fragment_ended_at,
  (EXTRACT(EPOCH FROM (
    report_fragments.fragment_ended_at - report_fragments.fragment_started_at
  )) * 1000)::bigint,
  CURRENT_TIMESTAMP
FROM report_fragments
WHERE report_fragments.fragment_ended_at > report_fragments.fragment_started_at;

INSERT INTO "DeviceSubjectDailySummary" (
  "id",
  "companyId",
  "userId",
  "deviceId",
  "activitySubjectId",
  "source",
  "utcDate",
  "focusActiveMs",
  "focusedIdleMs",
  "openRuntimeMs",
  "latestReceivedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(
    fragment."deviceId"::text || ':' || fragment."source"::text || ':' ||
    fragment."activitySubjectId"::text || ':' || fragment."utcDate"::text
  )::uuid,
  fragment."companyId",
  fragment."userId",
  fragment."deviceId",
  fragment."activitySubjectId",
  fragment."source",
  fragment."utcDate",
  SUM(CASE WHEN fragment."metric" = 'FOCUS_ACTIVE' THEN fragment."durationMs" ELSE 0 END),
  SUM(CASE WHEN fragment."metric" = 'FOCUS_IDLE' THEN fragment."durationMs" ELSE 0 END),
  SUM(CASE WHEN fragment."metric" = 'OPEN_RUNTIME' THEN fragment."durationMs" ELSE 0 END),
  MAX(interval_row."receivedAt"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ActivityIntervalDayFragment" fragment
INNER JOIN "ActivityInterval" interval_row
  ON interval_row."id" = fragment."activityIntervalId"
GROUP BY
  fragment."companyId",
  fragment."userId",
  fragment."deviceId",
  fragment."activitySubjectId",
  fragment."source",
  fragment."utcDate";

INSERT INTO "UsageReconciliationTarget" (
  "id",
  "companyId",
  "userId",
  "source",
  "utcDate",
  "state",
  "version",
  "attemptCount",
  "dirtyAt",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(
    fragment."companyId"::text || ':' || fragment."userId"::text || ':' ||
    fragment."source"::text || ':' || fragment."utcDate"::text
  )::uuid,
  fragment."companyId",
  fragment."userId",
  fragment."source",
  fragment."utcDate",
  'DIRTY',
  1,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ActivityIntervalDayFragment" fragment
GROUP BY
  fragment."companyId",
  fragment."userId",
  fragment."source",
  fragment."utcDate";

COMMENT ON COLUMN "ActivityIntervalDayFragment"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';
COMMENT ON COLUMN "DeviceSubjectDailySummary"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';
COMMENT ON COLUMN "UserSubjectDailySummary"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';
COMMENT ON COLUMN "UserDailyFocusSummary"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';
COMMENT ON COLUMN "CompanyDailyFocusSummary"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';
COMMENT ON COLUMN "UsageReconciliationTarget"."utcDate" IS
  'Policy/workspace reporting calendar date; legacy physical name retained.';

ANALYZE "ActivityIntervalDayFragment";
ANALYZE "DeviceSubjectDailySummary";
ANALYZE "UsageReconciliationTarget";

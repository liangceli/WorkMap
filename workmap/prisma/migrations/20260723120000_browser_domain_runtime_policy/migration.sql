ALTER TABLE "MonitoringPolicy"
  ADD COLUMN "collectDomainOpenRuntime" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DevicePolicyLease"
  ADD COLUMN "collectDomainOpenRuntime" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'TEAM_LEAD', 'MANAGER', 'HR_ADMIN', 'IT_ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('AVAILABLE', 'BUSY', 'FOCUS', 'IDLE', 'BREAK', 'OFFLINE', 'ON_CALL');

-- CreateEnum
CREATE TYPE "DeviceOS" AS ENUM ('WINDOWS', 'MACOS', 'LINUX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('APP', 'BROWSER', 'IDLE', 'LOCK', 'UNLOCK', 'HEARTBEAT');

-- CreateEnum
CREATE TYPE "BrowserName" AS ENUM ('CHROME', 'EDGE', 'FIREFOX', 'SAFARI', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ProductivityLabel" AS ENUM ('PRODUCTIVE', 'NEUTRAL', 'DISTRACTING', 'BLOCKED', 'UNCATEGORISED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('MICROSOFT', 'TEAMS', 'OUTLOOK', 'THREE_CX');

-- CreateEnum
CREATE TYPE "AvatarDirection" AS ENUM ('UP', 'DOWN', 'LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "OfficeRoomType" AS ENUM ('OPEN_OFFICE', 'FOCUS', 'BREAK', 'MEETING', 'DEPARTMENT_ZONE', 'OTHER');

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "departmentId" UUID,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "UserStatus" NOT NULL DEFAULT 'OFFLINE',
    "avatarId" TEXT,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "os" "DeviceOS" NOT NULL DEFAULT 'UNKNOWN',
    "hostname" TEXT,
    "agentVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "eventType" "ActivityEventType" NOT NULL,
    "appName" TEXT,
    "browserName" "BrowserName",
    "domain" TEXT,
    "isIdle" BOOLEAN NOT NULL DEFAULT false,
    "isActiveWindow" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUsageSummary" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "appName" TEXT NOT NULL,
    "category" TEXT,
    "productivityLabel" "ProductivityLabel" NOT NULL DEFAULT 'UNCATEGORISED',
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUsageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteUsageSummary" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "domain" TEXT NOT NULL,
    "browserName" "BrowserName" NOT NULL DEFAULT 'UNKNOWN',
    "category" TEXT,
    "productivityLabel" "ProductivityLabel" NOT NULL DEFAULT 'UNCATEGORISED',
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "idleSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteUsageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMap" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "tileSize" INTEGER NOT NULL DEFAULT 32,
    "mapData" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeRoom" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "officeMapId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OfficeRoomType" NOT NULL DEFAULT 'OTHER',
    "zoneData" JSONB,
    "autoStatus" "UserStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualOfficePosition" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "officeMapId" UUID NOT NULL,
    "officeRoomId" UUID,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "direction" "AvatarDirection" NOT NULL DEFAULT 'DOWN',
    "isMoving" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'OFFLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualOfficePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringPolicy" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "collectAppUsage" BOOLEAN NOT NULL DEFAULT true,
    "collectWebsiteDomain" BOOLEAN NOT NULL DEFAULT true,
    "collectFullUrl" BOOLEAN NOT NULL DEFAULT false,
    "collectScreenshots" BOOLEAN NOT NULL DEFAULT false,
    "collectKeystrokes" BOOLEAN NOT NULL DEFAULT false,
    "workHoursOnly" BOOLEAN NOT NULL DEFAULT true,
    "workdayStart" TEXT NOT NULL DEFAULT '09:00',
    "workdayEnd" TEXT NOT NULL DEFAULT '17:00',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "employeeCanViewOwnData" BOOLEAN NOT NULL DEFAULT true,
    "policyVersion" TEXT NOT NULL,
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcknowledgement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "monitoringPolicyId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID,
    "provider" "IntegrationProvider" NOT NULL,
    "externalAccountId" TEXT,
    "displayName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID,
    "targetUserId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_name_key" ON "Department"("companyId", "name");

-- CreateIndex
CREATE INDEX "User_companyId_departmentId_idx" ON "User"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "User_companyId_role_idx" ON "User"("companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE INDEX "Device_companyId_userId_idx" ON "Device"("companyId", "userId");

-- CreateIndex
CREATE INDEX "Device_companyId_lastSeenAt_idx" ON "Device"("companyId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_userId_startedAt_idx" ON "ActivityEvent"("companyId", "userId", "startedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_deviceId_startedAt_idx" ON "ActivityEvent"("companyId", "deviceId", "startedAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_companyId_eventType_startedAt_idx" ON "ActivityEvent"("companyId", "eventType", "startedAt");

-- CreateIndex
CREATE INDEX "AppUsageSummary_companyId_userId_date_idx" ON "AppUsageSummary"("companyId", "userId", "date");

-- CreateIndex
CREATE INDEX "AppUsageSummary_companyId_date_idx" ON "AppUsageSummary"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AppUsageSummary_companyId_userId_date_appName_key" ON "AppUsageSummary"("companyId", "userId", "date", "appName");

-- CreateIndex
CREATE INDEX "WebsiteUsageSummary_companyId_userId_date_idx" ON "WebsiteUsageSummary"("companyId", "userId", "date");

-- CreateIndex
CREATE INDEX "WebsiteUsageSummary_companyId_date_idx" ON "WebsiteUsageSummary"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteUsageSummary_companyId_userId_date_domain_browserNam_key" ON "WebsiteUsageSummary"("companyId", "userId", "date", "domain", "browserName");

-- CreateIndex
CREATE INDEX "OfficeMap_companyId_isDefault_idx" ON "OfficeMap"("companyId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeMap_companyId_slug_key" ON "OfficeMap"("companyId", "slug");

-- CreateIndex
CREATE INDEX "OfficeRoom_companyId_officeMapId_idx" ON "OfficeRoom"("companyId", "officeMapId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeRoom_officeMapId_name_key" ON "OfficeRoom"("officeMapId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualOfficePosition_userId_key" ON "VirtualOfficePosition"("userId");

-- CreateIndex
CREATE INDEX "VirtualOfficePosition_companyId_userId_idx" ON "VirtualOfficePosition"("companyId", "userId");

-- CreateIndex
CREATE INDEX "VirtualOfficePosition_companyId_officeMapId_idx" ON "VirtualOfficePosition"("companyId", "officeMapId");

-- CreateIndex
CREATE INDEX "VirtualOfficePosition_companyId_officeRoomId_idx" ON "VirtualOfficePosition"("companyId", "officeRoomId");

-- CreateIndex
CREATE INDEX "MonitoringPolicy_companyId_activeFrom_idx" ON "MonitoringPolicy"("companyId", "activeFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringPolicy_companyId_policyVersion_key" ON "MonitoringPolicy"("companyId", "policyVersion");

-- CreateIndex
CREATE INDEX "PolicyAcknowledgement_companyId_userId_idx" ON "PolicyAcknowledgement"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcknowledgement_userId_monitoringPolicyId_key" ON "PolicyAcknowledgement"("userId", "monitoringPolicyId");

-- CreateIndex
CREATE INDEX "IntegrationAccount_companyId_provider_idx" ON "IntegrationAccount"("companyId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationAccount_companyId_userId_idx" ON "IntegrationAccount"("companyId", "userId");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_actorUserId_createdAt_idx" ON "AuditLog"("companyId", "actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_targetUserId_createdAt_idx" ON "AuditLog"("companyId", "targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_action_createdAt_idx" ON "AuditLog"("companyId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUsageSummary" ADD CONSTRAINT "AppUsageSummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUsageSummary" ADD CONSTRAINT "AppUsageSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteUsageSummary" ADD CONSTRAINT "WebsiteUsageSummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteUsageSummary" ADD CONSTRAINT "WebsiteUsageSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMap" ADD CONSTRAINT "OfficeMap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeRoom" ADD CONSTRAINT "OfficeRoom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeRoom" ADD CONSTRAINT "OfficeRoom_officeMapId_fkey" FOREIGN KEY ("officeMapId") REFERENCES "OfficeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualOfficePosition" ADD CONSTRAINT "VirtualOfficePosition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualOfficePosition" ADD CONSTRAINT "VirtualOfficePosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualOfficePosition" ADD CONSTRAINT "VirtualOfficePosition_officeMapId_fkey" FOREIGN KEY ("officeMapId") REFERENCES "OfficeMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualOfficePosition" ADD CONSTRAINT "VirtualOfficePosition_officeRoomId_fkey" FOREIGN KEY ("officeRoomId") REFERENCES "OfficeRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringPolicy" ADD CONSTRAINT "MonitoringPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcknowledgement" ADD CONSTRAINT "PolicyAcknowledgement_monitoringPolicyId_fkey" FOREIGN KEY ("monitoringPolicyId") REFERENCES "MonitoringPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

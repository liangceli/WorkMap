-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" UUID NOT NULL,
    "actorEmail" TEXT,
    "actorCognitoSub" TEXT,
    "actorDisplayName" TEXT,
    "actorPlatformRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetCompanyId" UUID,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorCognitoSub_createdAt_idx" ON "PlatformAuditLog"("actorCognitoSub", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetCompanyId_createdAt_idx" ON "PlatformAuditLog"("targetCompanyId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_action_createdAt_idx" ON "PlatformAuditLog"("action", "createdAt");

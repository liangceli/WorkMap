-- Device-scoped Alpha pairing credentials and retry-safe client event identity.
CREATE TYPE "DeviceClientType" AS ENUM ('DESKTOP_AGENT', 'BROWSER_EXTENSION');

ALTER TABLE "Device" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "ActivityEvent" ADD COLUMN "clientEventId" TEXT;

CREATE TABLE "DevicePairingCode" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "clientType" "DeviceClientType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevicePairingCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeviceCredential" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "clientType" "DeviceClientType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevicePairingCode_codeHash_key" ON "DevicePairingCode"("codeHash");
CREATE INDEX "DevicePairingCode_companyId_userId_expiresAt_idx" ON "DevicePairingCode"("companyId", "userId", "expiresAt");
CREATE INDEX "DevicePairingCode_deviceId_idx" ON "DevicePairingCode"("deviceId");
CREATE UNIQUE INDEX "DeviceCredential_tokenHash_key" ON "DeviceCredential"("tokenHash");
CREATE INDEX "DeviceCredential_companyId_userId_idx" ON "DeviceCredential"("companyId", "userId");
CREATE INDEX "DeviceCredential_deviceId_revokedAt_idx" ON "DeviceCredential"("deviceId", "revokedAt");
CREATE UNIQUE INDEX "ActivityEvent_companyId_source_clientEventId_key" ON "ActivityEvent"("companyId", "source", "clientEventId");

ALTER TABLE "DevicePairingCode" ADD CONSTRAINT "DevicePairingCode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePairingCode" ADD CONSTRAINT "DevicePairingCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DevicePairingCode" ADD CONSTRAINT "DevicePairingCode_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

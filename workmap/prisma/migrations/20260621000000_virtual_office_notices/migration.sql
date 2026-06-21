CREATE TYPE "NoticeType" AS ENUM ('MESSAGE', 'WAVE', 'REACTION');

CREATE TABLE "Notice" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "type" "NoticeType" NOT NULL,
    "message" TEXT,
    "reaction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notice_companyId_recipientUserId_readAt_createdAt_idx"
ON "Notice"("companyId", "recipientUserId", "readAt", "createdAt");

CREATE INDEX "Notice_companyId_actorUserId_createdAt_idx"
ON "Notice"("companyId", "actorUserId", "createdAt");

ALTER TABLE "Notice"
ADD CONSTRAINT "Notice_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notice"
ADD CONSTRAINT "Notice_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notice"
ADD CONSTRAINT "Notice_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientHealthSnapshot"
ADD COLUMN "serverDiagnosticCode" VARCHAR(80),
ADD COLUMN "serverDiagnosticRequestId" VARCHAR(80),
ADD COLUMN "serverDiagnosticAt" TIMESTAMPTZ(3);

import { Module } from "@nestjs/common";
import { ActivityModule } from "./modules/activity/activity.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CompaniesModule } from "./modules/companies/companies.module.js";
import { ComplianceModule } from "./modules/compliance/compliance.module.js";
import { DevicesModule } from "./modules/devices/devices.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { IntegrationsModule } from "./modules/integrations/integrations.module.js";
import { InvitationsModule } from "./modules/invitations/invitations.module.js";
import { PrismaModule } from "./modules/prisma/prisma.module.js";
import { ReportsModule } from "./modules/reports/reports.module.js";
import { TenantOnboardingModule } from "./modules/tenant-onboarding/tenant-onboarding.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { VirtualOfficeModule } from "./modules/virtual-office/virtual-office.module.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CompaniesModule,
    TenantOnboardingModule,
    InvitationsModule,
    UsersModule,
    DevicesModule,
    ActivityModule,
    ReportsModule,
    VirtualOfficeModule,
    IntegrationsModule,
    ComplianceModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

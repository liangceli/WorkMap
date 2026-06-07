import { Module } from "@nestjs/common";
import { TenantOnboardingController } from "./tenant-onboarding.controller.js";
import { TenantOnboardingService } from "./tenant-onboarding.service.js";

@Module({
  controllers: [TenantOnboardingController],
  providers: [TenantOnboardingService],
})
export class TenantOnboardingModule {}

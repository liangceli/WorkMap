import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { CognitoJwtPayload } from "@workmap/auth";
import { CognitoOnlyGuard } from "../auth/cognito-only.guard.js";
import { CurrentCognito } from "../auth/current-cognito.decorator.js";
import { TenantOnboardingService } from "./tenant-onboarding.service.js";

@Controller("tenant-onboarding")
@UseGuards(CognitoOnlyGuard)
export class TenantOnboardingController {
  constructor(private readonly onboarding: TenantOnboardingService) {}

  @Get("status")
  getStatus(@CurrentCognito() payload: CognitoJwtPayload) {
    return this.onboarding.getStatus(payload);
  }

  @Post("workspace")
  createWorkspace(@CurrentCognito() payload: CognitoJwtPayload, @Body() body: unknown) {
    return this.onboarding.createWorkspace(payload, isRecord(body) ? body : {});
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

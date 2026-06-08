import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import type { PlatformRequestContext } from "@workmap/auth";
import { CurrentPlatformContext } from "../auth/current-platform-context.decorator.js";
import { PlatformContextGuard } from "../auth/platform-context.guard.js";
import { PlatformService } from "./platform.service.js";

@Controller("platform")
@UseGuards(PlatformContextGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("me")
  getMe(@CurrentPlatformContext() context: PlatformRequestContext) {
    return context;
  }

  @Get("tenants")
  listTenants(@CurrentPlatformContext() context: PlatformRequestContext) {
    return this.platform.listTenants(context);
  }

  @Get("tenants/:companyId")
  getTenant(@CurrentPlatformContext() context: PlatformRequestContext, @Param("companyId", ParseUUIDPipe) companyId: string) {
    return this.platform.getTenant(context, companyId);
  }

  @Get("tenants/:companyId/health")
  getTenantHealth(
    @CurrentPlatformContext() context: PlatformRequestContext,
    @Param("companyId", ParseUUIDPipe) companyId: string,
  ) {
    return this.platform.getTenantHealth(context, companyId);
  }

  @Get("audit")
  listPlatformAudit(@CurrentPlatformContext() context: PlatformRequestContext) {
    return this.platform.listPlatformAudit(context);
  }
}

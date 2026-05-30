import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { IntegrationsService } from "./integrations.service.js";

@Controller("integrations")
@UseGuards(RequestContextGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  listIntegrations(@CurrentContext() context: RequestContext) {
    return this.integrations.listCompanyIntegrations(context);
  }

  @Get("contact-links/:targetUserId")
  getContactLinks(@CurrentContext() context: RequestContext, @Param("targetUserId", ParseUUIDPipe) targetUserId: string) {
    return this.integrations.getContactLinks(context, targetUserId);
  }
}

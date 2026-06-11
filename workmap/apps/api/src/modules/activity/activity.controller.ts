import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { ActivityService } from "./activity.service.js";

@Controller("activity")
@UseGuards(RequestContextGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Post("app-usage")
  ingestAppUsage(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.activity.ingestAppUsage(context, body);
  }

  @Post("domain-usage")
  ingestDomainUsage(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.activity.ingestDomainUsage(context, body);
  }
}

import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { OptionalUuidPipe } from "../common/optional-uuid.pipe.js";
import { ReportsService } from "./reports.service.js";

@Controller("reports")
@UseGuards(RequestContextGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("usage-summary")
  getUsageSummary(
    @CurrentContext() context: RequestContext,
    @Query("userId", OptionalUuidPipe) userId?: string,
    @Query("scope") scope?: string,
  ) {
    return this.reports.getUsageSummary(context, { userId, scope });
  }
}

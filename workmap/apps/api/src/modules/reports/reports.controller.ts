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
    @Query("departmentId", OptionalUuidPipe) departmentId?: string,
    @Query("scope") scope?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("includeAudit") includeAudit?: string,
    @Query("includeLive") includeLive?: string,
  ) {
    return this.reports.getUsageSummary(context, { userId, departmentId, scope, from, to, includeAudit, includeLive });
  }

  @Get("tracking-audit")
  getTrackingAudit(
    @CurrentContext() context: RequestContext,
    @Query("userId", OptionalUuidPipe) userId?: string,
    @Query("departmentId", OptionalUuidPipe) departmentId?: string,
    @Query("scope") scope?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reports.getTrackingAudit(context, { userId, departmentId, scope, from, to });
  }

  @Get("agent-status")
  getAgentStatus(
    @CurrentContext() context: RequestContext,
    @Query("userId", OptionalUuidPipe) userId?: string,
    @Query("departmentId", OptionalUuidPipe) departmentId?: string,
    @Query("scope") scope?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("includeRevision") includeRevision?: string,
  ) {
    return this.reports.getAgentLiveStatus(context, { userId, departmentId, scope, from, to, includeRevision });
  }

  @Get("live-activity")
  getLiveActivity(
    @CurrentContext() context: RequestContext,
    @Query("userId", OptionalUuidPipe) userId?: string,
    @Query("departmentId", OptionalUuidPipe) departmentId?: string,
    @Query("scope") scope?: string,
  ) {
    return this.reports.getTrackingV2LiveActivity(context, {
      userId,
      departmentId,
      scope,
    });
  }
}

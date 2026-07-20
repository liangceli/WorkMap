import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { ComplianceService } from "./compliance.service.js";

@Controller("compliance")
@UseGuards(RequestContextGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get("policy")
  async getActivePolicy(@CurrentContext() context: RequestContext) {
    const policy = await this.compliance.getActivePolicy(context.companyId);

    return {
      id: policy.id,
      name: policy.name,
      collectAppUsage: policy.collectAppUsage,
      collectWebsiteDomain: policy.collectWebsiteDomain,
      collectFullUrl: policy.collectFullUrl,
      collectScreenshots: policy.collectScreenshots,
      collectKeystrokes: policy.collectKeystrokes,
      workHoursOnly: policy.workHoursOnly,
      workdayStart: policy.workdayStart,
      workdayEnd: policy.workdayEnd,
      scheduleTimeZone: policy.scheduleTimeZone,
      retentionDays: policy.retentionDays,
      employeeCanViewOwnData: policy.employeeCanViewOwnData,
      policyVersion: policy.policyVersion,
      activeFrom: policy.activeFrom.toISOString(),
    };
  }

  @Post("policy/:policyId/acknowledgement")
  async acknowledgePolicy(@CurrentContext() context: RequestContext, @Param("policyId", ParseUUIDPipe) policyId: string) {
    const acknowledgement = await this.compliance.acknowledgePolicy(context.companyId, context.userId, policyId);

    return {
      id: acknowledgement.id,
      monitoringPolicyId: acknowledgement.monitoringPolicyId,
      acknowledgedAt: acknowledgement.acknowledgedAt.toISOString(),
    };
  }

  @Patch("policy/:policyId/schedule-time-zone")
  async confirmScheduleTimeZone(
    @CurrentContext() context: RequestContext,
    @Param("policyId", ParseUUIDPipe) policyId: string,
    @Body() body: unknown,
  ) {
    const policy = await this.compliance.confirmScheduleTimeZone(
      context,
      policyId,
      body,
    );
    return {
      id: policy.id,
      policyVersion: policy.policyVersion,
      scheduleTimeZone: policy.scheduleTimeZone,
      scheduleTimeZoneState: "CONFIRMED" as const,
    };
  }

  @Patch("policy/:policyId/work-hours")
  async updatePolicyWorkHours(
    @CurrentContext() context: RequestContext,
    @Param("policyId", ParseUUIDPipe) policyId: string,
    @Body() body: unknown,
  ) {
    const policy = await this.compliance.updatePolicyWorkHours(
      context,
      policyId,
      body,
    );
    return {
      id: policy.id,
      policyVersion: policy.policyVersion,
      workHoursOnly: policy.workHoursOnly,
      workdayStart: policy.workdayStart,
      workdayEnd: policy.workdayEnd,
      scheduleTimeZone: policy.scheduleTimeZone,
    };
  }
}

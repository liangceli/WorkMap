import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
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
}

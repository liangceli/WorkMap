import { Controller, Get, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { CompaniesService } from "./companies.service.js";

@Controller("companies")
@UseGuards(RequestContextGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get("current")
  getCurrentCompany(@CurrentContext() context: RequestContext) {
    return this.companies.getCurrentCompany(context);
  }
}

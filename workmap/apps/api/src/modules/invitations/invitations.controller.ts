import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { CognitoJwtPayload, RequestContext } from "@workmap/auth";
import { CognitoOnlyGuard } from "../auth/cognito-only.guard.js";
import { CurrentCognito } from "../auth/current-cognito.decorator.js";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { InvitationsService } from "./invitations.service.js";

@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get("preview/:token")
  preview(@Param("token") token: string) {
    return this.invitations.preview(token);
  }

  @Get()
  @UseGuards(RequestContextGuard, RolesGuard)
  @Roles("OWNER")
  list(@CurrentContext() context: RequestContext) {
    return this.invitations.list(context);
  }

  @Post()
  @UseGuards(RequestContextGuard, RolesGuard)
  @Roles("OWNER")
  create(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.invitations.create(context, isRecord(body) ? body : {});
  }

  @Post("accept")
  @UseGuards(CognitoOnlyGuard)
  accept(@CurrentCognito() payload: CognitoJwtPayload, @Body() body: unknown) {
    return this.invitations.accept(payload, isRecord(body) ? body : {});
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

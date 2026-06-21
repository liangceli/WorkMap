import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { NoticesService } from "./notices.service.js";

@Controller("notices")
@UseGuards(RequestContextGuard)
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  list(@CurrentContext() context: RequestContext) {
    return this.notices.list(context);
  }

  @Post("interactions")
  createInteraction(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.notices.createInteraction(context, body);
  }

  @Patch("read")
  markAllRead(@CurrentContext() context: RequestContext) {
    return this.notices.markAllRead(context);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { UsersService } from "./users.service.js";

@Controller("users")
@UseGuards(RequestContextGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  getMe(@CurrentContext() context: RequestContext) {
    return this.users.getCurrentUser(context);
  }

  @Patch("me")
  updateMe(@CurrentContext() context: RequestContext, @Body() body: unknown) {
    return this.users.updateCurrentUserProfile(context, body);
  }

  @Get()
  listDirectory(@CurrentContext() context: RequestContext) {
    return this.users.listDirectory(context);
  }

  @Get(":userId")
  getUser(@CurrentContext() context: RequestContext, @Param("userId", ParseUUIDPipe) userId: string) {
    return this.users.getUserProfile(context, userId);
  }
}

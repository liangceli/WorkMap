import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
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

  @Get()
  listDirectory(@CurrentContext() context: RequestContext) {
    return this.users.listDirectory(context);
  }

  @Get(":userId")
  getUser(@CurrentContext() context: RequestContext, @Param("userId", ParseUUIDPipe) userId: string) {
    return this.users.getUserProfile(context, userId);
  }
}

import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { AuthService } from "./auth.service.js";
import { CurrentContext } from "./current-context.decorator.js";
import { RequestContextGuard } from "./request-context.guard.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("dev-token")
  createDevelopmentToken(@Body() body: unknown) {
    return this.auth.createDevelopmentToken(isRecord(body) ? body : {});
  }

  @Get("me")
  @UseGuards(RequestContextGuard)
  getCurrentContext(@CurrentContext() context: RequestContext) {
    return context;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

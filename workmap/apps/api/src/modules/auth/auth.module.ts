import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtService } from "./jwt.service.js";
import { RequestContextGuard } from "./request-context.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtService, RequestContextGuard, RolesGuard],
  exports: [AuthService, JwtService, RequestContextGuard, RolesGuard],
})
export class AuthModule {}

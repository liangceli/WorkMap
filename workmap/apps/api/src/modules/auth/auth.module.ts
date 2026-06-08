import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { CognitoOnlyGuard } from "./cognito-only.guard.js";
import { AuthService } from "./auth.service.js";
import { CognitoJwtService } from "./cognito-jwt.service.js";
import { JwtService } from "./jwt.service.js";
import { PlatformContextGuard } from "./platform-context.guard.js";
import { RequestContextResolverService } from "./request-context-resolver.service.js";
import { RequestContextGuard } from "./request-context.guard.js";
import { RolesGuard } from "./roles.guard.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    CognitoJwtService,
    CognitoOnlyGuard,
    JwtService,
    PlatformContextGuard,
    RequestContextResolverService,
    RequestContextGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    CognitoJwtService,
    CognitoOnlyGuard,
    JwtService,
    PlatformContextGuard,
    RequestContextResolverService,
    RequestContextGuard,
    RolesGuard,
  ],
})
export class AuthModule {}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { getVerifiedCognitoIdentity } from "./cognito-identity.js";
import { CognitoJwtService } from "./cognito-jwt.service.js";
import { PLATFORM_REQUEST_CONTEXT_KEY, type RequestWithPlatformContext } from "./current-platform-context.decorator.js";
import { isPlatformAdminIdentity } from "./platform-admin-allowlist.js";
import { RequestContextResolverService } from "./request-context-resolver.service.js";

type HeaderRequest = RequestWithPlatformContext & {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class PlatformContextGuard implements CanActivate {
  constructor(
    private readonly cognitoJwt: CognitoJwtService,
    private readonly requestContextResolver: RequestContextResolverService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const authorization = singleHeader(request.headers.authorization);
    const cognitoPayload = await this.cognitoJwt.verifyBearerToken(authorization);

    if (cognitoPayload) {
      const identity = getVerifiedCognitoIdentity(cognitoPayload);

      if (!isPlatformAdminIdentity(identity)) {
        throw new ForbiddenException("Platform admin access is not configured for this identity.");
      }

      request[PLATFORM_REQUEST_CONTEXT_KEY] = {
        platformRole: "PLATFORM_ADMIN",
        identity: {
          email: identity.email,
          cognitoSub: identity.sub,
          displayName: identity.displayName,
        },
        source: "cognito",
      };

      return true;
    }

    const tenantContext = await this.requestContextResolver.tryResolveBearerContext(authorization);

    if (tenantContext) {
      throw new ForbiddenException("Tenant users cannot access platform admin endpoints.");
    }

    throw new UnauthorizedException("A Cognito platform admin bearer token is required.");
  }
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

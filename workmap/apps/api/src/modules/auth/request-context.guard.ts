import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { WorkMapRole } from "@workmap/auth";
import { AuthService } from "./auth.service.js";
import { CognitoJwtService } from "./cognito-jwt.service.js";
import { REQUEST_CONTEXT_KEY, type RequestWithContext } from "./current-context.decorator.js";
import { JwtService } from "./jwt.service.js";

const ROLES = new Set<WorkMapRole>(["EMPLOYEE", "TEAM_LEAD", "MANAGER", "HR_ADMIN", "IT_ADMIN", "OWNER"]);

type HeaderRequest = RequestWithContext & {
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class RequestContextGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly cognitoJwt: CognitoJwtService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const authorization = singleHeader(request.headers.authorization);
    const cognitoPayload = await this.cognitoJwt.verifyBearerToken(authorization);

    if (cognitoPayload) {
      request[REQUEST_CONTEXT_KEY] = await this.auth.resolveCognitoContext(cognitoPayload);
      return true;
    }

    const jwtPayload = this.jwt.verifyBearerToken(authorization);

    if (jwtPayload) {
      request[REQUEST_CONTEXT_KEY] = await this.auth.resolveJwtContext(jwtPayload);
      return true;
    }

    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Bearer token is required.");
    }

    const companyId = singleHeader(request.headers["x-workmap-company-id"]);
    const userId = singleHeader(request.headers["x-workmap-user-id"]);
    const role = singleHeader(request.headers["x-workmap-role"]);

    if (!companyId || !userId || !role || !ROLES.has(role as WorkMapRole)) {
      throw new UnauthorizedException("Missing WorkMap request context.");
    }

    request[REQUEST_CONTEXT_KEY] = await this.auth.resolveDevelopmentHeaderContext({
      companyId,
      userId,
      role,
    });

    return true;
  }
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

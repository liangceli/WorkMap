import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestContext, WorkMapRole } from "@workmap/auth";
import { AuthService } from "./auth.service.js";
import { CognitoJwtService } from "./cognito-jwt.service.js";
import { JwtService } from "./jwt.service.js";

type HeaderSource = Record<string, string | string[] | undefined>;

type DevelopmentHeaderContextInput = {
  companyId: string;
  userId: string;
  role: string;
};

const ROLES = new Set<WorkMapRole>(["EMPLOYEE", "TEAM_LEAD", "MANAGER", "HR_ADMIN", "IT_ADMIN", "OWNER"]);

@Injectable()
export class RequestContextResolverService {
  constructor(
    private readonly auth: AuthService,
    private readonly cognitoJwt: CognitoJwtService,
    private readonly jwt: JwtService,
  ) {}

  async resolveBearerContext(authorization: string | undefined): Promise<RequestContext> {
    const context = await this.tryResolveBearerContext(authorization);

    if (!context) {
      throw new UnauthorizedException("Bearer token is required.");
    }

    return context;
  }

  async tryResolveBearerContext(authorization: string | undefined): Promise<RequestContext | null> {
    const cognitoPayload = await this.cognitoJwt.verifyBearerToken(authorization);

    if (cognitoPayload) {
      return this.auth.resolveCognitoContext(cognitoPayload);
    }

    const jwtPayload = this.jwt.verifyBearerToken(authorization);

    if (jwtPayload) {
      return this.auth.resolveJwtContext(jwtPayload);
    }

    return null;
  }

  async resolveHttpHeaders(headers: HeaderSource): Promise<RequestContext> {
    const authorization = singleHeader(headers.authorization);
    const bearerContext = await this.tryResolveBearerContext(authorization);

    if (bearerContext) {
      return bearerContext;
    }

    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Bearer token is required.");
    }

    return this.resolveDevelopmentHeaders({
      companyId: singleHeader(headers["x-workmap-company-id"]) ?? "",
      userId: singleHeader(headers["x-workmap-user-id"]) ?? "",
      role: singleHeader(headers["x-workmap-role"]) ?? "",
    });
  }

  async resolveDevelopmentHeaders(input: DevelopmentHeaderContextInput): Promise<RequestContext> {
    if (!input.companyId || !input.userId || !ROLES.has(input.role as WorkMapRole)) {
      throw new UnauthorizedException("Missing WorkMap request context.");
    }

    return this.auth.resolveDevelopmentHeaderContext({
      companyId: input.companyId,
      userId: input.userId,
      role: input.role,
    });
  }
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CognitoJwtPayload, RequestContext, WorkMapJwtPayload, WorkMapRole } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";
import { JwtService } from "./jwt.service.js";

type DevTokenInput = {
  email?: unknown;
  companySlug?: unknown;
};

type PilotLoginInput = DevTokenInput & {
  password?: unknown;
};

type DevelopmentHeaderContextInput = {
  companyId: string;
  userId: string;
  role: string;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const DEFAULT_LOCAL_PILOT_PASSWORD_HASH =
  "pbkdf2-sha256$120000$workmap-local-pilot$ogb3euHMstmx-Dp4fkSgKaZ_iaq4tnKPHWpLO5TpS_k";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async resolveJwtContext(payload: WorkMapJwtPayload): Promise<RequestContext> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        companyId: payload.companyId,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Bearer token user is not active in this company.");
    }

    return {
      companyId: user.companyId,
      userId: user.id,
      role: user.role,
    };
  }

  async resolveCognitoContext(payload: CognitoJwtPayload): Promise<RequestContext> {
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";

    if (!payload.sub) {
      throw new UnauthorizedException("Cognito token is missing subject.");
    }

    if (!isVerifiedEmailClaim(payload.email_verified)) {
      throw new UnauthorizedException("Cognito email must be verified before WorkMap user mapping.");
    }

    if (!isValidEmail(email)) {
      throw new UnauthorizedException("Cognito token is not mapped to a WorkMap user email.");
    }

    const companySlug = process.env.WORKMAP_COGNITO_COMPANY_SLUG?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        email,
        company: companySlug ? { slug: companySlug } : undefined,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
      },
      take: 2,
    });

    if (users.length === 0) {
      throw new UnauthorizedException("Cognito user is not mapped to an active WorkMap user.");
    }

    if (users.length > 1) {
      throw new UnauthorizedException("Cognito user email is ambiguous. Configure WORKMAP_COGNITO_COMPANY_SLUG.");
    }

    const [user] = users;

    return {
      companyId: user.companyId,
      userId: user.id,
      role: user.role,
    };
  }

  async resolveDevelopmentHeaderContext(input: DevelopmentHeaderContextInput): Promise<RequestContext> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: input.userId,
        companyId: input.companyId,
      },
      select: {
        id: true,
        companyId: true,
        role: true,
      },
    });

    if (!user || user.role !== input.role) {
      throw new UnauthorizedException("Invalid WorkMap development request context.");
    }

    return {
      companyId: user.companyId,
      userId: user.id,
      role: user.role,
    };
  }

  async createPilotSession(input: PilotLoginInput) {
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const companySlug = typeof input.companySlug === "string" ? input.companySlug.trim() : input.companySlug;
    const password = typeof input.password === "string" ? input.password : "";

    if (!isValidEmail(email)) {
      throw new BadRequestException("A valid email is required.");
    }

    if (!password) {
      throw new BadRequestException("Password is required.");
    }

    if (companySlug !== undefined && (typeof companySlug !== "string" || !isValidCompanySlug(companySlug))) {
      throw new BadRequestException("companySlug must be a string when provided.");
    }

    if (!verifyPilotPassword(password)) {
      throw new UnauthorizedException("Invalid pilot login credentials.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        company: companySlug ? { slug: companySlug } : undefined,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        displayName: true,
        role: true,
        company: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid pilot login credentials.");
    }

    return this.createAuthTokenResponse(user);
  }

  async createDevelopmentToken(input: DevTokenInput) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Development token endpoint is disabled in production.");
    }

    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const companySlug = typeof input.companySlug === "string" ? input.companySlug.trim() : input.companySlug;

    if (!isValidEmail(email)) {
      throw new BadRequestException("A valid email is required.");
    }

    if (companySlug !== undefined && (typeof companySlug !== "string" || !isValidCompanySlug(companySlug))) {
      throw new BadRequestException("companySlug must be a string when provided.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        company: companySlug ? { slug: companySlug } : undefined,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        displayName: true,
        role: true,
        company: {
          select: {
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Development user not found.");
    }

    return this.createAuthTokenResponse(user);
  }

  private createAuthTokenResponse(user: {
    id: string;
    companyId: string;
    email: string;
    displayName: string;
    role: WorkMapRole;
    company: { slug: string };
  }) {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TOKEN_TTL_SECONDS;
    const accessToken = this.jwt.signPayload({
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      iat: now,
      exp: expiresAt,
    });

    return {
      accessToken,
      tokenType: "Bearer",
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      user: {
        id: user.id,
        companyId: user.companyId,
        companySlug: user.company.slug,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}

function verifyPilotPassword(password: string) {
  const configuredHash = process.env.WORKMAP_PILOT_PASSWORD_HASH?.trim();

  if (!configuredHash && process.env.NODE_ENV === "production") {
    throw new UnauthorizedException("Pilot login is not configured.");
  }

  const hash = configuredHash || DEFAULT_LOCAL_PILOT_PASSWORD_HASH;
  const [algorithm, iterationsText, salt, expectedHash] = hash.split("$");

  if (algorithm !== "pbkdf2-sha256" || !iterationsText || !salt || !expectedHash) {
    throw new UnauthorizedException("Pilot login is not configured.");
  }

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) {
    throw new UnauthorizedException("Pilot login is not configured.");
  }

  const expected = Buffer.from(expectedHash, "base64url");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isVerifiedEmailClaim(value: CognitoJwtPayload["email_verified"]) {
  return value === true || value === "true";
}

function isValidCompanySlug(value: string) {
  return value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

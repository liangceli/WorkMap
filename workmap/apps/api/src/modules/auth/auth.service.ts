import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { RequestContext, WorkMapJwtPayload } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";
import { JwtService } from "./jwt.service.js";

type DevTokenInput = {
  email?: unknown;
  companySlug?: unknown;
};

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

  async createDevelopmentToken(input: DevTokenInput) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("Development token endpoint is disabled in production.");
    }

    if (typeof input.email !== "string" || !input.email.includes("@")) {
      throw new BadRequestException("A valid email is required.");
    }

    if (input.companySlug !== undefined && typeof input.companySlug !== "string") {
      throw new BadRequestException("companySlug must be a string when provided.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: input.email,
        company: input.companySlug ? { slug: input.companySlug } : undefined,
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

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 60 * 60 * 8;
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

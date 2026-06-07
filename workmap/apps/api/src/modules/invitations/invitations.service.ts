import { createHash, randomBytes } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { InvitationStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { canInviteEmployees, type CognitoJwtPayload, type RequestContext } from "@workmap/auth";
import { getVerifiedCognitoIdentity, isValidEmail } from "../auth/cognito-identity.js";
import { PrismaService } from "../prisma/prisma.service.js";

const INVITE_TTL_DAYS = 7;
const INVITABLE_ROLES = new Set<UserRole>([
  UserRole.EMPLOYEE,
  UserRole.TEAM_LEAD,
  UserRole.MANAGER,
  UserRole.HR_ADMIN,
  UserRole.IT_ADMIN,
]);

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(context: RequestContext) {
    assertCanManageInvitations(context);

    const invitations = await this.prisma.invitation.findMany({
      where: { companyId: context.companyId },
      include: {
        invitedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return {
      invitations: invitations.map((invitation) => toInvitationResponse(invitation)),
    };
  }

  async create(context: RequestContext, input: Record<string, unknown>) {
    assertCanManageInvitations(context);

    const invitedEmail = parseEmail(input.email);
    const role = parseInviteRole(input.role);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        companyId: context.companyId,
        invitedEmail,
        role,
        tokenHash,
        status: InvitationStatus.PENDING,
        invitedByUserId: context.userId,
        expiresAt,
      },
      include: {
        invitedBy: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return {
      invitation: toInvitationResponse(invitation),
      inviteLink: `${getAppBaseUrl()}/invite/${encodeURIComponent(token)}`,
      token,
    };
  }

  async accept(payload: CognitoJwtPayload, input: Record<string, unknown>) {
    const identity = getVerifiedCognitoIdentity(payload);
    const token = typeof input.token === "string" ? input.token.trim() : "";
    const displayName = parseDisplayName(input.displayName, identity.displayName);

    if (token.length < 20 || token.length > 256) {
      throw new BadRequestException("A valid invitation token is required.");
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new BadRequestException("Invitation is invalid.");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(`Invitation is ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException("Invitation has expired.");
    }

    if (invitation.invitedEmail.toLowerCase() !== identity.email) {
      throw new ForbiddenException("Invitation email does not match the verified Cognito email.");
    }

    return this.prisma.$transaction(async (tx) => {
      const linkedBySub = await tx.user.findUnique({
        where: { cognitoSub: identity.sub },
        select: tenantUserSelect,
      });

      if (linkedBySub && linkedBySub.companyId !== invitation.companyId) {
        throw new ForbiddenException("This Cognito account is already linked to another WorkMap workspace.");
      }

      if (linkedBySub && linkedBySub.email !== identity.email) {
        throw new ConflictException("This Cognito account is linked to a WorkMap user with a different email.");
      }

      const emailMatches = await tx.user.findMany({
        where: { email: identity.email },
        select: tenantUserSelect,
        take: 2,
      });
      const offTenantEmailMatch = emailMatches.find((user) => user.companyId !== invitation.companyId);

      if (!linkedBySub && offTenantEmailMatch) {
        throw new ConflictException("This Cognito email already belongs to another WorkMap workspace.");
      }

      const sameTenantEmailMatch = emailMatches.find((user) => user.companyId === invitation.companyId);

      if (sameTenantEmailMatch?.cognitoSub && sameTenantEmailMatch.cognitoSub !== identity.sub) {
        throw new ConflictException("This WorkMap user is already linked to another Cognito account.");
      }

      const user = linkedBySub
        ? await tx.user.update({
            where: { id: linkedBySub.id },
            data: {
              displayName,
              status: UserStatus.AVAILABLE,
            },
            select: tenantUserSelect,
          })
        :
        (sameTenantEmailMatch
          ? await tx.user.update({
              where: { id: sameTenantEmailMatch.id },
              data: {
                cognitoSub: identity.sub,
                displayName,
                role: invitation.role,
                status: UserStatus.AVAILABLE,
              },
              select: tenantUserSelect,
            })
          : await tx.user.create({
              data: {
                companyId: invitation.companyId,
                email: identity.email,
                cognitoSub: identity.sub,
                displayName,
                role: invitation.role,
                status: UserStatus.AVAILABLE,
              },
              select: tenantUserSelect,
            }));

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return {
        context: {
          companyId: user.companyId,
          userId: user.id,
          role: user.role,
        },
        user: {
          id: user.id,
          companyId: user.companyId,
          companySlug: user.company.slug,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatarId: user.avatarId,
        },
        company: user.company,
        onboarding: {
          createdWorkspace: false,
          acceptedInvite: true,
          nextRoute: "/compliance",
        },
      };
    });
  }
}

const tenantUserSelect = {
  id: true,
  companyId: true,
  email: true,
  displayName: true,
  role: true,
  avatarId: true,
  cognitoSub: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.UserSelect;

type InvitationWithInviter = Prisma.InvitationGetPayload<{
  include: {
    invitedBy: {
      select: {
        id: true;
        displayName: true;
        email: true;
      };
    };
  };
}>;

function toInvitationResponse(invitation: InvitationWithInviter) {
  return {
    id: invitation.id,
    invitedEmail: invitation.invitedEmail,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  };
}

function parseEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!isValidEmail(email)) {
    throw new BadRequestException("A valid invite email is required.");
  }

  return email;
}

function parseInviteRole(value: unknown) {
  const role = typeof value === "string" ? value.trim() : "";

  if (!INVITABLE_ROLES.has(role as UserRole)) {
    throw new BadRequestException("Invitation role is not allowed.");
  }

  return role as UserRole;
}

function parseDisplayName(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value : fallback;
  const displayName = raw.trim().replace(/\s+/g, " ");

  if (displayName.length < 2 || displayName.length > 80) {
    throw new BadRequestException("displayName must be between 2 and 80 characters.");
  }

  return displayName;
}

function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function getAppBaseUrl() {
  const configured = process.env.WORKMAP_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return configured.replace(/\/+$/, "");
}

function assertCanManageInvitations(context: RequestContext) {
  if (!canInviteEmployees(context)) {
    throw new ForbiddenException("Only workspace owners can manage invitations.");
  }
}

import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { AvatarDirection, OfficeRoomType, Prisma, UserRole, UserStatus } from "@prisma/client";
import type { CognitoJwtPayload, RequestContext } from "@workmap/auth";
import { getVerifiedCognitoIdentity } from "../auth/cognito-identity.js";
import { PrismaService } from "../prisma/prisma.service.js";

type WorkspaceInput = {
  companyName: string;
  workspaceName: string;
};

type TenantUser = {
  id: string;
  companyId: string;
  email: string;
  displayName: string;
  role: UserRole;
  cognitoSub: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

const DEFAULT_OWNER_SPAWN = { x: 160, y: 545 } as const;

@Injectable()
export class TenantOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(payload: CognitoJwtPayload) {
    const identity = getVerifiedCognitoIdentity(payload);
    const user = await this.findUserForIdentity(identity.sub, identity.email, { bindLegacyEmailMatch: false });

    if (!user) {
      return {
        state: "needs_workspace",
        cognito: {
          sub: identity.sub,
          email: identity.email,
          displayName: identity.displayName,
        },
      };
    }

    return {
      state: "workspace_ready",
      cognito: {
        sub: identity.sub,
        email: identity.email,
        displayName: identity.displayName,
      },
      ...this.toWorkspaceResponse(user, false, false),
    };
  }

  async createWorkspace(payload: CognitoJwtPayload, input: Record<string, unknown>) {
    const identity = getVerifiedCognitoIdentity(payload);
    const workspaceInput = parseWorkspaceInput(input);
    const existingUser = await this.findUserForIdentity(identity.sub, identity.email, { bindLegacyEmailMatch: true });

    if (existingUser) {
      return this.toWorkspaceResponse(existingUser, false, false);
    }

    const slug = await this.createUniqueCompanySlug(workspaceInput.companyName);

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: workspaceInput.companyName,
          slug,
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });

      const department = await tx.department.create({
        data: {
          companyId: company.id,
          name: "General",
        },
        select: {
          id: true,
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          departmentId: department.id,
          email: identity.email,
          cognitoSub: identity.sub,
          displayName: identity.displayName,
          role: UserRole.OWNER,
          status: UserStatus.AVAILABLE,
          jobTitle: "Workspace owner",
        },
        select: {
          id: true,
          companyId: true,
          email: true,
          displayName: true,
          role: true,
          cognitoSub: true,
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      await createDefaultWorkspaceData(tx, {
        companyId: company.id,
        userId: user.id,
        workspaceName: workspaceInput.workspaceName,
      });

      return this.toWorkspaceResponse(user, true, false);
    });
  }

  private async findUserForIdentity(cognitoSub: string, email: string, options: { bindLegacyEmailMatch: boolean }) {
    const userBySub = await this.prisma.user.findUnique({
      where: { cognitoSub },
      select: tenantUserSelect,
    });

    if (userBySub) {
      return userBySub;
    }

    const emailMatches = await this.prisma.user.findMany({
      where: { email },
      select: tenantUserSelect,
      take: 2,
    });

    if (emailMatches.length === 0) {
      return null;
    }

    if (emailMatches.length > 1) {
      throw new ConflictException("This Cognito email matches multiple WorkMap company users. Ask an admin to resolve the mapping.");
    }

    const [user] = emailMatches;

    if (user.cognitoSub && user.cognitoSub !== cognitoSub) {
      throw new ConflictException("This WorkMap user is already linked to another Cognito account.");
    }

    if (!user.cognitoSub && options.bindLegacyEmailMatch) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: { cognitoSub },
        select: tenantUserSelect,
      });
    }

    return user;
  }

  private async createUniqueCompanySlug(companyName: string) {
    const baseSlug = slugify(companyName) || "workspace";

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await this.prisma.company.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException("Unable to create a unique workspace slug. Try a more specific company name.");
  }

  private toWorkspaceResponse(user: TenantUser, createdWorkspace: boolean, acceptedInvite: boolean) {
    const context: RequestContext = {
      companyId: user.companyId,
      userId: user.id,
      role: user.role,
    };

    return {
      context,
      user: {
        id: user.id,
        companyId: user.companyId,
        companySlug: user.company.slug,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      company: user.company,
      onboarding: {
        createdWorkspace,
        acceptedInvite,
        nextRoute: user.role === UserRole.OWNER ? "/onboarding/invite" : "/virtual-office",
      },
    };
  }
}

const tenantUserSelect = {
  id: true,
  companyId: true,
  email: true,
  displayName: true,
  role: true,
  cognitoSub: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} satisfies Prisma.UserSelect;

function parseWorkspaceInput(input: Record<string, unknown>): WorkspaceInput {
  const companyName = typeof input.companyName === "string" ? input.companyName.trim() : "";
  const workspaceName = typeof input.workspaceName === "string" ? input.workspaceName.trim() : "";

  if (companyName.length < 2 || companyName.length > 120) {
    throw new BadRequestException("companyName must be between 2 and 120 characters.");
  }

  if (workspaceName.length < 2 || workspaceName.length > 120) {
    throw new BadRequestException("workspaceName must be between 2 and 120 characters.");
  }

  return {
    companyName,
    workspaceName,
  };
}

async function createDefaultWorkspaceData(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    workspaceName: string;
  },
) {
  const officeMap = await tx.officeMap.create({
    data: {
      companyId: input.companyId,
      name: input.workspaceName,
      slug: "default-office",
      width: 1280,
      height: 720,
      tileSize: 32,
      isDefault: true,
      mapData: {
        version: 1,
        layers: ["floor", "wall", "furniture", "collision", "interaction"],
      },
    },
    select: {
      id: true,
    },
  });

  const openOffice = await tx.officeRoom.create({
    data: {
      companyId: input.companyId,
      officeMapId: officeMap.id,
      name: "Open Office",
      type: OfficeRoomType.OPEN_OFFICE,
      autoStatus: UserStatus.AVAILABLE,
      zoneData: rectangleZone(0, 0, 640, 360),
    },
    select: {
      id: true,
    },
  });

  await tx.officeRoom.createMany({
    data: [
      {
        companyId: input.companyId,
        officeMapId: officeMap.id,
        name: "Focus Room",
        type: OfficeRoomType.FOCUS,
        autoStatus: UserStatus.FOCUS,
        zoneData: rectangleZone(640, 0, 320, 220),
      },
      {
        companyId: input.companyId,
        officeMapId: officeMap.id,
        name: "Break Room",
        type: OfficeRoomType.BREAK,
        autoStatus: UserStatus.BREAK,
        zoneData: rectangleZone(960, 0, 320, 220),
      },
      {
        companyId: input.companyId,
        officeMapId: officeMap.id,
        name: "Meeting Room",
        type: OfficeRoomType.MEETING,
        autoStatus: UserStatus.BUSY,
        zoneData: rectangleZone(640, 220, 320, 250),
      },
      {
        companyId: input.companyId,
        officeMapId: officeMap.id,
        name: "Team Zone",
        type: OfficeRoomType.DEPARTMENT_ZONE,
        autoStatus: UserStatus.AVAILABLE,
        zoneData: rectangleZone(0, 360, 640, 360),
      },
    ],
  });

  await tx.virtualOfficePosition.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      officeMapId: officeMap.id,
      officeRoomId: openOffice.id,
      x: DEFAULT_OWNER_SPAWN.x,
      y: DEFAULT_OWNER_SPAWN.y,
      direction: AvatarDirection.DOWN,
      isMoving: false,
      status: UserStatus.AVAILABLE,
    },
  });

  await tx.monitoringPolicy.create({
    data: {
      companyId: input.companyId,
      name: "Default Monitoring Policy",
      collectAppUsage: true,
      collectWebsiteDomain: true,
      collectFullUrl: false,
      collectScreenshots: false,
      collectKeystrokes: false,
      workHoursOnly: true,
      workdayStart: "09:00",
      workdayEnd: "17:00",
      retentionDays: 90,
      employeeCanViewOwnData: true,
      policyVersion: "v1",
      activeFrom: new Date(),
    },
  });
}

function rectangleZone(x: number, y: number, width: number, height: number) {
  return { shape: "rectangle", x, y, width, height };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

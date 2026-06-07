import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canViewEmployeeActivity, canViewEmployeeDirectory, type RequestContext } from "@workmap/auth";
import { AuditService } from "../audit/audit.service.js";
import { toApiStatus } from "../common/enum-mappers.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCurrentUser(context: RequestContext) {
    return this.getUserProfile(context, context.userId);
  }

  async updateCurrentUserProfile(context: RequestContext, input: unknown) {
    const displayName = parseDisplayName(input);
    const avatarId = parseAvatarId(input);
    const data: { displayName?: string; avatarId?: string } = {};

    if (displayName) {
      data.displayName = displayName;
    }

    if (avatarId) {
      data.avatarId = avatarId;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException("At least one profile field is required.");
    }

    await this.prisma.user.update({
      where: { id: context.userId },
      data,
    });

    return this.getCurrentUser(context);
  }

  async listDirectory(context: RequestContext) {
    if (!canViewEmployeeDirectory(context)) {
      throw new ForbiddenException("Employee directory is not visible to this role.");
    }

    const users = await this.prisma.user.findMany({
      where: { companyId: context.companyId },
      include: {
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ displayName: "asc" }],
    });

    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: toApiStatus(user.status),
      avatarId: user.avatarId,
      jobTitle: user.jobTitle,
      department: user.department,
    }));
  }

  async getUserProfile(context: RequestContext, userId: string) {
    const includeSensitive = canViewEmployeeActivity(context, userId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: context.companyId,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (!includeSensitive) {
      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        status: toApiStatus(user.status),
        avatarId: user.avatarId,
        jobTitle: user.jobTitle,
        department: user.department,
        contactOnly: true,
      };
    }

    if (context.userId !== userId) {
      await this.audit.logSensitiveAction({
        companyId: context.companyId,
        actorUserId: context.userId,
        targetUserId: userId,
        action: "EMPLOYEE_DETAIL_VIEWED",
        resourceType: "User",
        resourceId: userId,
        metadata: { source: "api.users.getUserProfile" },
      });
    }

    const [apps, websites] = await Promise.all([
      this.prisma.appUsageSummary.findMany({
        where: { companyId: context.companyId, userId },
        orderBy: [{ date: "desc" }, { activeSeconds: "desc" }],
        take: 5,
      }),
      this.prisma.websiteUsageSummary.findMany({
        where: { companyId: context.companyId, userId },
        orderBy: [{ date: "desc" }, { activeSeconds: "desc" }],
        take: 5,
      }),
    ]);

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: toApiStatus(user.status),
      avatarId: user.avatarId,
      jobTitle: user.jobTitle,
      department: user.department,
      appUsage: apps.map((item) => ({
        appName: item.appName,
        category: item.category,
        productivityLabel: item.productivityLabel,
        activeSeconds: item.activeSeconds,
        idleSeconds: item.idleSeconds,
        date: item.date.toISOString().slice(0, 10),
      })),
      websiteUsage: websites.map((item) => ({
        domain: item.domain,
        browserName: item.browserName,
        category: item.category,
        productivityLabel: item.productivityLabel,
        activeSeconds: item.activeSeconds,
        idleSeconds: item.idleSeconds,
        date: item.date.toISOString().slice(0, 10),
      })),
    };
  }

  assertCanViewActivity(context: RequestContext, userId: string) {
    if (!canViewEmployeeActivity(context, userId)) {
      throw new ForbiddenException("Employee activity is not visible to this role.");
    }
  }
}

function parseDisplayName(input: unknown) {
  if (!isRecord(input) || !("displayName" in input)) {
    return undefined;
  }

  const displayName = typeof input.displayName === "string" ? normalizeWhitespace(input.displayName) : "";

  if (displayName.length < 2 || displayName.length > 80) {
    throw new BadRequestException("displayName must be between 2 and 80 characters.");
  }

  return displayName;
}

function parseAvatarId(input: unknown) {
  if (!isRecord(input) || !("avatarId" in input)) {
    return undefined;
  }

  const avatarId = typeof input.avatarId === "string" ? input.avatarId.trim() : "";

  if (!avatarId.startsWith("layered:v2:") || avatarId.length > 2048) {
    throw new BadRequestException("avatarId must be a valid WorkMap layered avatar reference.");
  }

  return avatarId;
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

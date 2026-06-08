import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  canViewPlatformAudit,
  canViewPlatformTenantHealth,
  canViewPlatformTenantList,
  type PlatformRequestContext,
} from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

type TenantRoleCounts = Partial<Record<UserRole, number>>;

const PLATFORM_AUDIT_ACTIONS = {
  tenantListViewed: "PLATFORM_TENANT_LIST_VIEWED",
  tenantDetailViewed: "PLATFORM_TENANT_DETAIL_VIEWED",
  tenantHealthViewed: "PLATFORM_TENANT_HEALTH_VIEWED",
  auditViewed: "PLATFORM_AUDIT_VIEWED",
} as const;

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants(context: PlatformRequestContext) {
    assertCanViewTenants(context);

    const companies = await this.prisma.company.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            devices: true,
            officeMaps: true,
            policies: true,
            integrations: true,
            invitations: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const roleCountsByCompany = await this.getRoleCountsByCompany(companies.map((company) => company.id));

    await this.logPlatformAction(context, PLATFORM_AUDIT_ACTIONS.tenantListViewed, undefined, {
      tenantCount: companies.length,
    });

    return {
      tenants: companies.map((company) => toTenantSummary(company, roleCountsByCompany.get(company.id) ?? {})),
    };
  }

  async getTenant(context: PlatformRequestContext, companyId: string) {
    assertCanViewTenantHealth(context);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            devices: true,
            officeMaps: true,
            policies: true,
            integrations: true,
            invitations: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException("Tenant not found.");
    }

    const roleCounts = (await this.getRoleCountsByCompany([company.id])).get(company.id) ?? {};
    const health = await this.getTenantHealthSnapshot(company.id);

    await this.logPlatformAction(context, PLATFORM_AUDIT_ACTIONS.tenantDetailViewed, company.id, {
      targetCompanyId: company.id,
    });

    return {
      tenant: {
        ...toTenantSummary(company, roleCounts),
        roleCounts: toRoleCounts(roleCounts),
      },
      health,
    };
  }

  async getTenantHealth(context: PlatformRequestContext, companyId: string) {
    assertCanViewTenantHealth(context);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException("Tenant not found.");
    }

    const health = await this.getTenantHealthSnapshot(companyId);

    await this.logPlatformAction(context, PLATFORM_AUDIT_ACTIONS.tenantHealthViewed, companyId, {
      targetCompanyId: companyId,
    });

    return { health };
  }

  async listPlatformAudit(context: PlatformRequestContext) {
    if (!canViewPlatformAudit(context)) {
      throw new ForbiddenException("Platform audit is not visible to this user.");
    }

    const logs = await this.prisma.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const targetCompanyIds = Array.from(new Set(logs.map((log) => log.targetCompanyId).filter((id): id is string => Boolean(id))));
    const targetCompanies = targetCompanyIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: targetCompanyIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const companyById = new Map(targetCompanies.map((company) => [company.id, company]));

    await this.logPlatformAction(context, PLATFORM_AUDIT_ACTIONS.auditViewed, undefined, {
      resultCount: logs.length,
    });

    return {
      audit: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        targetCompany: log.targetCompanyId ? companyById.get(log.targetCompanyId) ?? null : null,
        actor: {
          email: log.actorEmail,
          cognitoSub: log.actorCognitoSub,
          displayName: log.actorDisplayName,
          platformRole: log.actorPlatformRole,
        },
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private async getRoleCountsByCompany(companyIds: string[]) {
    if (companyIds.length === 0) {
      return new Map<string, TenantRoleCounts>();
    }

    const counts = await this.prisma.user.groupBy({
      by: ["companyId", "role"],
      where: {
        companyId: { in: companyIds },
      },
      _count: {
        _all: true,
      },
    });
    const countsByCompany = new Map<string, TenantRoleCounts>();

    for (const item of counts) {
      const roleCounts = countsByCompany.get(item.companyId) ?? {};
      roleCounts[item.role] = item._count._all;
      countsByCompany.set(item.companyId, roleCounts);
    }

    return countsByCompany;
  }

  private async getTenantHealthSnapshot(companyId: string) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      ownerCount,
      userCount,
      pendingInviteCount,
      defaultOfficeMap,
      policyCount,
      deviceCount,
      activeDeviceCount,
      integrationCount,
      latestActivity,
      latestPosition,
    ] = await Promise.all([
      this.prisma.user.count({ where: { companyId, role: UserRole.OWNER } }),
      this.prisma.user.count({ where: { companyId } }),
      this.prisma.invitation.count({ where: { companyId, status: "PENDING" } }),
      this.prisma.officeMap.findFirst({ where: { companyId, isDefault: true }, select: { id: true } }),
      this.prisma.monitoringPolicy.count({ where: { companyId } }),
      this.prisma.device.count({ where: { companyId } }),
      this.prisma.device.count({ where: { companyId, lastSeenAt: { gte: oneDayAgo } } }),
      this.prisma.integrationAccount.count({ where: { companyId, enabled: true } }),
      this.prisma.activityEvent.aggregate({
        where: { companyId },
        _max: { createdAt: true },
      }),
      this.prisma.virtualOfficePosition.aggregate({
        where: { companyId },
        _max: { updatedAt: true },
      }),
    ]);

    return {
      readiness: {
        hasOwner: ownerCount > 0,
        hasUsers: userCount > 0,
        hasDefaultOfficeMap: Boolean(defaultOfficeMap),
        hasMonitoringPolicy: policyCount > 0,
      },
      counts: {
        owners: ownerCount,
        users: userCount,
        pendingInvites: pendingInviteCount,
        devices: deviceCount,
        activeDevices24h: activeDeviceCount,
        enabledIntegrations: integrationCount,
      },
      lastActivityAt: latestActivity._max.createdAt?.toISOString() ?? null,
      lastVirtualOfficePositionAt: latestPosition._max.updatedAt?.toISOString() ?? null,
    };
  }

  private async logPlatformAction(
    context: PlatformRequestContext,
    action: string,
    targetCompanyId?: string,
    metadata?: Record<string, string | number | boolean | null>,
  ) {
    await this.prisma.platformAuditLog.create({
      data: {
        actorEmail: context.identity.email,
        actorCognitoSub: context.identity.cognitoSub,
        actorDisplayName: context.identity.displayName,
        actorPlatformRole: context.platformRole,
        action,
        targetCompanyId,
        resourceType: targetCompanyId ? "Company" : "Platform",
        resourceId: targetCompanyId,
        metadata: {
          ...metadata,
          source: "api.platform",
        },
      },
    });
  }
}

function assertCanViewTenants(context: PlatformRequestContext) {
  if (!canViewPlatformTenantList(context)) {
    throw new ForbiddenException("Platform tenant list is not visible to this user.");
  }
}

function assertCanViewTenantHealth(context: PlatformRequestContext) {
  if (!canViewPlatformTenantHealth(context)) {
    throw new ForbiddenException("Platform tenant health is not visible to this user.");
  }
}

function toTenantSummary(
  company: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
      users: number;
      devices: number;
      officeMaps: number;
      policies: number;
      integrations: number;
      invitations: number;
    };
  },
  roleCounts: TenantRoleCounts,
) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    ownerCount: roleCounts.OWNER ?? 0,
    employeeCount: roleCounts.EMPLOYEE ?? 0,
    userCount: company._count.users,
    deviceCount: company._count.devices,
    inviteCount: company._count.invitations,
    integrationCount: company._count.integrations,
    policyConfigured: company._count.policies > 0,
    defaultOfficeMapConfigured: company._count.officeMaps > 0,
  };
}

function toRoleCounts(roleCounts: TenantRoleCounts) {
  return {
    EMPLOYEE: roleCounts.EMPLOYEE ?? 0,
    TEAM_LEAD: roleCounts.TEAM_LEAD ?? 0,
    MANAGER: roleCounts.MANAGER ?? 0,
    HR_ADMIN: roleCounts.HR_ADMIN ?? 0,
    IT_ADMIN: roleCounts.IT_ADMIN ?? 0,
    OWNER: roleCounts.OWNER ?? 0,
  };
}

import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { canManageIntegrations, canUseContactLinks, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanyIntegrations(context: RequestContext) {
    if (!canManageIntegrations(context)) {
      throw new ForbiddenException("Integration settings are not visible to this role.");
    }

    const integrations = await this.prisma.integrationAccount.findMany({
      where: {
        companyId: context.companyId,
        userId: null,
      },
      orderBy: { provider: "asc" },
    });

    return integrations.map((integration) => ({
      id: integration.id,
      provider: integration.provider,
      displayName: integration.displayName,
      enabled: integration.enabled,
      connectedAt: integration.connectedAt?.toISOString() ?? null,
    }));
  }

  async getContactLinks(context: RequestContext, targetUserId: string) {
    if (!canUseContactLinks(context)) {
      throw new ForbiddenException("Contact links are not visible to this role.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: context.companyId,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Contact target not found.");
    }

    const email = user.email.trim();
    const emailAvailable = email.length > 0;
    const encodedEmail = encodeURIComponent(email);
    const teamsChatUrl = emailAvailable ? `https://teams.microsoft.com/l/chat/0/0?users=${encodedEmail}` : null;
    const outlookMailtoUrl = emailAvailable ? `mailto:${encodedEmail}` : null;

    return {
      targetUserId: user.id,
      displayName: user.displayName,
      emailAvailable,
      teamsChatUrl,
      outlookMailtoUrl,
      threeCxUrl: null,
      teams: {
        label: "Teams Chat",
        href: teamsChatUrl,
        enabled: Boolean(teamsChatUrl),
        reason: teamsChatUrl ? undefined : "No email address is available for this teammate.",
      },
      outlook: {
        label: "Outlook Email",
        href: outlookMailtoUrl,
        enabled: Boolean(outlookMailtoUrl),
        reason: outlookMailtoUrl ? undefined : "No email address is available for this teammate.",
      },
      threeCx: {
        label: "3CX Call",
        href: null,
        enabled: false,
        reason: "Coming later.",
      },
    };
  }
}

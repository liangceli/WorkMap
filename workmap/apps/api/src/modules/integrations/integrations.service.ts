import { Injectable, NotFoundException } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCompanyIntegrations(context: RequestContext) {
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

    const encodedEmail = encodeURIComponent(user.email);

    const teamsChatUrl = `https://teams.microsoft.com/l/chat/0/0?users=${encodedEmail}`;
    const outlookMailtoUrl = `mailto:${encodedEmail}`;
    const threeCxUrl = `https://webclient.3cx.com/call?to=${encodedEmail}`;

    return {
      targetUserId: user.id,
      displayName: user.displayName,
      teamsChatUrl,
      outlookMailtoUrl,
      threeCxUrl,
      teams: {
        label: "Teams Chat",
        href: teamsChatUrl,
        enabled: true,
      },
      outlook: {
        label: "Outlook Email",
        href: outlookMailtoUrl,
        enabled: true,
      },
      threeCx: {
        label: "3CX Call",
        href: threeCxUrl,
        enabled: true,
      },
    };
  }
}

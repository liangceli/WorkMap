import { Injectable } from "@nestjs/common";
import { canViewDeviceHealth, type RequestContext } from "@workmap/auth";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listVisibleDevices(context: RequestContext) {
    const canViewCompanyDevices = canViewDeviceHealth(context);
    const devices = await this.prisma.device.findMany({
      where: {
        companyId: context.companyId,
        ...(canViewCompanyDevices ? {} : { userId: context.userId }),
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: [{ lastSeenAt: "desc" }, { updatedAt: "desc" }],
    });

    return devices.map((device) => ({
      id: device.id,
      os: device.os,
      hostname: device.hostname,
      agentVersion: device.agentVersion,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      user: device.user,
    }));
  }
}

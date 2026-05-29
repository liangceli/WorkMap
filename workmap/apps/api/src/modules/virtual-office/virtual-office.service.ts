import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AvatarDirection, UserStatus } from "@prisma/client";
import type { PlayerDirection, UserPresenceStatus } from "@workmap/shared-types";
import { PrismaService } from "../prisma/prisma.service.js";

type PersistPositionInput = {
  companyId: string;
  userId: string;
  officeMapId: string;
  officeRoomId?: string;
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
};

@Injectable()
export class VirtualOfficeService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultOfficeMap(companyId: string) {
    const officeMap = await this.prisma.officeMap.findFirst({
      where: { companyId, isDefault: true },
      include: {
        rooms: {
          orderBy: { name: "asc" },
        },
      },
    });

    if (!officeMap) {
      throw new NotFoundException("Default office map not found.");
    }

    return officeMap;
  }

  async listLatestPositions(companyId: string, officeMapId: string) {
    return this.prisma.virtualOfficePosition.findMany({
      where: {
        companyId,
        officeMapId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarId: true,
            status: true,
            role: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        officeRoom: {
          select: {
            id: true,
            name: true,
            type: true,
            autoStatus: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async persistLatestPosition(input: PersistPositionInput) {
    await this.assertMapAndRoomBelongToCompany(input.companyId, input.officeMapId, input.officeRoomId);

    return this.prisma.virtualOfficePosition.upsert({
      where: { userId: input.userId },
      update: {
        officeMapId: input.officeMapId,
        officeRoomId: input.officeRoomId,
        x: input.x,
        y: input.y,
        direction: toPrismaDirection(input.direction),
        isMoving: input.isMoving,
        status: toPrismaStatus(input.status),
      },
      create: {
        companyId: input.companyId,
        userId: input.userId,
        officeMapId: input.officeMapId,
        officeRoomId: input.officeRoomId,
        x: input.x,
        y: input.y,
        direction: toPrismaDirection(input.direction),
        isMoving: input.isMoving,
        status: toPrismaStatus(input.status),
      },
    });
  }

  private async assertMapAndRoomBelongToCompany(companyId: string, officeMapId: string, officeRoomId?: string) {
    const officeMap = await this.prisma.officeMap.findFirst({
      where: {
        id: officeMapId,
        companyId,
      },
      select: { id: true },
    });

    if (!officeMap) {
      throw new BadRequestException("Office map does not belong to company.");
    }

    if (!officeRoomId) {
      return;
    }

    const officeRoom = await this.prisma.officeRoom.findFirst({
      where: {
        id: officeRoomId,
        companyId,
        officeMapId,
      },
      select: { id: true },
    });

    if (!officeRoom) {
      throw new BadRequestException("Office room does not belong to office map.");
    }
  }
}

function toPrismaDirection(direction: PlayerDirection) {
  return direction.toUpperCase() as AvatarDirection;
}

function toPrismaStatus(status: UserPresenceStatus) {
  return status.toUpperCase() as UserStatus;
}

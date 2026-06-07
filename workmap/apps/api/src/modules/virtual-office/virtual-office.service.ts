import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AvatarDirection, OfficeRoomType, UserStatus } from "@prisma/client";
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    await this.assertMapAndRoomBelongToCompany(companyId, officeMapId);

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

  async listNavigationDestinations(companyId: string) {
    const officeMap = await this.getDefaultOfficeMap(companyId);
    const positionCounts = await this.prisma.virtualOfficePosition.groupBy({
      by: ["officeRoomId"],
      where: {
        companyId,
        officeMapId: officeMap.id,
        officeRoomId: { not: null },
      },
      _count: {
        _all: true,
      },
    });
    const peopleCountByRoomId = new Map(
      positionCounts
        .filter((item) => item.officeRoomId)
        .map((item) => [item.officeRoomId as string, item._count._all]),
    );

    return officeMap.rooms.map((room) => {
      const bounds = parseRectangleBounds(room.zoneData);
      const anchor = bounds
        ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
        : { x: officeMap.width / 2, y: officeMap.height / 2 };

      return {
        id: room.id,
        name: room.name,
        type: toDestinationType(room.type),
        anchor,
        bounds,
        autoStatus: room.autoStatus ? toApiStatus(room.autoStatus) : undefined,
        peopleCount: peopleCountByRoomId.get(room.id) ?? 0,
      };
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

    if (!uuidPattern.test(officeRoomId)) {
      throw new BadRequestException("Office room id must be a valid UUID.");
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

function toApiStatus(status: UserStatus) {
  return status.toLowerCase() as UserPresenceStatus;
}

function toDestinationType(type: OfficeRoomType) {
  switch (type) {
    case OfficeRoomType.DEPARTMENT_ZONE:
      return "department";
    case OfficeRoomType.OPEN_OFFICE:
      return "common_area";
    case OfficeRoomType.FOCUS:
    case OfficeRoomType.BREAK:
    case OfficeRoomType.MEETING:
    case OfficeRoomType.OTHER:
      return "room";
  }
}

type RectangleBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function parseRectangleBounds(value: unknown): RectangleBounds | undefined {
  if (!isRecord(value) || value.shape !== "rectangle") {
    return undefined;
  }

  const { x, y, width, height } = value;

  if (![x, y, width, height].every((item) => typeof item === "number" && Number.isFinite(item))) {
    return undefined;
  }

  return { x, y, width, height } as RectangleBounds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

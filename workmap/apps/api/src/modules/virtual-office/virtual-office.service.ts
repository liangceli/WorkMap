import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AvatarDirection, OfficeRoomType, UserStatus } from "@prisma/client";
import {
  WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST,
  isVirtualOfficePointInBounds,
  validateVirtualOfficeMapManifest,
  type PlayerDirection,
  type UserPresenceStatus,
  type VirtualOfficeMapManifest,
} from "@workmap/shared-types";
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

export type VirtualOfficeRealtimeJoinContext = {
  user: {
    displayName: string;
    avatarId: string;
    role: string;
    status: UserPresenceStatus;
  };
  roomIds: Set<string>;
  mapManifest: VirtualOfficeMapManifest;
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
    const manifest = resolveOfficeMapManifest(officeMap.mapData);
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
    const roomByKey = createRoomByManifestKey(officeMap.rooms, manifest);

    return manifest.navigation.map((destination) => {
      const room = destination.roomKey ? roomByKey.get(destination.roomKey) : undefined;

      return {
        id: destination.key,
        roomId: room?.id,
        name: destination.name,
        type: destination.type,
        description: destination.description,
        anchor: destination.anchor,
        bounds: destination.bounds,
        autoStatus: destination.autoStatus,
        peopleCount: room ? peopleCountByRoomId.get(room.id) ?? 0 : 0,
      };
    });
  }

  async persistLatestPosition(input: PersistPositionInput) {
    const officeMap = await this.assertMapAndRoomBelongToCompany(input.companyId, input.officeMapId, input.officeRoomId);
    const manifest = resolveOfficeMapManifest(officeMap.mapData);

    if (!isVirtualOfficePointInBounds({ x: input.x, y: input.y }, manifest)) {
      throw new BadRequestException("Position is outside the configured office map bounds.");
    }

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

  async getRealtimeJoinContext(
    companyId: string,
    userId: string,
    officeMapId: string,
  ): Promise<VirtualOfficeRealtimeJoinContext> {
    const officeMap = await this.assertMapAndRoomBelongToCompany(companyId, officeMapId);

    const [user, rooms] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
        select: {
          displayName: true,
          avatarId: true,
          role: true,
          status: true,
        },
      }),
      this.prisma.officeRoom.findMany({
        where: {
          companyId,
          officeMapId,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException("Virtual office user not found.");
    }

    return {
      user: {
        displayName: user.displayName,
        avatarId: user.avatarId ?? "default",
        role: user.role,
        status: toApiStatus(user.status),
      },
      roomIds: new Set(rooms.map((room) => room.id)),
      mapManifest: resolveOfficeMapManifest(officeMap.mapData),
    };
  }

  private async assertMapAndRoomBelongToCompany(companyId: string, officeMapId: string, officeRoomId?: string) {
    const officeMap = await this.prisma.officeMap.findFirst({
      where: {
        id: officeMapId,
        companyId,
      },
      select: { id: true, mapData: true },
    });

    if (!officeMap) {
      throw new BadRequestException("Office map does not belong to company.");
    }

    if (!officeRoomId) {
      return officeMap;
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

    return officeMap;
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

function resolveOfficeMapManifest(mapData: unknown): VirtualOfficeMapManifest {
  const validation = validateVirtualOfficeMapManifest(mapData);
  return validation.ok ? validation.manifest : WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST;
}

function createRoomByManifestKey(
  rooms: Array<{
    id: string;
    name: string;
    type: OfficeRoomType;
    zoneData: unknown;
    autoStatus: UserStatus | null;
  }>,
  manifest: VirtualOfficeMapManifest,
) {
  const roomByKey = new Map<string, (typeof rooms)[number]>();

  for (const room of rooms) {
    const roomKey = readRoomKey(room.zoneData) ?? manifest.rooms.find((candidate) => candidate.name === room.name)?.key;
    if (roomKey) {
      roomByKey.set(roomKey, room);
    }
  }

  return roomByKey;
}

function readRoomKey(value: unknown) {
  if (!isRecord(value) || typeof value.roomKey !== "string") {
    return undefined;
  }

  return value.roomKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

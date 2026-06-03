import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import type { RequestContext } from "@workmap/auth";
import { CurrentContext } from "../auth/current-context.decorator.js";
import { toApiDirection, toApiStatus } from "../common/enum-mappers.js";
import { RequestContextGuard } from "../auth/request-context.guard.js";
import { parseSavePositionBody } from "./save-position.dto.js";
import { VirtualOfficeService } from "./virtual-office.service.js";

@Controller("virtual-office")
@UseGuards(RequestContextGuard)
export class VirtualOfficeController {
  constructor(private readonly office: VirtualOfficeService) {}

  @Get("map")
  async getDefaultMap(@CurrentContext() context: RequestContext) {
    const map = await this.office.getDefaultOfficeMap(context.companyId);

    return {
      id: map.id,
      name: map.name,
      slug: map.slug,
      width: map.width,
      height: map.height,
      tileSize: map.tileSize,
      mapData: map.mapData,
      rooms: map.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        zoneData: room.zoneData,
        autoStatus: room.autoStatus ? toApiStatus(room.autoStatus) : null,
      })),
    };
  }

  @Get("navigation")
  listNavigation(@CurrentContext() context: RequestContext) {
    return this.office.listNavigationDestinations(context.companyId);
  }

  @Get("map/:officeMapId/positions")
  async listPositions(@CurrentContext() context: RequestContext, @Param("officeMapId", ParseUUIDPipe) officeMapId: string) {
    const positions = await this.office.listLatestPositions(context.companyId, officeMapId);

    return positions.map((position) => ({
      userId: position.userId,
      displayName: position.user.displayName,
      avatarId: position.user.avatarId ?? "default",
      x: position.x,
      y: position.y,
      direction: toApiDirection(position.direction),
      isMoving: position.isMoving,
      status: toApiStatus(position.status),
      roomId: position.officeRoomId ?? undefined,
      updatedAt: position.updatedAt.toISOString(),
    }));
  }

  @Put("map/:officeMapId/positions/me")
  async saveCurrentUserPosition(
    @CurrentContext() context: RequestContext,
    @Param("officeMapId", ParseUUIDPipe) officeMapId: string,
    @Body() body: unknown,
  ) {
    const position = parseSavePositionBody(body);
    const saved = await this.office.persistLatestPosition({
      companyId: context.companyId,
      userId: context.userId,
      officeMapId,
      officeRoomId: position.roomId,
      x: position.x,
      y: position.y,
      direction: position.direction,
      isMoving: position.isMoving,
      status: position.status,
    });

    return {
      userId: saved.userId,
      x: saved.x,
      y: saved.y,
      direction: toApiDirection(saved.direction),
      isMoving: saved.isMoving,
      status: toApiStatus(saved.status),
      roomId: saved.officeRoomId ?? undefined,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}

import { BadRequestException } from "@nestjs/common";
import type { PlayerDirection, UserPresenceStatus } from "@workmap/shared-types";

export type SavePositionBody = {
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
};

const directions = new Set<PlayerDirection>(["up", "down", "left", "right"]);
const statuses = new Set<UserPresenceStatus>(["available", "busy", "focus", "idle", "break", "offline", "on_call"]);

export function parseSavePositionBody(value: unknown): SavePositionBody {
  if (!isRecord(value)) {
    throw new BadRequestException("Position body must be an object.");
  }

  const { x, y, direction, isMoving, status, roomId } = value;

  if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) {
    throw new BadRequestException("Position x and y must be finite numbers.");
  }

  if (!directions.has(direction as PlayerDirection)) {
    throw new BadRequestException("Position direction is invalid.");
  }

  if (typeof isMoving !== "boolean") {
    throw new BadRequestException("Position isMoving must be a boolean.");
  }

  if (!statuses.has(status as UserPresenceStatus)) {
    throw new BadRequestException("Position status is invalid.");
  }

  if (roomId !== undefined && typeof roomId !== "string") {
    throw new BadRequestException("Position roomId must be a string when provided.");
  }

  return {
    x,
    y,
    direction: direction as PlayerDirection,
    isMoving,
    status: status as UserPresenceStatus,
    roomId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

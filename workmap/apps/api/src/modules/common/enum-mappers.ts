import type { AvatarDirection, UserStatus } from "@prisma/client";
import type { PlayerDirection, UserPresenceStatus } from "@workmap/shared-types";

export function toApiStatus(status: UserStatus): UserPresenceStatus {
  return status.toLowerCase() as UserPresenceStatus;
}

export function toApiDirection(direction: AvatarDirection): PlayerDirection {
  return direction.toLowerCase() as PlayerDirection;
}

export type PlayerDirection = "up" | "down" | "left" | "right";

export type UserPresenceStatus =
  | "available"
  | "busy"
  | "focus"
  | "idle"
  | "break"
  | "offline"
  | "on_call";

export type PlayerState = {
  userId: string;
  displayName: string;
  avatarId: string;
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
  updatedAt: string;
};

export type OfficeRoomZone = {
  id: string;
  name: string;
  status: UserPresenceStatus;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ContactTarget = {
  userId: string;
  displayName: string;
  role: string;
  status: UserPresenceStatus;
};

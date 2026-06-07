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

export type VirtualOfficeRealtimeJoinPayload = {
  officeMapId: string;
};

export type VirtualOfficeRealtimeMovePayload = {
  x: number;
  y: number;
  direction: PlayerDirection;
  isMoving: boolean;
  status: UserPresenceStatus;
  roomId?: string;
};

export type VirtualOfficeRealtimePlayerState = VirtualOfficeRealtimeMovePayload & {
  userId: string;
  displayName: string;
  avatarId: string;
  role: string;
  officeMapId: string;
  updatedAt: string;
};

export type VirtualOfficeRealtimePresenceUser = {
  userId: string;
  displayName: string;
  avatarId: string;
  role: string;
  status: UserPresenceStatus;
  updatedAt: string;
};

export type VirtualOfficeRealtimeClientEvent =
  | {
      event: "office:join";
      payload: VirtualOfficeRealtimeJoinPayload;
    }
  | {
      event: "office:leave";
      payload?: undefined;
    }
  | {
      event: "player:move";
      payload: VirtualOfficeRealtimeMovePayload;
    };

export type VirtualOfficeRealtimeServerEvent =
  | {
      event: "player:state";
      payload: VirtualOfficeRealtimePlayerState;
    }
  | {
      event: "office:presence";
      payload: {
        officeMapId: string;
        users: VirtualOfficeRealtimePresenceUser[];
      };
    }
  | {
      event: "office:error";
      payload: {
        message: string;
      };
    };

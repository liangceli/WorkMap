export type PlayerDirection = "up" | "down" | "left" | "right";

export type UserPresenceStatus =
  | "available"
  | "busy"
  | "focus"
  | "idle"
  | "break"
  | "offline"
  | "on_call";

export type VirtualOfficeDestinationType = "department" | "room" | "common_area" | "desk_area" | "support";

export type VirtualOfficeRoomManifestType =
  | "OPEN_OFFICE"
  | "FOCUS"
  | "BREAK"
  | "MEETING"
  | "DEPARTMENT_ZONE"
  | "OTHER";

export type VirtualOfficePoint = {
  x: number;
  y: number;
};

export type VirtualOfficeRect = VirtualOfficePoint & {
  width: number;
  height: number;
};

export type VirtualOfficeMapSpawn = VirtualOfficePoint & {
  direction: PlayerDirection;
  roomKey?: string;
};

export type VirtualOfficeRoomManifest = {
  key: string;
  name: string;
  type: VirtualOfficeRoomManifestType;
  autoStatus: UserPresenceStatus;
  bounds: VirtualOfficeRect;
};

export type VirtualOfficeNavigationManifest = {
  key: string;
  roomKey?: string;
  name: string;
  type: VirtualOfficeDestinationType;
  description: string;
  anchor: VirtualOfficePoint;
  bounds: VirtualOfficeRect;
  autoStatus?: UserPresenceStatus;
};

export type VirtualOfficeMapManifest = {
  schemaVersion: 1;
  mapKey: string;
  mapVersion: string;
  displayName: string;
  tmxPath: string;
  dimensions: {
    width: number;
    height: number;
    tileSize: number;
  };
  canvas: {
    width: number;
    height: number;
  };
  defaultSpawn: VirtualOfficeMapSpawn;
  safeFallbackSpawn: VirtualOfficeMapSpawn;
  collision: {
    source: "tmx-layer-names";
    layerNames: string[];
    walkableBounds?: VirtualOfficeRect[];
  };
  render: {
    layerOrder: string[];
  };
  rooms: VirtualOfficeRoomManifest[];
  navigation: VirtualOfficeNavigationManifest[];
};

const validStatuses = new Set<UserPresenceStatus>(["available", "busy", "focus", "idle", "break", "offline", "on_call"]);
const validDirections = new Set<PlayerDirection>(["up", "down", "left", "right"]);
const validRoomTypes = new Set<VirtualOfficeRoomManifestType>([
  "OPEN_OFFICE",
  "FOCUS",
  "BREAK",
  "MEETING",
  "DEPARTMENT_ZONE",
  "OTHER",
]);
const validDestinationTypes = new Set<VirtualOfficeDestinationType>([
  "department",
  "room",
  "common_area",
  "desk_area",
  "support",
]);

export const WORKMAP_DEFAULT_OFFICE_MAP_MANIFEST = {
  schemaVersion: 1,
  mapKey: "workmap-default-office",
  mapVersion: "2026-06-big-outdoor-v1",
  displayName: "WorkMap Big Outdoor Office",
  tmxPath: "/maps/workmap2.tmx",
  dimensions: {
    width: 3200,
    height: 2560,
    tileSize: 32,
  },
  canvas: {
    width: 1120,
    height: 680,
  },
  defaultSpawn: {
    x: 960,
    y: 1345,
    direction: "down",
    roomKey: "open-office",
  },
  safeFallbackSpawn: {
    x: 960,
    y: 1345,
    direction: "down",
    roomKey: "open-office",
  },
  collision: {
    source: "tmx-layer-names",
    layerNames: ["WallsPaper", "corner", "Walls", "Tools", "furniture", "chairs", "plants", "some ons on table"],
    walkableBounds: [{ x: 800, y: 800, width: 1600, height: 960 }],
  },
  render: {
    layerOrder: [
      "Outdoor_Ground",
      "shadows",
      "tree-ex",
      "trees-middle",
      "trees-back",
      "trees-front",
      "Outdoor_Water",
      "right-up-corner-buildings",
      "items-on-ground",
      "right-bottom-section-buildings",
      "Floor",
      "Carpet",
      "plants",
      "WallsPaper",
      "corner",
      "Walls",
      "Tools",
      "furniture",
      "Shadows",
      "chairs",
      "some ons on table",
      "Office_Roof",
      "left-up-corner-buildings",
      "fetchs",
    ],
  },
  rooms: [
    {
      key: "open-office",
      name: "Open Office",
      type: "OPEN_OFFICE",
      autoStatus: "available",
      bounds: { x: 832, y: 864, width: 736, height: 512 },
    },
    {
      key: "engineering-zone",
      name: "Engineering Zone",
      type: "DEPARTMENT_ZONE",
      autoStatus: "available",
      bounds: { x: 832, y: 1440, width: 736, height: 288 },
    },
    {
      key: "focus-room",
      name: "Focus Room",
      type: "FOCUS",
      autoStatus: "focus",
      bounds: { x: 1664, y: 864, width: 224, height: 384 },
    },
    {
      key: "meeting-room",
      name: "Main Meeting Room",
      type: "MEETING",
      autoStatus: "busy",
      bounds: { x: 1920, y: 864, width: 416, height: 384 },
    },
    {
      key: "sales-zone",
      name: "Sales Zone",
      type: "DEPARTMENT_ZONE",
      autoStatus: "available",
      bounds: { x: 1664, y: 1440, width: 416, height: 288 },
    },
    {
      key: "break-room",
      name: "Break Room",
      type: "BREAK",
      autoStatus: "break",
      bounds: { x: 2144, y: 1568, width: 192, height: 160 },
    },
  ],
  navigation: [
    {
      key: "open-office",
      roomKey: "open-office",
      name: "Open Office",
      type: "desk_area",
      description: "Shared desk area for everyday presence and quick collaboration.",
      anchor: { x: 1300, y: 1300 },
      bounds: { x: 832, y: 864, width: 736, height: 512 },
      autoStatus: "available",
    },
    {
      key: "engineering-zone",
      roomKey: "engineering-zone",
      name: "Engineering Zone",
      type: "department",
      description: "Engineering desks and focused project work.",
      anchor: { x: 1050, y: 1560 },
      bounds: { x: 832, y: 1440, width: 736, height: 288 },
      autoStatus: "available",
    },
    {
      key: "focus-room",
      roomKey: "focus-room",
      name: "Focus Room",
      type: "room",
      description: "Quiet area for focus work.",
      anchor: { x: 1730, y: 1010 },
      bounds: { x: 1664, y: 864, width: 224, height: 384 },
      autoStatus: "focus",
    },
    {
      key: "meeting-room",
      roomKey: "meeting-room",
      name: "Main Meeting Room",
      type: "room",
      description: "Collaborative meeting area with presentation space.",
      anchor: { x: 2035, y: 1160 },
      bounds: { x: 1920, y: 864, width: 416, height: 384 },
      autoStatus: "busy",
    },
    {
      key: "sales-zone",
      roomKey: "sales-zone",
      name: "Sales Zone",
      type: "department",
      description: "Sales team workspace and customer follow-up area.",
      anchor: { x: 1810, y: 1570 },
      bounds: { x: 1664, y: 1440, width: 416, height: 288 },
      autoStatus: "available",
    },
    {
      key: "break-room",
      roomKey: "break-room",
      name: "Break Room",
      type: "common_area",
      description: "Informal break area for short pauses.",
      anchor: { x: 2210, y: 1635 },
      bounds: { x: 2144, y: 1568, width: 192, height: 160 },
      autoStatus: "break",
    },
    {
      key: "it-support",
      name: "IT Support",
      type: "support",
      description: "Support area for setup, devices, and integrations.",
      anchor: { x: 2050, y: 1590 },
      bounds: { x: 1920, y: 1440, width: 416, height: 288 },
      autoStatus: "available",
    },
  ],
} as const satisfies VirtualOfficeMapManifest;

export type VirtualOfficeMapManifestValidation =
  | { ok: true; manifest: VirtualOfficeMapManifest; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export function validateVirtualOfficeMapManifest(value: unknown): VirtualOfficeMapManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["Map manifest must be an object."], warnings };
  }

  if (value.schemaVersion !== 1) errors.push("Map manifest schemaVersion must be 1.");
  if (!isNonEmptyString(value.mapKey)) errors.push("Map manifest mapKey is required.");
  if (!isNonEmptyString(value.mapVersion)) errors.push("Map manifest mapVersion is required.");
  if (!isNonEmptyString(value.displayName)) errors.push("Map manifest displayName is required.");
  if (!isNonEmptyString(value.tmxPath)) errors.push("Map manifest tmxPath is required.");

  const dimensions = isRecord(value.dimensions) ? value.dimensions : null;
  if (!dimensions || !isPositiveNumber(dimensions.width) || !isPositiveNumber(dimensions.height) || !isPositiveNumber(dimensions.tileSize)) {
    errors.push("Map manifest dimensions must include positive width, height, and tileSize.");
  }

  const canvas = isRecord(value.canvas) ? value.canvas : null;
  if (!canvas || !isPositiveNumber(canvas.width) || !isPositiveNumber(canvas.height)) {
    errors.push("Map manifest canvas must include positive width and height.");
  }

  const collision = isRecord(value.collision) ? value.collision : null;
  if (!collision || collision.source !== "tmx-layer-names" || !Array.isArray(collision.layerNames) || collision.layerNames.length === 0) {
    errors.push("Map manifest collision layerNames are required.");
  } else if (!collision.layerNames.every(isNonEmptyString)) {
    errors.push("Map manifest collision layerNames must be non-empty strings.");
  }

  const render = isRecord(value.render) ? value.render : null;
  if (!render || !Array.isArray(render.layerOrder) || render.layerOrder.length === 0 || !render.layerOrder.every(isNonEmptyString)) {
    errors.push("Map manifest render.layerOrder must include non-empty layer names.");
  }

  const bounds = dimensions && isPositiveNumber(dimensions.width) && isPositiveNumber(dimensions.height)
    ? { width: dimensions.width, height: dimensions.height }
    : null;

  if (collision?.walkableBounds !== undefined) {
    if (!Array.isArray(collision.walkableBounds) || collision.walkableBounds.length === 0) {
      errors.push("Map manifest collision.walkableBounds must be a non-empty array when provided.");
    } else {
      for (const [index, rect] of collision.walkableBounds.entries()) {
        validateRect(`Map manifest collision.walkableBounds ${index}`, rect, bounds, errors);
      }
    }
  }

  validateSpawn("defaultSpawn", value.defaultSpawn, bounds, errors);
  validateSpawn("safeFallbackSpawn", value.safeFallbackSpawn, bounds, errors);

  if (!Array.isArray(value.rooms) || value.rooms.length === 0) {
    errors.push("Map manifest rooms are required.");
  } else {
    const keys = new Set<string>();
    for (const room of value.rooms) {
      if (!isRecord(room)) {
        errors.push("Map manifest room must be an object.");
        continue;
      }
      if (!isNonEmptyString(room.key)) {
        errors.push("Map manifest room key is required.");
      } else if (keys.has(room.key)) {
        errors.push(`Map manifest room key is duplicated: ${room.key}.`);
      } else {
        keys.add(room.key);
      }
      if (!isNonEmptyString(room.name)) errors.push(`Map manifest room ${String(room.key)} name is required.`);
      if (!validRoomTypes.has(room.type as VirtualOfficeRoomManifestType)) errors.push(`Map manifest room ${String(room.key)} type is invalid.`);
      if (!validStatuses.has(room.autoStatus as UserPresenceStatus)) errors.push(`Map manifest room ${String(room.key)} autoStatus is invalid.`);
      validateRect(`Map manifest room ${String(room.key)} bounds`, room.bounds, bounds, errors);
    }
  }

  if (!Array.isArray(value.navigation) || value.navigation.length === 0) {
    errors.push("Map manifest navigation destinations are required.");
  } else {
    const keys = new Set<string>();
    const roomKeys = new Set((Array.isArray(value.rooms) ? value.rooms : []).filter(isRecord).map((room) => room.key).filter(isNonEmptyString));
    for (const destination of value.navigation) {
      if (!isRecord(destination)) {
        errors.push("Map manifest navigation destination must be an object.");
        continue;
      }
      if (!isNonEmptyString(destination.key)) {
        errors.push("Map manifest navigation destination key is required.");
      } else if (keys.has(destination.key)) {
        errors.push(`Map manifest navigation destination key is duplicated: ${destination.key}.`);
      } else {
        keys.add(destination.key);
      }
      if (destination.roomKey !== undefined && (!isNonEmptyString(destination.roomKey) || !roomKeys.has(destination.roomKey))) {
        warnings.push(`Map manifest navigation destination ${String(destination.key)} references a missing roomKey.`);
      }
      if (!isNonEmptyString(destination.name)) errors.push(`Map manifest navigation destination ${String(destination.key)} name is required.`);
      if (!validDestinationTypes.has(destination.type as VirtualOfficeDestinationType)) {
        errors.push(`Map manifest navigation destination ${String(destination.key)} type is invalid.`);
      }
      if (!isNonEmptyString(destination.description)) warnings.push(`Map manifest navigation destination ${String(destination.key)} has no description.`);
      validatePoint(`Map manifest navigation destination ${String(destination.key)} anchor`, destination.anchor, bounds, errors);
      validateRect(`Map manifest navigation destination ${String(destination.key)} bounds`, destination.bounds, bounds, errors);
      if (destination.autoStatus !== undefined && !validStatuses.has(destination.autoStatus as UserPresenceStatus)) {
        errors.push(`Map manifest navigation destination ${String(destination.key)} autoStatus is invalid.`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return { ok: true, manifest: value as VirtualOfficeMapManifest, warnings };
}

export function getVirtualOfficeMapBounds(manifest: VirtualOfficeMapManifest) {
  return {
    width: manifest.dimensions.width,
    height: manifest.dimensions.height,
  };
}

export function isVirtualOfficePointInBounds(point: VirtualOfficePoint, manifest: VirtualOfficeMapManifest) {
  return point.x >= 0 && point.y >= 0 && point.x <= manifest.dimensions.width && point.y <= manifest.dimensions.height;
}

export function isVirtualOfficeRectInBounds(rect: VirtualOfficeRect, manifest: VirtualOfficeMapManifest) {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= manifest.dimensions.width &&
    rect.y + rect.height <= manifest.dimensions.height
  );
}

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

function validateSpawn(
  label: string,
  value: unknown,
  bounds: { width: number; height: number } | null,
  errors: string[],
) {
  if (!isRecord(value)) {
    errors.push(`Map manifest ${label} is required.`);
    return;
  }

  validatePoint(`Map manifest ${label}`, value, bounds, errors);
  if (!validDirections.has(value.direction as PlayerDirection)) {
    errors.push(`Map manifest ${label} direction is invalid.`);
  }
}

function validatePoint(
  label: string,
  value: unknown,
  bounds: { width: number; height: number } | null,
  errors: string[],
) {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y) || value.x < 0 || value.y < 0) {
    errors.push(`${label} must include non-negative finite x and y.`);
    return;
  }

  if (bounds && (value.x > bounds.width || value.y > bounds.height)) {
    errors.push(`${label} must be within map bounds.`);
  }
}

function validateRect(
  label: string,
  value: unknown,
  bounds: { width: number; height: number } | null,
  errors: string[],
) {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height) ||
    value.x < 0 ||
    value.y < 0 ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    errors.push(`${label} must include non-negative x/y and positive width/height.`);
    return;
  }

  if (bounds && (value.x + value.width > bounds.width || value.y + value.height > bounds.height)) {
    errors.push(`${label} must be within map bounds.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

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

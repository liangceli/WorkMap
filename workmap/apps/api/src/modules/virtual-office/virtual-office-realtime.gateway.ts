import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { canAccessVirtualOffice, type RequestContext } from "@workmap/auth";
import type {
  UserPresenceStatus,
  VirtualOfficeMapManifest,
  VirtualOfficeRealtimeClientEvent,
  VirtualOfficeRealtimeMovePayload,
  VirtualOfficeRealtimePlayerState,
  VirtualOfficeRealtimePresenceUser,
  VirtualOfficeRealtimeServerEvent,
} from "@workmap/shared-types";
import { isVirtualOfficePointInBounds } from "@workmap/shared-types";
import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { RequestContextResolverService } from "../auth/request-context-resolver.service.js";
import { parseSavePositionBody } from "./save-position.dto.js";
import { VirtualOfficeService } from "./virtual-office.service.js";

type UpgradeHandler = (request: IncomingMessage, socket: Socket, head: Buffer) => void;

type UpgradeServer = {
  on(event: "upgrade", listener: UpgradeHandler): void;
  removeListener(event: "upgrade", listener: UpgradeHandler): void;
};

type RealtimeClient = {
  id: string;
  socket: Socket;
  context: RequestContext;
  buffer: Buffer;
  roomIds: Set<string>;
  roomKey?: string;
  officeMapId?: string;
  mapManifest?: VirtualOfficeMapManifest;
  profile?: {
    displayName: string;
    avatarId: string;
    role: string;
    status: UserPresenceStatus;
  };
  lastMoveAt: number;
  lastState?: VirtualOfficeRealtimePlayerState;
};

const REALTIME_PATH = "/virtual-office/realtime";
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_MESSAGE_BYTES = 16 * 1024;
const MIN_MOVE_INTERVAL_MS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class VirtualOfficeRealtimeGateway implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(VirtualOfficeRealtimeGateway.name);
  private readonly clients = new Map<string, RealtimeClient>();
  private readonly rooms = new Map<string, Set<string>>();
  private server?: UpgradeServer;

  private readonly upgradeHandler: UpgradeHandler = (request, socket, head) => {
    void this.handleUpgrade(request, socket, head);
  };

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly contextResolver: RequestContextResolverService,
    private readonly office: VirtualOfficeService,
  ) {}

  onModuleInit() {
    const server = this.httpAdapterHost.httpAdapter?.getHttpServer?.() as unknown;

    if (!isUpgradeServer(server)) {
      this.logger.warn("Virtual office realtime gateway could not attach to HTTP server.");
      return;
    }

    this.server = server;
    server.on("upgrade", this.upgradeHandler);
    this.logger.log(`Virtual office realtime gateway attached at ${REALTIME_PATH}.`);
  }

  onApplicationShutdown() {
    if (this.server) {
      this.server.removeListener("upgrade", this.upgradeHandler);
    }

    for (const client of this.clients.values()) {
      client.socket.destroy();
    }

    this.clients.clear();
    this.rooms.clear();
  }

  private async handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    const url = readRequestUrl(request);

    if (url.pathname !== REALTIME_PATH) {
      return;
    }

    if (!isAllowedOrigin(singleHeader(request.headers.origin))) {
      rejectUpgrade(socket, "403 Forbidden");
      return;
    }

    const key = singleHeader(request.headers["sec-websocket-key"]);
    const version = singleHeader(request.headers["sec-websocket-version"]);

    if (!key || version !== "13") {
      rejectUpgrade(socket, "400 Bad Request");
      return;
    }

    const token = url.searchParams.get("token")?.trim();
    const authorization = singleHeader(request.headers.authorization) ?? (token ? `Bearer ${token}` : undefined);

    let context: RequestContext;

    try {
      context = await this.contextResolver.resolveBearerContext(authorization);
    } catch {
      rejectUpgrade(socket, "401 Unauthorized");
      return;
    }

    acceptUpgrade(socket, key);
    const client: RealtimeClient = {
      id: randomUUID(),
      socket,
      context,
      buffer: Buffer.alloc(0),
      roomIds: new Set(),
      lastMoveAt: 0,
    };

    this.clients.set(client.id, client);
    socket.setNoDelay(true);
    socket.on("data", (chunk: Buffer) => this.handleSocketData(client, chunk));
    socket.on("close", () => this.disconnect(client));
    socket.on("error", () => this.disconnect(client));

    if (head.length > 0) {
      this.handleSocketData(client, head);
    }
  }

  private handleSocketData(client: RealtimeClient, chunk: Buffer) {
    client.buffer = Buffer.concat([client.buffer, chunk]);

    while (client.buffer.length >= 2) {
      const frame = readClientFrame(client.buffer);

      if (!frame) {
        return;
      }

      client.buffer = client.buffer.subarray(frame.bytesRead);

      if (frame.type === "close") {
        client.socket.end(Buffer.from([0x88, 0x00]));
        this.disconnect(client);
        return;
      }

      if (frame.type === "ping") {
        writeFrame(client.socket, frame.payload, 0x0a);
        continue;
      }

      if (frame.type !== "text") {
        continue;
      }

      void this.handleClientMessage(client, frame.payload.toString("utf8"));
    }
  }

  private async handleClientMessage(client: RealtimeClient, rawMessage: string) {
    const message = parseClientEvent(rawMessage);

    if (!message) {
      this.sendError(client, "Realtime message is invalid.");
      return;
    }

    try {
      switch (message.event) {
        case "office:join":
          await this.handleJoin(client, message.payload.officeMapId);
          break;
        case "office:leave":
          this.leaveRoom(client);
          break;
        case "player:move":
          this.handleMove(client, message.payload);
          break;
      }
    } catch (error) {
      this.sendError(client, error instanceof Error ? error.message : "Realtime action failed.");
    }
  }

  private async handleJoin(client: RealtimeClient, officeMapId: string) {
    if (!canAccessVirtualOffice(client.context)) {
      this.sendError(client, "Role is not allowed to access virtual office realtime.");
      return;
    }

    if (!UUID_PATTERN.test(officeMapId)) {
      this.sendError(client, "Office map id must be a valid UUID.");
      return;
    }

    const joinContext = await this.office.getRealtimeJoinContext(client.context.companyId, client.context.userId, officeMapId);
    this.leaveRoom(client);

    client.officeMapId = officeMapId;
    client.roomIds = joinContext.roomIds;
    client.mapManifest = joinContext.mapManifest;
    client.profile = joinContext.user;
    client.roomKey = createRoomKey(client.context.companyId, officeMapId);

    const clients = this.rooms.get(client.roomKey) ?? new Set<string>();
    clients.add(client.id);
    this.rooms.set(client.roomKey, clients);
    this.broadcastPresence(client.roomKey, officeMapId);
  }

  private handleMove(client: RealtimeClient, payload: VirtualOfficeRealtimeMovePayload) {
    if (!client.roomKey || !client.officeMapId || !client.profile || !client.mapManifest) {
      this.sendError(client, "Join an office map before sending movement.");
      return;
    }

    const position = parseSavePositionBody(payload);

    if (position.roomId && !client.roomIds.has(position.roomId)) {
      this.sendError(client, "Office room does not belong to joined office map.");
      return;
    }

    if (!isVirtualOfficePointInBounds({ x: position.x, y: position.y }, client.mapManifest)) {
      this.sendError(client, "Movement is outside the configured office map bounds.");
      return;
    }

    const now = Date.now();
    const importantStop = Boolean(client.lastState?.isMoving && !position.isMoving);

    if (now - client.lastMoveAt < MIN_MOVE_INTERVAL_MS && !importantStop) {
      return;
    }

    client.lastMoveAt = now;
    client.profile.status = position.status;
    const state: VirtualOfficeRealtimePlayerState = {
      userId: client.context.userId,
      displayName: client.profile.displayName,
      avatarId: client.profile.avatarId,
      role: client.profile.role,
      officeMapId: client.officeMapId,
      x: Math.round(position.x),
      y: Math.round(position.y),
      direction: position.direction,
      isMoving: position.isMoving,
      status: position.status,
      roomId: position.roomId,
      updatedAt: new Date(now).toISOString(),
    };

    client.lastState = state;
    this.broadcast(client.roomKey, { event: "player:state", payload: state }, client.id);
  }

  private leaveRoom(client: RealtimeClient) {
    const roomKey = client.roomKey;
    const officeMapId = client.officeMapId;

    if (!roomKey) {
      return;
    }

    const clients = this.rooms.get(roomKey);
    clients?.delete(client.id);

    if (clients?.size === 0) {
      this.rooms.delete(roomKey);
    }

    if (client.lastState) {
      this.broadcast(roomKey, {
        event: "player:state",
        payload: {
          ...client.lastState,
          isMoving: false,
          status: "offline",
          updatedAt: new Date().toISOString(),
        },
      });
    }

    client.roomKey = undefined;
    client.officeMapId = undefined;
    client.mapManifest = undefined;
    client.roomIds = new Set();

    if (officeMapId) {
      this.broadcastPresence(roomKey, officeMapId);
    }
  }

  private disconnect(client: RealtimeClient) {
    if (!this.clients.has(client.id)) {
      return;
    }

    this.leaveRoom(client);
    this.clients.delete(client.id);
  }

  private broadcastPresence(roomKey: string, officeMapId: string) {
    const users: VirtualOfficeRealtimePresenceUser[] = Array.from(this.rooms.get(roomKey) ?? [])
      .map((clientId) => this.clients.get(clientId))
      .filter((client): client is RealtimeClient => Boolean(client?.profile))
      .map((client) => ({
        userId: client.context.userId,
        displayName: client.profile!.displayName,
        avatarId: client.profile!.avatarId,
        role: client.profile!.role,
        status: client.lastState?.status ?? client.profile!.status,
        updatedAt: client.lastState?.updatedAt ?? new Date().toISOString(),
      }));

    this.broadcast(roomKey, { event: "office:presence", payload: { officeMapId, users } });
  }

  private broadcast(roomKey: string, event: VirtualOfficeRealtimeServerEvent, excludeClientId?: string) {
    for (const clientId of this.rooms.get(roomKey) ?? []) {
      if (clientId === excludeClientId) {
        continue;
      }

      const client = this.clients.get(clientId);

      if (client) {
        sendEvent(client, event);
      }
    }
  }

  private sendError(client: RealtimeClient, message: string) {
    sendEvent(client, { event: "office:error", payload: { message } });
  }
}

function parseClientEvent(rawMessage: string): VirtualOfficeRealtimeClientEvent | null {
  try {
    const value = JSON.parse(rawMessage) as unknown;

    if (!isRecord(value) || typeof value.event !== "string") {
      return null;
    }

    if (value.event === "office:join" && isRecord(value.payload) && typeof value.payload.officeMapId === "string") {
      return { event: "office:join", payload: { officeMapId: value.payload.officeMapId } };
    }

    if (value.event === "office:leave") {
      return { event: "office:leave" };
    }

    if (value.event === "player:move" && isRecord(value.payload)) {
      return { event: "player:move", payload: value.payload as VirtualOfficeRealtimeMovePayload };
    }

    return null;
  } catch {
    return null;
  }
}

function sendEvent(client: RealtimeClient, event: VirtualOfficeRealtimeServerEvent) {
  writeFrame(client.socket, Buffer.from(JSON.stringify(event), "utf8"), 0x01);
}

function readClientFrame(buffer: Buffer):
  | {
      type: "text" | "close" | "ping" | "other";
      payload: Buffer;
      bytesRead: number;
    }
  | null {
  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const fin = (firstByte & 0x80) !== 0;
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let length = secondByte & 0x7f;
  let offset = 2;

  if (!fin || !masked) {
    return {
      type: "close",
      payload: Buffer.alloc(0),
      bytesRead: buffer.length,
    };
  }

  if (length === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }

    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }

    const largeLength = buffer.readBigUInt64BE(offset);

    if (largeLength > BigInt(MAX_MESSAGE_BYTES)) {
      return {
        type: "close",
        payload: Buffer.alloc(0),
        bytesRead: buffer.length,
      };
    }

    length = Number(largeLength);
    offset += 8;
  }

  if (length > MAX_MESSAGE_BYTES) {
    return {
      type: "close",
      payload: Buffer.alloc(0),
      bytesRead: buffer.length,
    };
  }

  if (buffer.length < offset + 4 + length) {
    return null;
  }

  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(length);

  for (let index = 0; index < length; index += 1) {
    payload[index] = buffer[offset + index] ^ mask[index % 4];
  }

  const type = opcode === 0x01 ? "text" : opcode === 0x08 ? "close" : opcode === 0x09 ? "ping" : "other";

  return {
    type,
    payload,
    bytesRead: offset + length,
  };
}

function writeFrame(socket: Socket, payload: Buffer, opcode: 0x01 | 0x0a) {
  if (!socket.writable) {
    return;
  }

  const header =
    payload.length < 126
      ? Buffer.from([0x80 | opcode, payload.length])
      : payload.length <= 0xffff
        ? createMediumHeader(opcode, payload.length)
        : createLargeHeader(opcode, payload.length);

  socket.write(Buffer.concat([header, payload]));
}

function createMediumHeader(opcode: 0x01 | 0x0a, length: number) {
  const header = Buffer.alloc(4);
  header[0] = 0x80 | opcode;
  header[1] = 126;
  header.writeUInt16BE(length, 2);
  return header;
}

function createLargeHeader(opcode: 0x01 | 0x0a, length: number) {
  const header = Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return header;
}

function acceptUpgrade(socket: Socket, key: string) {
  const acceptKey = createHash("sha1").update(`${key}${WEBSOCKET_GUID}`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n"),
  );
}

function rejectUpgrade(socket: Socket, status: "400 Bad Request" | "401 Unauthorized" | "403 Forbidden") {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

function readRequestUrl(request: IncomingMessage) {
  const host = singleHeader(request.headers.host) ?? "localhost";
  return new URL(request.url ?? "/", `http://${host}`);
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true;
  }

  const configuredOrigin = process.env.WORKMAP_ALLOWED_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const allowedOrigins = configuredOrigin
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return allowedOrigins.includes(origin.replace(/\/+$/, ""));
}

function createRoomKey(companyId: string, officeMapId: string) {
  return `${companyId}:${officeMapId}`;
}

function isUpgradeServer(value: unknown): value is UpgradeServer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as UpgradeServer).on === "function" &&
    typeof (value as UpgradeServer).removeListener === "function"
  );
}

function singleHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

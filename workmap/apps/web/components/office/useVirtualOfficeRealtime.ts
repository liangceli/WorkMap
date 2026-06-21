"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  VirtualOfficeRealtimeClientEvent,
  VirtualOfficeRealtimeMovePayload,
  VirtualOfficeRealtimePlayerState,
  VirtualOfficeRealtimeServerEvent,
  VirtualOfficeRealtimeTeammateEventPayload,
  VirtualOfficeRealtimeTeammateMessageEventPayload,
} from "@workmap/shared-types";
import { getVirtualOfficeRealtimeUrl } from "../../lib/api/realtimeApi";
import type { ApiClientOptions } from "../../lib/api/apiTypes";

export type VirtualOfficeRealtimeState = "fallback" | "connecting" | "connected" | "reconnecting" | "error";

type UseVirtualOfficeRealtimeInput = {
  officeMapId?: string;
  apiOptions?: ApiClientOptions;
  currentUserId?: string;
  onRemoteState: (state: VirtualOfficeRealtimePlayerState) => void;
  onWave?: (payload: VirtualOfficeRealtimeTeammateEventPayload) => void;
  onMessage?: (payload: VirtualOfficeRealtimeTeammateMessageEventPayload) => void;
  onError?: (message: string) => void;
};

const VISIBLE_SEND_INTERVAL_MS = 110;
const HIDDEN_SEND_INTERVAL_MS = 1000;
const STATIONARY_REFRESH_MS = 2000;

export function useVirtualOfficeRealtime({
  officeMapId,
  apiOptions,
  currentUserId,
  onRemoteState,
  onWave,
  onMessage,
  onError,
}: UseVirtualOfficeRealtimeInput) {
  const [connectionState, setConnectionState] = useState<VirtualOfficeRealtimeState>("fallback");
  const socketRef = useRef<WebSocket | null>(null);
  const joinedRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const lastSentSnapshotRef = useRef<VirtualOfficeRealtimeMovePayload | null>(null);
  const onRemoteStateRef = useRef(onRemoteState);
  const onWaveRef = useRef(onWave);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onRemoteStateRef.current = onRemoteState;
  }, [onRemoteState]);

  useEffect(() => {
    onWaveRef.current = onWave;
  }, [onWave]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!officeMapId || !apiOptions?.token) {
      socketRef.current = null;
      joinedRef.current = false;
      setConnectionState("fallback");
      return undefined;
    }

    const realtimeUrl = getVirtualOfficeRealtimeUrl(apiOptions);

    if (!realtimeUrl) {
      setConnectionState("fallback");
      return undefined;
    }

    let cancelled = false;
    let reconnectAttempt = 0;
    let reconnectTimeout: number | undefined;

    const connect = () => {
      if (cancelled) {
        return;
      }

      setConnectionState(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      const socket = new WebSocket(realtimeUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (cancelled || socketRef.current !== socket) {
          return;
        }

        reconnectAttempt = 0;
        joinedRef.current = true;
        setConnectionState("connected");
        sendSocketEvent(socket, { event: "office:join", payload: { officeMapId } });
      });

      socket.addEventListener("message", (event: MessageEvent<string>) => {
        const message = parseServerEvent(event.data);

        if (!message) {
          return;
        }

        if (message.event === "player:state") {
          if (message.payload.userId !== currentUserId) {
            onRemoteStateRef.current(message.payload);
          }
          return;
        }

        if (message.event === "teammate:wave") {
          if (message.payload.targetUserId === currentUserId) {
            onWaveRef.current?.(message.payload);
          }
          return;
        }

        if (message.event === "teammate:message") {
          if (message.payload.targetUserId === currentUserId) {
            onMessageRef.current?.(message.payload);
          }
          return;
        }

        if (message.event === "office:error" && process.env.NODE_ENV === "development") {
          console.info("virtual-office realtime fallback", message.payload.message);
        }

        if (message.event === "office:error") {
          onErrorRef.current?.(message.payload.message);
        }
      });

      socket.addEventListener("close", () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          joinedRef.current = false;
        }

        if (cancelled) {
          return;
        }

        reconnectAttempt += 1;
        setConnectionState(reconnectAttempt === 1 ? "error" : "reconnecting");
        reconnectTimeout = window.setTimeout(connect, Math.min(4000, 900 + reconnectAttempt * 600));
      });

      socket.addEventListener("error", () => {
        if (process.env.NODE_ENV === "development") {
          console.info("virtual-office realtime socket error; polling fallback remains active");
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      joinedRef.current = false;
      if (reconnectTimeout) {
        window.clearTimeout(reconnectTimeout);
      }

      const socket = socketRef.current;
      socketRef.current = null;

      if (socket && socket.readyState === WebSocket.OPEN) {
        sendSocketEvent(socket, { event: "office:leave" });
        socket.close(1000, "Virtual office closed");
      } else {
        socket?.close();
      }
    };
  }, [apiOptions?.baseUrl, apiOptions?.token, currentUserId, officeMapId]);

  const sendMovement = useCallback((position: VirtualOfficeRealtimeMovePayload) => {
    const socket = socketRef.current;

    if (!joinedRef.current || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    const lastSent = lastSentSnapshotRef.current;
    const hidden = document.visibilityState === "hidden";
    const minimumInterval = hidden ? HIDDEN_SEND_INTERVAL_MS : VISIBLE_SEND_INTERVAL_MS;
    const unchanged = lastSent ? isSameMovementSnapshot(lastSent, position) : false;
    const importantChange = Boolean(
      !lastSent ||
        (lastSent.isMoving && !position.isMoving) ||
        lastSent.status !== position.status ||
        lastSent.roomId !== position.roomId,
    );

    if (unchanged && now - lastSentAtRef.current < STATIONARY_REFRESH_MS) {
      return;
    }

    if (now - lastSentAtRef.current < minimumInterval && !importantChange) {
      return;
    }

    lastSentAtRef.current = now;
    lastSentSnapshotRef.current = position;
    sendSocketEvent(socket, { event: "player:move", payload: position });
  }, []);

  const sendWave = useCallback((targetUserId: string) => {
    const socket = socketRef.current;

    if (!joinedRef.current || !socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    sendSocketEvent(socket, { event: "teammate:wave", payload: { targetUserId } });
    return true;
  }, []);

  const sendMessage = useCallback((targetUserId: string, message: string) => {
    const socket = socketRef.current;
    const normalized = message.replace(/\s+/g, " ").trim();

    if (!normalized || normalized.length > 500 || !joinedRef.current || !socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    sendSocketEvent(socket, { event: "teammate:message", payload: { targetUserId, message: normalized } });
    return true;
  }, []);

  return {
    connectionState,
    sendMovement,
    sendWave,
    sendMessage,
  };
}

function sendSocketEvent(socket: WebSocket, event: VirtualOfficeRealtimeClientEvent) {
  socket.send(JSON.stringify(event));
}

function parseServerEvent(raw: string): VirtualOfficeRealtimeServerEvent | null {
  try {
    const value = JSON.parse(raw) as unknown;

    if (!isRecord(value) || typeof value.event !== "string") {
      return null;
    }

    if (value.event === "player:state" && isRealtimePlayerState(value.payload)) {
      return { event: "player:state", payload: value.payload };
    }

    if (value.event === "office:presence" && isRecord(value.payload) && Array.isArray(value.payload.users)) {
      return {
        event: "office:presence",
        payload: {
          officeMapId: typeof value.payload.officeMapId === "string" ? value.payload.officeMapId : "",
          users: [],
        },
      };
    }

    if (value.event === "office:error" && isRecord(value.payload) && typeof value.payload.message === "string") {
      return { event: "office:error", payload: { message: value.payload.message } };
    }

    if (
      value.event === "teammate:wave" &&
      isRecord(value.payload) &&
      typeof value.payload.fromUserId === "string" &&
      typeof value.payload.fromDisplayName === "string" &&
      typeof value.payload.targetUserId === "string" &&
      typeof value.payload.createdAt === "string"
    ) {
      return {
        event: "teammate:wave",
        payload: {
          fromUserId: value.payload.fromUserId,
          fromDisplayName: value.payload.fromDisplayName,
          targetUserId: value.payload.targetUserId,
          createdAt: value.payload.createdAt,
        },
      };
    }

    if (
      value.event === "teammate:message" &&
      isRecord(value.payload) &&
      typeof value.payload.fromUserId === "string" &&
      typeof value.payload.fromDisplayName === "string" &&
      typeof value.payload.targetUserId === "string" &&
      typeof value.payload.message === "string" &&
      typeof value.payload.createdAt === "string"
    ) {
      return {
        event: "teammate:message",
        payload: {
          fromUserId: value.payload.fromUserId,
          fromDisplayName: value.payload.fromDisplayName,
          targetUserId: value.payload.targetUserId,
          message: value.payload.message,
          createdAt: value.payload.createdAt,
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

function isRealtimePlayerState(value: unknown): value is VirtualOfficeRealtimePlayerState {
  return (
    isRecord(value) &&
    typeof value.userId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.avatarId === "string" &&
    typeof value.role === "string" &&
    typeof value.officeMapId === "string" &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    isDirection(value.direction) &&
    typeof value.isMoving === "boolean" &&
    isStatus(value.status) &&
    (value.roomId === undefined || typeof value.roomId === "string") &&
    typeof value.updatedAt === "string"
  );
}

function isSameMovementSnapshot(left: VirtualOfficeRealtimeMovePayload, right: VirtualOfficeRealtimeMovePayload) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.direction === right.direction &&
    left.isMoving === right.isMoving &&
    left.status === right.status &&
    left.roomId === right.roomId
  );
}

function isDirection(value: unknown) {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function isStatus(value: unknown) {
  return (
    value === "available" ||
    value === "busy" ||
    value === "focus" ||
    value === "idle" ||
    value === "break" ||
    value === "offline" ||
    value === "on_call"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

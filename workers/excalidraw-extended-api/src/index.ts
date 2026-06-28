import { Hono } from "hono";

import {
  corsMiddleware,
  getBearerToken,
  getRequestId,
  jsonError,
  parseJsonBody,
} from "./http";
import { hashAccessToken } from "./crypto";
import { RoomService } from "./roomService";
import { ApiError } from "./types";

import type {
  Env,
  SaveSnapshotRequest,
  UpdateRoomConfigRequest,
} from "./types";
import type { Context } from "hono";

type AppContext = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

app.use("*", corsMiddleware);

app.get("/health", (c) => c.json({ ok: true }));

app.post("/api/rooms", async (c) => {
  const requestId = getRequestId(c);

  try {
    const limiter = c.env.ROOM_CREATE_LIMITER;
    if (limiter) {
      const ip = c.req.header("CF-Connecting-IP") || "unknown";
      const outcome = await limiter.limit({ key: `create:${ip}` });
      if (!outcome.success) {
        throw new ApiError(429, "rate_limited", "Too many room creations.", {
          retryAfterSeconds: Math.max(1, outcome.reset),
        });
      }
    }

    const response = await new RoomService(c.env).createRoom();
    return c.json(response, 201);
  } catch (error) {
    return handleError(c, error, requestId);
  }
});

app.get("/api/rooms/:roomId/snapshot", async (c) => {
  const requestId = getRequestId(c);

  try {
    const roomId = c.req.param("roomId");
    const token = getBearerToken(c);
    await limitRoomAccess(c, "read", roomId, token);

    const response = await new RoomService(c.env).getSnapshot(roomId, token);
    return c.json(response);
  } catch (error) {
    return handleError(c, error, requestId);
  }
});

app.put("/api/rooms/:roomId/snapshot", async (c) => {
  const requestId = getRequestId(c);

  try {
    const roomId = c.req.param("roomId");
    const token = getBearerToken(c);
    await limitRoomAccess(c, "write", roomId, token);
    const request = await parseJsonBody<SaveSnapshotRequest>(c);

    const response = await new RoomService(c.env).updateSnapshot(
      roomId,
      token,
      request,
    );
    return c.json(response);
  } catch (error) {
    return handleError(c, error, requestId);
  }
});

app.put("/api/rooms/:roomId/config", async (c) => {
  const requestId = getRequestId(c);

  try {
    const roomId = c.req.param("roomId");
    const token = getBearerToken(c);
    await limitRoomAccess(c, "write", roomId, token);
    const request = await parseJsonBody<UpdateRoomConfigRequest>(c, 4096);

    const response = await new RoomService(c.env).updateConfig(
      roomId,
      token,
      request,
    );
    return c.json(response);
  } catch (error) {
    return handleError(c, error, requestId);
  }
});

app.notFound((c) =>
  c.json(
    {
      error: "room_not_found",
      message: "Route was not found.",
      requestId: getRequestId(c),
    },
    404,
  ),
);

const limitRoomAccess = async (
  c: AppContext,
  operation: "read" | "write",
  roomId: string,
  token: string,
) => {
  const limiter =
    operation === "read" ? c.env.ROOM_READ_LIMITER : c.env.ROOM_WRITE_LIMITER;

  if (!limiter) {
    return;
  }

  const tokenHash = await hashAccessToken(token, c.env.TOKEN_HASH_PEPPER);
  const outcome = await limiter.limit({
    key: `${operation}:${roomId}:${tokenHash}`,
  });

  if (!outcome.success) {
    throw new ApiError(429, "rate_limited", "Too many room requests.", {
      retryAfterSeconds: Math.max(1, outcome.reset),
    });
  }
};

const handleError = (c: AppContext, error: unknown, requestId: string) => {
  if (error instanceof ApiError) {
    return jsonError(c, error, requestId);
  }

  console.error(
    JSON.stringify({
      requestId,
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );

  return jsonError(
    c,
    new ApiError(500, "internal_error", "Internal server error."),
    requestId,
  );
};

export default app;

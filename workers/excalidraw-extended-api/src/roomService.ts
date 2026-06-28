import {
  generateAccessToken,
  generateRoomId,
  hashAccessToken,
  timingSafeEqual,
} from "./crypto";
import { ApiError } from "./types";

import type {
  CreateRoomResponse,
  Env,
  PersistedRoomAggregateV1,
  RoomConfig,
  RoomSnapshotEnvelope,
  SaveSnapshotRequest,
  SnapshotResponse,
  UpdateRoomConfigRequest,
} from "./types";

const KV_KEY_PREFIX = "room:";
const MIN_WRITE_SPACING_MS = 5000;
const MAX_ROOM_NAME_CODE_POINTS = 120;
const HASH_PATTERN = /^sha256:[A-Za-z0-9+/=_:-]+$/;

const nowIso = () => new Date().toISOString();

const getRoomKey = (roomId: string) => `${KV_KEY_PREFIX}${roomId}`;

const emptySnapshot = (): RoomSnapshotEnvelope => ({
  version: 1,
  encoding: "json",
  encryption: "none",
  payload: {
    elements: [],
    appState: {},
    files: {},
  },
});

const toSnapshotResponse = (
  room: PersistedRoomAggregateV1,
): SnapshotResponse => ({
  revision: room.revision,
  contentHash: room.contentHash,
  updatedAt: room.updatedAt,
  envelope: room.snapshot,
});

const validateRoomId = (roomId: string) => {
  if (!/^room_[A-Za-z0-9_-]{16,80}$/.test(roomId)) {
    throw new ApiError(400, "invalid_request", "Invalid room id.");
  }
};

const validateContentHash = (contentHash: string) => {
  if (!HASH_PATTERN.test(contentHash)) {
    throw new ApiError(400, "invalid_request", "Invalid content hash.");
  }
};

const validateSnapshot = (snapshot: RoomSnapshotEnvelope) => {
  if (
    !snapshot ||
    snapshot.version !== 1 ||
    snapshot.encoding !== "json" ||
    snapshot.encryption !== "none"
  ) {
    throw new ApiError(
      400,
      "unsupported_version",
      "Unsupported snapshot envelope.",
    );
  }

  if (
    !snapshot.payload ||
    !Array.isArray(snapshot.payload.elements) ||
    typeof snapshot.payload.files !== "object" ||
    snapshot.payload.files === null
  ) {
    throw new ApiError(400, "invalid_request", "Invalid snapshot payload.");
  }
};

const normalizeRoomName = (name: UpdateRoomConfigRequest["name"]) => {
  if (name === null) {
    return null;
  }

  if (typeof name !== "string") {
    throw new ApiError(400, "invalid_request", "Room name must be a string.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  return [...trimmed].slice(0, MAX_ROOM_NAME_CODE_POINTS).join("");
};

export class RoomService {
  constructor(private readonly env: Env) {}

  async createRoom(): Promise<CreateRoomResponse> {
    const roomId = generateRoomId();
    const storageAccessToken = generateAccessToken();
    const tokenHash = await hashAccessToken(
      storageAccessToken,
      this.env.TOKEN_HASH_PEPPER,
    );
    const timestamp = nowIso();
    const snapshot = emptySnapshot();
    const contentHash = "sha256:empty";
    const config: RoomConfig = { name: null, updatedAt: timestamp };

    const room: PersistedRoomAggregateV1 = {
      recordVersion: 1,
      roomId,
      tokenHash,
      config,
      revision: 1,
      contentHash,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastWriteAt: timestamp,
      snapshot,
    };

    await this.env.PERSISTENCE_KV.put(getRoomKey(roomId), JSON.stringify(room));

    return {
      roomId,
      storageAccessToken,
      config,
      snapshot: toSnapshotResponse(room),
    };
  }

  async getSnapshot(
    roomId: string,
    storageAccessToken: string,
  ): Promise<{
    roomId: string;
    config: RoomConfig;
    snapshot: SnapshotResponse;
  }> {
    const room = await this.getAuthorizedRoom(roomId, storageAccessToken);
    return {
      roomId: room.roomId,
      config: room.config,
      snapshot: toSnapshotResponse(room),
    };
  }

  async updateSnapshot(
    roomId: string,
    storageAccessToken: string,
    request: SaveSnapshotRequest,
  ): Promise<{
    roomId: string;
    config: RoomConfig;
    snapshot: SnapshotResponse;
  }> {
    const room = await this.getAuthorizedRoom(roomId, storageAccessToken);

    if (typeof request.baseRevision !== "number") {
      throw new ApiError(400, "invalid_request", "baseRevision is required.");
    }
    validateContentHash(request.contentHash);
    validateSnapshot(request.snapshot);

    if (request.contentHash === room.contentHash) {
      return {
        roomId: room.roomId,
        config: room.config,
        snapshot: toSnapshotResponse(room),
      };
    }

    if (room.revision !== request.baseRevision && request.force !== true) {
      throw new ApiError(409, "conflict", "Snapshot revision conflict.", {
        currentRevision: room.revision,
        currentContentHash: room.contentHash,
      });
    }

    const elapsedMs = Date.now() - Date.parse(room.lastWriteAt);
    if (
      room.revision > 1 &&
      elapsedMs >= 0 &&
      elapsedMs < MIN_WRITE_SPACING_MS
    ) {
      throw new ApiError(
        429,
        "rate_limited",
        "Room was saved too recently. Try again shortly.",
        {
          retryAfterSeconds: Math.ceil(
            (MIN_WRITE_SPACING_MS - elapsedMs) / 1000,
          ),
        },
      );
    }

    const timestamp = nowIso();
    const nextRoom: PersistedRoomAggregateV1 = {
      ...room,
      revision: room.revision + 1,
      contentHash: request.contentHash,
      updatedAt: timestamp,
      lastWriteAt: timestamp,
      snapshot: request.snapshot,
    };

    await this.env.PERSISTENCE_KV.put(
      getRoomKey(roomId),
      JSON.stringify(nextRoom),
    );

    return {
      roomId: nextRoom.roomId,
      config: nextRoom.config,
      snapshot: toSnapshotResponse(nextRoom),
    };
  }

  async updateConfig(
    roomId: string,
    storageAccessToken: string,
    request: UpdateRoomConfigRequest,
  ): Promise<{ roomId: string; config: RoomConfig }> {
    const room = await this.getAuthorizedRoom(roomId, storageAccessToken);
    const timestamp = nowIso();
    const nextRoom: PersistedRoomAggregateV1 = {
      ...room,
      config: {
        name: normalizeRoomName(request.name),
        updatedAt: timestamp,
      },
    };

    await this.env.PERSISTENCE_KV.put(
      getRoomKey(roomId),
      JSON.stringify(nextRoom),
    );

    return { roomId: nextRoom.roomId, config: nextRoom.config };
  }

  private async getAuthorizedRoom(
    roomId: string,
    storageAccessToken: string,
  ): Promise<PersistedRoomAggregateV1> {
    validateRoomId(roomId);

    const room = await this.getRoom(roomId);
    const tokenHash = await hashAccessToken(
      storageAccessToken,
      this.env.TOKEN_HASH_PEPPER,
    );

    if (!timingSafeEqual(room.tokenHash, tokenHash)) {
      throw new ApiError(403, "invalid_token", "Invalid room access token.");
    }

    return room;
  }

  private async getRoom(roomId: string): Promise<PersistedRoomAggregateV1> {
    const room = await this.env.PERSISTENCE_KV.get<PersistedRoomAggregateV1>(
      getRoomKey(roomId),
      "json",
    );

    if (!room) {
      throw new ApiError(404, "room_not_found", "Room was not found.");
    }

    if (
      room.recordVersion !== 1 ||
      room.roomId !== roomId ||
      !room.config ||
      room.snapshot?.version !== 1
    ) {
      throw new ApiError(
        400,
        "unsupported_version",
        "Unsupported persisted room record.",
      );
    }

    return room;
  }
}

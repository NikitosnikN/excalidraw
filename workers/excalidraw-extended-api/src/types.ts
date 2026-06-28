export type RoomConfig = {
  name: string | null;
  updatedAt: string;
};

export type ExcalidrawSceneSnapshot = {
  elements: readonly unknown[];
  appState: Record<string, unknown> | null;
  files: Record<string, unknown>;
};

export type RoomSnapshotEnvelope = {
  version: 1;
  encoding: "json";
  encryption: "none";
  payload: ExcalidrawSceneSnapshot;
};

export type SnapshotVersion = {
  revision: number;
  contentHash: string;
  updatedAt: string;
};

export type SnapshotResponse = SnapshotVersion & {
  envelope: RoomSnapshotEnvelope;
};

export type CreateRoomResponse = {
  roomId: string;
  storageAccessToken: string;
  config: RoomConfig;
  snapshot: SnapshotResponse;
};

export type PersistedRoomAggregateV1 = {
  recordVersion: 1;
  roomId: string;
  tokenHash: string;
  config: RoomConfig;
  revision: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  lastWriteAt: string;
  snapshot: RoomSnapshotEnvelope;
};

export type SaveSnapshotRequest = {
  baseRevision: number;
  force?: boolean;
  contentHash: string;
  snapshot: RoomSnapshotEnvelope;
};

export type UpdateRoomConfigRequest = {
  name: string | null;
};

export type ApiErrorCode =
  | "invalid_request"
  | "missing_token"
  | "invalid_token"
  | "room_not_found"
  | "conflict"
  | "payload_too_large"
  | "rate_limited"
  | "unsupported_version"
  | "internal_error";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;
  readonly currentRevision?: number;
  readonly currentContentHash?: string;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: {
      retryAfterSeconds?: number;
      currentRevision?: number;
      currentContentHash?: string;
    },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = details?.retryAfterSeconds;
    this.currentRevision = details?.currentRevision;
    this.currentContentHash = details?.currentContentHash;
  }
}

export type RateLimitBinding = {
  limit(options: { key: string }): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

export type Env = {
  PERSISTENCE_KV: KVNamespace;
  TOKEN_HASH_PEPPER: string;
  ALLOWED_ORIGINS?: string;
  ROOM_CREATE_LIMITER?: RateLimitBinding;
  ROOM_READ_LIMITER?: RateLimitBinding;
  ROOM_WRITE_LIMITER?: RateLimitBinding;
};

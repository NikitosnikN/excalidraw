import type {
  CreateRoomResponse,
  RoomSnapshotEnvelope,
  RoomSnapshotLoadResponse,
} from "./types";

const DEFAULT_API_URL = "https://api-draw.nikitayugov.com";

const getApiUrl = () =>
  (import.meta.env.VITE_APP_PERSISTENCE_API_URL || DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );

type ApiErrorResponse = {
  error: string;
  message?: string;
  currentRevision?: number;
  currentContentHash?: string;
};

export class PersistentRoomApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly currentRevision?: number;
  readonly currentContentHash?: string;

  constructor(status: number, body: ApiErrorResponse) {
    super(body.message || body.error || "Persistent room request failed");
    this.status = status;
    this.code = body.error;
    this.currentRevision = body.currentRevision;
    this.currentContentHash = body.currentContentHash;
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as ApiErrorResponse;

  if (!response.ok) {
    throw new PersistentRoomApiError(response.status, body);
  }

  return body as T;
};

const request = async <T>(
  path: string,
  opts: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {},
) => {
  const headers = new Headers();
  if (opts.token) {
    headers.set("Authorization", `Bearer ${opts.token}`);
  }
  if (opts.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  return parseResponse<T>(
    await fetch(`${getApiUrl()}${path}`, {
      method: opts.method || "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
};

export const createPersistentRoom = () =>
  request<CreateRoomResponse>("/api/rooms", { method: "POST" });

export const getPersistentRoomSnapshot = (roomId: string, token: string) =>
  request<RoomSnapshotLoadResponse>(`/api/rooms/${roomId}/snapshot`, {
    token,
  });

export const savePersistentRoomSnapshot = (
  roomId: string,
  token: string,
  requestBody: {
    baseRevision: number;
    force: boolean;
    contentHash: string;
    snapshot: RoomSnapshotEnvelope;
  },
) =>
  request<RoomSnapshotLoadResponse>(`/api/rooms/${roomId}/snapshot`, {
    method: "PUT",
    token,
    body: requestBody,
  });

export const updatePersistentRoomConfig = (
  roomId: string,
  token: string,
  requestBody: { name: string | null },
) =>
  request<{
    roomId: string;
    config: { name: string | null; updatedAt: string };
  }>(`/api/rooms/${roomId}/config`, {
    method: "PUT",
    token,
    body: requestBody,
  });

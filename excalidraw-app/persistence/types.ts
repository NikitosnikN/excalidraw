import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

export type RoomConfig = {
  name: string | null;
  updatedAt: string;
};

export type ExcalidrawSceneSnapshot = {
  elements: readonly OrderedExcalidrawElement[];
  appState: Partial<AppState> | null;
  files: BinaryFiles;
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

export type RoomSnapshotLoadResponse = {
  roomId: string;
  config: RoomConfig;
  snapshot: SnapshotResponse;
};

export type PersistentRoomSession = {
  roomId: string;
  storageAccessToken: string;
  config: RoomConfig;
  revision: number;
  contentHash: string;
  updatedAt: string;
};

export type PersistentRoomBootstrap = {
  session: PersistentRoomSession | null;
  scene: ExcalidrawInitialDataState | null;
};

export type PersistentRoomRegistry = {
  version: 1;
  rooms: Record<
    string,
    {
      storageAccessToken: string;
      lastOpenedAt: string;
      roomName?: string;
      lastKnownRevision?: number;
      lastKnownContentHash?: string;
    }
  >;
};

export type SaveSnapshotResult =
  | {
      ok: true;
      session: PersistentRoomSession;
    }
  | {
      ok: false;
      reason: "conflict";
      currentRevision: number;
      currentContentHash: string;
    };

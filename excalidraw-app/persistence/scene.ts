import { clearAppStateForDatabase } from "@excalidraw/excalidraw/appState";

import {
  createPersistentRoom,
  getPersistentRoomSnapshot,
  PersistentRoomApiError,
} from "./client";
import {
  getPersistentRoomAccessToken,
  savePersistentRoomSession,
} from "./registry";

import type {
  CreateRoomResponse,
  ExcalidrawSceneSnapshot,
  PersistentRoomBootstrap,
  PersistentRoomSession,
  RoomSnapshotLoadResponse,
} from "./types";

const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const hashSnapshot = async (snapshot: ExcalidrawSceneSnapshot) => {
  const data = textEncoder.encode(JSON.stringify(snapshot));
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return `sha256:${toHex(new Uint8Array(digest))}`;
};

export const toSnapshotPayload = (
  elements: ExcalidrawSceneSnapshot["elements"],
  appState: ExcalidrawSceneSnapshot["appState"],
  files: ExcalidrawSceneSnapshot["files"],
): ExcalidrawSceneSnapshot => ({
  elements,
  appState: appState ? clearAppStateForDatabase(appState) : {},
  files,
});

export const getPersistentRoomIdFromLocation = () => {
  const match = window.location.pathname.match(/^\/r\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

export const isPersistentRoomRootPath = () =>
  window.location.pathname === "/" &&
  !window.location.search &&
  !window.location.hash;

const getAccessKeyFromHash = () => {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return params.get("accessKey");
};

const clearAccessKeyFromHash = () => {
  if (getAccessKeyFromHash()) {
    window.history.replaceState(
      {},
      document.title,
      `${window.location.origin}${window.location.pathname}`,
    );
  }
};

const sessionFromCreate = (
  response: CreateRoomResponse,
): PersistentRoomSession => ({
  roomId: response.roomId,
  storageAccessToken: response.storageAccessToken,
  config: response.config,
  revision: response.snapshot.revision,
  contentHash: response.snapshot.contentHash,
  updatedAt: response.snapshot.updatedAt,
});

const sessionFromLoad = (
  response: RoomSnapshotLoadResponse,
  storageAccessToken: string,
): PersistentRoomSession => ({
  roomId: response.roomId,
  storageAccessToken,
  config: response.config,
  revision: response.snapshot.revision,
  contentHash: response.snapshot.contentHash,
  updatedAt: response.snapshot.updatedAt,
});

const bootstrapFromResponse = (
  response: RoomSnapshotLoadResponse,
  storageAccessToken: string,
): PersistentRoomBootstrap => {
  const session = sessionFromLoad(response, storageAccessToken);
  savePersistentRoomSession(session);

  return {
    session,
    scene: {
      ...response.snapshot.envelope.payload,
      appState: {
        ...response.snapshot.envelope.payload.appState,
        name: response.config.name,
      },
    },
  };
};

export const bootstrapPersistentRoom =
  async (): Promise<PersistentRoomBootstrap | null> => {
    if (isPersistentRoomRootPath()) {
      const response = await createPersistentRoom();
      const session = sessionFromCreate(response);
      savePersistentRoomSession(session);
      window.history.replaceState(
        {},
        document.title,
        `${window.location.origin}/r/${encodeURIComponent(response.roomId)}`,
      );

      return {
        session,
        scene: {
          ...response.snapshot.envelope.payload,
          appState: {
            ...response.snapshot.envelope.payload.appState,
            name: response.config.name,
          },
        },
      };
    }

    const roomId = getPersistentRoomIdFromLocation();
    if (!roomId) {
      return null;
    }

    const accessKey = getAccessKeyFromHash();
    let storageAccessToken = getPersistentRoomAccessToken(roomId);

    if (!storageAccessToken && accessKey) {
      const confirmed = window.confirm(
        "Import access to this room on this device?\n\nAnyone using this browser profile will be able to open and edit this room.",
      );
      if (!confirmed) {
        clearAccessKeyFromHash();
        return {
          session: null,
          scene: {
            appState: {
              errorMessage: "Room access was not imported on this device.",
            },
          },
        };
      }
      storageAccessToken = accessKey;
    }

    if (!storageAccessToken) {
      return {
        session: null,
        scene: {
          appState: {
            errorMessage:
              "This persistent room needs an access key. Open a private access link or import the key from another device.",
          },
        },
      };
    }

    try {
      const response = await getPersistentRoomSnapshot(
        roomId,
        storageAccessToken,
      );
      clearAccessKeyFromHash();
      return bootstrapFromResponse(response, storageAccessToken);
    } catch (error) {
      if (error instanceof PersistentRoomApiError && error.status === 403) {
        return {
          session: null,
          scene: {
            appState: {
              errorMessage: "The stored access key for this room is invalid.",
            },
          },
        };
      }
      throw error;
    }
  };

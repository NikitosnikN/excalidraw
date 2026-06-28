import { STORAGE_KEYS } from "../app_constants";

import type { PersistentRoomRegistry, PersistentRoomSession } from "./types";

const REGISTRY_KEY = `${STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS}:persistentRooms`;

const emptyRegistry = (): PersistentRoomRegistry => ({
  version: 1,
  rooms: {},
});

export const readPersistentRoomRegistry = (): PersistentRoomRegistry => {
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    if (!raw) {
      return emptyRegistry();
    }

    const parsed = JSON.parse(raw) as PersistentRoomRegistry;
    if (parsed.version !== 1 || !parsed.rooms) {
      return emptyRegistry();
    }

    return parsed;
  } catch (error) {
    console.warn("Failed to read persistent room registry", error);
    return emptyRegistry();
  }
};

export const getPersistentRoomAccessToken = (roomId: string) => {
  return readPersistentRoomRegistry().rooms[roomId]?.storageAccessToken || null;
};

export const savePersistentRoomSession = (session: PersistentRoomSession) => {
  try {
    const registry = readPersistentRoomRegistry();
    registry.rooms[session.roomId] = {
      storageAccessToken: session.storageAccessToken,
      lastOpenedAt: new Date().toISOString(),
      roomName: session.config.name || undefined,
      lastKnownRevision: session.revision,
      lastKnownContentHash: session.contentHash,
    };
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch (error) {
    console.warn("Failed to save persistent room registry", error);
  }
};

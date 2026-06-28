import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PersistentRoomApiError,
  savePersistentRoomSnapshot,
  updatePersistentRoomConfig,
} from "./client";
import { savePersistentRoomSession } from "./registry";
import { hashSnapshot, toSnapshotPayload } from "./scene";

import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { PersistentRoomSession, RoomSnapshotEnvelope } from "./types";

const AUTOSAVE_DELAY_MS = 60_000;

type SaveStatus =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

type LatestScene = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const sessionFromSaveResponse = (
  response: Awaited<ReturnType<typeof savePersistentRoomSnapshot>>,
  storageAccessToken: string,
): PersistentRoomSession => ({
  roomId: response.roomId,
  storageAccessToken,
  config: response.config,
  revision: response.snapshot.revision,
  contentHash: response.snapshot.contentHash,
  updatedAt: response.snapshot.updatedAt,
});

export const usePersistentRoom = ({
  excalidrawAPI,
  session,
  setSession,
  setErrorMessage,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  session: PersistentRoomSession | null;
  setSession: (session: PersistentRoomSession | null) => void;
  setErrorMessage: (message: string) => void;
}) => {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [roomName, setRoomName] = useState(session?.config.name || "");
  const latestSceneRef = useRef<LatestScene | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const sceneHashCheckRef = useRef(0);
  const sessionRef = useRef(session);

  useEffect(() => {
    sessionRef.current = session;
    setRoomName(session?.config.name || "");
  }, [session]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    },
    [],
  );

  const updateSession = useCallback(
    (nextSession: PersistentRoomSession) => {
      sessionRef.current = nextSession;
      savePersistentRoomSession(nextSession);
      setSession(nextSession);
    },
    [setSession],
  );

  const saveLatestScene = useCallback(
    async (opts: { force: boolean; source: "autosave" | "manual" }) => {
      const activeSession = sessionRef.current;
      const latestScene = latestSceneRef.current;

      if (!activeSession || !latestScene) {
        return;
      }

      const snapshotPayload = toSnapshotPayload(
        latestScene.elements,
        latestScene.appState,
        latestScene.files,
      );
      const contentHash = await hashSnapshot(snapshotPayload);

      if (contentHash === activeSession.contentHash) {
        setStatus("saved");
        return;
      }

      const envelope: RoomSnapshotEnvelope = {
        version: 1,
        encoding: "json",
        encryption: "none",
        payload: snapshotPayload,
      };

      setStatus("saving");

      try {
        const response = await savePersistentRoomSnapshot(
          activeSession.roomId,
          activeSession.storageAccessToken,
          {
            baseRevision: activeSession.revision,
            force: opts.force,
            contentHash,
            snapshot: envelope,
          },
        );
        updateSession(
          sessionFromSaveResponse(response, activeSession.storageAccessToken),
        );
        sceneHashCheckRef.current += 1;
        setStatus("saved");
      } catch (error) {
        if (
          error instanceof PersistentRoomApiError &&
          error.code === "conflict"
        ) {
          setStatus("conflict");

          if (
            opts.source === "manual" &&
            window.confirm(
              "The cloud room has a newer revision. Overwrite it with the current canvas?",
            )
          ) {
            const conflictSession: PersistentRoomSession = {
              ...activeSession,
              revision:
                error.currentRevision === undefined
                  ? activeSession.revision
                  : error.currentRevision,
              contentHash:
                error.currentContentHash || activeSession.contentHash,
            };
            updateSession(conflictSession);
            await saveLatestScene({ force: true, source: "manual" });
          }
          return;
        }

        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [setErrorMessage, updateSession],
  );

  const scheduleAutosave = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      if (!sessionRef.current) {
        return;
      }

      latestSceneRef.current = { elements, appState, files };
      const hashCheckId = sceneHashCheckRef.current + 1;
      sceneHashCheckRef.current = hashCheckId;

      void (async () => {
        const snapshotPayload = toSnapshotPayload(elements, appState, files);
        const contentHash = await hashSnapshot(snapshotPayload);

        if (hashCheckId !== sceneHashCheckRef.current) {
          return;
        }

        const activeSession = sessionRef.current;
        if (!activeSession) {
          return;
        }

        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }

        if (contentHash === activeSession.contentHash) {
          setStatus((currentStatus) =>
            currentStatus === "saving" ? currentStatus : "saved",
          );
          return;
        }

        setStatus((currentStatus) =>
          currentStatus === "saving" ? currentStatus : "pending",
        );

        autosaveTimerRef.current = window.setTimeout(() => {
          void saveLatestScene({ force: false, source: "autosave" });
        }, AUTOSAVE_DELAY_MS);
      })().catch((error) => {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
      });
    },
    [saveLatestScene, setErrorMessage],
  );

  const manualSave = useCallback(async () => {
    if (!excalidrawAPI || !sessionRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    latestSceneRef.current = {
      elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    };
    await saveLatestScene({ force: false, source: "manual" });
  }, [excalidrawAPI, saveLatestScene]);

  const copyPrivateAccessLink = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }

    await copyTextToSystemClipboard(
      `${window.location.origin}/r/${encodeURIComponent(
        activeSession.roomId,
      )}#accessKey=${encodeURIComponent(activeSession.storageAccessToken)}`,
    );
    excalidrawAPI?.setToast({ message: "Private access link copied" });
  }, [excalidrawAPI]);

  const saveRoomName = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) {
      return;
    }

    const normalizedName = roomName.trim() || null;
    const response = await updatePersistentRoomConfig(
      activeSession.roomId,
      activeSession.storageAccessToken,
      {
        name: normalizedName,
      },
    );

    const nextSession = {
      ...activeSession,
      config: response.config,
    };
    updateSession(nextSession);
    excalidrawAPI?.updateScene({
      appState: { name: response.config.name },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [excalidrawAPI, roomName, updateSession]);

  return {
    isEnabled: !!session,
    status,
    roomName,
    setRoomName,
    scheduleAutosave,
    manualSave,
    copyPrivateAccessLink,
    saveRoomName,
  };
};

import { useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import type { usePersistentRoom } from "./usePersistentRoom";

import "./PersistentRoomControls.scss";

type PersistentRoomController = ReturnType<typeof usePersistentRoom>;

export const PersistentRoomControls = ({
  controller,
}: {
  controller: PersistentRoomController;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!controller.isEnabled) {
    return null;
  }

  return (
    <>
      <FilledButton
        className="persistent-room-controls__trigger"
        label="Room"
        variant="outlined"
        onClick={() => setIsOpen(true)}
      >
        <span>Room</span>
        <span
          className={`persistent-room-controls__dot persistent-room-controls__dot--${controller.status}`}
          aria-hidden
        />
      </FilledButton>

      {isOpen && (
        <Dialog
          size="small"
          title="Persistent room"
          onCloseRequest={() => setIsOpen(false)}
        >
          <div className="persistent-room-controls">
            <label className="persistent-room-controls__field">
              <span>Room name</span>
              <input
                aria-label="Room name"
                className="persistent-room-controls__name"
                value={controller.roomName}
                placeholder="Untitled room"
                maxLength={120}
                onChange={(event) => controller.setRoomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void controller.saveRoomName();
                  }
                }}
              />
            </label>

            <div className="persistent-room-controls__status-row">
              <span>Status</span>
              <strong aria-live="polite" title="Persistent room save status">
                {controller.status === "pending" && "Unsaved"}
                {controller.status === "saving" && "Saving..."}
                {controller.status === "saved" && "Saved"}
                {controller.status === "conflict" && "Conflict"}
                {controller.status === "error" && "Save failed"}
                {controller.status === "idle" && "Ready"}
              </strong>
            </div>

            <div className="persistent-room-controls__actions">
              <FilledButton
                label="Save scene"
                onClick={() => {
                  void controller.manualSave();
                }}
              />
              <FilledButton
                label="Save name"
                variant="outlined"
                onClick={() => {
                  void controller.saveRoomName();
                }}
              />
              <FilledButton
                label="Copy private access link"
                variant="outlined"
                onClick={() => {
                  void controller.copyPrivateAccessLink();
                }}
              />
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
};

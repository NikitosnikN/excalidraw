import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";

import type { usePersistentRoom } from "./usePersistentRoom";

import "./PersistentRoomControls.scss";

type PersistentRoomController = ReturnType<typeof usePersistentRoom>;

export const PersistentRoomControls = ({
  controller,
}: {
  controller: PersistentRoomController;
}) => {
  if (!controller.isEnabled) {
    return null;
  }

  return (
    <div className="persistent-room-controls">
      <input
        aria-label="Room name"
        className="persistent-room-controls__name"
        value={controller.roomName}
        placeholder="Untitled room"
        maxLength={120}
        onChange={(event) => controller.setRoomName(event.target.value)}
        onBlur={() => {
          void controller.saveRoomName();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      <span
        className="persistent-room-controls__status"
        aria-live="polite"
        title="Persistent room save status"
      >
        {controller.status === "pending" && "Unsaved"}
        {controller.status === "saving" && "Saving..."}
        {controller.status === "saved" && "Saved"}
        {controller.status === "conflict" && "Conflict"}
        {controller.status === "error" && "Save failed"}
        {controller.status === "idle" && "Ready"}
      </span>
      <FilledButton
        label="Save"
        variant="outlined"
        onClick={() => {
          void controller.manualSave();
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
  );
};

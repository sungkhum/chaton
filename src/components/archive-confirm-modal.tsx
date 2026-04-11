import { createPortal } from "react-dom";
import { Archive, LogOut } from "lucide-react";
import { useEffect } from "react";

interface ArchiveConfirmModalProps {
  /** "dm" for DM archive, "group" for leaving a group chat */
  type: "dm" | "group";
  /** Display name of the conversation (username or group name) */
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArchiveConfirmModal({
  type,
  name,
  onConfirm,
  onCancel,
}: ArchiveConfirmModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const isGroup = type === "group";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 z-[60] modal-backdrop-enter"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-[#0a1220] text-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-white/8 modal-card-enter overflow-hidden">
          {/* Accent bar */}
          {isGroup ? (
            <div className="h-0.5 bg-gradient-to-r from-red-500/80 via-red-400/60 to-red-500/30" />
          ) : (
            <div className="h-0.5 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]" />
          )}

          <div className="p-6 flex flex-col gap-4">
            {/* Icon + Title */}
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isGroup
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-[#34F080]/10 border border-[#34F080]/20"
                }`}
              >
                {isGroup ? (
                  <LogOut className="w-5 h-5 text-red-400" />
                ) : (
                  <Archive className="w-5 h-5 text-[#34F080]" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-white">
                  {isGroup ? "Leave group?" : "Archive chat?"}
                </h3>
                <p className="text-[13px] text-gray-400 mt-1 leading-relaxed">
                  {isGroup ? (
                    <>
                      Other members will see that you left{" "}
                      <span className="text-gray-300 font-medium">{name}</span>.
                      You can rejoin later from Archived Chats.
                    </>
                  ) : (
                    <>
                      Your conversation with{" "}
                      <span className="text-gray-300 font-medium">{name}</span>{" "}
                      will move to Archived Chats.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                onClick={onCancel}
                className="rounded-full py-2 px-4 glass-btn-secondary text-sm text-gray-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`rounded-full py-2 px-4 text-sm font-semibold cursor-pointer ${
                  isGroup
                    ? "glass-btn-danger text-red-400"
                    : "glass-btn-primary text-[#34F080]"
                }`}
              >
                {isGroup ? "Leave" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

import { CheckCircle2, Clock, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface JoinConfirmationInfo {
  groupName: string;
  groupImageUrl?: string;
  status: "submitted" | "pending";
}

export function JoinConfirmationModal() {
  const [info, setInfo] = useState<JoinConfirmationInfo | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Hydrate from sessionStorage on mount (set by join-group-page before redirect)
  useEffect(() => {
    const raw = sessionStorage.getItem("pendingJoinConfirmation");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      // Validate shape before trusting sessionStorage data
      if (
        typeof parsed?.groupName === "string" &&
        (parsed.status === "submitted" || parsed.status === "pending") &&
        (!parsed.groupImageUrl || typeof parsed.groupImageUrl === "string")
      ) {
        setInfo(parsed);
      } else {
        sessionStorage.removeItem("pendingJoinConfirmation");
      }
    } catch {
      sessionStorage.removeItem("pendingJoinConfirmation");
    }
  }, []);

  if (!info) return null;

  const dismiss = () => {
    sessionStorage.removeItem("pendingJoinConfirmation");
    setInfo(null);
  };

  const isSubmitted = info.status === "submitted";

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[60] modal-backdrop-enter"
        onClick={dismiss}
      />
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-[#0a1220] text-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-blue-900/50 modal-card-enter">
          <div className="p-8 flex flex-col items-center gap-5">
            {/* Group avatar */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-[#1a2235] flex items-center justify-center border border-white/10 relative">
              <Users className="w-7 h-7 text-[#34F080]/60" />
              {info.groupImageUrl && (
                <img
                  src={info.groupImageUrl}
                  alt={info.groupName}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  style={{ opacity: imageLoaded ? 1 : 0 }}
                  onLoad={() => setImageLoaded(true)}
                />
              )}
            </div>

            {/* Group name */}
            <h2 className="text-lg font-bold text-white text-center break-words line-clamp-2">
              {info.groupName}
            </h2>

            {/* Status icon + message */}
            {isSubmitted ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#34F080]" />
                <p className="text-white text-sm font-semibold">
                  Request sent!
                </p>
                <p className="text-gray-400 text-xs leading-relaxed">
                  The group owner has been notified. Once they approve your
                  request, this group will appear in your chats.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Clock className="w-8 h-8 text-yellow-400/80" />
                <p className="text-gray-300 text-sm font-medium">
                  Waiting for approval
                </p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  The group owner has your request. This group will appear in
                  your chats once they approve it.
                </p>
              </div>
            )}

            {/* Dismiss button */}
            <button
              onClick={dismiss}
              className="w-full px-5 py-3 landing-btn-vivid text-white font-black rounded-xl text-sm cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

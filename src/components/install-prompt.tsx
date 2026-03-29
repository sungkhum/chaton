import { X, Download, Share, MoreVertical, Plus, Monitor } from "lucide-react";
import { useInstallPrompt, InstallType } from "../hooks/useInstallPrompt";

/* ------------------------------------------------------------------ */
/*  Inline SVGs for platform-specific icons                            */
/* ------------------------------------------------------------------ */

/** iOS Safari share icon (square with up-arrow) */
function IosShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-platform instruction content                                   */
/* ------------------------------------------------------------------ */

function NativeContent({ onInstall }: { onInstall: () => void }) {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        Install ChatOn for a faster, native-like experience with push
        notifications and offline access.
      </p>
      <button
        onClick={onInstall}
        className="w-full py-3 rounded-xl font-semibold text-black
                   bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0]
                   active:scale-[0.98] transition-transform"
      >
        <Download className="inline -mt-0.5 mr-2 h-4 w-4" />
        Install ChatOn
      </button>
    </>
  );
}

function ManualIosContent() {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        Add ChatOn to your home screen for a full-screen app experience.
      </p>
      <ol className="space-y-3 text-sm text-gray-200">
        <Step n={1}>
          Tap the <strong>Share</strong> button{" "}
          <IosShareIcon className="inline h-5 w-5 -mt-0.5 text-[#40B8E0]" />{" "}
          in the Safari toolbar
        </Step>
        <Step n={2}>
          Scroll down and tap{" "}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white text-xs font-medium">
            <Plus className="h-3 w-3" /> Add to Home Screen
          </span>
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong> in the top-right corner
        </Step>
      </ol>
    </>
  );
}

function ManualIosOtherContent() {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        To install ChatOn on your iPhone, you need to open this page in{" "}
        <strong>Safari</strong>.
      </p>
      <ol className="space-y-3 text-sm text-gray-200">
        <Step n={1}>
          Copy this URL or open <strong>Safari</strong>
        </Step>
        <Step n={2}>
          Navigate to this page in Safari
        </Step>
        <Step n={3}>
          Tap{" "}
          <IosShareIcon className="inline h-5 w-5 -mt-0.5 text-[#40B8E0]" />{" "}
          then <strong>"Add to Home Screen"</strong>
        </Step>
      </ol>
    </>
  );
}

function ManualFirefoxContent() {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        Install ChatOn for a full-screen app experience with push notifications.
      </p>
      <ol className="space-y-3 text-sm text-gray-200">
        <Step n={1}>
          Tap the menu{" "}
          <MoreVertical className="inline h-4 w-4 -mt-0.5 text-[#40B8E0]" />{" "}
          in the bottom-right corner
        </Step>
        <Step n={2}>
          Tap <strong>"Install"</strong>
        </Step>
        <Step n={3}>
          Tap <strong>Install</strong> to confirm
        </Step>
      </ol>
    </>
  );
}

function ManualSamsungContent() {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        Add ChatOn to your home screen for a full-screen app experience.
      </p>
      <ol className="space-y-3 text-sm text-gray-200">
        <Step n={1}>
          Tap the menu{" "}
          <span className="inline-flex items-center justify-center w-5 h-5 -mt-0.5 text-[#40B8E0]">
            &#9776;
          </span>{" "}
          (hamburger icon) at the bottom
        </Step>
        <Step n={2}>
          Tap{" "}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-white text-xs font-medium">
            <Plus className="h-3 w-3" /> Add page to
          </span>{" "}
          then <strong>"Home screen"</strong>
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong> to confirm
        </Step>
      </ol>
    </>
  );
}

function ManualMacosContent() {
  return (
    <>
      <p className="text-sm text-gray-300 mb-4">
        Add ChatOn to your Dock for a native app experience with push
        notifications.
      </p>
      <ol className="space-y-3 text-sm text-gray-200">
        <Step n={1}>
          Click <strong>File</strong> in the Safari menu bar (or use the{" "}
          <IosShareIcon className="inline h-4 w-4 -mt-0.5 text-[#40B8E0]" />{" "}
          Share button)
        </Step>
        <Step n={2}>
          Click <strong>"Add to Dock"</strong>
        </Step>
        <Step n={3}>
          ChatOn will appear in your Dock and Launchpad as a standalone app
        </Step>
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared step wrapper                                                */
/* ------------------------------------------------------------------ */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span
        className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10
                    flex items-center justify-center text-xs font-bold text-[#34F080]"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Content picker                                                     */
/* ------------------------------------------------------------------ */

const CONTENT: Record<
  Exclude<InstallType, "none">,
  {
    title: string;
    icon: React.ReactNode;
    Body: React.FC<{ onInstall: () => void }>;
  }
> = {
  native: {
    title: "Get the ChatOn app",
    icon: <Download className="h-5 w-5 text-[#34F080]" />,
    Body: NativeContent,
  },
  "manual-ios": {
    title: "Add ChatOn to Home Screen",
    icon: <Share className="h-5 w-5 text-[#40B8E0]" />,
    Body: ManualIosContent,
  },
  "manual-ios-other": {
    title: "Open in Safari to install",
    icon: <Share className="h-5 w-5 text-[#40B8E0]" />,
    Body: ManualIosOtherContent,
  },
  "manual-firefox": {
    title: "Install ChatOn",
    icon: <Download className="h-5 w-5 text-[#34F080]" />,
    Body: ManualFirefoxContent,
  },
  "manual-samsung": {
    title: "Add ChatOn to Home Screen",
    icon: <Download className="h-5 w-5 text-[#34F080]" />,
    Body: ManualSamsungContent,
  },
  "manual-macos": {
    title: "Add ChatOn to your Dock",
    icon: <Monitor className="h-5 w-5 text-[#40B8E0]" />,
    Body: ManualMacosContent,
  },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function InstallPrompt() {
  const { installType, triggerNativeInstall, dismiss } = useInstallPrompt();

  if (installType === "none") return null;

  const { title, icon, Body } = CONTENT[installType];

  const handleInstall = async () => {
    const outcome = await triggerNativeInstall();
    if (outcome === "dismissed") dismiss();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
                    animate-[fadeIn_200ms_ease-out]"
        onClick={dismiss}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg
                    rounded-t-2xl border border-white/10
                    bg-[#0F1520]/95 backdrop-blur-xl
                    p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]
                    shadow-[0_-8px_40px_rgba(0,0,0,0.5)]
                    animate-[slideUp_300ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src="/apple-touch-icon.png"
              alt="ChatOn"
              className="h-10 w-10 rounded-xl"
            />
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">
                {title}
              </h3>
              <span className="text-xs text-gray-500">chaton.chat</span>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400
                        transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body — platform-specific */}
        <Body onInstall={handleInstall} />

        {/* "Not now" for manual flows */}
        {installType !== "native" && (
          <button
            onClick={dismiss}
            className="w-full mt-4 py-2.5 rounded-xl text-sm text-gray-400
                        hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            Maybe later
          </button>
        )}
      </div>
    </>
  );
}

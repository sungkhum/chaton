import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSingleProfile,
  updateProfile,
  updateFollowingStatus,
  identity,
} from "deso-protocol";
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Loader2,
  Lock,
  MessageCircle,
  Share2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../../store";
import { uploadImage } from "../../services/media.service";
import { withAuth } from "../../utils/with-auth";
import { AUTO_FOLLOW_USERNAMES } from "../../utils/constants";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 3;
const SHARE_TEXT =
  "Chat with me on ChatOn — decentralized, end-to-end encrypted messaging on the blockchain. No censorship, no middlemen.";
const SHARE_URL = "https://getchaton.com";

/**
 * Check if onboarding has been completed for this user.
 */
export function isOnboardingComplete(publicKey: string): boolean {
  try {
    return localStorage.getItem(`chaton:onboarded:${publicKey}`) === "1";
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as complete for this user.
 */
export function markOnboardingComplete(publicKey: string) {
  try {
    localStorage.setItem(`chaton:onboarded:${publicKey}`, "1");
  } catch {
    // localStorage may be unavailable
  }
}

export const OnboardingWizard = ({ onComplete }: OnboardingWizardProps) => {
  const { appUser, setAppUser } = useStore(useShallow((s) => ({ appUser: s.appUser, setAppUser: s.setAppUser })));
  const [step, setStep] = useState(1);

  // Profile setup state
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Encryption + follow state
  const [setupStatus, setSetupStatus] = useState<
    "encrypting" | "following" | "done" | "error"
  >("encrypting");

  // Invite state
  const [copied, setCopied] = useState(false);

  // Detect if user already has a profile — skip step 1 if so
  const hasProfile = !!appUser?.ProfileEntryResponse;

  useEffect(() => {
    if (hasProfile) {
      setStep(2);
    }
  }, [hasProfile]);

  // ── Step 2: Run encryption check + auto-follow ──
  useEffect(() => {
    if (step !== 2 || !appUser) return;

    let cancelled = false;

    const runSetup = async () => {
      setSetupStatus("encrypting");

      // Brief pause so user sees the encryption step
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;

      setSetupStatus("following");

      // Auto-follow accounts silently
      try {
        const followPromises = AUTO_FOLLOW_USERNAMES.map(async (uname) => {
          try {
            const profileRes = await getSingleProfile({
              Username: uname,
              NoErrorOnMissing: true,
            });
            const pubKey = profileRes?.Profile?.PublicKeyBase58Check;
            if (!pubKey) return;

            await withAuth(() =>
              updateFollowingStatus({
                FollowerPublicKeyBase58Check: appUser.PublicKeyBase58Check,
                FollowedPublicKeyBase58Check: pubKey,
                IsUnfollow: false,
                MinFeeRateNanosPerKB: 1000,
              })
            );
          } catch (err: any) {
            if (err?.message?.includes("RuleErrorFollowEntryAlreadyExists"))
              return;
            console.warn(`Failed to follow @${uname}:`, err);
          }
        });

        await Promise.all(followPromises);
      } catch {
        // Non-critical — don't block onboarding
      }

      if (cancelled) return;
      setSetupStatus("done");

      await new Promise((r) => setTimeout(r, 800));
      if (cancelled) return;
      setStep(3);
    };

    runSetup();
    return () => {
      cancelled = true;
    };
  }, [step, appUser]);

  // ── Username availability check ──
  const checkUsername = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 3) {
      setUsernameStatus(trimmed.length > 0 ? "invalid" : "idle");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    try {
      const res = await getSingleProfile({
        Username: trimmed,
        NoErrorOnMissing: true,
      });
      setUsernameStatus(res?.Profile ? "taken" : "available");
    } catch {
      setUsernameStatus("available");
    }
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUsername(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkUsername(val), 400);
  };

  // ── Profile image upload ──
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setProfileImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingImage(true);
    try {
      const result = await uploadImage(file);
      setProfileImageUrl(result.ImageURL);
    } catch {
      toast.error("Failed to upload image");
      setProfileImagePreview("");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Save profile ──
  const handleSaveProfile = async () => {
    if (!appUser) return;
    const trimmedUsername = username.trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }
    if (usernameStatus !== "available") {
      toast.error("Please choose an available username");
      return;
    }

    setSavingProfile(true);
    try {
      await withAuth(() =>
        updateProfile({
          UpdaterPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          ProfilePublicKeyBase58Check: "",
          NewUsername: trimmedUsername,
          NewProfilePic: profileImageUrl || "",
          NewCreatorBasisPoints: 10000,
          NewStakeMultipleBasisPoints: 12500,
          MinFeeRateNanosPerKB: 1500,
        })
      );

      setAppUser({
        ...appUser,
        ProfileEntryResponse: {
          ...appUser.ProfileEntryResponse,
          Username: trimmedUsername,
          PublicKeyBase58Check: appUser.PublicKeyBase58Check,
        } as any,
      });

      setStep(2);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("not enough")) {
        toast.error(
          "Not enough $DESO. Complete phone verification to get free tokens.",
          {
            action: {
              label: "Verify Phone",
              onClick: () => identity.verifyPhoneNumber(),
            },
          }
        );
      } else {
        toast.error(`Failed to create profile: ${msg}`);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Share invite ──
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ChatOn",
          text: SHARE_TEXT,
          url: SHARE_URL,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${SHARE_TEXT}\n${SHARE_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    if (appUser) {
      markOnboardingComplete(appUser.PublicKeyBase58Check);
    }
    onComplete();
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="flex items-start md:items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8 md:py-0 relative">
      {/* Atmospheric orbs — matches landing page */}
      <div
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #34F080 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #40B8E0 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[460px] rounded-2xl border border-white/[0.06] p-6 sm:p-8 animate-[fadeIn_0.3s_ease-out]"
        style={{
          background:
            "linear-gradient(170deg, rgba(20,28,43,0.85) 0%, rgba(10,16,28,0.92) 100%)",
          backdropFilter: "blur(40px)",
          boxShadow:
            "0 32px 80px -12px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Top edge glow */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#34F080]/25 to-transparent" />

        {/* Logo + Progress */}
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/ChatOn-Logo-Small.png"
            alt=""
            className="w-8 h-8 rounded-lg"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">
                Step {step} of {TOTAL_STEPS}
              </span>
            </div>
            <div className="h-[3px] bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, #34F080 0%, #20E0AA 60%, #40B8E0 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div key={step} className="animate-[fadeIn_0.25s_ease-out]">
          {/* ── Step 1: Profile Setup ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[22px] sm:text-2xl font-bold text-white mb-1.5 leading-tight">
                  Set up your profile
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Choose a username and photo so friends can find you.
                </p>
              </div>

              {/* Avatar picker */}
              <div className="flex justify-center pt-1">
                <div
                  className="relative cursor-pointer group"
                  onClick={() =>
                    !uploadingImage && fileInputRef.current?.click()
                  }
                >
                  <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-full bg-white/[0.04] border-2 border-dashed border-white/15 group-hover:border-[#34F080]/40 flex items-center justify-center overflow-hidden transition-all duration-300">
                    {profileImagePreview ? (
                      <img
                        src={profileImagePreview}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-7 h-7 text-gray-600 group-hover:text-[#34F080]/70 transition-colors" />
                    )}
                  </div>
                  {uploadingImage && (
                    <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-600 text-center -mt-1">
                {profileImagePreview ? "Tap to change" : "Tap to add a photo"}
              </p>

              {/* Username input */}
              <div>
                <label
                  htmlFor="onboard-username"
                  className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    @
                  </span>
                  <input
                    id="onboard-username"
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="yourname"
                    maxLength={26}
                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#34F080]/40 focus:bg-white/[0.06] rounded-xl pl-8 pr-10 py-3.5 text-white text-[15px] outline-none transition-all"
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                    {usernameStatus === "checking" && (
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    )}
                    {usernameStatus === "available" && (
                      <Check className="w-4 h-4 text-[#34F080]" />
                    )}
                  </div>
                </div>
                <div className="mt-1.5 text-xs min-h-[1rem]" aria-live="polite">
                  {usernameStatus === "available" && (
                    <span className="text-[#34F080]">
                      Username is available
                    </span>
                  )}
                  {usernameStatus === "taken" && (
                    <span className="text-red-400">
                      Username is already taken
                    </span>
                  )}
                  {usernameStatus === "invalid" && (
                    <span className="text-yellow-400/80">
                      3+ characters: letters, numbers, underscores only
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5 pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={
                    savingProfile ||
                    usernameStatus !== "available" ||
                    uploadingImage
                  }
                  className="w-full landing-btn-vivid flex items-center justify-center gap-2 px-6 py-3.5 text-white font-bold rounded-xl text-sm cursor-pointer min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                >
                  {savingProfile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Create Profile
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="w-full text-center text-sm text-gray-600 hover:text-gray-400 transition-colors py-2 cursor-pointer"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Encryption + Auto-Follow ── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[22px] sm:text-2xl font-bold text-white mb-1.5 leading-tight">
                  Securing your account
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Setting up end-to-end encryption and connecting you with the
                  community.
                </p>
              </div>

              {/* Visual shield */}
              <div className="flex justify-center py-4">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{
                      background:
                        setupStatus === "done"
                          ? "linear-gradient(135deg, rgba(52,240,128,0.12) 0%, rgba(32,224,170,0.08) 100%)"
                          : "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
                      border: `1px solid ${setupStatus === "done" ? "rgba(52,240,128,0.2)" : "rgba(255,255,255,0.06)"}`,
                      transition: "all 0.5s ease",
                    }}
                  >
                    {setupStatus === "done" ? (
                      <Check className="w-8 h-8 text-[#34F080]" />
                    ) : (
                      <Lock className="w-8 h-8 text-gray-500" />
                    )}
                  </div>
                  {setupStatus !== "done" && (
                    <div
                      className="absolute inset-0 rounded-2xl animate-ping opacity-[0.08]"
                      style={{
                        border: "1px solid #34F080",
                        animationDuration: "2s",
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <SetupRow
                  icon={<Lock className="w-[18px] h-[18px]" />}
                  label="End-to-end encryption"
                  status={
                    setupStatus === "encrypting" ? "in-progress" : "complete"
                  }
                />
                <SetupRow
                  icon={<UserPlus className="w-[18px] h-[18px]" />}
                  label="Connecting with ChatOn community"
                  status={
                    setupStatus === "following"
                      ? "in-progress"
                      : setupStatus === "encrypting"
                        ? "pending"
                        : "complete"
                  }
                />
              </div>

              {setupStatus === "error" && (
                <div className="text-sm text-red-400 text-center">
                  Something went wrong.{" "}
                  <button
                    onClick={() => setStep(3)}
                    className="text-[#34F080] hover:underline cursor-pointer"
                  >
                    Continue anyway
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Invite Friends ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center pt-2">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(52,240,128,0.12) 0%, rgba(32,224,170,0.06) 100%)",
                    border: "1px solid rgba(52,240,128,0.15)",
                  }}
                >
                  <MessageCircle className="w-7 h-7 text-[#34F080]" />
                </div>
                <h2 className="text-[22px] sm:text-2xl font-bold text-white mb-1.5 leading-tight">
                  You're all set!
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Invite friends so you have someone to chat with.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white/[0.04] border border-white/[0.08] hover:border-[#34F080]/25 hover:bg-white/[0.06] text-white font-semibold rounded-xl transition-all text-sm cursor-pointer min-h-[48px]"
                >
                  <Share2 className="w-4 h-4" />
                  Share Invite Link
                </button>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/15 text-gray-400 font-semibold rounded-xl transition-all text-sm cursor-pointer min-h-[48px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[#34F080]" />
                      <span className="text-[#34F080]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={handleFinish}
                className="w-full landing-btn-vivid flex items-center justify-center gap-2 px-6 py-3.5 text-white font-bold rounded-xl text-sm cursor-pointer min-h-[48px]"
              >
                Start Chatting
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Setup Row ──

function SetupRow({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: "pending" | "in-progress" | "complete";
}) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all duration-300"
      style={{
        background:
          status === "complete"
            ? "rgba(52,240,128,0.04)"
            : "rgba(255,255,255,0.02)",
        border: `1px solid ${status === "complete" ? "rgba(52,240,128,0.1)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      <div
        className={`flex-shrink-0 transition-colors duration-300 ${
          status === "complete"
            ? "text-[#34F080]"
            : status === "in-progress"
              ? "text-white/70"
              : "text-gray-700"
        }`}
      >
        {icon}
      </div>
      <span
        className={`flex-1 text-[13px] font-medium transition-colors duration-300 ${
          status === "complete"
            ? "text-[#34F080]/90"
            : status === "in-progress"
              ? "text-white/80"
              : "text-gray-700"
        }`}
      >
        {label}
      </span>
      <div className="flex-shrink-0">
        {status === "in-progress" && (
          <Loader2 className="w-4 h-4 text-[#34F080]/70 animate-spin" />
        )}
        {status === "complete" && (
          <Check className="w-4 h-4 text-[#34F080]" />
        )}
        {status === "pending" && (
          <div className="w-3.5 h-3.5 rounded-full border border-gray-700/60" />
        )}
      </div>
    </div>
  );
}

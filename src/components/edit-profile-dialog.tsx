import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildProfilePictureUrl,
  getSingleProfile,
  identity,
  updateProfile,
} from "deso-protocol";
import { Camera, Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { AppUser, useStore } from "../store";
import { uploadImage } from "../services/media.service";
import { withAuth } from "../utils/with-auth";

interface EditProfileDialogProps {
  appUser: AppUser;
  onClose: () => void;
}

const MAX_BIO_LENGTH = 256;

export const EditProfileDialog = ({
  appUser,
  onClose,
}: EditProfileDialogProps) => {
  const setAppUser = useStore((s) => s.setAppUser);
  const profile = appUser.ProfileEntryResponse;

  // Form state — pre-populated from current profile
  const [username, setUsername] = useState(profile?.Username || "");
  const [bio, setBio] = useState(profile?.Description || "");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileImagePreview, setProfileImagePreview] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Username check
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid" | "unchanged"
  >(profile?.Username ? "unchanged" : "idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalUsername = useRef(profile?.Username || "");

  // Build current profile pic URL for display
  const currentPicUrl = profile?.PublicKeyBase58Check
    ? buildProfilePictureUrl(profile.PublicKeyBase58Check, {
        fallbackImageUrl: "",
      })
    : "";

  // Close on escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ── Username availability check ──
  const checkUsername = useCallback(async (name: string) => {
    const trimmed = name.trim();

    // Same as current — no check needed
    if (trimmed === originalUsername.current) {
      setUsernameStatus("unchanged");
      return;
    }

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

  // ── Check if anything changed ──
  const hasChanges =
    username.trim() !== originalUsername.current ||
    bio !== (profile?.Description || "") ||
    !!profileImageUrl;

  const canSave =
    hasChanges &&
    !saving &&
    !uploadingImage &&
    (usernameStatus === "available" || usernameStatus === "unchanged") &&
    username.trim().length >= 3;

  // ── Save profile ──
  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const trimmedUsername = username.trim();
      const isUsernameChanged = trimmedUsername !== originalUsername.current;

      await withAuth(() =>
        updateProfile({
          UpdaterPublicKeyBase58Check: appUser.PublicKeyBase58Check,
          ProfilePublicKeyBase58Check: "",
          NewUsername: isUsernameChanged ? trimmedUsername : "",
          NewDescription: bio,
          NewProfilePic: profileImageUrl || "",
          NewCreatorBasisPoints:
            profile?.CoinEntry?.CreatorBasisPoints ?? 10000,
          NewStakeMultipleBasisPoints: 12500,
          MinFeeRateNanosPerKB: 1500,
        })
      );

      // Optimistic store update
      setAppUser({
        ...appUser,
        ProfileEntryResponse: {
          ...profile,
          Username: trimmedUsername,
          Description: bio,
          PublicKeyBase58Check: appUser.PublicKeyBase58Check,
        } as any,
      });

      toast.success("Profile updated!");
      onClose();
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("not enough")) {
        toast.error("Not enough $DESO for transaction fee.", {
          action: {
            label: "Verify Phone",
            onClick: () => identity.verifyPhoneNumber(),
          },
        });
      } else {
        toast.error(`Failed to update profile: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const displayPic = profileImagePreview || currentPicUrl;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#050e1d] text-blue-100 border border-blue-900/60 w-full sm:w-[92%] max-w-[460px] rounded-t-2xl sm:rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[#34F080] via-[#20E0AA] to-[#40B8E0] shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Pencil className="w-5 h-5 text-[#34F080]" />
            <h3 className="text-lg font-bold text-white">Edit Profile</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="px-5 pb-5 overflow-y-auto">
          {/* Profile picture */}
          <div className="flex justify-center pt-2 pb-1">
            <div
              className="relative cursor-pointer group"
              onClick={() => !uploadingImage && fileInputRef.current?.click()}
            >
              <div className="w-[88px] h-[88px] sm:w-24 sm:h-24 rounded-full bg-white/[0.04] border-2 border-white/10 group-hover:border-[#34F080]/40 flex items-center justify-center overflow-hidden transition-[border-color] duration-300">
                {displayPic ? (
                  <img
                    src={displayPic}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-7 h-7 text-gray-600 group-hover:text-[#34F080]/70 transition-colors" />
                )}
              </div>
              {/* Edit overlay */}
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-[background-color] duration-200">
                {uploadingImage ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-600 text-center mb-4">
            Tap to change photo
          </p>

          {/* Username field */}
          <div className="mb-4">
            <label
              htmlFor="edit-username"
              className="block text-xs font-semibold text-gray-400 mb-2 tracking-wide uppercase"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                @
              </span>
              <input
                id="edit-username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="yourname"
                maxLength={26}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#34F080]/40 focus:bg-white/[0.06] rounded-xl pl-8 pr-10 py-3.5 text-white text-[15px] outline-none transition-[border-color,background-color]"
                autoComplete="off"
                autoCapitalize="off"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                )}
                {(usernameStatus === "available" ||
                  usernameStatus === "unchanged") &&
                  username.trim().length >= 3 && (
                    <Check className="w-4 h-4 text-[#34F080]" />
                  )}
              </div>
            </div>
            <div className="mt-1.5 text-xs min-h-[1rem]" aria-live="polite">
              {usernameStatus === "available" && (
                <span className="text-[#34F080]">Username is available</span>
              )}
              {usernameStatus === "taken" && (
                <span className="text-red-400">Username is already taken</span>
              )}
              {usernameStatus === "invalid" && (
                <span className="text-yellow-400/80">
                  3+ characters: letters, numbers, underscores only
                </span>
              )}
            </div>
          </div>

          {/* Bio field */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="edit-bio"
                className="block text-xs font-semibold text-gray-400 tracking-wide uppercase"
              >
                Bio
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  bio.length > MAX_BIO_LENGTH ? "text-red-400" : "text-gray-600"
                }`}
              >
                {bio.length}/{MAX_BIO_LENGTH}
              </span>
            </div>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
              placeholder="Tell people about yourself..."
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#34F080]/40 focus:bg-white/[0.06] rounded-xl px-3.5 py-3 text-white text-[15px] outline-none transition-[border-color,background-color] resize-none leading-relaxed placeholder:text-gray-600"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-[background-color,box-shadow,transform,opacity] cursor-pointer min-h-[48px] ${
              canSave
                ? "bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:shadow-[0_0_30px_rgba(52,240,128,0.3)] active:scale-[0.98]"
                : "bg-white/5 text-gray-500 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>

          {!hasChanges && (
            <p className="text-[11px] text-gray-600 text-center mt-3">
              Make changes to enable saving
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

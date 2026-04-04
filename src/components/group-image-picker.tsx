import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AVATAR_COLORS, hashToColorIndex, getInitials } from "../utils/avatar";
import { uploadImage } from "../services/media.service";

interface GroupImagePickerProps {
  imageUrl: string;
  onImageChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  groupName: string;
  diameter?: number;
}

export const GroupImagePicker = ({
  imageUrl,
  onImageChange,
  onUploadingChange,
  groupName,
  diameter = 72,
}: GroupImagePickerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset loaded state during render (not useEffect) when the URL changes.
  // useEffect runs after paint, so if the browser fires onLoad for a cached
  // image before the effect, the effect clobbers imgLoaded back to false.
  const prevUrlRef = useRef(imageUrl);
  if (prevUrlRef.current !== imageUrl) {
    prevUrlRef.current = imageUrl;
    setImgLoaded(false);
  }

  const colorIndex = hashToColorIndex(groupName || "");
  const avatarColor = AVATAR_COLORS[colorIndex];
  const initials = getInitials(groupName || "");
  const fontSize = Math.round(diameter * 0.38);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const result = await uploadImage(file);
      onImageChange(result.ImageURL);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      // Reset input so re-selecting same file triggers change
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative cursor-pointer group"
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{ width: diameter, height: diameter }}
      >
        {/* Base: initials avatar */}
        <div
          style={{
            width: diameter,
            height: diameter,
            backgroundColor: avatarColor.bg,
            fontSize: `${fontSize}px`,
          }}
          className="rounded-full flex items-center justify-center font-semibold select-none"
        >
          <span style={{ color: avatarColor.text, lineHeight: 1 }}>
            {initials}
          </span>

          {/* Image overlay */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Group"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(false)}
              style={{
                width: diameter,
                height: diameter,
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.2s ease-in",
                position: "absolute",
                inset: 0,
              }}
              className="rounded-full object-cover"
            />
          )}
        </div>

        {/* Hover/upload overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Remove button */}
        {imageUrl && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onImageChange("");
              setImgLoaded(false);
            }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      <span className="text-xs text-gray-400">
        {imageUrl ? "Change photo" : "Add photo"}
      </span>
    </div>
  );
};

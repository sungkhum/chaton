import { X, Loader2 } from "lucide-react";

interface VideoPreviewPanelProps {
  file: File;
  previewUrl: string;
  onCancel: () => void;
  isUploading?: boolean;
}

export const VideoPreviewPanel = ({
  file,
  previewUrl,
  onCancel,
  isUploading,
}: VideoPreviewPanelProps) => {
  return (
    <div className="w-full pb-2 mb-1 border-b border-ink/[0.06]">
      <div className="relative inline-block">
        <video
          src={previewUrl}
          className="max-h-[140px] w-auto rounded-lg object-contain"
          controls
          playsInline
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="w-5 h-5 animate-spin text-ink" />
              <span className="text-[11px] text-ink/80">Uploading…</span>
            </div>
          </div>
        )}
        {!isUploading && (
          <button
            onClick={onCancel}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 border border-ink/20 text-fg-300 hover:text-ink hover:bg-black/90 cursor-pointer transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <p className="text-[11px] text-fg-500 mt-1 truncate max-w-[200px]">
        {file.name}
      </p>
    </div>
  );
};

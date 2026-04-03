import { X } from "lucide-react";

interface VideoPreviewPanelProps {
  file: File;
  previewUrl: string;
  onCancel: () => void;
}

export const VideoPreviewPanel = ({
  file,
  previewUrl,
  onCancel,
}: VideoPreviewPanelProps) => {
  return (
    <div className="absolute bottom-full mb-2 left-0 w-[320px] md:w-[400px] bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-blue-800/30">
        <span className="text-sm text-blue-100 font-medium flex-1 truncate">
          {file.name}
        </span>
        <button
          onClick={onCancel}
          className="cursor-pointer text-blue-400/60 hover:text-blue-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Video preview */}
      <div className="flex items-center justify-center p-4 max-h-[260px] overflow-hidden">
        <video
          src={previewUrl}
          className="max-h-[230px] w-auto rounded-lg object-contain"
          controls
          playsInline
        />
      </div>
    </div>
  );
};

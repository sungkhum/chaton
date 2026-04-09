import { X } from "lucide-react";

interface ImagePreviewPanelProps {
  file: File;
  previewUrl: string;
  onCancel: () => void;
}

export const ImagePreviewPanel = ({
  file,
  previewUrl,
  onCancel,
}: ImagePreviewPanelProps) => {
  return (
    <div className="w-full pb-2 mb-1 border-b border-white/[0.06]">
      <div className="relative inline-block">
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-[140px] w-auto rounded-lg object-contain"
        />
        <button
          onClick={onCancel}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 border border-white/20 text-gray-300 hover:text-white hover:bg-black/90 cursor-pointer transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-1 truncate max-w-[200px]">
        {file.name}
      </p>
    </div>
  );
};

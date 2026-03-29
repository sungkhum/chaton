import { FileText, Download } from "lucide-react";
import { formatFileSize } from "../../services/media.service";

interface FileMessageProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

const FILE_ICONS: Record<string, string> = {
  pdf: "text-red-400",
  doc: "text-blue-400",
  docx: "text-blue-400",
  xls: "text-green-400",
  xlsx: "text-green-400",
  zip: "text-yellow-400",
  default: "text-blue-300/60",
};

export const FileMessage = ({
  fileUrl,
  fileName,
  fileSize,
  fileType,
}: FileMessageProps) => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const iconColor = FILE_ICONS[ext] || FILE_ICONS.default;

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-blue-900/20 rounded-lg p-3 min-w-[200px] hover:bg-blue-900/30 transition-colors"
    >
      <FileText className={`w-8 h-8 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-blue-100 truncate">{fileName}</div>
        <div className="text-xs text-blue-300/50 flex items-center gap-2">
          {fileSize && <span>{formatFileSize(fileSize)}</span>}
          {fileType && <span>{fileType}</span>}
        </div>
      </div>
      <Download className="w-4 h-4 text-blue-400/60 shrink-0" />
    </a>
  );
};

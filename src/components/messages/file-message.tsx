import { FileText, Download, ExternalLink, LinkIcon } from "lucide-react";
import { useState } from "react";
import { formatFileSize } from "../../services/media.service";
import { detectLinkService } from "../../utils/link-services";

interface FileMessageProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const FileMessage = ({
  fileUrl,
  fileName,
  fileSize,
  fileType,
  description,
  ogTitle,
  ogDescription,
  ogImage,
}: FileMessageProps) => {
  const [imageError, setImageError] = useState(false);
  const isLink = fileUrl.startsWith("http://") || fileUrl.startsWith("https://");
  const domain = isLink ? getDomain(fileUrl) : "";

  // URL-based link attachment (new flow)
  if (isLink && !fileSize && !fileType) {
    const service = detectLinkService(fileUrl);
    const hasOg = ogTitle || ogDescription || (ogImage && !imageError);

    const cardGradient = service?.cardGradient ?? "from-blue-900/40 to-indigo-900/30";
    const cardBorder = service?.cardBorder ?? "border-blue-700/30";

    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`block rounded-lg overflow-hidden hover:brightness-110 transition group ${
          hasOg ? "min-w-[240px] max-w-[360px]" : "min-w-[220px] max-w-[320px]"
        }`}
      >
        <div className={`bg-gradient-to-br ${cardGradient} border ${cardBorder} rounded-lg overflow-hidden`}>
          {/* OG Image banner */}
          {ogImage && !imageError && (
            <img
              src={ogImage}
              alt={ogTitle || description || "Link preview"}
              className="w-full h-[140px] object-cover"
              onError={() => setImageError(true)}
            />
          )}

          <div className="p-3.5">
            <div className="flex items-start gap-3">
              {service ? (
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${service.badgeBg}`}>
                  <span className={`text-xs font-bold leading-none ${service.badgeText}`}>
                    {service.badge}
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 p-2 bg-blue-500/15 rounded-lg shrink-0">
                  <LinkIcon className="w-5 h-5 text-blue-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {/* OG title or user description */}
                {(ogTitle || description) && (
                  <div className="text-sm text-blue-50 leading-snug mb-0.5 line-clamp-2">
                    {description || ogTitle}
                  </div>
                )}
                {/* OG description (show beneath if we have a title/description already) */}
                {ogDescription && (description || ogTitle) && (
                  <div className="text-xs text-gray-500 leading-snug mb-1 line-clamp-2">
                    {ogDescription}
                  </div>
                )}
                {/* If only OG description, no title */}
                {ogDescription && !description && !ogTitle && (
                  <div className="text-sm text-blue-50 leading-snug mb-1 line-clamp-2">
                    {ogDescription}
                  </div>
                )}
                <div className="text-xs text-blue-400/60 truncate flex items-center gap-1.5">
                  <span className="truncate">
                    {service ? service.name : domain || fileUrl}
                  </span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    );
  }

  // Traditional file attachment (existing flow)
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

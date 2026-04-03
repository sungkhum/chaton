import { ExternalLink, LinkIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchOgData, OgData } from "../../services/og.service";
import { detectLinkService } from "../../utils/link-services";

/** Extract the first http/https URL from a string. Returns null if none found. */
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_RE);
  return match ? match[0] : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function LinkPreview({ url }: { url: string }) {
  const [og, setOg] = useState<OgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOgData(url).then((data) => {
      if (!cancelled) {
        setOg(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (loading) return null; // Don't show skeleton — just show nothing until loaded
  if (!og || (!og.title && !og.description && !og.image)) return null;

  const domain = getDomain(url);
  const service = detectLinkService(url);
  const cardGradient = service?.cardGradient ?? "from-blue-900/40 to-indigo-900/30";
  const cardBorder = service?.cardBorder ?? "border-blue-700/30";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden hover:brightness-110 transition group mt-1.5"
    >
      <div className={`bg-gradient-to-br ${cardGradient} border ${cardBorder} rounded-lg overflow-hidden`}>
        {og.image && !imageError && (
          <img
            src={og.image}
            alt={og.title || "Link preview"}
            className="w-full h-[120px] object-cover"
            onError={() => setImageError(true)}
          />
        )}

        <div className="p-2.5">
          <div className="flex items-start gap-2.5">
            {service ? (
              <div className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${service.badgeBg}`}>
                {service.icon ? (
                  <service.icon size={14} className={service.badgeText} />
                ) : (
                  <span className={`text-[10px] font-bold leading-none ${service.badgeText}`}>
                    {service.badge}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-0.5 p-1.5 bg-blue-500/15 rounded-md shrink-0">
                <LinkIcon className="w-4 h-4 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {og.title && (
                <div className="text-[13px] text-blue-50 leading-snug mb-0.5 line-clamp-2">
                  {og.title}
                </div>
              )}
              {og.description && (
                <div className="text-[11px] text-gray-500 leading-snug mb-1 line-clamp-2">
                  {og.description}
                </div>
              )}
              <div className="text-[11px] text-blue-400/60 truncate flex items-center gap-1">
                <span className="truncate">
                  {service ? service.name : domain || url}
                </span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

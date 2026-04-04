import {
  ExternalLink,
  Heart,
  LinkIcon,
  MessageCircle,
  Repeat2,
} from "lucide-react";
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

function formatCount(n?: number): string {
  if (!n) return "0";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toString();
}

function TweetPreview({ og, url }: { og: OgData; url: string }) {
  const [imageError, setImageError] = useState(false);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden hover:brightness-110 transition group mt-1.5"
    >
      <div className="bg-gradient-to-br from-gray-800/60 to-slate-900/40 border border-gray-600/30 rounded-lg overflow-hidden">
        {/* Author row */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
          {og.authorAvatar ? (
            <img
              src={og.authorAvatar}
              alt=""
              className="w-5 h-5 rounded-full shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gray-600 shrink-0" />
          )}
          <span className="text-[13px] font-medium text-gray-100 truncate">
            {og.author}
          </span>
          {og.authorHandle && (
            <span className="text-[12px] text-gray-500 truncate">
              @{og.authorHandle}
            </span>
          )}
        </div>

        {/* Tweet text */}
        {og.description && (
          <div className="px-3 pb-1.5 text-[13px] text-gray-300 leading-snug line-clamp-4 whitespace-pre-line">
            {og.description}
          </div>
        )}

        {/* Media */}
        {og.image && !imageError && (
          <div className="mx-3 mb-2 rounded-md overflow-hidden">
            <img
              src={og.image}
              alt={og.title || "Tweet media"}
              className="w-full max-h-[200px] object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        {/* Metrics bar */}
        {og.metrics && (
          <div className="flex items-center gap-4 px-3 pb-2.5 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {formatCount(og.metrics.replies)}
            </span>
            <span className="flex items-center gap-1">
              <Repeat2 className="w-3 h-3" />
              {formatCount(og.metrics.retweets)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {formatCount(og.metrics.likes)}
            </span>
            <span className="ml-auto flex items-center gap-1 text-gray-600">
              X
              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
        )}
      </div>
    </a>
  );
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
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) return null; // Don't show skeleton — just show nothing until loaded
  if (!og || (!og.title && !og.description && !og.image)) return null;

  // Tweet-specific card
  if (og.type === "tweet") return <TweetPreview og={og} url={url} />;

  const domain = getDomain(url);
  const service = detectLinkService(url);
  const cardGradient =
    service?.cardGradient ?? "from-blue-900/40 to-indigo-900/30";
  const cardBorder = service?.cardBorder ?? "border-blue-700/30";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg overflow-hidden hover:brightness-110 transition group mt-1.5"
    >
      <div
        className={`bg-gradient-to-br ${cardGradient} border ${cardBorder} rounded-lg overflow-hidden`}
      >
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
              <div
                className={`mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${service.badgeBg}`}
              >
                {service.icon ? (
                  <service.icon size={14} className={service.badgeText} />
                ) : (
                  <span
                    className={`text-[10px] font-bold leading-none ${service.badgeText}`}
                  >
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

import { X, Loader2, LinkIcon } from "lucide-react";
import { useState, useRef, useEffect, KeyboardEvent, useCallback, forwardRef, useImperativeHandle } from "react";
import { fetchOgData, OgData } from "../../services/og.service";
import { detectLinkService, extractFileNameFromUrl } from "../../utils/link-services";
import {
  SiGoogledrive, SiDropbox, SiGithub, SiFigma, SiNotion, SiYoutube,
} from "@icons-pack/react-simple-icons";

interface LinkAttachmentPanelProps {
  onSend: (url: string, description?: string, ogData?: OgData) => void;
  onCancel: () => void;
  isSending: boolean;
}

export interface LinkAttachmentPanelHandle {
  /** Triggers send — called by the parent's main send button. Returns true if sent. */
  triggerSend: () => Promise<boolean>;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const LinkAttachmentPanel = forwardRef<LinkAttachmentPanelHandle, LinkAttachmentPanelProps>(({
  onSend,
  onCancel,
  isSending,
}, ref) => {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);

  const [ogData, setOgData] = useState<OgData | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [ogFetched, setOgFetched] = useState(false);
  const [ogImageError, setOgImageError] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ogResolveRef = useRef<((data: OgData) => void) | null>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  // Debounced OG fetch when URL changes — also reset description pre-fill
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = url.trim();

    setOgFetched(false);

    if (!isValidUrl(trimmed)) {
      setOgData(null);
      setOgLoading(false);
      return;
    }

    setOgLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await fetchOgData(trimmed);
      setOgData(data);
      setOgLoading(false);
      setOgFetched(true);
      setOgImageError(false);
      // Don't pre-fill description — let the user set it.
      // OG title shows in the preview card automatically.
      // Resolve any pending send wait
      if (ogResolveRef.current) {
        ogResolveRef.current(data);
        ogResolveRef.current = null;
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url]);

  const validUrl = isValidUrl(url.trim());
  const showError = urlTouched && url.trim().length > 0 && !validUrl;

  const handleSend = async (): Promise<boolean> => {
    if (isSending || !validUrl) {
      if (!validUrl) setUrlTouched(true);
      return false;
    }

    let finalOg = ogData;

    // If OG is still loading, wait up to 1s for it to complete
    if (ogLoading) {
      finalOg = await Promise.race([
        new Promise<OgData>((resolve) => {
          ogResolveRef.current = resolve;
        }),
        new Promise<OgData>((resolve) => setTimeout(() => resolve({}), 1000)),
      ]);
      ogResolveRef.current = null;
    }

    onSend(url.trim(), description.trim() || undefined, finalOg || undefined);
    return true;
  };

  useImperativeHandle(ref, () => ({
    triggerSend: handleSend,
  }));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleUrlBlur = useCallback(() => {
    if (url.trim().length > 0) setUrlTouched(true);
  }, [url]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };

  let domain = "";
  try {
    domain = new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    // not a valid URL yet
  }

  const service = validUrl ? detectLinkService(url.trim()) : null;
  const errorId = "link-panel-url-error";

  // Prefer URL filename when OG title is just the service name, domain,
  // or a known-useless placeholder (e.g. Google Docs JS-rendered titles)
  const JUNK_TITLES = [
    "loading google docs", "loading google sheets", "loading google slides",
    "loading google forms", "google docs", "google sheets", "google slides",
    "google forms", "google drive", "error",
  ];
  const ogDisplayTitle = (() => {
    const raw = ogData?.title;
    if (!raw) return undefined;
    const lower = raw.toLowerCase().trim();
    if (JUNK_TITLES.includes(lower)) return undefined;
    const isGeneric =
      (service && lower === service.name.toLowerCase()) ||
      (domain && lower === domain.toLowerCase());
    if (isGeneric) {
      return extractFileNameFromUrl(url.trim()) || raw;
    }
    return raw;
  })();

  const hasOgPreview = ogData && (ogDisplayTitle || ogData.description || ogData.image);
  const showNoPreview = ogFetched && !hasOgPreview && !ogLoading && validUrl;

  return (
    <div
      role="region"
      aria-label="Share a link"
      className="w-full pb-2 mb-1 border-b border-white/[0.06]"
    >
      {/* Header label + dismiss */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-blue-400/80 uppercase tracking-wider">Share a link</span>
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="p-1 text-gray-500 hover:text-white cursor-pointer transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* URL input */}
      <div className="mb-1.5">
        <input
          ref={urlRef}
          type="url"
          placeholder="Paste a URL..."
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError || undefined}
          className="w-full bg-white/[0.04] text-white text-sm outline-none placeholder:text-gray-500 rounded-lg px-3 py-2 border border-white/8 focus:border-blue-500/40 transition-colors"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        {showError && (
          <p id={errorId} className="text-red-400/70 text-[11px] mt-1 ml-1">
            Enter a valid URL (e.g. https://example.com)
          </p>
        )}
        {!validUrl && !showError && (
          <div className="flex items-center gap-3 mt-1.5 ml-1">
            <SiGoogledrive size={12} className="text-gray-600" />
            <SiDropbox size={12} className="text-gray-600" />
            <SiFigma size={12} className="text-gray-600" />
            <SiNotion size={12} className="text-gray-600" />
            <SiGithub size={12} className="text-gray-600" />
            <SiYoutube size={12} className="text-gray-600" />
            <span className="text-[10px] text-gray-600">and any URL</span>
          </div>
        )}
      </div>

      {/* Description input — only show once URL is valid */}
      {validUrl && (
        <div className="mb-1.5">
          <input
            type="text"
            placeholder="Add a description (optional)..."
            className="w-full bg-white/[0.04] text-white text-sm outline-none placeholder:text-gray-500 rounded-lg px-3 py-2 border border-white/8 focus:border-blue-500/40 transition-colors"
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
        </div>
      )}

      {/* OG Preview */}
      <div aria-live="polite">
        {ogLoading && validUrl && (
          <div className="mt-1">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 animate-pulse">
              <div className="h-3 bg-white/8 rounded w-3/4 mb-1.5" />
              <div className="h-2.5 bg-white/5 rounded w-2/3" />
            </div>
          </div>
        )}

        {!ogLoading && hasOgPreview && (
          <div className="mt-1">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] overflow-hidden">
              {ogData.image && !ogImageError && (
                <img
                  src={ogData.image}
                  alt={ogData.title || "Link preview"}
                  className="w-full h-[70px] object-cover"
                  onError={() => setOgImageError(true)}
                />
              )}
              <div className="p-2.5 flex items-start gap-2">
                {service ? (
                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${service.badgeBg}`}>
                    {service.icon ? (
                      <service.icon size={12} className={service.badgeText} />
                    ) : (
                      <span className={`text-[9px] font-bold leading-none ${service.badgeText}`}>
                        {service.badge}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 bg-blue-500/15">
                    <LinkIcon className="w-3 h-3 text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {ogDisplayTitle && (
                    <div className="text-xs font-medium text-blue-100 leading-snug truncate">
                      {ogDisplayTitle}
                    </div>
                  )}
                  {ogData.description && (
                    <div className="text-[11px] text-gray-500 leading-snug mt-0.5 line-clamp-2">
                      {ogData.description}
                    </div>
                  )}
                  <div className="text-[10px] text-blue-400/40 mt-0.5">
                    {service ? service.name : domain}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showNoPreview && (
          <p className="text-gray-600 text-[11px] mt-1.5 ml-1">No preview available for this link</p>
        )}
      </div>
    </div>
  );
});

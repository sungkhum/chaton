import { X, Send, Loader2, LinkIcon } from "lucide-react";
import { useState, useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { fetchOgData, OgData } from "../../services/og.service";
import { detectLinkService } from "../../utils/link-services";

interface LinkAttachmentPanelProps {
  onSend: (url: string, description?: string, ogData?: OgData) => void;
  onCancel: () => void;
  isSending: boolean;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const LinkAttachmentPanel = ({
  onSend,
  onCancel,
  isSending,
}: LinkAttachmentPanelProps) => {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [userEditedDescription, setUserEditedDescription] = useState(false);
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [ogFetched, setOgFetched] = useState(false);
  const [ogImageError, setOgImageError] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ogResolveRef = useRef<((data: OgData) => void) | null>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  // Click-outside-to-close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  // Debounced OG fetch when URL changes — also reset description pre-fill
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = url.trim();

    // Reset pre-fill flag when URL changes so new OG title can populate
    setUserEditedDescription(false);
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
      // Pre-fill description with OG title if user hasn't typed one
      if (data.title && !userEditedDescription) {
        setDescription(data.title);
      }
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

  const handleSend = async () => {
    if (isSending || !validUrl) return;

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
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!validUrl) {
        setUrlTouched(true);
      } else {
        handleSend();
      }
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
    setUserEditedDescription(true);
  };

  let domain = "";
  try {
    domain = new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    // not a valid URL yet
  }

  const service = validUrl ? detectLinkService(url.trim()) : null;
  const errorId = "link-panel-url-error";
  const hasOgPreview = ogData && (ogData.title || ogData.description || ogData.image);
  const showNoPreview = ogFetched && !hasOgPreview && !ogLoading && validUrl;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Share a link"
      className="absolute bottom-full mb-2 left-0 w-[320px] md:w-[400px] bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[70vh]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-blue-800/30 shrink-0">
        <LinkIcon className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm text-blue-100 font-medium flex-1">
          Share a link
        </span>
        <button
          onClick={onCancel}
          aria-label="Close"
          className="cursor-pointer text-blue-400/60 hover:text-blue-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {/* URL input */}
        <div className="px-3 pt-3 pb-2">
          <input
            ref={urlRef}
            type="url"
            placeholder="Paste a URL..."
            aria-describedby={showError ? errorId : undefined}
            aria-invalid={showError || undefined}
            className="w-full bg-[#0a1019] text-white text-sm outline-none placeholder:text-gray-600 rounded-lg px-3 py-2.5 border border-white/8 focus:border-blue-500/40 transition-colors"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleUrlBlur}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
          {showError && (
            <p id={errorId} className="text-red-400/70 text-xs mt-1 ml-1">
              Enter a valid URL (e.g. https://example.com)
            </p>
          )}
          {!showError && domain && !hasOgPreview && !ogLoading && !showNoPreview && (
            <p className="text-blue-400/50 text-xs mt-1 ml-1">{domain}</p>
          )}
        </div>

        {/* Description input */}
        <div className="px-3 pb-2">
          <input
            type="text"
            placeholder="Add a description..."
            className="w-full bg-[#0a1019] text-white text-sm outline-none placeholder:text-gray-600 rounded-lg px-3 py-2 border border-white/8"
            value={description}
            onChange={handleDescriptionChange}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />
        </div>

        {/* OG Preview — below both inputs */}
        <div aria-live="polite">
          {ogLoading && validUrl && (
            <div className="px-3 pb-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3 animate-pulse">
                <div className="h-3 bg-white/8 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-white/5 rounded w-full mb-1" />
                <div className="h-2.5 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          )}

          {!ogLoading && hasOgPreview && (
            <div className="px-3 pb-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.03] overflow-hidden">
                {ogData.image && !ogImageError && (
                  <img
                    src={ogData.image}
                    alt={ogData.title || "Link preview"}
                    className="w-full h-[80px] object-cover"
                    onError={() => setOgImageError(true)}
                  />
                )}
                <div className="p-2.5 flex items-start gap-2.5">
                  {service ? (
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${service.badgeBg}`}>
                      {service.icon ? (
                        <service.icon size={14} className={service.badgeText} />
                      ) : (
                        <span className={`text-[10px] font-bold leading-none ${service.badgeText}`}>
                          {service.badge}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-blue-500/15">
                      <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {ogData.title && (
                      <div className="text-xs font-medium text-blue-100 leading-snug truncate">
                        {ogData.title}
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
            <div className="px-3 pb-2">
              <p className="text-gray-600 text-xs ml-1">No preview available for this link</p>
            </div>
          )}
        </div>
      </div>

      {/* Send row — always pinned at bottom */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-blue-800/30 shrink-0">
        <div className="flex-1 text-xs text-gray-600 truncate ml-1">
          {ogLoading ? "Fetching preview..." : domain || ""}
        </div>
        <button
          onClick={handleSend}
          disabled={isSending || !validUrl}
          aria-label="Send link"
          title={!validUrl ? "Paste a URL first" : "Send link"}
          className="p-2 rounded-full bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:brightness-110 cursor-pointer transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};

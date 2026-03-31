import { Search, X, Loader2, ArrowLeft, Send } from "lucide-react";
import { useEffect, useState, useRef, useCallback, KeyboardEvent } from "react";
import {
  KlipyItem,
  KlipyCategory,
  searchGifs,
  trendingGifs,
  searchStickers,
  trendingStickers,
  getCategories,
  getSearchSuggestions,
  getThumbnailUrl,
  getDisplayUrl,
} from "../../services/klipy.service";
import { useMobile } from "../../hooks/useMobile";

type ContentTab = "gifs" | "stickers";

interface GifPickerProps {
  onSelectGif: (item: KlipyItem, caption?: string) => void;
  onSelectSticker: (item: KlipyItem) => void;
  onClose: () => void;
  customerId?: string;
}

export const GifPicker = ({
  onSelectGif,
  onSelectSticker,
  onClose,
  customerId,
}: GifPickerProps) => {
  const { isMobile } = useMobile();
  const [tab, setTab] = useState<ContentTab>("gifs");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KlipyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<KlipyItem | null>(null);
  const [caption, setCaption] = useState("");
  const [categories, setCategories] = useState<KlipyCategory[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const gridRef = useRef<HTMLDivElement>(null);

  // Mobile: full-width anchored to compose bar. Desktop: fixed 400px.
  const PICKER_CONTAINER = `absolute bottom-full mb-2 ${
    isMobile ? "left-0 right-0" : "left-0 w-[400px]"
  } bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden`;

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Load trending + categories on mount and tab switch
  useEffect(() => {
    loadTrending();
    loadCategories();
    setQuery("");
    setSuggestions([]);
    setSelectedGif(null);
    inputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    if (selectedGif) captionRef.current?.focus();
  }, [selectedGif]);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    const fetcher = tab === "gifs" ? trendingGifs : trendingStickers;
    const { items: result } = await fetcher(1, 24, customerId);
    setItems(result);
    setLoading(false);
  }, [tab, customerId]);

  const loadCategories = useCallback(async () => {
    const cats = await getCategories(tab);
    setCategories(cats.slice(0, 20));
  }, [tab]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Search suggestions (shown as horizontal chips)
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (q.trim().length >= 2) {
      suggestTimer.current = setTimeout(async () => {
        const s = await getSearchSuggestions(q.trim());
        setSuggestions(s);
      }, 200);
    } else {
      setSuggestions([]);
    }

    if (!q.trim()) {
      loadTrending();
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      const searcher = tab === "gifs" ? searchGifs : searchStickers;
      const { items: result } = await searcher(q.trim(), 1, 24, customerId);
      setItems(result);
      setLoading(false);
    }, 300);
  };

  const applySuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setSuggestions([]);
    // Trigger search immediately
    (async () => {
      setLoading(true);
      const searcher = tab === "gifs" ? searchGifs : searchStickers;
      const { items: result } = await searcher(suggestion, 1, 24, customerId);
      setItems(result);
      setLoading(false);
    })();
  };

  const handleCategoryClick = (cat: KlipyCategory) => {
    setQuery(cat.title);
    (async () => {
      setLoading(true);
      const searcher = tab === "gifs" ? searchGifs : searchStickers;
      const { items: result } = await searcher(cat.title, 1, 24, customerId);
      setItems(result);
      setLoading(false);
    })();
  };

  const handleItemClick = (item: KlipyItem) => {
    if (tab === "stickers") {
      // Stickers send immediately (like Telegram)
      onSelectSticker(item);
      onClose();
    } else {
      // GIFs go to preview/caption screen
      setSelectedGif(item);
    }
  };

  const handleBack = () => {
    setSelectedGif(null);
    setCaption("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = () => {
    if (!selectedGif) return;
    const trimmed = caption.trim();
    onSelectGif(selectedGif, trimmed || undefined);
    onClose();
  };

  const handleCaptionKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleBack();
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // ── GIF confirmation view ──
  if (selectedGif) {
    const preview = getDisplayUrl(selectedGif, "md");
    return (
      <div ref={pickerRef} className={PICKER_CONTAINER}>
        <div className="flex items-center gap-2 p-3 border-b border-blue-800/30">
          <button
            onClick={handleBack}
            className="cursor-pointer text-blue-400/60 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-blue-100 font-medium">Send GIF</span>
          <div className="flex-1" />
          <button onClick={onClose} className="cursor-pointer">
            <X className="w-4 h-4 text-blue-400/60" />
          </button>
        </div>

        <div className="flex items-center justify-center p-4 max-h-[260px] overflow-hidden">
          {preview && (
            <img
              src={preview.url}
              alt={selectedGif.title}
              className="max-h-[230px] w-auto rounded-lg object-contain"
            />
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-blue-800/30">
          <input
            ref={captionRef}
            type="text"
            placeholder="Add a message..."
            className="flex-1 bg-[#0a1019] text-white text-sm outline-none placeholder:text-gray-600 rounded-lg px-3 py-2 border border-white/8"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleCaptionKeyDown}
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-full bg-gradient-to-r from-[#34F080] to-[#20E0AA] text-black hover:brightness-110 cursor-pointer transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <KlipyAttribution />
      </div>
    );
  }

  // ── Browse/search view ──
  return (
    <div className={PICKER_CONTAINER}>
      {/* Tabs */}
      <div className="flex border-b border-blue-800/30">
        <TabButton
          label="GIFs"
          active={tab === "gifs"}
          onClick={() => setTab("gifs")}
        />
        <TabButton
          label="Stickers"
          active={tab === "stickers"}
          onClick={() => setTab("stickers")}
        />
        <div className="flex-1" />
        <button onClick={onClose} className="cursor-pointer px-3">
          <X className="w-4 h-4 text-blue-400/60" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 bg-[#0a1019] rounded-lg border border-white/8 px-3 py-2">
          <Search className="w-4 h-4 text-blue-400/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search KLIPY"
            className="flex-1 bg-transparent text-blue-100 text-sm outline-none placeholder:text-blue-400/40"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                loadTrending();
                inputRef.current?.focus();
              }}
              className="cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-blue-400/40" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestion chips (when searching) / Category chips (when idle) */}
      {query && suggestions.length > 0 ? (
        <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => applySuggestion(s)}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#34F080]/10 text-[#34F080]/80 hover:bg-[#34F080]/20 hover:text-[#34F080] cursor-pointer transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      ) : !query && categories.length > 0 ? (
        <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => handleCategoryClick(cat)}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-800/20 text-blue-300/70 hover:bg-blue-800/40 hover:text-blue-200 cursor-pointer transition-colors"
            >
              {cat.title}
            </button>
          ))}
        </div>
      ) : null}

      {/* Content grid */}
      <div ref={gridRef} className="h-[250px] md:h-[300px] overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-blue-400/40 py-8 text-sm">
            {query
              ? `No ${tab === "gifs" ? "GIFs" : "stickers"} found`
              : "Enter a KLIPY API key to search"}
          </div>
        ) : (
          <div className="columns-2 gap-2">
            {items.map((item) => (
              <ContentThumbnail
                key={item.id}
                item={item}
                onClick={() => handleItemClick(item)}
                isSticker={tab === "stickers"}
              />
            ))}
          </div>
        )}
      </div>

      <KlipyAttribution />
    </div>
  );
};

// ── Sub-components ──

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors relative ${
        active
          ? "text-blue-100"
          : "text-blue-400/50 hover:text-blue-300/70"
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#34F080] rounded-full" />
      )}
    </button>
  );
}

function ContentThumbnail({
  item,
  onClick,
  isSticker,
}: {
  item: KlipyItem;
  onClick: () => void;
  isSticker: boolean;
}) {
  const thumb = getThumbnailUrl(item);
  const [loaded, setLoaded] = useState(false);

  if (!thumb) return null;

  return (
    <div
      className={`mb-2 cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all break-inside-avoid relative ${
        isSticker ? "bg-transparent" : ""
      }`}
      onClick={onClick}
    >
      {/* Blur placeholder — sits behind until real image loads */}
      {!loaded && item.blur_preview && (
        <img
          src={item.blur_preview}
          alt=""
          className="w-full h-auto"
          style={{ aspectRatio: `${thumb.width}/${thumb.height}` }}
        />
      )}
      <img
        src={thumb.url}
        alt={item.title}
        className={`w-full h-auto transition-opacity duration-200 ${
          !loaded ? "absolute inset-0 opacity-0" : "opacity-100"
        }`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function KlipyAttribution() {
  return (
    <div className="flex items-center justify-end px-3 py-1.5 border-t border-blue-800/30">
      <a
        href="https://klipy.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
      >
        <span className="text-[10px] text-blue-300/70 tracking-wide uppercase">
          Powered by
        </span>
        <span className="text-[11px] font-bold tracking-wider text-blue-300/70">
          KLIPY
        </span>
      </a>
    </div>
  );
}

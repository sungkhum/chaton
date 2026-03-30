import { Search, X, Loader2, ArrowLeft, Send } from "lucide-react";
import { useEffect, useState, useRef, KeyboardEvent } from "react";
import { GiphyGif, searchGifs, trendingGifs } from "../../services/giphy.service";

interface GifPickerProps {
  onSelect: (gif: GiphyGif, caption?: string) => void;
  onClose: () => void;
}

export const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState<GiphyGif | null>(null);
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
    loadTrending();
  }, []);

  // Focus caption input when a GIF is selected
  useEffect(() => {
    if (selectedGif) {
      captionRef.current?.focus();
    }
  }, [selectedGif]);

  const loadTrending = async () => {
    setLoading(true);
    const results = await trendingGifs(20);
    setGifs(results);
    setLoading(false);
  };

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!q.trim()) {
      loadTrending();
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchGifs(q.trim());
      setGifs(results);
      setLoading(false);
    }, 300);
  };

  const handleBack = () => {
    setSelectedGif(null);
    setCaption("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSend = () => {
    if (!selectedGif) return;
    const trimmed = caption.trim();
    onSelect(selectedGif, trimmed || undefined);
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

  // Confirmation view
  if (selectedGif) {
    return (
      <div className="absolute bottom-full mb-2 left-0 w-[320px] md:w-[400px] bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-blue-800/30">
          <button onClick={handleBack} className="cursor-pointer text-blue-400/60 hover:text-blue-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-blue-100 font-medium">Send GIF</span>
          <div className="flex-1" />
          <button onClick={onClose} className="cursor-pointer">
            <X className="w-4 h-4 text-blue-400/60" />
          </button>
        </div>

        {/* GIF preview */}
        <div className="flex items-center justify-center p-4 max-h-[260px] overflow-hidden">
          <img
            src={selectedGif.images.fixed_width.url}
            alt={selectedGif.title}
            className="max-h-[230px] w-auto rounded-lg object-contain"
          />
        </div>

        {/* Caption input + send */}
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

        {/* GIPHY attribution */}
        <div className="flex items-center justify-end px-3 py-1.5 border-t border-blue-800/30">
          <a
            href="https://giphy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
          >
            <span className="text-[10px] text-blue-300/70 tracking-wide uppercase">
              Powered by
            </span>
            <span className="text-[11px] font-bold tracking-wider text-blue-300/70">
              GIPHY
            </span>
          </a>
        </div>
      </div>
    );
  }

  // Search/browse view
  return (
    <div className="absolute bottom-full mb-2 left-0 w-[320px] md:w-[400px] bg-[#0a1628] border border-blue-800/40 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-blue-800/30">
        <Search className="w-4 h-4 text-blue-400/60 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search GIFs..."
          className="flex-1 bg-transparent text-blue-100 text-sm outline-none placeholder:text-blue-400/40"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        <button onClick={onClose} className="cursor-pointer">
          <X className="w-4 h-4 text-blue-400/60" />
        </button>
      </div>

      <div className="h-[300px] overflow-y-auto custom-scrollbar p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center text-blue-400/40 py-8 text-sm">
            {query ? "No GIFs found" : "Enter a Giphy API key to search GIFs"}
          </div>
        ) : (
          <div className="columns-2 gap-2">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                className="mb-2 cursor-pointer rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all break-inside-avoid"
                onClick={() => setSelectedGif(gif)}
              >
                <img
                  src={gif.images.fixed_width.url}
                  alt={gif.title}
                  className="w-full h-auto"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end px-3 py-1.5 border-t border-blue-800/30">
        <a
          href="https://giphy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
        >
          <span className="text-[10px] text-blue-300/70 tracking-wide uppercase">
            Powered by
          </span>
          <span className="text-[11px] font-bold tracking-wider text-blue-300/70">
            GIPHY
          </span>
        </a>
      </div>
    </div>
  );
};

import { Search, X, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { GiphyGif, searchGifs, trendingGifs } from "../../services/giphy.service";

interface GifPickerProps {
  onSelect: (gif: GiphyGif) => void;
  onClose: () => void;
}

export const GifPicker = ({ onSelect, onClose }: GifPickerProps) => {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
    loadTrending();
  }, []);

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
                onClick={() => {
                  onSelect(gif);
                  onClose();
                }}
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

      <div className="text-center py-1 text-[10px] text-blue-400/30 border-t border-blue-800/30">
        Powered by GIPHY
      </div>
    </div>
  );
};

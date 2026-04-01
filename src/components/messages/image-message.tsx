import { useState } from "react";
import { X } from "lucide-react";

interface ImageMessageProps {
  imageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export const ImageMessage = ({ imageUrl, alt, width, height, caption }: ImageMessageProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <>
      <div className="max-w-[300px]">
        <div
          className="cursor-pointer rounded-lg overflow-hidden relative"
          onClick={() => setLightboxOpen(true)}
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          {!loaded && (
            <div
              className="absolute inset-0 bg-white/10 animate-pulse rounded-lg"
              style={aspectRatio ? { aspectRatio } : { minHeight: 200 }}
            />
          )}
          <img
            src={imageUrl}
            alt={alt || "Image"}
            className={`w-full h-auto object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
            style={aspectRatio ? { aspectRatio } : undefined}
            loading="lazy"
            onLoad={() => setLoaded(true)}
          />
        </div>
        {caption && (
          <p className="text-sm text-white mt-2 px-1 whitespace-pre-wrap break-words select-text">
            {caption}
          </p>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white cursor-pointer"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={imageUrl}
            alt={alt || "Image"}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
};

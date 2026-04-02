import { useState } from "react";

interface GifMessageProps {
  gifUrl: string;
  title?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export const GifMessage = ({ gifUrl, title, width, height, caption }: GifMessageProps) => {
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div
      className="rounded-lg overflow-hidden max-w-[250px] md:max-w-[300px] relative"
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!loaded && (
        <div
          className="absolute inset-0 bg-white/10 animate-pulse rounded-lg"
          style={aspectRatio ? { aspectRatio } : { minHeight: 150 }}
        />
      )}
      <img
        src={gifUrl}
        alt={title || "GIF"}
        className={`w-full h-auto object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={aspectRatio ? { aspectRatio } : undefined}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
      {caption && (
        <p className="text-sm text-white mt-2 px-1 whitespace-pre-wrap break-words select-text">
          {caption}
        </p>
      )}
    </div>
  );
};

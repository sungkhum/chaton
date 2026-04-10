import { useState, ReactNode } from "react";

interface GifMessageProps {
  gifUrl: string;
  title?: string;
  width?: number;
  height?: number;
  caption?: ReactNode;
}

export const GifMessage = ({
  gifUrl,
  title,
  width,
  height,
  caption,
}: GifMessageProps) => {
  // rerender-lazy-state-init: probe browser cache so remounts after
  // optimistic→confirmed merge skip the skeleton entirely.
  const [loaded, setLoaded] = useState(() => {
    const probe = new Image();
    probe.src = gifUrl;
    return probe.complete && probe.naturalWidth > 0;
  });
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div className="w-full min-w-[180px] max-w-[300px] md:max-w-[350px]">
      <div
        className="overflow-hidden relative"
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
          className={`w-full h-auto object-cover transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          style={aspectRatio ? { aspectRatio } : undefined}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </div>
      {caption && (
        <div className="text-sm text-white mt-1.5 px-3 pb-1 whitespace-pre-wrap break-words select-text">
          {caption}
        </div>
      )}
    </div>
  );
};

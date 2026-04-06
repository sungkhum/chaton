import { useState } from "react";

interface StickerMessageProps {
  stickerUrl: string;
  title?: string;
  width?: number;
  height?: number;
}

export const StickerMessage = ({
  stickerUrl,
  title,
  width,
  height,
}: StickerMessageProps) => {
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div
      className="relative"
      style={{
        // Fluid sticker width: 120px on small phones, scales up to 180px on desktop.
        // clamp() guarantees a non-zero width so aspect-ratio can compute height.
        width: "clamp(120px, 30vw, 180px)",
        ...(aspectRatio ? { aspectRatio } : {}),
      }}
    >
      {!loaded && (
        <div
          className="absolute inset-0 bg-white/10 animate-pulse rounded-lg"
          style={aspectRatio ? { aspectRatio } : { minHeight: 100 }}
        />
      )}
      <img
        src={stickerUrl}
        alt={title || "Sticker"}
        className={`w-full h-auto object-contain transition-opacity duration-200 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={aspectRatio ? { aspectRatio } : undefined}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
};

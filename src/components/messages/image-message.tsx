import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";

interface ImageMessageProps {
  imageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export const ImageMessage = ({ imageUrl, alt, width, height, caption }: ImageMessageProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = width && height ? width / height : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const gesture = useRef({
    scale: 1, tx: 0, ty: 0,
    dist0: 0, scale0: 1,
    px0: 0, py0: 0, tx0: 0, ty0: 0,
    moved: false,
  });

  const applyTransform = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const { scale, tx, ty } = gesture.current;
    img.style.transform = scale === 1 && tx === 0 && ty === 0
      ? "" : `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);

  const resetZoom = useCallback(() => {
    const img = imgRef.current;
    if (img) {
      img.style.transition = "transform 0.2s ease-out";
      img.addEventListener("transitionend", () => { img.style.transition = ""; }, { once: true });
    }
    Object.assign(gesture.current, { scale: 1, tx: 0, ty: 0 });
    applyTransform();
  }, [applyTransform]);

  // Non-passive touch listeners for pinch-to-zoom and pan
  useEffect(() => {
    if (!lightboxOpen) return;
    const el = containerRef.current;
    if (!el) return;

    const g = gesture.current;
    Object.assign(g, { scale: 1, tx: 0, ty: 0, moved: false });

    const onStart = (e: TouchEvent) => {
      const img = imgRef.current;
      if (img) img.style.transition = "";
      g.moved = false;
      if (e.touches.length === 2) {
        e.preventDefault();
        g.dist0 = touchDistance(e.touches[0], e.touches[1]);
        g.scale0 = g.scale;
      } else if (e.touches.length === 1) {
        g.px0 = e.touches[0].clientX;
        g.py0 = e.touches[0].clientY;
        g.tx0 = g.tx;
        g.ty0 = g.ty;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        g.moved = true;
        const d = touchDistance(e.touches[0], e.touches[1]);
        g.scale = Math.min(Math.max(g.scale0 * (d / g.dist0), 1), 5);
        if (g.scale <= 1) { g.tx = 0; g.ty = 0; }
        applyTransform();
      } else if (e.touches.length === 1 && g.scale > 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - g.px0;
        const dy = e.touches[0].clientY - g.py0;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) g.moved = true;
        g.tx = g.tx0 + dx;
        g.ty = g.ty0 + dy;
        applyTransform();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (g.moved) e.preventDefault(); // suppress click after gesture
      if (g.scale <= 1) resetZoom();
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [lightboxOpen, applyTransform, resetZoom]);

  const handleOverlayClick = useCallback(() => {
    const g = gesture.current;
    if (g.moved) { g.moved = false; return; }
    if (g.scale > 1) { resetZoom(); return; }
    setLightboxOpen(false);
  }, [resetZoom]);

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
            onError={() => setLoaded(true)}
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
          ref={containerRef}
          className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 select-none"
          style={{ touchAction: "none" }}
          onClick={handleOverlayClick}
        >
          <button
            className="absolute top-4 right-4 text-white cursor-pointer z-10"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
              setLightboxOpen(false);
            }}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            ref={imgRef}
            src={imageUrl}
            alt={alt || "Image"}
            className="max-w-full max-h-full object-contain will-change-transform"
            style={{ transformOrigin: "center center" }}
          />
        </div>
      )}
    </>
  );
};

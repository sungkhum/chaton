import { Play } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";

interface VideoMessageProps {
  videoUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  /** Local-only thumbnail (data URL) for optimistic display before Cloudflare thumbnail is available. */
  localThumbnail?: string;
}

/**
 * Convert a video URL to a playable stream URL.
 * Cloudflare Stream iframe URLs (iframe.videodelivery.net/{id}) are HTML embed pages,
 * not playable video streams. Convert to the HLS manifest URL.
 */
function toStreamUrl(videoUrl: string): string {
  // Cloudflare Stream iframe: https://iframe.videodelivery.net/{videoId}
  // → HLS: https://videodelivery.net/{videoId}/manifest/video.m3u8
  // Only convert if the ID is a 32-char hex string (CF Stream UID).
  // Livepeer playback IDs (alphanumeric, shorter) should not be sent to CF Stream.
  const cfIframeMatch = videoUrl.match(
    /iframe\.videodelivery\.net\/([a-f0-9]{32})/
  );
  if (cfIframeMatch) {
    return `https://videodelivery.net/${cfIframeMatch[1]}/manifest/video.m3u8`;
  }
  return videoUrl;
}

/** Derive a thumbnail URL from a video stream URL. */
function getThumbnailUrl(videoUrl: string): string | undefined {
  // Cloudflare Stream: 32-char hex ID in videodelivery.net or cloudflarestream.com URLs
  const cfMatch = videoUrl.match(/videodelivery\.net\/([a-f0-9]{32})/);
  if (cfMatch) {
    return `https://videodelivery.net/${cfMatch[1]}/thumbnails/thumbnail.jpg`;
  }
  const cfCustomerMatch = videoUrl.match(
    /cloudflarestream\.com\/([a-f0-9]{32})/
  );
  if (cfCustomerMatch) {
    return `https://videodelivery.net/${cfCustomerMatch[1]}/thumbnails/thumbnail.jpg`;
  }

  // Livepeer VOD: .../hls/{playbackId}/index.m3u8 → .../hls/{playbackId}/thumbnails/keyframes_0.png
  if (videoUrl.includes("lp-playback") && videoUrl.includes("/hls/")) {
    return videoUrl.replace(/\/[^/]+\.m3u8.*$/, "/thumbnails/keyframes_0.png");
  }

  return undefined;
}

export const VideoMessage = ({
  videoUrl,
  width,
  height,
  duration,
  localThumbnail,
}: VideoMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const aspectRatio = width && height ? width / height : 16 / 9;

  // Derive thumbnail from the original URL (before conversion)
  const thumbnailUrl = localThumbnail || getThumbnailUrl(videoUrl);
  // Convert iframe embed URLs to playable stream URLs
  const streamUrl = toStreamUrl(videoUrl);
  const isHls = streamUrl.includes(".m3u8") || streamUrl.includes("/hls/");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ autoStartLoad: false });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Native HLS (Safari) or direct mp4 URL
      video.src = streamUrl;
      video.preload = "metadata";
    }
  }, [streamUrl, isHls]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      // Start loading HLS on first play
      if (hlsRef.current) {
        hlsRef.current.startLoad();
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div
      className="relative overflow-hidden w-full min-w-[180px] max-w-[400px] cursor-pointer outline outline-1 outline-white/10 [outline-offset:-1px]"
      style={{ aspectRatio }}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        playsInline
      />

      {!isPlaying && (
        <>
          {/* Thumbnail image overlay — hides when playing */}
          {thumbnailUrl && !thumbnailError && (
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setThumbnailError(true)}
            />
          )}
          <div
            className={`absolute inset-0 flex items-center justify-center ${
              thumbnailUrl && !thumbnailError ? "bg-black/30" : "bg-[#0d1626]"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
            {duration !== undefined && duration > 0 && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                {formatTime(duration)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

import { Play } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";

interface VideoMessageProps {
  videoUrl: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** Derive a thumbnail URL from a video stream URL. */
function getThumbnailUrl(videoUrl: string): string | undefined {
  // Cloudflare Stream: https://iframe.videodelivery.net/{videoId}
  // Thumbnail: https://videodelivery.net/{videoId}/thumbnails/thumbnail.jpg
  const cfMatch = videoUrl.match(/videodelivery\.net\/([a-f0-9]+)/);
  if (cfMatch) {
    return `https://videodelivery.net/${cfMatch[1]}/thumbnails/thumbnail.jpg`;
  }

  // Cloudflare Stream customer subdomain: https://customer-{sub}.cloudflarestream.com/{videoId}
  const cfCustomerMatch = videoUrl.match(/cloudflarestream\.com\/([a-f0-9]+)/);
  if (cfCustomerMatch) {
    return `https://videodelivery.net/${cfCustomerMatch[1]}/thumbnails/thumbnail.jpg`;
  }

  // Livepeer HLS: .../hls/{playbackId}/index.m3u8
  // Thumbnail: .../hls/{playbackId}/thumbnails/keyframes_0.jpg
  if (videoUrl.includes("/hls/") && videoUrl.includes(".m3u8")) {
    return videoUrl.replace(/\/[^/]+\.m3u8.*$/, "/thumbnails/keyframes_0.jpg");
  }

  return undefined;
}

export const VideoMessage = ({ videoUrl, width, height, duration }: VideoMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const aspectRatio = width && height ? width / height : 16 / 9;

  const isHls = videoUrl.includes(".m3u8") || videoUrl.includes("/hls/");
  const thumbnailUrl = getThumbnailUrl(videoUrl);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ autoStartLoad: false });
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      // Native HLS (Safari) or direct mp4 URL
      video.src = videoUrl;
      video.preload = "metadata";
    }
  }, [videoUrl, isHls]);

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
      className="relative rounded-lg overflow-hidden max-w-[300px] cursor-pointer"
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
          <div className={`absolute inset-0 flex items-center justify-center ${
            thumbnailUrl && !thumbnailError ? "bg-black/30" : "bg-[#0d1626]"
          }`}>
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

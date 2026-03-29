import { Play } from "lucide-react";
import { useState, useRef } from "react";

interface VideoMessageProps {
  videoUrl: string;
  width?: number;
  height?: number;
  duration?: number;
}

export const VideoMessage = ({ videoUrl, width, height, duration }: VideoMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const aspectRatio = width && height ? width / height : 16 / 9;

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
        src={videoUrl}
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
        playsInline
      />

      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-1" />
          </div>
          {duration && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
              {formatTime(duration)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

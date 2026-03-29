import { Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

interface VoiceNoteMessageProps {
  videoUrl: string;
  duration?: number;
}

export const VoiceNoteMessage = ({ videoUrl, duration }: VoiceNoteMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio
        ref={audioRef}
        src={videoUrl}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio && audio.duration) {
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
      />

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center shrink-0 cursor-pointer hover:bg-blue-500/50"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-blue-200" />
        ) : (
          <Play className="w-4 h-4 text-blue-200 ml-0.5" />
        )}
      </button>

      <div className="flex-1">
        {/* Waveform placeholder */}
        <div className="relative h-6 flex items-center gap-px">
          {Array.from({ length: 30 }).map((_, i) => {
            const height = 4 + Math.sin(i * 0.7) * 12 + Math.random() * 8;
            const isFilled = (i / 30) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  isFilled ? "bg-blue-400" : "bg-blue-800/50"
                }`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>
        <div className="text-[10px] text-blue-300/50 mt-0.5">
          {duration ? formatTime(duration) : "0:00"}
        </div>
      </div>
    </div>
  );
};

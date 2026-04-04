import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause } from "lucide-react";
import Hls from "hls.js";

const WAVEFORM_BARS = 40;

/** Deterministic pseudo-waveform from a seed string. */
function generateWaveform(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  const raw: number[] = [];
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    h = (Math.imul(h, 16807) + i) >>> 0;
    raw.push(0.15 + ((h % 1000) / 1000) * 0.85);
  }
  // Smoothing pass
  return raw.map((_, i) => {
    const p = raw[Math.max(0, i - 1)];
    const c = raw[i];
    const n = raw[Math.min(raw.length - 1, i + 1)];
    return (p + c * 2 + n) / 4;
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Convert Cloudflare Stream iframe URL to HLS manifest. */
function toStreamUrl(url: string): string {
  const m = url.match(/iframe\.videodelivery\.net\/([a-f0-9]{32})/);
  if (m) return `https://videodelivery.net/${m[1]}/manifest/video.m3u8`;
  return url;
}

interface AudioMessageProps {
  audioUrl: string;
  duration?: number;
  /** Seed for deterministic waveform (defaults to audioUrl) */
  waveformSeed?: string;
  /** Whether this message was sent by the current user */
  isOwn?: boolean;
}

export const AudioMessage = ({
  audioUrl,
  duration = 0,
  waveformSeed,
  isOwn,
}: AudioMessageProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const rafRef = useRef(0);

  const waveform = useMemo(
    () => generateWaveform(waveformSeed || audioUrl),
    [waveformSeed, audioUrl]
  );
  const streamUrl = useMemo(() => toStreamUrl(audioUrl), [audioUrl]);
  const isHls = streamUrl.includes(".m3u8") || streamUrl.includes("/hls/");
  const displayDuration = loadedDuration || duration;
  const progress = displayDuration > 0 ? currentTime / displayDuration : 0;

  const accentColor = isOwn ? "#34F080" : "#8EBBFF";

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ autoStartLoad: false });
      hls.loadSource(streamUrl);
      hls.attachMedia(audio);
      hlsRef.current = hls;
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else {
      audio.src = streamUrl;
      audio.preload = "metadata";
    }
  }, [streamUrl, isHls]);

  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    if (isPlaying) rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (hlsRef.current) hlsRef.current.startLoad();
      audio.play();
    }
  };

  const handleBarClick = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !displayDuration) return;
    audio.currentTime = (index / WAVEFORM_BARS) * displayDuration;
    setCurrentTime(audio.currentTime);
    if (!isPlaying) {
      if (hlsRef.current) hlsRef.current.startLoad();
      audio.play();
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 min-w-[280px] select-none">
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setLoadedDuration(d);
        }}
      />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer"
        style={{ backgroundColor: `${accentColor}18` }}
        type="button"
      >
        {isPlaying ? (
          <Pause
            className="w-[18px] h-[18px]"
            style={{ color: accentColor }}
            fill="currentColor"
          />
        ) : (
          <Play
            className="w-[18px] h-[18px] ml-0.5"
            style={{ color: accentColor }}
            fill="currentColor"
          />
        )}
      </button>

      {/* Waveform */}
      <div
        className="flex-1 flex items-center gap-px h-8 cursor-pointer"
        role="slider"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        {waveform.map((h, i) => {
          const filled = i / WAVEFORM_BARS <= progress;
          return (
            <div
              key={i}
              onClick={() => handleBarClick(i)}
              className="flex-1 min-w-[2px] rounded-full transition-colors duration-75"
              style={{
                height: `${Math.max(15, Math.round(h * 100))}%`,
                backgroundColor: filled
                  ? accentColor
                  : "rgba(255,255,255,0.15)",
              }}
            />
          );
        })}
      </div>

      {/* Duration / time */}
      <span className="text-[11px] text-gray-400 font-mono tabular-nums min-w-[28px] text-right shrink-0">
        {isPlaying ? formatTime(currentTime) : formatTime(displayDuration)}
      </span>
    </div>
  );
};

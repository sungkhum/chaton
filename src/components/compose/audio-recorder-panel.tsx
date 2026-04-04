import { useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { toast } from "sonner";

const LIVE_BARS = 36;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioRecorderPanelProps {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

export const AudioRecorderPanel = ({
  onSend,
  onCancel,
}: AudioRecorderPanelProps) => {
  const {
    isRecording,
    duration,
    amplitude,
    audioBlob,
    finalDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const barsRef = useRef<number[]>(Array(LIVE_BARS).fill(0));
  const [bars, setBars] = useState<number[]>(Array(LIVE_BARS).fill(0));
  const sentRef = useRef(false);

  // Auto-start recording on mount
  useEffect(() => {
    startRecording().catch(() => {
      toast.error(
        "Microphone access denied. Please allow microphone access in your browser settings."
      );
      onCancel();
    });
  }, []);

  // Push new amplitude sample into rolling bar array
  useEffect(() => {
    if (!isRecording) return;
    const next = [...barsRef.current.slice(1), amplitude];
    barsRef.current = next;
    setBars(next);
  }, [amplitude, isRecording]);

  // Auto-send once blob is ready after stop
  useEffect(() => {
    if (audioBlob && !isRecording && !sentRef.current) {
      sentRef.current = true;
      onSend(audioBlob, finalDuration);
    }
  }, [audioBlob, isRecording, finalDuration, onSend]);

  const handleCancel = () => {
    cancelRecording();
    onCancel();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Cancel */}
      <button
        onClick={handleCancel}
        className="p-1.5 text-gray-400 hover:text-red-400 cursor-pointer transition-colors rounded-full hover:bg-white/[0.04]"
        type="button"
        aria-label="Cancel recording"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Recording dot */}
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />

      {/* Live waveform */}
      <div className="flex-1 flex items-center gap-[2px] h-8 overflow-hidden">
        {bars.map((amp, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-red-400/70 shrink-0"
            style={{
              height: `${Math.max(3, amp * 28)}px`,
              transition: "height 75ms ease-out",
            }}
          />
        ))}
      </div>

      {/* Timer */}
      <span className="text-sm text-red-400 font-mono tabular-nums min-w-[36px] text-right shrink-0">
        {formatTime(duration)}
      </span>

      {/* Stop & Send */}
      <button
        onClick={stopRecording}
        className="p-2 glass-fab text-[#34F080] hover:border-[#34F080]/60 rounded-full cursor-pointer transition-all"
        type="button"
        aria-label="Stop and send audio"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

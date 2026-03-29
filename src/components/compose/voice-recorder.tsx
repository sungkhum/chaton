import { Mic, Square, X, Send } from "lucide-react";
import { useAudioRecorder, formatDuration } from "../../hooks/useAudioRecorder";

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
}

export const VoiceRecorder = ({ onSend }: VoiceRecorderProps) => {
  const {
    isRecording,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useAudioRecorder();

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2 bg-blue-900/20 rounded-full px-3 py-1.5">
        <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 max-w-[200px]" />
        <span className="text-xs text-blue-300/60">{formatDuration(duration)}</span>
        <button
          onClick={clearRecording}
          className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            onSend(audioBlob, duration);
            clearRecording();
          }}
          className="p-1.5 bg-[#ffda59] text-[#6d4800] rounded-full cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-red-900/20 rounded-full px-4 py-2 animate-pulse">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm text-red-300 font-mono">
          {formatDuration(duration)}
        </span>
        <button
          onClick={cancelRecording}
          className="p-1 text-red-400 hover:text-red-300 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={stopRecording}
          className="p-1.5 bg-red-500 text-white rounded-full cursor-pointer"
        >
          <Square className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="p-2 text-blue-400/60 hover:text-blue-300 cursor-pointer"
      title="Voice note"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
};

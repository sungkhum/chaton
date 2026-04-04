import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecorderResult {
  isRecording: boolean;
  /** Elapsed time in seconds */
  duration: number;
  /** Current amplitude 0–1 for live visualization */
  amplitude: number;
  /** Recorded audio blob (available after stop) */
  audioBlob: Blob | null;
  /** Final duration in seconds */
  finalDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
}

export function useAudioRecorder(): AudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [amplitude, setAmplitude] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [finalDuration, setFinalDuration] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef(0);
  const rafRef = useRef(0);
  const mimeRef = useRef("");

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current?.state !== "closed") ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const mime = MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    mimeRef.current = mime;

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const dur = (Date.now() - startRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      setAudioBlob(blob);
      setFinalDuration(dur);
      setIsRecording(false);
    };

    recorder.start(100);
    startRef.current = Date.now();
    setIsRecording(true);
    setDuration(0);
    setAmplitude(0);
    setAudioBlob(null);
    setFinalDuration(0);

    timerRef.current = window.setInterval(() => {
      setDuration((Date.now() - startRef.current) / 1000);
    }, 100);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      setAmplitude(Math.min(1, Math.sqrt(sum / buf.length) * 3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanup();
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
    setDuration(0);
    setAmplitude(0);
    setAudioBlob(null);
    setFinalDuration(0);
  }, [cleanup]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    duration,
    amplitude,
    audioBlob,
    finalDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

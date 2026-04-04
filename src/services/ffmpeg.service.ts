import {
  Input,
  Output,
  Conversion,
  Mp4OutputFormat,
  BufferTarget,
  BlobSource,
  MP4,
  WEBM,
  MATROSKA,
  OGG,
  WAVE,
} from "mediabunny";

let polyfillLoaded = false;

/** Load the AAC encoder. Lazy-loaded on first audio send, cached after. */
async function ensureAACEncoder(): Promise<void> {
  if (polyfillLoaded) return;
  const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
  registerAacEncoder();
  polyfillLoaded = true;
}

/**
 * Compress an audio blob to AAC in mp4 container.
 * Voice-optimized: 64kbps mono AAC — small files, fast uploads, good quality for speech.
 * Returns a Blob with type video/mp4 (accepted by DeSo upload-video).
 *
 * Uses native WebCodecs on Chrome/Safari (~17 kB), WASM polyfill on Firefox (~4.7 MB lazy).
 */
export async function compressAudioToMp4(audioBlob: Blob): Promise<Blob> {
  await ensureAACEncoder();

  const input = new Input({
    source: new BlobSource(audioBlob),
    formats: [MP4, WEBM, MATROSKA, OGG, WAVE],
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target,
  });

  const conversion = await Conversion.init({
    input,
    output,
    audio: {
      codec: "aac",
      bitrate: 64_000,
      sampleRate: 48000,
      numberOfChannels: 1,
    },
  });

  await conversion.execute();

  if (!target.buffer) {
    throw new Error("Audio compression produced no output");
  }

  return new Blob([target.buffer], { type: "video/mp4" });
}

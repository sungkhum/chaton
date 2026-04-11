import {
  identity,
  uploadVideo as desoUploadVideo,
  pollForVideoReady,
  getVideoStatus,
} from "deso-protocol";
import { useStore } from "../store";

const getNodeUrl = () => import.meta.env.VITE_NODE_URL;

export interface ImageUploadResult {
  ImageURL: string;
}

export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const appUser = useStore.getState().appUser;
  if (!appUser) throw new Error("Must be logged in to upload images");

  const jwt = await identity.jwt();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("UserPublicKeyBase58Check", appUser.PublicKeyBase58Check);
  formData.append("JWT", jwt);

  const response = await fetch(`${getNodeUrl()}/api/v0/upload-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed: ${response.statusText}`);
  }

  return response.json();
}

export interface VideoUploadResult {
  assetId: string;
  playbackId: string;
  url: string;
}

const VIDEO_UPLOAD_TIMEOUT_MS = 120_000;

export async function uploadVideoFile(file: File): Promise<VideoUploadResult> {
  const appUser = useStore.getState().appUser;
  if (!appUser) throw new Error("Must be logged in to upload media");

  const uploadAndPoll = async () => {
    const response = await desoUploadVideo({
      UserPublicKeyBase58Check: appUser.PublicKeyBase58Check,
      file,
    });

    await pollForVideoReady(response.asset.id);
    return response;
  };

  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error("Upload timed out — try a shorter clip or Wi-Fi")),
      VIDEO_UPLOAD_TIMEOUT_MS
    );
  });

  let response: Awaited<ReturnType<typeof desoUploadVideo>>;
  try {
    response = await Promise.race([uploadAndPoll(), timeout]);
  } finally {
    clearTimeout(timerId!);
  }

  // Get the actual playback URL from video status (response.url is just the upload endpoint).
  // The API returns playbackUrl (lowercase) despite the TS types saying playbackURL (uppercase).
  const status = (await getVideoStatus({ videoId: response.asset.id })) as any;
  const playbackUrl: string = status.playbackUrl || status.playbackURL;
  if (!playbackUrl) {
    throw new Error("Video processed but no playback URL returned");
  }

  return {
    assetId: response.asset.id,
    playbackId:
      status.playbackId || status.playbackID || response.asset.playbackId,
    url: playbackUrl,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

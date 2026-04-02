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
  formData.append(
    "UserPublicKeyBase58Check",
    appUser.PublicKeyBase58Check
  );
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

export async function uploadVideoFile(file: File): Promise<VideoUploadResult> {
  const appUser = useStore.getState().appUser;
  if (!appUser) throw new Error("Must be logged in to upload media");

  const response = await desoUploadVideo({
    UserPublicKeyBase58Check: appUser.PublicKeyBase58Check,
    file,
  });

  await pollForVideoReady(response.asset.id);

  // Get the Cloudflare Stream video ID from video status (response.url is just the upload endpoint).
  // Store as iframe.videodelivery.net URL to match DeSo app format — our player converts to HLS on the fly.
  const status = await getVideoStatus({ videoId: response.asset.id });
  const cfVideoId = status.playbackID || response.asset.playbackId;
  if (!cfVideoId) {
    throw new Error("Video processed but no playback ID returned");
  }
  const playbackUrl = `https://iframe.videodelivery.net/${cfVideoId}`;

  return {
    assetId: response.asset.id,
    playbackId: cfVideoId,
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

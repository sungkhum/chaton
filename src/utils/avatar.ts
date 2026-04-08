// Telegram-inspired vibrant avatar palette, tuned for dark backgrounds
export const AVATAR_COLORS = [
  { bg: "#E17076", text: "#FFFFFF" }, // coral red
  { bg: "#FAA74A", text: "#FFFFFF" }, // warm orange
  { bg: "#A695E7", text: "#FFFFFF" }, // soft violet
  { bg: "#7BC862", text: "#FFFFFF" }, // fresh green
  { bg: "#6EC9CB", text: "#FFFFFF" }, // teal cyan
  { bg: "#65AADD", text: "#FFFFFF" }, // sky blue
  { bg: "#EE7AAE", text: "#FFFFFF" }, // rose pink
  { bg: "#E4AE3A", text: "#FFFFFF" }, // golden amber
];

export function hashToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!cleaned) return "?";
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return cleaned.substring(0, 2).toUpperCase();
}

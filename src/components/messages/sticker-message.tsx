interface StickerMessageProps {
  stickerUrl: string;
  title?: string;
  width?: number;
  height?: number;
}

export const StickerMessage = ({ stickerUrl, title, width, height }: StickerMessageProps) => {
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div className="max-w-[140px] md:max-w-[180px]">
      <img
        src={stickerUrl}
        alt={title || "Sticker"}
        className="w-full h-auto object-contain"
        style={aspectRatio ? { aspectRatio } : undefined}
        loading="lazy"
      />
    </div>
  );
};

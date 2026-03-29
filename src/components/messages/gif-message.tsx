interface GifMessageProps {
  gifUrl: string;
  title?: string;
  width?: number;
  height?: number;
}

export const GifMessage = ({ gifUrl, title, width, height }: GifMessageProps) => {
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div className="rounded-lg overflow-hidden max-w-[300px]">
      <img
        src={gifUrl}
        alt={title || "GIF"}
        className="w-full h-auto object-cover"
        style={aspectRatio ? { aspectRatio } : undefined}
        loading="lazy"
      />
      {title && (
        <div className="text-[10px] text-blue-300/40 mt-1 px-1">
          via GIPHY
        </div>
      )}
    </div>
  );
};

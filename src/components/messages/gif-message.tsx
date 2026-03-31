interface GifMessageProps {
  gifUrl: string;
  title?: string;
  width?: number;
  height?: number;
  caption?: string;
}

export const GifMessage = ({ gifUrl, title, width, height, caption }: GifMessageProps) => {
  const aspectRatio = width && height ? width / height : undefined;

  return (
    <div className="rounded-lg overflow-hidden max-w-[250px] md:max-w-[300px]">
      <img
        src={gifUrl}
        alt={title || "GIF"}
        className="w-full h-auto object-cover"
        style={aspectRatio ? { aspectRatio } : undefined}
        loading="lazy"
      />
      {caption && (
        <p className="text-sm text-white mt-2 px-1 whitespace-pre-wrap break-words select-text">
          {caption}
        </p>
      )}
    </div>
  );
};

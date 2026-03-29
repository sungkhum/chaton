import { useMemo } from "react";
import { marked } from "marked";

// Configure marked for chat messages
marked.setOptions({
  breaks: true, // Convert \n to <br> (chat-style line breaks)
  gfm: true, // GitHub-flavored markdown (tables, strikethrough, etc.)
});

// Custom renderer to style links and add security attrs
const renderer = new marked.Renderer();
renderer.link = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

// Prevent images from rendering inline (could be used for phishing)
renderer.image = ({ href, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text || href}</a>`;
};

export function FormattedMessage({ children }: { children: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(children, { renderer, async: false }) as string;
    // Remove wrapping <p> tags for simple single-line messages to avoid extra spacing
    const trimmed = raw.trim();
    if (
      trimmed.startsWith("<p>") &&
      trimmed.endsWith("</p>") &&
      trimmed.indexOf("<p>", 1) === -1
    ) {
      return trimmed.slice(3, -4);
    }
    return trimmed;
  }, [children]);

  return (
    <div
      className="text-md break-words formatted-message"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

import { useEffect } from "react";

const BASE_URL = "https://getchaton.com";
const DEFAULT_TITLE = "ChatOn — Messaging that no one can shut down";
const DEFAULT_DESCRIPTION =
  "End-to-end encrypted messaging on the DeSo blockchain. Your message content is unreadable to everyone except you and your recipients. Built to scale. Impossible to censor.";

interface PageMeta {
  title?: string;
  description?: string;
  path?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

function setMetaTag(
  property: string,
  content: string,
  attr: "name" | "property" = "property"
) {
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLinkTag(rel: string, href: string) {
  let el = document.querySelector(
    `link[rel="${rel}"]`
  ) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function usePageMeta({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path,
  ogTitle,
  ogDescription,
  ogImage,
}: PageMeta = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const canonicalUrl = BASE_URL + (path ?? window.location.pathname);

    setMetaTag("description", description, "name");
    setLinkTag("canonical", canonicalUrl);
    setMetaTag("og:url", canonicalUrl);
    setMetaTag("og:title", ogTitle ?? title);
    setMetaTag("og:description", ogDescription ?? description);
    setMetaTag("twitter:title", ogTitle ?? title, "name");
    setMetaTag("twitter:description", ogDescription ?? description, "name");

    if (ogImage) {
      const imageUrl = ogImage.startsWith("http")
        ? ogImage
        : BASE_URL + ogImage;
      setMetaTag("og:image", imageUrl);
      setMetaTag(
        "og:image:type",
        ogImage.endsWith(".png") ? "image/png" : "image/webp"
      );
      setMetaTag("og:image:alt", ogTitle ?? title);
      setMetaTag("twitter:image", imageUrl, "name");
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, path, ogTitle, ogDescription, ogImage]);
}

export interface TranslationResult {
  translatedText: string;
  detectedLang: string;
}

// In-memory cache: keyed by "text_hash:sourceLang:targetLang"
// Value is either a translation result or "same" (source === target)
const cache = new Map<string, TranslationResult | "same">();

// Simple hash for cache keys (avoids storing full message text as key)
function hashKey(text: string, targetLang: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return `${h}:${text.length}:${targetLang}`;
}

// Request queue to avoid rate-limiting (max 3 concurrent, 150ms stagger)
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const STAGGER_MS = 150;
const queue: Array<() => void> = [];

function processQueue() {
  while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = queue.shift();
    next?.();
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequests++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeRequests--;
          setTimeout(processQueue, STAGGER_MS);
        });
    };

    if (activeRequests < MAX_CONCURRENT) {
      run();
    } else {
      queue.push(run);
    }
  });
}

// Replace @mentions with XML-style placeholders that translation APIs preserve,
// and return a function to restore them in the translated output.
function protectMentions(text: string): {
  cleaned: string;
  restore: (translated: string) => string;
} {
  const mentions: string[] = [];
  const cleaned = text.replace(/@\w+/g, (match) => {
    const idx = mentions.length;
    mentions.push(match);
    return `<x${idx}/>`;
  });

  const restore = (translated: string): string => {
    let result = translated;
    for (let i = 0; i < mentions.length; i++) {
      // Handle variants the API might return: <x0/>, <x0 />, <x0>, </x0>, <x0></x0>
      const mention = mentions[i]!;
      result = result.replace(
        new RegExp(`<x${i}\\s*/?>(?:\\s*</x${i}>)?|</x${i}>`, "g"),
        mention
      );
    }
    // If the API dropped a placeholder entirely, prepend the missing mention
    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i]!;
      if (!result.includes(mention)) {
        result = mention + " " + result;
      }
    }
    return result;
  };

  return { cleaned, restore };
}

/**
 * Translate text using the free MyMemory API (CORS-friendly, no key needed).
 *
 * @param text - Text to translate
 * @param sourceLang - Source language code (e.g., "en") or "auto" for auto-detect
 * @param targetLang - Target language code (e.g., "es")
 * @returns Translation result, or null if translation failed or source === target
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult | null> {
  // Same language — no translation needed
  if (sourceLang === targetLang) {
    return null;
  }

  const key = hashKey(text, targetLang);
  const cached = cache.get(key);
  if (cached === "same") return null;
  if (cached) return cached;

  // Protect @mentions from being translated/mangled
  const { cleaned: textToTranslate, restore } = protectMentions(text);

  // If the message is only mentions with no translatable text, skip the API call
  const strippedText = textToTranslate.replace(/<x\d+\/>/g, "").trim();
  if (!strippedText) {
    cache.set(key, "same");
    return null;
  }

  return enqueue(async () => {
    // Re-check cache (another request may have resolved while queued)
    const rechecked = cache.get(key);
    if (rechecked === "same") return null;
    if (rechecked) return rechecked;

    try {
      const langPair =
        sourceLang === "auto"
          ? `auto|${targetLang}`
          : `${sourceLang}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        textToTranslate.slice(0, 5000)
      )}&langpair=${langPair}`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
        return null;
      }

      const rawTranslated = data.responseData.translatedText as string;
      const translatedText = restore(rawTranslated);
      const detectedLang =
        data.matches?.[0]?.source?.split("-")[0] || sourceLang;

      // If detected source is same as target, cache as "same"
      if (detectedLang === targetLang) {
        cache.set(key, "same");
        return null;
      }

      // If the API returned the same text, treat as same language
      if (translatedText.toLowerCase().trim() === text.toLowerCase().trim()) {
        cache.set(key, "same");
        return null;
      }

      const result: TranslationResult = { translatedText, detectedLang };
      cache.set(key, result);
      return result;
    } catch {
      return null;
    }
  });
}

/** Check if a translation is cached (without triggering a request). */
export function getCachedTranslation(
  text: string,
  targetLang: string
): TranslationResult | "same" | undefined {
  return cache.get(hashKey(text, targetLang));
}

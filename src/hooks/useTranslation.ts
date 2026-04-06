import { useCallback, useEffect, useRef, useState } from "react";
import { DecryptedMessageEntryResponse } from "deso-protocol";
import { parseMessageType } from "../utils/extra-data";
import { detectLanguageSync } from "../utils/detect-language";
import {
  translateText,
  getCachedTranslation,
  TranslationResult,
} from "../services/translate.service";

export interface MessageTranslation {
  text: string;
  sourceLang: string;
}

/**
 * Auto-translate hook: translates non-sender messages whose language
 * differs from the user's preferred language.
 *
 * Returns a Map of messageKey → translation, plus a manual translate function
 * for use when auto-translate is OFF.
 */
export function useTranslation(
  messages: DecryptedMessageEntryResponse[],
  userPublicKey: string | undefined,
  preferredLang: string,
  autoTranslate: boolean
) {
  const [translations, setTranslations] = useState<
    Map<string, MessageTranslation>
  >(() => new Map());
  const [translatingKeys, setTranslatingKeys] = useState<Set<string>>(
    () => new Set()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // rerender-use-ref-transient-values: track translations/translatingKeys in
  // refs so the effect doesn't depend on them (avoids infinite re-trigger loop).
  const translationsRef = useRef(translations);
  translationsRef.current = translations;
  const translatingKeysRef = useRef(translatingKeys);
  translatingKeysRef.current = translatingKeys;

  // Manual translate a single message (for context menu)
  // rerender-functional-setstate: uses functional setState so callback is stable
  const translateMessage = useCallback(
    async (message: DecryptedMessageEntryResponse) => {
      const key = message.MessageInfo.TimestampNanosString;
      const text = message.DecryptedMessage;
      if (!text || text.length < 5) return;

      // Already translated? Toggle off
      if (translationsRef.current.has(key)) {
        setTranslations((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      const parsed = parseMessageType(message);
      const sourceLang = parsed.lang || detectLanguageSync(text) || "auto";

      setTranslatingKeys((prev) => new Set(prev).add(key));

      try {
        const result = await translateText(text, sourceLang, preferredLang);
        if (result) {
          setTranslations((prev) =>
            new Map(prev).set(key, {
              text: result.translatedText,
              sourceLang: result.detectedLang,
            })
          );
        }
      } finally {
        setTranslatingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [preferredLang]
  );

  // Auto-translate: process messages when they change.
  // Only depends on messages/userPublicKey/preferredLang/autoTranslate —
  // NOT on translations/translatingKeys (read via refs to avoid infinite loop).
  useEffect(() => {
    if (!autoTranslate || !userPublicKey || !preferredLang) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const currentTranslations = translationsRef.current;
      const currentTranslating = translatingKeysRef.current;

      const toTranslate: Array<{
        key: string;
        text: string;
        sourceLang: string;
      }> = [];

      for (const msg of messages) {
        const key = msg.MessageInfo.TimestampNanosString;

        // Skip own messages
        if (msg.IsSender) continue;
        // Skip if already translated or in-flight
        if (currentTranslations.has(key)) continue;
        if (currentTranslating.has(key)) continue;

        const text = msg.DecryptedMessage;
        if (!text || text.length < 5) continue;

        const parsed = parseMessageType(msg);
        // Skip non-text messages
        if (parsed.type !== "text") continue;

        const sourceLang = parsed.lang || detectLanguageSync(text) || "auto";

        // Skip if same language
        if (sourceLang === preferredLang) continue;

        // Check service-level cache first (no API call)
        const cached = getCachedTranslation(text, preferredLang);
        if (cached === "same") continue;
        if (cached) {
          setTranslations((prev) =>
            new Map(prev).set(key, {
              text: cached.translatedText,
              sourceLang: cached.detectedLang,
            })
          );
          continue;
        }

        toTranslate.push({ key, text, sourceLang });
      }

      // Translate queued messages (the service handles throttling)
      for (const { key, text, sourceLang } of toTranslate) {
        setTranslatingKeys((prev) => new Set(prev).add(key));

        translateText(text, sourceLang, preferredLang)
          .then((result: TranslationResult | null) => {
            if (result) {
              setTranslations((prev) =>
                new Map(prev).set(key, {
                  text: result.translatedText,
                  sourceLang: result.detectedLang,
                })
              );
            }
          })
          .finally(() => {
            setTranslatingKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          });
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [messages, userPublicKey, preferredLang, autoTranslate]);

  return { translations, translatingKeys, translateMessage };
}

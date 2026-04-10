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

      const replyKey = `reply:${key}`;

      // Already translated? Toggle off
      if (translationsRef.current.has(key)) {
        setTranslations((prev) => {
          const next = new Map(prev);
          next.delete(key);
          next.delete(replyKey);
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

        // Also translate the reply preview if present
        // Use "auto" for source lang — the quoted message may be in a different language
        if (parsed.replyPreview && parsed.replyPreview.length >= 5) {
          try {
            const replyResult = await translateText(
              parsed.replyPreview,
              "auto",
              preferredLang
            );
            if (replyResult && translationsRef.current.has(key)) {
              setTranslations((prev) =>
                new Map(prev).set(replyKey, {
                  text: replyResult.translatedText,
                  sourceLang: replyResult.detectedLang,
                })
              );
            }
          } catch {
            // Reply preview translation failed — not critical, ignore
          }
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
        replyPreview?: string;
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
          const updates = new Map<string, MessageTranslation>();
          updates.set(key, {
            text: cached.translatedText,
            sourceLang: cached.detectedLang,
          });
          // Also translate reply preview from cache if available
          let replyNeedsApi = false;
          if (parsed.replyPreview && parsed.replyPreview.length >= 5) {
            const cachedReply = getCachedTranslation(
              parsed.replyPreview,
              preferredLang
            );
            if (cachedReply && cachedReply !== "same") {
              updates.set(`reply:${key}`, {
                text: cachedReply.translatedText,
                sourceLang: cachedReply.detectedLang,
              });
            } else if (cachedReply !== "same") {
              replyNeedsApi = true;
            }
          }
          setTranslations((prev) => {
            const next = new Map(prev);
            for (const [k, v] of updates) next.set(k, v);
            return next;
          });
          // Main text was cached but reply preview was not — queue reply for API
          if (replyNeedsApi) {
            toTranslate.push({
              key,
              text: "",
              sourceLang,
              replyPreview: parsed.replyPreview,
            });
          }
          continue;
        }

        toTranslate.push({
          key,
          text,
          sourceLang,
          replyPreview:
            parsed.replyPreview && parsed.replyPreview.length >= 5
              ? parsed.replyPreview
              : undefined,
        });
      }

      // Translate queued messages (the service handles throttling)
      for (const { key, text, sourceLang, replyPreview } of toTranslate) {
        setTranslatingKeys((prev) => new Set(prev).add(key));

        // Reply-only entry (main text was served from cache)
        const mainPromise = text
          ? translateText(text, sourceLang, preferredLang).then(
              (result: TranslationResult | null) => {
                if (result) {
                  setTranslations((prev) =>
                    new Map(prev).set(key, {
                      text: result.translatedText,
                      sourceLang: result.detectedLang,
                    })
                  );
                }
              }
            )
          : Promise.resolve();

        mainPromise
          .then(() => {
            // Also translate reply preview if present
            // Use "auto" — the quoted message may be in a different language
            if (replyPreview) {
              return translateText(replyPreview, "auto", preferredLang)
                .then((replyResult: TranslationResult | null) => {
                  if (replyResult) {
                    setTranslations((prev) =>
                      new Map(prev).set(`reply:${key}`, {
                        text: replyResult.translatedText,
                        sourceLang: replyResult.detectedLang,
                      })
                    );
                  }
                })
                .catch(() => {
                  // Reply preview translation failed — not critical, ignore
                });
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

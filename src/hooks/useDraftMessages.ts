import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_PREFIX = "chaton:drafts:";

function storageKey(publicKey: string): string {
  return STORAGE_PREFIX + publicKey;
}

function loadDrafts(publicKey: string): Record<string, string> {
  if (!publicKey) return {};
  try {
    const stored = localStorage.getItem(storageKey(publicKey));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveDrafts(publicKey: string, drafts: Record<string, string>) {
  if (!publicKey) return;
  try {
    localStorage.setItem(storageKey(publicKey), JSON.stringify(drafts));
  } catch {
    // localStorage might be full or disabled
  }
}

export function useDraftMessages(publicKey: string) {
  // rerender-lazy-state-init: pass initializer function to avoid parsing on every render
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    loadDrafts(publicKey)
  );

  // Reload drafts when the active account changes
  const prevKeyRef = useRef(publicKey);
  useEffect(() => {
    if (publicKey !== prevKeyRef.current) {
      prevKeyRef.current = publicKey;
      setDrafts(loadDrafts(publicKey));
    }
  }, [publicKey]);

  const getDraft = useCallback(
    (conversationKey: string): string => {
      return drafts[conversationKey] || "";
    },
    [drafts]
  );

  const setDraft = useCallback(
    (conversationKey: string, text: string) => {
      setDrafts((prev) => {
        const next = { ...prev };
        if (text) {
          next[conversationKey] = text;
        } else {
          delete next[conversationKey];
        }
        saveDrafts(publicKey, next);
        return next;
      });
    },
    [publicKey]
  );

  const clearDraft = useCallback(
    (conversationKey: string) => {
      setDraft(conversationKey, "");
    },
    [setDraft]
  );

  return { getDraft, setDraft, clearDraft };
}

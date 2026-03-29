import { useState, useCallback } from "react";

const STORAGE_KEY = "chattra:drafts";

function loadDrafts(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveDrafts(drafts: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // localStorage might be full or disabled
  }
}

export function useDraftMessages() {
  const [drafts, setDrafts] = useState<Record<string, string>>(loadDrafts);

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
        saveDrafts(next);
        return next;
      });
    },
    []
  );

  const clearDraft = useCallback(
    (conversationKey: string) => {
      setDraft(conversationKey, "");
    },
    [setDraft]
  );

  return { getDraft, setDraft, clearDraft };
}

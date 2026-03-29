import { useCallback, useRef, useState, useEffect } from "react";

const TYPING_DEBOUNCE_MS = 3000;
const TYPING_DISPLAY_TIMEOUT_MS = 4000;

export function useTypingIndicator(sendTyping: (conversationKey: string) => void) {
  const lastSent = useRef(0);

  const onKeystroke = useCallback(
    (conversationKey: string) => {
      const now = Date.now();
      if (now - lastSent.current > TYPING_DEBOUNCE_MS) {
        lastSent.current = now;
        sendTyping(conversationKey);
      }
    },
    [sendTyping]
  );

  return { onKeystroke };
}

export function useTypingDisplay() {
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { from: string; timestamp: number }>
  >(new Map());

  const onTypingReceived = useCallback(
    (from: string, conversationKey: string) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(`${conversationKey}:${from}`, {
          from,
          timestamp: Date.now(),
        });
        return next;
      });
    },
    []
  );

  // Clean up stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const [key, value] of next) {
          if (now - value.timestamp > TYPING_DISPLAY_TIMEOUT_MS) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTypingUsersForConversation = useCallback(
    (conversationKey: string): string[] => {
      const result: string[] = [];
      for (const [key, value] of typingUsers) {
        if (key.startsWith(`${conversationKey}:`)) {
          result.push(value.from);
        }
      }
      return result;
    },
    [typingUsers]
  );

  return { onTypingReceived, getTypingUsersForConversation };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { AccessGroupEntryResponse } from "deso-protocol";
import { ConversationMap } from "../utils/types";
import {
  MessageSearchResult,
  SearchProgress,
  orchestrateDeepSearch,
  searchCachedMessages,
} from "../services/message-search.service";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const BATCH_INTERVAL_MS = 200;
const MAX_RESULTS = 100;

export interface UseMessageSearchOptions {
  userPublicKey: string;
  conversations: ConversationMap;
  usernameMap: Record<string, string>;
  allAccessGroups: AccessGroupEntryResponse[];
}

export interface UseMessageSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: MessageSearchResult[];
  isSearching: boolean;
  isDeepSearching: boolean;
  progress: SearchProgress | null;
  clearSearch: () => void;
}

export function useMessageSearch(
  options: UseMessageSearchOptions
): UseMessageSearchReturn {
  const { userPublicKey, conversations, usernameMap, allAccessGroups } = options;

  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const deepResultsRef = useRef<MessageSearchResult[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchedTimestampsRef = useRef<Set<string>>(new Set());

  // Stable ref for latest conversations/usernameMap so deep search uses fresh data
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const usernameMapRef = useRef(usernameMap);
  usernameMapRef.current = usernameMap;
  const accessGroupsRef = useRef(allAccessGroups);
  accessGroupsRef.current = allAccessGroups;

  const cancelSearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const clearSearch = useCallback(() => {
    cancelSearch();
    setQueryState("");
    setResults([]);
    setIsSearching(false);
    setIsDeepSearching(false);
    setProgress(null);
    deepResultsRef.current = [];
    searchedTimestampsRef.current = new Set();
  }, [cancelSearch]);

  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);

      // Cancel any in-flight search
      cancelSearch();

      const trimmed = q.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setResults([]);
        setIsSearching(false);
        setIsDeepSearching(false);
        setProgress(null);
        deepResultsRef.current = [];
        searchedTimestampsRef.current = new Set();
        return;
      }

      setIsSearching(true);

      debounceRef.current = setTimeout(async () => {
        const currentConversations = conversationsRef.current;
        const currentUsernameMap = usernameMapRef.current;
        const searchTerm = trimmed;

        // Phase 1: cached/in-memory search
        try {
          const { results: cacheResults, searchedTimestamps } =
            await searchCachedMessages(
              userPublicKey,
              searchTerm,
              currentConversations,
              currentUsernameMap
            );

          setResults(cacheResults);
          setIsSearching(false);
          searchedTimestampsRef.current = searchedTimestamps;

          // Phase 2: deep search
          const controller = new AbortController();
          abortRef.current = controller;
          deepResultsRef.current = [...cacheResults];
          setIsDeepSearching(true);

          const flushBatch = () => {
            const sorted = [...deepResultsRef.current].sort(
              (a, b) => b.timestamp - a.timestamp
            );
            setResults(sorted.slice(0, MAX_RESULTS));
          };

          await orchestrateDeepSearch(
            userPublicKey,
            searchTerm,
            currentConversations,
            currentUsernameMap,
            accessGroupsRef.current,
            searchedTimestampsRef.current,
            controller.signal,
            (result) => {
              deepResultsRef.current.push(result);
              // Batched UI update
              if (!batchTimerRef.current) {
                batchTimerRef.current = setTimeout(() => {
                  batchTimerRef.current = null;
                  flushBatch();
                }, BATCH_INTERVAL_MS);
              }
            },
            (prog) => {
              setProgress(prog);
            }
          );

          // Final flush
          if (batchTimerRef.current) {
            clearTimeout(batchTimerRef.current);
            batchTimerRef.current = null;
          }
          if (!controller.signal.aborted) {
            flushBatch();
          }
        } catch (err) {
          console.warn("[useMessageSearch] Search error:", err);
        } finally {
          setIsSearching(false);
          setIsDeepSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    [userPublicKey, cancelSearch]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelSearch();
    };
  }, [cancelSearch]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    isDeepSearching,
    progress,
    clearSearch,
  };
}

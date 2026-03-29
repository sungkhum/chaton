import { createStore, get, set, type UseStore } from "idb-keyval";

let store: UseStore | null = null;
try {
  store = createStore("chattra-hidden-msgs", "hidden-store");
} catch {
  // IndexedDB unavailable (e.g. some private browsing modes)
}

function storeKey(userPublicKey: string): string {
  return `hidden:${userPublicKey}`;
}

/** Get all hidden message timestamp IDs for a user. */
export async function getHiddenMessageIds(
  userPublicKey: string
): Promise<Set<string>> {
  if (!store) return new Set();
  try {
    const ids = await get<string[]>(storeKey(userPublicKey), store);
    return new Set(ids ?? []);
  } catch {
    return new Set();
  }
}

/** Hide a message (delete for me). */
export async function hideMessage(
  userPublicKey: string,
  timestampNanosString: string
): Promise<void> {
  if (!store) return;
  try {
    const existing = await getHiddenMessageIds(userPublicKey);
    existing.add(timestampNanosString);
    await set(storeKey(userPublicKey), [...existing], store);
  } catch {
    // Best-effort
  }
}

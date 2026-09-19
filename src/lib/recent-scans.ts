export interface RecentScan {
  id: string;
  url: string;
  score: number | null;
  at: number;
}

const STORAGE_KEY = "leakfix:recent-scans";
const MAX_ENTRIES = 8;
const EMPTY: RecentScan[] = [];

let cache: RecentScan[] | null = null;
const listeners = new Set<() => void>();

function parse(value: string | null): RecentScan[] {
  if (!value) return EMPTY;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    const valid = parsed.filter(
      (item): item is RecentScan =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentScan).id === "string" &&
        typeof (item as RecentScan).url === "string",
    );
    return valid.length > 0 ? valid : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Recent scans are a client-side convenience stored in localStorage. They are
 * exposed through an external store so React can read them without a
 * setState-in-effect and without hydration mismatches.
 */
export function getRecentScansSnapshot(): RecentScan[] {
  if (cache === null) {
    try {
      cache = parse(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

export function getRecentScansServerSnapshot(): RecentScan[] {
  return EMPTY;
}

export function subscribeRecentScans(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function recordRecentScan(entry: { id: string; url: string; score?: number | null }): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentScansSnapshot().filter((item) => item.id !== entry.id);
    const next: RecentScan[] = [
      { id: entry.id, url: entry.url, score: entry.score ?? null, at: Date.now() },
      ...existing,
    ].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cache = next;
    emit();
  } catch {
    // Storage can be unavailable (private mode); recent scans are a convenience.
  }
}

export function clearRecentScans(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    cache = EMPTY;
    emit();
  } catch {
    // ignore
  }
}

const KEY_PREFIX = 'visited-list:';

export interface VisitedList {
  id: string;
  name: string;
  lastVisitedAt: number;
}

/**
 * Records (or refreshes) a list that this browser visited as a non-owner.
 * Used to populate "Shared with me" on the home page so visitors of a share
 * link have a way back to lists they don't own.
 */
export function recordVisit(listId: string, name: string): void {
  if (typeof window === 'undefined') return;
  const entry: VisitedList = { id: listId, name, lastVisitedAt: Date.now() };
  window.localStorage.setItem(KEY_PREFIX + listId, JSON.stringify(entry));
}

export function getVisitedLists(): VisitedList[] {
  if (typeof window === 'undefined') return [];
  const entries: VisitedList[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as VisitedList;
      if (
        parsed &&
        typeof parsed.id === 'string' &&
        typeof parsed.name === 'string' &&
        typeof parsed.lastVisitedAt === 'number'
      ) {
        entries.push(parsed);
      }
    } catch {
      // Ignore malformed entry — a future visit will overwrite it.
    }
  }
  return entries.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
}

export function removeVisited(listId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY_PREFIX + listId);
}

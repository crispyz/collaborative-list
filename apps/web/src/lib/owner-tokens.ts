const KEY_PREFIX = 'owner-token:';

export function saveOwnerToken(listId: string, token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_PREFIX + listId, token);
}

export function getOwnerToken(listId: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(KEY_PREFIX + listId) ?? undefined;
}

export function removeOwnerToken(listId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY_PREFIX + listId);
}

export function getOwnedListIds(): string[] {
  if (typeof window === 'undefined') return [];
  const ids: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(KEY_PREFIX)) {
      ids.push(key.slice(KEY_PREFIX.length));
    }
  }
  return ids;
}

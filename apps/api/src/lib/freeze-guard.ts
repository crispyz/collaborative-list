import type { List } from '@collab/db';
import { HttpError } from './errors.js';

export function assertCanMutate(list: List, ownerToken: string | undefined): void {
  if (!list.isFrozen) return;
  if (!ownerToken || ownerToken !== list.ownerToken) {
    throw new HttpError(403, 'LIST_FROZEN', 'List is frozen; only the owner can mutate it.');
  }
}

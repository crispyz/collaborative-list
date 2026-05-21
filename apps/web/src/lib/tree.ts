import type { TodoItem } from '@collab/shared';

export interface TodoTree {
  roots: TodoItem[];
  childrenByParent: Map<string, TodoItem[]>;
}

/**
 * Group a flat todos array into root-level rows and a `parentId → children`
 * lookup. Each group is sorted by `position asc`, matching the server's
 * read order. One pass + two sort passes.
 */
export function buildTree(todos: TodoItem[]): TodoTree {
  const roots: TodoItem[] = [];
  const childrenByParent = new Map<string, TodoItem[]>();
  for (const t of todos) {
    if (t.parentId === null) {
      roots.push(t);
    } else {
      const arr = childrenByParent.get(t.parentId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentId, arr);
    }
  }
  roots.sort((a, b) => a.position - b.position);
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.position - b.position);
  }
  return { roots, childrenByParent };
}

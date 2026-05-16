import type { List as ListRow, TodoItem as TodoItemRow } from '@collab/db';
import type { List, TodoItem } from '@collab/shared';

export function serializeList(row: ListRow): List {
  return {
    id: row.id,
    name: row.name,
    isFrozen: row.isFrozen,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeTodoItem(row: TodoItemRow): TodoItem {
  return {
    id: row.id,
    listId: row.listId,
    parentId: row.parentId,
    position: row.position,
    title: row.title,
    isDone: row.isDone,
    priceCents: row.priceCents,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

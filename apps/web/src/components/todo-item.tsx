'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TodoItem as Todo } from '@collab/shared';
import { TodoRowContent } from '@/components/todo-row-content';

interface Props {
  todo: Todo;
  listId: string;
  ownerToken: string | undefined;
  canEdit: boolean;
  canDrag: boolean;
  /** 0 = root, 1 = subtask. Drives indentation when `flat`. */
  depth?: number;
  /**
   * When the row lives inside another card (e.g. as a subtask under a TodoBranch),
   * removes the outer border/rounded so the parent card owns the container shape.
   */
  flat?: boolean;
}

export function TodoRow({
  todo,
  listId,
  ownerToken,
  canEdit,
  canDrag,
  depth = 0,
  flat = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    disabled: !canDrag,
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className={
        flat
          ? `group/row flex items-center gap-3 border-t px-3 py-2.5 ${depth === 1 ? 'pl-8' : ''}`
          : 'group/row flex items-center gap-3 rounded-md border bg-card p-3'
      }
    >
      <TodoRowContent
        todo={todo}
        listId={listId}
        ownerToken={ownerToken}
        canEdit={canEdit}
        canDrag={canDrag}
        attributes={attributes}
        listeners={listeners}
      />
    </li>
  );
}

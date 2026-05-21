'use client';

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CreateTodoInput, TodoItem } from '@collab/shared';
import { ApiError, api } from '@/lib/api';
import { TodoRow } from '@/components/todo-item';
import { TodoRowContent } from '@/components/todo-row-content';
import { Input } from '@/components/ui/input';

interface Props {
  parent: TodoItem;
  children: TodoItem[];
  listId: string;
  ownerToken: string | undefined;
  canEdit: boolean;
  canDrag: boolean;
}

export function TodoBranch({ parent, children, listId, ownerToken, canEdit, canDrag }: Props) {
  const queryClient = useQueryClient();

  // Root-level sortable. The whole card (parent + children + add-row) is a
  // single sortable item at the root scope.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: parent.id,
    disabled: !canDrag,
  });
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const [expanded, setExpanded] = useState(true);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const hasChildren = children.length > 0;
  const doneCount = children.filter((c) => c.isDone).length;
  const showAddForm = expanded && canEdit && (hasChildren || addingSubtask);

  const createSubtask = useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(listId, input, ownerToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list', listId] }),
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add subtask.');
    },
  });

  function addSubtaskAction() {
    const title = subtaskDraft.trim();
    if (!title) {
      toast.error('Subtask title is required.');
      return;
    }
    createSubtask.mutate({ title, parentId: parent.id });
    setSubtaskDraft('');
  }

  function startAddingSubtask() {
    setExpanded(true);
    setAddingSubtask(true);
    requestAnimationFrame(() => addInputRef.current?.focus());
  }

  // Branch-only controls injected between the title and price columns of the parent row.
  const middle = (
    <>
      {canEdit && (
        <button
          type="button"
          onClick={startAddingSubtask}
          aria-label="Add subtask"
          className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/row:opacity-100"
        >
          <Plus className="size-4" />
        </button>
      )}
      {hasChildren && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <span className="tabular-nums">
            {doneCount}/{children.length}
          </span>
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
      )}
    </>
  );

  return (
    <li
      ref={setNodeRef}
      style={sortableStyle}
      className="overflow-hidden rounded-md border bg-card"
    >
      {/* Parent row — its own hover scope (`group/row`) so the parent's
          pencils + Add-subtask button don't trigger when hovering subtask rows. */}
      <div className="group/row flex items-center gap-3 p-3">
        <TodoRowContent
          todo={parent}
          listId={listId}
          ownerToken={ownerToken}
          canEdit={canEdit}
          canDrag={canDrag}
          attributes={attributes}
          listeners={listeners}
          middle={middle}
        />
      </div>

      {/* Children list — own SortableContext so subtasks reorder among siblings. */}
      {expanded && hasChildren && (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul>
            {children.map((c) => (
              <TodoRow
                key={c.id}
                todo={c}
                listId={listId}
                ownerToken={ownerToken}
                canEdit={canEdit}
                canDrag={canDrag}
                depth={1}
                flat
              />
            ))}
          </ul>
        </SortableContext>
      )}

      {/* Add-subtask row — visible when there are already subtasks, OR when the
          user just clicked the hover-+ on the parent (addingSubtask=true). */}
      {showAddForm && (
        <form
          action={addSubtaskAction}
          className="flex items-center gap-3 border-t bg-muted/30 px-3 py-2.5"
        >
          <span
            aria-hidden
            className="ml-1 flex size-5 shrink-0 items-center justify-center rounded border border-dashed text-muted-foreground"
          >
            <Plus className="size-3" />
          </span>
          <Input
            ref={addInputRef}
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSubtaskDraft('');
                if (!hasChildren) setAddingSubtask(false);
              }
            }}
            onBlur={() => {
              // If the user opened the form via hover-+ and walked away
              // without typing, close it so empty parents stay tidy.
              if (!hasChildren && !subtaskDraft.trim()) setAddingSubtask(false);
            }}
            placeholder="Add subtask…"
            maxLength={500}
            disabled={createSubtask.isPending}
            className="h-auto border-0 bg-transparent px-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
          />
        </form>
      )}
    </li>
  );
}

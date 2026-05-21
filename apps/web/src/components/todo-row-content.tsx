'use client';

import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TodoItem } from '@collab/shared';
import { formatCents, priceToInput } from '@/lib/money';
import { useTodoEdit } from '@/lib/use-todo-edit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  todo: TodoItem;
  listId: string;
  ownerToken: string | undefined;
  canEdit: boolean;
  canDrag: boolean;
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
  /**
   * Optional content rendered between the title column and the price column.
   * Used by TodoBranch's parent row for the hover-+ button and counter pill.
   * Pencil-reveal styles assume the wrapping element uses `group/row`.
   */
  middle?: ReactNode;
}

export function TodoRowContent({
  todo,
  listId,
  ownerToken,
  canEdit,
  canDrag,
  attributes,
  listeners,
  middle,
}: Props) {
  const {
    update,
    remove,
    editingField,
    setEditingField,
    titleDraft,
    setTitleDraft,
    priceDraft,
    setPriceDraft,
    saveTitle,
    savePrice,
  } = useTodoEdit(todo, listId, ownerToken);

  return (
    <>
      {canDrag && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder "${todo.title}"`}
          className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <input
        type="checkbox"
        checked={todo.isDone}
        onChange={(e) => update.mutate({ isDone: e.target.checked })}
        disabled={!canEdit}
        className="size-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Mark "${todo.title}" as ${todo.isDone ? 'not done' : 'done'}`}
      />

      {editingField === 'title' && canEdit ? (
        <Input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveTitle();
            if (e.key === 'Escape') {
              setTitleDraft(todo.title);
              setEditingField(null);
            }
          }}
          maxLength={500}
          className="flex-1"
        />
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => {
            setTitleDraft(todo.title);
            setEditingField('title');
          }}
          className={`flex flex-1 cursor-pointer items-center gap-2 truncate text-left text-sm ${
            todo.isDone ? 'text-muted-foreground line-through' : ''
          }`}
          aria-label={`Edit title of "${todo.title}"`}
        >
          <span className="truncate">{todo.title}</span>
          <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-60" />
        </button>
      ) : (
        <span
          className={`flex-1 truncate text-sm ${
            todo.isDone ? 'text-muted-foreground line-through' : ''
          }`}
        >
          {todo.title}
        </span>
      )}

      {middle}

      {editingField === 'price' && canEdit ? (
        <Input
          autoFocus
          value={priceDraft}
          onChange={(e) => setPriceDraft(e.target.value)}
          onBlur={savePrice}
          onKeyDown={(e) => {
            if (e.key === 'Enter') savePrice();
            if (e.key === 'Escape') {
              setPriceDraft(priceToInput(todo.priceCents));
              setEditingField(null);
            }
          }}
          inputMode="decimal"
          placeholder="0.00"
          className="w-24"
        />
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => {
            setPriceDraft(priceToInput(todo.priceCents));
            setEditingField('price');
          }}
          className="flex w-28 cursor-pointer items-center justify-end gap-1 text-right text-sm text-muted-foreground hover:text-foreground"
          aria-label={
            todo.priceCents == null
              ? `Set price for "${todo.title}"`
              : `Edit price of "${todo.title}"`
          }
        >
          {todo.priceCents == null ? (
            <span className="italic">Set price</span>
          ) : (
            <span className="tabular-nums">{formatCents(todo.priceCents)}</span>
          )}
          <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-60" />
        </button>
      ) : (
        <span className="w-28 text-right text-sm text-muted-foreground">
          {todo.priceCents == null ? (
            <span className="italic">—</span>
          ) : (
            <span className="tabular-nums">{formatCents(todo.priceCents)}</span>
          )}
        </span>
      )}

      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label={`Delete "${todo.title}"`}
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </>
  );
}

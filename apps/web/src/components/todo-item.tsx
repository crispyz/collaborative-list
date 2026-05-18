'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TodoItem as Todo, UpdateTodoInput } from '@collab/shared';
import { ApiError, api, type ListWithTodos } from '@/lib/api';
import { formatCents, parseDollars } from '@/lib/money';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  todo: Todo;
  listId: string;
  ownerToken: string | undefined;
  canEdit: boolean;
}

function priceToInput(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toFixed(2);
}

export function TodoRow({ todo, listId, ownerToken, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [editingField, setEditingField] = useState<'title' | 'price' | null>(null);
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const [priceDraft, setPriceDraft] = useState(priceToInput(todo.priceCents));

  const update = useMutation({
    mutationFn: (input: UpdateTodoInput) => api.patchTodo(listId, todo.id, input, ownerToken),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['list', listId] });
      const previous = queryClient.getQueryData<ListWithTodos>(['list', listId]);
      queryClient.setQueryData<ListWithTodos>(['list', listId], (old) =>
        old
          ? {
              ...old,
              todos: old.todos.map((t) => (t.id === todo.id ? { ...t, ...input } : t)),
            }
          : old,
      );
      return { previous };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['list', listId], ctx.previous);
      toast.error(err instanceof ApiError ? err.message : 'Failed to update todo.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['list', listId] }),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTodo(listId, todo.id, ownerToken),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['list', listId] });
      const previous = queryClient.getQueryData<ListWithTodos>(['list', listId]);
      queryClient.setQueryData<ListWithTodos>(['list', listId], (old) =>
        old ? { ...old, todos: old.todos.filter((t) => t.id !== todo.id) } : old,
      );
      return { previous };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['list', listId], ctx.previous);
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete todo.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['list', listId] }),
  });

  function saveTitle() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== todo.title) {
      update.mutate({ title: trimmed });
    } else {
      setTitleDraft(todo.title);
    }
    setEditingField(null);
  }

  function savePrice() {
    const trimmed = priceDraft.trim();
    if (trimmed === '') {
      if (todo.priceCents !== null) update.mutate({ priceCents: null });
      setEditingField(null);
      return;
    }
    const parsed = parseDollars(trimmed);
    if (parsed === null) {
      // invalid input — revert silently
      setPriceDraft(priceToInput(todo.priceCents));
      setEditingField(null);
      return;
    }
    if (parsed !== todo.priceCents) {
      update.mutate({ priceCents: parsed });
    }
    setEditingField(null);
  }

  return (
    <li className="group flex items-center gap-3 rounded-md border bg-card p-3">
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
          className={`flex flex-1 items-center gap-2 truncate text-left text-sm ${
            todo.isDone ? 'text-muted-foreground line-through' : ''
          }`}
          aria-label={`Edit title of "${todo.title}"`}
        >
          <span className="truncate">{todo.title}</span>
          <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
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
          className="flex w-28 items-center justify-end gap-1 text-right text-sm text-muted-foreground hover:text-foreground"
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
          <Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
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
    </li>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TodoItem, UpdateTodoInput } from '@collab/shared';
import { ApiError, api, type ListWithTodos } from '@/lib/api';
import { parseDollars, priceToInput } from '@/lib/money';

/**
 * Inline-edit state + mutations shared between standalone rows (TodoRow) and
 * the parent row inside a card (TodoBranch). Owns the title/price drafts, the
 * "which field is being edited" flag, optimistic update/delete mutations, and
 * the save-on-blur/save-on-enter handlers.
 */
export function useTodoEdit(todo: TodoItem, listId: string, ownerToken: string | undefined) {
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

  return {
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
  };
}

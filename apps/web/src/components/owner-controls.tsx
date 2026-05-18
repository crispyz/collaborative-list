'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { List } from '@collab/shared';
import { ApiError, api, type ListWithTodos } from '@/lib/api';
import { removeOwnerToken } from '@/lib/owner-tokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface Props {
  list: List;
  ownerToken: string;
}

export function OwnerControls({ list, ownerToken }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const toggleFrozen = useMutation({
    mutationFn: () =>
      list.isFrozen ? api.unfreezeList(list.id, ownerToken) : api.freezeList(list.id, ownerToken),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['list', list.id] });
      const previous = queryClient.getQueryData<ListWithTodos>(['list', list.id]);
      queryClient.setQueryData<ListWithTodos>(['list', list.id], (old) =>
        old ? { ...old, list: { ...old.list, isFrozen: !list.isFrozen } } : old,
      );
      return { previous };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['list', list.id], ctx.previous);
      setError(err instanceof ApiError ? err.message : 'Failed to update freeze state.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['list', list.id] }),
  });

  const deleteList = useMutation({
    mutationFn: () => api.deleteList(list.id, ownerToken),
    onSuccess: () => {
      removeOwnerToken(list.id);
      queryClient.removeQueries({ queryKey: ['list', list.id] });
      router.push('/');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Failed to delete list.');
    },
  });

  return (
    <section className="mb-6 rounded-md border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Status: </span>
          <span className="font-medium">{list.isFrozen ? 'Frozen' : 'Active'}</span>
        </p>
        <span className="text-xs text-muted-foreground">You own this list</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        When frozen, only you can edit this list. Non-owners cannot add, edit, or delete tasks until
        you unfreeze it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={list.isFrozen ? 'outline' : 'default'}
          size="sm"
          onClick={() => {
            setError(null);
            toggleFrozen.mutate();
          }}
          disabled={toggleFrozen.isPending}
        >
          {list.isFrozen ? 'Unfreeze list' : 'Freeze list'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm" disabled={deleteList.isPending}>
                Delete list
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this list?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove <span className="font-medium">{list.name}</span> and
                all its todos. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                render={
                  <Button variant="destructive" onClick={() => deleteList.mutate()}>
                    Delete list
                  </Button>
                }
              />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  );
}

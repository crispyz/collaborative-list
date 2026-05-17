'use client';

import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { getOwnedListIds, removeOwnerToken } from '@/lib/owner-tokens';
import { CreateListForm } from '@/components/create-list-form';
import { ListCard } from '@/components/list-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  // null = pre-hydration (avoids flicker / hydration mismatch).
  const [ids, setIds] = useState<string[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setIds(getOwnedListIds());
  }, []);

  const queries = useQueries({
    queries: (ids ?? []).map((id) => ({
      queryKey: ['list-card', id] as const,
      queryFn: () => api.getList(id),
      retry: (count: number, err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return false;
        return count < 1;
      },
    })),
  });

  // Auto-prune localStorage entries whose lists no longer exist server-side.
  useEffect(() => {
    if (!ids) return;
    const stale: string[] = [];
    queries.forEach((q, i) => {
      if (q.error instanceof ApiError && q.error.status === 404) {
        const id = ids[i];
        if (id) stale.push(id);
      }
    });
    if (stale.length === 0) return;
    stale.forEach(removeOwnerToken);
    setIds((prev) => prev?.filter((id) => !stale.includes(id)) ?? null);
  }, [queries, ids]);

  if (ids === null) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  if (ids.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-8">
        <h1 className="mb-2 text-2xl font-semibold">Collaborative List</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Create your first list to get started.
        </p>
        <CreateListForm />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your lists</h1>
        <Button onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? 'Cancel' : '+ New list'}
        </Button>
      </header>

      {showCreate && (
        <div className="mb-8 rounded-lg border bg-card p-4">
          <CreateListForm onDone={() => setShowCreate(false)} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id, i) => {
          const q = queries[i];
          if (!q) return null;
          if (q.data) {
            return <ListCard key={id} list={q.data.list} todoCount={q.data.todos.length} />;
          }
          if (q.isPending) {
            return <Skeleton key={id} className="h-32 w-full" />;
          }
          return null;
        })}
      </div>
    </main>
  );
}

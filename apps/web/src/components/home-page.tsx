'use client';

import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { getOwnedListIds, removeOwnerToken } from '@/lib/owner-tokens';
import { getVisitedLists, removeVisited, type VisitedList } from '@/lib/visited-lists';
import { CreateListForm } from '@/components/create-list-form';
import { ListCard } from '@/components/list-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  // null = pre-hydration (avoids flicker / hydration mismatch).
  const [ownedIds, setOwnedIds] = useState<string[] | null>(null);
  const [visited, setVisited] = useState<VisitedList[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const owned = getOwnedListIds();
    setOwnedIds(owned);
    // Defensive: if a list ever ended up in both stores, keep it under "Your
    // lists" only — ownership is the stronger signal.
    const ownedSet = new Set(owned);
    setVisited(getVisitedLists().filter((v) => !ownedSet.has(v.id)));
  }, []);

  const ownedQueries = useQueries({
    queries: (ownedIds ?? []).map((id) => ({
      queryKey: ['list-card', id] as const,
      queryFn: () => api.getList(id),
      retry: (count: number, err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return false;
        return count < 1;
      },
    })),
  });

  const visitedQueries = useQueries({
    queries: (visited ?? []).map((v) => ({
      queryKey: ['list-card', v.id] as const,
      queryFn: () => api.getList(v.id),
      retry: (count: number, err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return false;
        return count < 1;
      },
    })),
  });

  // Auto-prune owned entries whose lists no longer exist server-side.
  useEffect(() => {
    if (!ownedIds) return;
    const stale: string[] = [];
    ownedQueries.forEach((q, i) => {
      if (q.error instanceof ApiError && q.error.status === 404) {
        const id = ownedIds[i];
        if (id) stale.push(id);
      }
    });
    if (stale.length === 0) return;
    stale.forEach(removeOwnerToken);
    setOwnedIds((prev) => prev?.filter((id) => !stale.includes(id)) ?? null);
  }, [ownedQueries, ownedIds]);

  // Auto-prune visited entries whose lists no longer exist server-side.
  useEffect(() => {
    if (!visited) return;
    const stale: string[] = [];
    visitedQueries.forEach((q, i) => {
      if (q.error instanceof ApiError && q.error.status === 404) {
        const id = visited[i]?.id;
        if (id) stale.push(id);
      }
    });
    if (stale.length === 0) return;
    stale.forEach(removeVisited);
    setVisited((prev) => prev?.filter((v) => !stale.includes(v.id)) ?? null);
  }, [visitedQueries, visited]);

  if (ownedIds === null || visited === null) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }

  const hasOwned = ownedIds.length > 0;
  const hasVisited = visited.length > 0;

  if (!hasOwned && !hasVisited) {
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
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Collaborative List</h1>
        <Button onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? 'Cancel' : '+ New list'}
        </Button>
      </header>

      {showCreate && (
        <div className="mb-8 rounded-lg border bg-card p-4">
          <CreateListForm onDone={() => setShowCreate(false)} />
        </div>
      )}

      {hasOwned && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Your lists</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownedIds.map((id, i) => {
              const q = ownedQueries[i];
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
        </section>
      )}

      {hasVisited && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Shared with me</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visited.map((v, i) => {
              const q = visitedQueries[i];
              if (!q) return null;
              if (q.data) {
                return <ListCard key={v.id} list={q.data.list} todoCount={q.data.todos.length} />;
              }
              if (q.isPending) {
                return <Skeleton key={v.id} className="h-32 w-full" />;
              }
              return null;
            })}
          </div>
        </section>
      )}
    </main>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { CreateTodoInput } from '@collab/shared';
import { ApiError, api, type ListWithTodos } from '@/lib/api';
import { getOwnerToken } from '@/lib/owner-tokens';
import { FilterTabs, type FilterValue } from '@/components/filter-tabs';
import { TodoRow } from '@/components/todo-item';
import { TotalCost } from '@/components/total-cost';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const VALID_FILTERS: ReadonlySet<FilterValue> = new Set(['all', 'active', 'done']);

interface Props {
  id: string;
}

export function ListPage({ id }: Props) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const filter: FilterValue =
    filterParam && (VALID_FILTERS as Set<string>).has(filterParam)
      ? (filterParam as FilterValue)
      : 'all';

  const [ownerToken, setOwnerToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    setOwnerToken(getOwnerToken(id));
  }, [id]);

  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.getList(id),
  });

  const [newTitle, setNewTitle] = useState('');
  const createTodo = useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(id, input, ownerToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list', id] }),
  });

  function handleAddTodo(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    createTodo.mutate({ title });
    setNewTitle('');
  }

  if (listQuery.isPending) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Skeleton className="mb-4 h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (listQuery.isError) {
    const status = listQuery.error instanceof ApiError ? listQuery.error.status : 0;
    return (
      <main className="mx-auto max-w-3xl p-8 text-center">
        <h1 className="text-xl font-semibold">
          {status === 404 ? 'List not found' : 'Something went wrong'}
        </h1>
        {status === 404 ? (
          <p className="mt-2 text-sm text-muted-foreground">This list may have been deleted.</p>
        ) : (
          <Button className="mt-4" onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        )}
      </main>
    );
  }

  const data: ListWithTodos = listQuery.data;
  const visible = data.todos.filter((t) => {
    if (filter === 'all') return true;
    return filter === 'active' ? !t.isDone : t.isDone;
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All lists
      </Link>
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{data.list.name}</h1>
          <div className="flex items-center gap-2">
            {data.list.isFrozen && <Badge variant="secondary">Frozen</Badge>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href).catch(() => {});
              }}
            >
              Copy URL
            </Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this URL with friends to collaborate.
        </p>
      </header>

      <form onSubmit={handleAddTodo} className="mb-6 flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={500}
          disabled={createTodo.isPending}
        />
        <Button type="submit" disabled={createTodo.isPending || !newTitle.trim()}>
          Add
        </Button>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <FilterTabs current={filter} />
        <TotalCost todos={data.todos} visible={visible} filter={filter} />
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((t) => (
          <TodoRow key={t.id} todo={t} listId={id} ownerToken={ownerToken} />
        ))}
        {visible.length === 0 && (
          <li className="rounded-md border bg-card p-4 text-center text-sm text-muted-foreground">
            {filter === 'all' ? 'No todos yet — add one above.' : `No ${filter} todos.`}
          </li>
        )}
      </ul>
    </main>
  );
}

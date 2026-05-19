'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CreateTodoInput, TodoItem } from '@collab/shared';
import { ApiError, api, type ListWithTodos } from '@/lib/api';
import { getOwnerToken, removeOwnerToken } from '@/lib/owner-tokens';
import { useListSubscription } from '@/lib/realtime';
import { FilterTabs, type FilterValue } from '@/components/filter-tabs';
import { OwnerControls } from '@/components/owner-controls';
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
  const router = useRouter();
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

  // Set while a local drag is in flight (drag start → mutation settled). Read
  // synchronously by the WS subscription to defer incoming `todo.reordered`
  // events so they can't fight with our in-progress visual state.
  const dragInFlightRef = useRef(false);

  useListSubscription(id, {
    onListDeleted: () => {
      removeOwnerToken(id);
      router.replace('/');
    },
    shouldSkipEvent: (event) => dragInFlightRef.current && event.type === 'todo.reordered',
  });

  const listQuery = useQuery({
    queryKey: ['list', id],
    queryFn: () => api.getList(id),
  });

  const [newTitle, setNewTitle] = useState('');
  const createTodo = useMutation({
    mutationFn: (input: CreateTodoInput) => api.createTodo(id, input, ownerToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['list', id] }),
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create todo.');
    },
  });

  function addTodoAction() {
    const title = newTitle.trim();
    if (!title) {
      toast.error('Title is required.');
      return;
    }
    createTodo.mutate({ title });
    setNewTitle('');
  }

  // Temporary order kept ONLY while a drag is in flight (drag start → mutation
  // settled). Drives the SortableContext during that window. Otherwise the list
  // renders from React Query like every other piece of state in the app.
  const [dragOrder, setDragOrder] = useState<TodoItem[] | null>(null);

  const reorder = useMutation({
    mutationFn: (items: { id: string; position: number }[]) =>
      api.reorderTodos(id, items, ownerToken),
    onSuccess: (result) => {
      // Single authoritative cache write — server response is the source of truth
      // for ordering. After this, normal cache-driven render resumes.
      queryClient.setQueryData<ListWithTodos>(['list', id], (old) =>
        old ? { ...old, todos: result.items } : old,
      );
      setDragOrder(null);
      dragInFlightRef.current = false;
    },
    onError: (err) => {
      setDragOrder(null);
      dragInFlightRef.current = false;
      toast.error(err instanceof ApiError ? err.message : 'Failed to reorder todos.');
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(_event: DragStartEvent) {
    dragInFlightRef.current = true;
    const todos = listQuery.data?.todos ?? [];
    setDragOrder(todos);
  }

  function handleDragCancel() {
    setDragOrder(null);
    dragInFlightRef.current = false;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const order = dragOrder ?? listQuery.data?.todos;
    if (!order) {
      setDragOrder(null);
      dragInFlightRef.current = false;
      return;
    }
    if (!over || active.id === over.id) {
      setDragOrder(null);
      dragInFlightRef.current = false;
      return;
    }
    const oldIndex = order.findIndex((t) => t.id === active.id);
    const newIndex = order.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      setDragOrder(null);
      dragInFlightRef.current = false;
      return;
    }
    const newOrder = arrayMove(order, oldIndex, newIndex);
    // Keep the new order visible until the mutation settles. dragInFlightRef stays
    // true so deferred WS reorder events from other clients are ignored.
    setDragOrder(newOrder);
    reorder.mutate(newOrder.map((t, i) => ({ id: t.id, position: i })));
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
  const isOwner = !!ownerToken;
  const canEdit = isOwner || !data.list.isFrozen;
  const canReorder = canEdit && filter === 'all';
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
        My lists
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

      {isOwner && ownerToken && <OwnerControls list={data.list} ownerToken={ownerToken} />}

      {!isOwner && data.list.isFrozen && (
        <div className="mb-6 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          This list is frozen by the owner. You can view but not edit until it's unfrozen.
        </div>
      )}

      <form action={addTodoAction} className="mb-6 flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={canEdit ? 'What needs doing?' : 'Editing disabled'}
          maxLength={500}
          disabled={createTodo.isPending || !canEdit}
        />
        <Button type="submit" disabled={createTodo.isPending || !newTitle.trim() || !canEdit}>
          Add
        </Button>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <FilterTabs current={filter} />
        <TotalCost todos={data.todos} visible={visible} filter={filter} />
      </div>

      {canEdit && filter !== 'all' && (
        <p className="mb-3 text-xs text-muted-foreground">Switch to All to reorder todos.</p>
      )}

      {canReorder ? (
        (() => {
          // While a drag is in flight we render the temporary `dragOrder`; otherwise
          // the regular cache-derived `visible` array. `canReorder` already requires
          // `filter === 'all'`, so `visible === data.todos` in this branch.
          const displayOrder = dragOrder ?? visible;
          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={displayOrder.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2">
                  {displayOrder.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      listId={id}
                      ownerToken={ownerToken}
                      canEdit={canEdit}
                      canDrag
                    />
                  ))}
                  {displayOrder.length === 0 && (
                    <li className="rounded-md border bg-card p-4 text-center text-sm text-muted-foreground">
                      No todos yet — add one above.
                    </li>
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          );
        })()
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((t) => (
            <TodoRow
              key={t.id}
              todo={t}
              listId={id}
              ownerToken={ownerToken}
              canEdit={canEdit}
              canDrag={false}
            />
          ))}
          {visible.length === 0 && (
            <li className="rounded-md border bg-card p-4 text-center text-sm text-muted-foreground">
              {filter === 'all' ? 'No todos yet — add one above.' : `No ${filter} todos.`}
            </li>
          )}
        </ul>
      )}
    </main>
  );
}

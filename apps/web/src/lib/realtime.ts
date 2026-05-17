'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { ClientMessage, RealtimeEvent } from '@collab/shared';
import type { ListWithTodos } from '@/lib/api';

const HTTP_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const WS_URL = `${HTTP_URL.replace(/^http/, 'ws')}/ws`;

interface SubscriptionOptions {
  onListDeleted?: () => void;
}

export function useListSubscription(listId: string, options: SubscriptionOptions = {}): void {
  const queryClient = useQueryClient();
  const onListDeletedRef = useRef(options.onListDeleted);
  onListDeletedRef.current = options.onListDeleted;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let backoff = 500;
    let cleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      socket = new WebSocket(WS_URL);

      socket.addEventListener('open', () => {
        backoff = 500;
        const msg: ClientMessage = { type: 'subscribe', listId };
        socket?.send(JSON.stringify(msg));
        // Catch anything that happened while disconnected (or on first connect).
        queryClient.invalidateQueries({ queryKey: ['list', listId] });
      });

      socket.addEventListener('message', (e) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(typeof e.data === 'string' ? e.data : '') as RealtimeEvent;
        } catch {
          return;
        }
        if (!event || typeof event !== 'object' || !('type' in event)) return;
        applyEvent(queryClient, event, listId, onListDeletedRef.current);
      });

      socket.addEventListener('close', () => {
        if (cleanup) return;
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10_000);
      });

      socket.addEventListener('error', () => {
        // close will fire after error; backoff handled there
      });
    }

    connect();

    return () => {
      cleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        const msg: ClientMessage = { type: 'unsubscribe', listId };
        socket.send(JSON.stringify(msg));
      }
      socket?.close();
    };
  }, [listId, queryClient]);
}

function applyEvent(
  qc: QueryClient,
  event: RealtimeEvent,
  expectedListId: string,
  onListDeleted: (() => void) | undefined,
): void {
  if (event.listId !== expectedListId) return;
  const key = ['list', expectedListId] as const;

  switch (event.type) {
    case 'todo.created': {
      qc.setQueryData<ListWithTodos>(key, (old) => {
        if (!old) return old;
        if (old.todos.some((t) => t.id === event.item.id)) return old;
        const todos = [...old.todos, event.item].sort((a, b) => a.position - b.position);
        return { ...old, todos };
      });
      return;
    }
    case 'todo.updated': {
      qc.setQueryData<ListWithTodos>(key, (old) =>
        old
          ? { ...old, todos: old.todos.map((t) => (t.id === event.item.id ? event.item : t)) }
          : old,
      );
      return;
    }
    case 'todo.deleted': {
      qc.setQueryData<ListWithTodos>(key, (old) =>
        old ? { ...old, todos: old.todos.filter((t) => t.id !== event.itemId) } : old,
      );
      return;
    }
    case 'todo.reordered': {
      qc.setQueryData<ListWithTodos>(key, (old) => (old ? { ...old, todos: event.items } : old));
      return;
    }
    case 'list.frozen':
    case 'list.unfrozen': {
      const isFrozen = event.type === 'list.frozen';
      qc.setQueryData<ListWithTodos>(key, (old) =>
        old ? { ...old, list: { ...old.list, isFrozen } } : old,
      );
      return;
    }
    case 'list.deleted': {
      qc.removeQueries({ queryKey: key });
      onListDeleted?.();
      return;
    }
  }
}

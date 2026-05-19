import type {
  CreateListInput,
  CreateTodoInput,
  List,
  TodoItem,
  UpdateTodoInput,
} from '@collab/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  ownerToken?: string | undefined;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, ownerToken, headers: headersInit, ...init } = options;
  const headers = new Headers(headersInit);
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (ownerToken) headers.set('x-owner-token', ownerToken);

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw new ApiError(res.status, errBody.code ?? 'UNKNOWN', errBody.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListWithTodos {
  list: List;
  todos: TodoItem[];
}

export interface CreatedList {
  list: List;
  ownerToken: string;
}

export const api = {
  createList: (input: CreateListInput) =>
    apiFetch<CreatedList>('/lists', { method: 'POST', body: input }),

  getList: (id: string) => apiFetch<ListWithTodos>(`/lists/${id}`),

  deleteList: (id: string, ownerToken: string) =>
    apiFetch<void>(`/lists/${id}`, { method: 'DELETE', ownerToken }),

  freezeList: (id: string, ownerToken: string) =>
    apiFetch<List>(`/lists/${id}/freeze`, { method: 'POST', ownerToken }),

  unfreezeList: (id: string, ownerToken: string) =>
    apiFetch<List>(`/lists/${id}/unfreeze`, { method: 'POST', ownerToken }),

  createTodo: (listId: string, input: CreateTodoInput, ownerToken?: string) =>
    apiFetch<TodoItem>(`/lists/${listId}/todos`, {
      method: 'POST',
      body: input,
      ownerToken,
    }),

  patchTodo: (listId: string, todoId: string, input: UpdateTodoInput, ownerToken?: string) =>
    apiFetch<TodoItem>(`/lists/${listId}/todos/${todoId}`, {
      method: 'PATCH',
      body: input,
      ownerToken,
    }),

  deleteTodo: (listId: string, todoId: string, ownerToken?: string) =>
    apiFetch<void>(`/lists/${listId}/todos/${todoId}`, {
      method: 'DELETE',
      ownerToken,
    }),

  reorderTodos: (listId: string, items: { id: string; position: number }[], ownerToken?: string) =>
    apiFetch<{ items: TodoItem[] }>(`/lists/${listId}/todos/reorder`, {
      method: 'POST',
      body: { items },
      ownerToken,
    }),
};

import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().datetime();
const trimmedTitle = z.string().trim().min(1).max(500);
const trimmedListName = z.string().trim().min(1).max(200);
const priceCents = z.number().int().nonnegative().nullable();

export const TodoItemSchema = z.object({
  id: uuid,
  listId: uuid,
  parentId: uuid.nullable(),
  position: z.number(),
  title: z.string(),
  isDone: z.boolean(),
  priceCents: priceCents,
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type TodoItem = z.infer<typeof TodoItemSchema>;

export const ListSchema = z.object({
  id: uuid,
  name: z.string(),
  isFrozen: z.boolean(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type List = z.infer<typeof ListSchema>;

export const ListWithOwnerSchema = ListSchema.extend({
  ownerToken: z.string(),
});
export type ListWithOwner = z.infer<typeof ListWithOwnerSchema>;

export const CreateListInputSchema = z.object({
  name: trimmedListName,
});
export type CreateListInput = z.infer<typeof CreateListInputSchema>;

export const CreateTodoInputSchema = z.object({
  title: trimmedTitle,
  parentId: uuid.nullable().optional(),
  priceCents: priceCents.optional(),
});
export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export const UpdateTodoInputSchema = z.object({
  title: trimmedTitle.optional(),
  isDone: z.boolean().optional(),
  priceCents: priceCents.optional(),
  position: z.number().optional(),
});
export type UpdateTodoInput = z.infer<typeof UpdateTodoInputSchema>;

export const ReorderTodosInputSchema = z.object({
  items: z.array(z.object({ id: uuid, position: z.number() })).min(1),
});
export type ReorderTodosInput = z.infer<typeof ReorderTodosInputSchema>;

export const OwnerAuthSchema = z.object({
  ownerToken: z.string().min(1),
});
export type OwnerAuth = z.infer<typeof OwnerAuthSchema>;

export type RealtimeEvent =
  | { type: "todo.created"; listId: string; item: TodoItem }
  | { type: "todo.updated"; listId: string; item: TodoItem }
  | { type: "todo.deleted"; listId: string; itemId: string }
  | { type: "todo.reordered"; listId: string; items: TodoItem[] }
  | { type: "list.frozen"; listId: string }
  | { type: "list.unfrozen"; listId: string };

export type ClientMessage =
  | { type: "subscribe"; listId: string }
  | { type: "unsubscribe"; listId: string };

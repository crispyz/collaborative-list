import { prisma } from '@collab/db';
import {
  CreateTodoInputSchema,
  ReorderTodosInputSchema,
  TodoItemSchema,
  UpdateTodoInputSchema,
} from '@collab/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { assertCanMutate } from '../lib/freeze-guard.js';
import { serializeTodoItem } from '../lib/serialize.js';
import { broadcast } from '../realtime/rooms.js';

const ListIdParams = z.object({ listId: z.uuid() });
const TodoParams = z.object({
  listId: z.uuid(),
  todoId: z.uuid(),
});
const OptionalOwnerHeaders = z.object({
  'x-owner-token': z.string().optional(),
});

export const todosRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/lists/:listId/todos',
    {
      schema: {
        params: ListIdParams,
        headers: OptionalOwnerHeaders,
        body: CreateTodoInputSchema,
        response: { 201: TodoItemSchema },
      },
    },
    async (req, reply) => {
      const list = await prisma.list.findUnique({ where: { id: req.params.listId } });
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      assertCanMutate(list, req.headers['x-owner-token']);

      const max = await prisma.todoItem.aggregate({
        where: { listId: list.id, parentId: req.body.parentId ?? null },
        _max: { position: true },
      });
      const position = (max._max.position ?? -1) + 1;

      const created = await prisma.todoItem.create({
        data: {
          listId: list.id,
          title: req.body.title,
          parentId: req.body.parentId ?? null,
          priceCents: req.body.priceCents ?? null,
          position,
        },
      });
      const item = serializeTodoItem(created);
      broadcast(list.id, { type: 'todo.created', listId: list.id, item });
      reply.status(201);
      return item;
    },
  );

  app.patch(
    '/lists/:listId/todos/:todoId',
    {
      schema: {
        params: TodoParams,
        headers: OptionalOwnerHeaders,
        body: UpdateTodoInputSchema,
        response: { 200: TodoItemSchema },
      },
    },
    async (req) => {
      const list = await prisma.list.findUnique({ where: { id: req.params.listId } });
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      assertCanMutate(list, req.headers['x-owner-token']);

      const todo = await prisma.todoItem.findUnique({ where: { id: req.params.todoId } });
      if (!todo || todo.listId !== list.id) {
        throw new HttpError(404, 'TODO_NOT_FOUND', 'Todo not found');
      }

      const updated = await prisma.todoItem.update({
        where: { id: todo.id },
        data: {
          ...(req.body.title !== undefined && { title: req.body.title }),
          ...(req.body.isDone !== undefined && { isDone: req.body.isDone }),
          ...(req.body.priceCents !== undefined && { priceCents: req.body.priceCents }),
          ...(req.body.position !== undefined && { position: req.body.position }),
        },
      });
      const item = serializeTodoItem(updated);
      broadcast(list.id, { type: 'todo.updated', listId: list.id, item });
      return item;
    },
  );

  app.delete(
    '/lists/:listId/todos/:todoId',
    {
      schema: {
        params: TodoParams,
        headers: OptionalOwnerHeaders,
      },
    },
    async (req, reply) => {
      const list = await prisma.list.findUnique({ where: { id: req.params.listId } });
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      assertCanMutate(list, req.headers['x-owner-token']);

      const existing = await prisma.todoItem.findUnique({ where: { id: req.params.todoId } });
      if (!existing || existing.listId !== list.id) {
        throw new HttpError(404, 'TODO_NOT_FOUND', 'Todo not found');
      }

      await prisma.todoItem.delete({ where: { id: existing.id } });
      broadcast(list.id, { type: 'todo.deleted', listId: list.id, itemId: existing.id });
      return reply.status(204).send();
    },
  );

  app.post(
    '/lists/:listId/todos/reorder',
    {
      schema: {
        params: ListIdParams,
        headers: OptionalOwnerHeaders,
        body: ReorderTodosInputSchema,
        response: { 200: z.object({ items: z.array(TodoItemSchema) }) },
      },
    },
    async (req) => {
      const list = await prisma.list.findUnique({ where: { id: req.params.listId } });
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      assertCanMutate(list, req.headers['x-owner-token']);

      const ids = req.body.items.map((i) => i.id);
      const existing = await prisma.todoItem.findMany({
        where: { id: { in: ids }, listId: list.id },
        select: { id: true },
      });
      if (existing.length !== ids.length) {
        throw new HttpError(
          400,
          'VALIDATION_ERROR',
          'One or more todo ids do not belong to this list.',
        );
      }

      await prisma.$transaction(
        req.body.items.map((i) =>
          prisma.todoItem.update({ where: { id: i.id }, data: { position: i.position } }),
        ),
      );

      const fresh = await prisma.todoItem.findMany({
        where: { listId: list.id },
        orderBy: { position: 'asc' },
      });
      const items = fresh.map(serializeTodoItem);
      broadcast(list.id, { type: 'todo.reordered', listId: list.id, items });
      return { items };
    },
  );
};

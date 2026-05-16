import { randomBytes } from 'node:crypto';
import { prisma } from '@collab/db';
import { CreateListInputSchema, ListSchema, TodoItemSchema } from '@collab/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError } from '../lib/errors.js';
import { serializeList, serializeTodoItem } from '../lib/serialize.js';

const ListIdParams = z.object({ id: z.uuid() });

const OwnerHeaders = z.object({
  'x-owner-token': z.string().min(1),
});

const GetListResponse = z.object({
  list: ListSchema,
  todos: z.array(TodoItemSchema),
});

const CreateListResponse = z.object({
  list: ListSchema,
  ownerToken: z.string(),
});

export const listsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/lists',
    { schema: { body: CreateListInputSchema, response: { 201: CreateListResponse } } },
    async (req, reply) => {
      const ownerToken = randomBytes(32).toString('hex');
      const created = await prisma.list.create({
        data: { name: req.body.name, ownerToken },
      });
      reply.status(201);
      return { list: serializeList(created), ownerToken };
    },
  );

  app.get(
    '/lists/:id',
    { schema: { params: ListIdParams, response: { 200: GetListResponse } } },
    async (req) => {
      const list = await prisma.list.findUnique({
        where: { id: req.params.id },
        include: { todos: { orderBy: { position: 'asc' } } },
      });
      if (!list) {
        throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      }
      const { todos, ...rest } = list;
      return {
        list: serializeList(rest),
        todos: todos.map(serializeTodoItem),
      };
    },
  );

  app.post(
    '/lists/:id/freeze',
    { schema: { params: ListIdParams, headers: OwnerHeaders, response: { 200: ListSchema } } },
    async (req) => setFrozen(req.params.id, req.headers['x-owner-token'], true),
  );

  app.post(
    '/lists/:id/unfreeze',
    { schema: { params: ListIdParams, headers: OwnerHeaders, response: { 200: ListSchema } } },
    async (req) => setFrozen(req.params.id, req.headers['x-owner-token'], false),
  );

  app.delete(
    '/lists/:id',
    { schema: { params: ListIdParams, headers: OwnerHeaders } },
    async (req, reply) => {
      const list = await prisma.list.findUnique({ where: { id: req.params.id } });
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
      if (list.ownerToken !== req.headers['x-owner-token']) {
        throw new HttpError(403, 'INVALID_OWNER_TOKEN', 'Invalid owner token');
      }
      await prisma.list.delete({ where: { id: list.id } });
      return reply.status(204).send();
    },
  );
};

async function setFrozen(id: string, ownerToken: string, isFrozen: boolean) {
  const list = await prisma.list.findUnique({ where: { id } });
  if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'List not found');
  if (list.ownerToken !== ownerToken) {
    throw new HttpError(403, 'INVALID_OWNER_TOKEN', 'Invalid owner token');
  }
  const updated = await prisma.list.update({ where: { id }, data: { isFrozen } });
  return serializeList(updated);
}

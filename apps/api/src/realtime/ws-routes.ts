import type { FastifyPluginAsync } from 'fastify';
import type { RawData } from 'ws';
import { z } from 'zod';
import { subscribe, unsubscribe, unsubscribeAll } from './rooms.js';

const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), listId: z.uuid() }),
  z.object({ type: z.literal('unsubscribe'), listId: z.uuid() }),
]);

export const wsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (raw: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const result = ClientMessageSchema.safeParse(parsed);
      if (!result.success) return;
      const { type, listId } = result.data;
      if (type === 'subscribe') subscribe(listId, socket);
      else unsubscribe(listId, socket);
    });

    socket.on('close', () => unsubscribeAll(socket));
  });
};

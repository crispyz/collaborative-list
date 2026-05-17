import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { registerErrorHandler } from './lib/errors.js';
import { wsRoutes } from './realtime/ws-routes.js';
import { listsRoutes } from './routes/lists.js';
import { todosRoutes } from './routes/todos.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'x-owner-token'],
  });

  registerErrorHandler(app);

  app.get(
    '/health',
    { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } },
    async () => ({ ok: true as const }),
  );

  app.register(websocket);
  app.register(wsRoutes);

  app.register(listsRoutes);
  app.register(todosRoutes);

  return app;
}

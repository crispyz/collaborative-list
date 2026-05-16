import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { registerErrorHandler } from './lib/errors.js';
import { listsRoutes } from './routes/lists.js';
import { todosRoutes } from './routes/todos.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });

  registerErrorHandler(app);

  app.get(
    '/health',
    { schema: { response: { 200: z.object({ ok: z.literal(true) }) } } },
    async () => ({ ok: true as const }),
  );

  app.register(listsRoutes);
  app.register(todosRoutes);

  return app;
}

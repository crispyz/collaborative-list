import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'LIST_NOT_FOUND'
  | 'TODO_NOT_FOUND'
  | 'INVALID_OWNER_TOKEN'
  | 'OWNER_TOKEN_REQUIRED'
  | 'LIST_FROZEN'
  | 'INTERNAL';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({
        error: err.message,
        code: err.code,
        ...(err.details !== undefined ? { details: err.details } : {}),
      });
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.status(400).send({
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        details: err.validation,
      });
    }

    app.log.error(err);
    return reply.status(500).send({ error: 'Internal Server Error', code: 'INTERNAL' });
  });
}

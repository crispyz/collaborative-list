import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, env } from 'prisma/config';

const here = dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(resolve(here, '../../.env'));
} catch {
  // .env is absent in production, where env vars are set externally.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});

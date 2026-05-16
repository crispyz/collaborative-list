import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(resolve(here, '../../../../.env'));
} catch {
  // .env is optional in production where env vars are set externally.
}

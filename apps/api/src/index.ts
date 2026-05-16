import './lib/load-env.js';
import { env } from './lib/config.js';
import { buildServer } from './server.js';

const app = buildServer();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

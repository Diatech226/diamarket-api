import { env } from './config/env';
import { app } from './app';
import { connectDatabase } from './config/db';

async function bootstrap() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[startup] Failed to start API. ${message}`);
  process.exit(1);
});

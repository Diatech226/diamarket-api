import { env } from './config/env';
import { app } from './app';
import { connectDatabase } from './config/db';
import { seedDefaultAdmin } from './services/admin-seed.service';

async function bootstrap() {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is required before the API can start.');
  await connectDatabase();
  await seedDefaultAdmin();
  app.listen(env.port, () => {
    console.log(`API listening on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[startup] Failed to start API. ${message}`);
  process.exit(1);
});

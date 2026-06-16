import { connectDatabase } from '../src/config/db';
import { seedDefaultAdmin } from '../src/services/admin-seed.service';

async function main() {
  await connectDatabase();
  await seedDefaultAdmin();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[admin-seed] Failed. ${message}`);
    process.exit(1);
  });

import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { initAuditTriggers } from './prisma';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await initAuditTriggers();

  app.listen(PORT, () => {
    console.log(`[CTERS Server] Running on http://localhost:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[CTERS Server] Failed to bootstrap:', err);
  process.exit(1);
});

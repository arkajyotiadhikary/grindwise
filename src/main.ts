import {
  initializeDatabase,
  getDatabase,
} from './adapters/persistence/sqlite/database';
import { seedRoadmap } from './adapters/persistence/sqlite/seeder';
import { startBot } from './bot/socket';
import { createMessageHandler } from './bot/handlers';
import { BaileysMessenger } from './channels/baileys-messenger';
import { DIContainer } from './di-container';
import { startScheduler } from './services/scheduler';
import { startExpressServer } from './server';

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     DSA Learning System — WhatsApp Bot   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  console.log('🗄️  Initializing database...');
  initializeDatabase();

  console.log('📚 Seeding NeetCode roadmap...');
  seedRoadmap();

  const db = getDatabase();

  let messenger: BaileysMessenger | undefined;
  let di: DIContainer | undefined;

  await startBot(
    async (sock, messages) => {
      if (!messenger || !di) {
        messenger = new BaileysMessenger(sock);
        di = new DIContainer(db, messenger);
      }
      await createMessageHandler(di)(sock, messages);
    },
    (sock) => {
      messenger = new BaileysMessenger(sock);
      di = new DIContainer(db, messenger);
      startScheduler(di);
      startExpressServer(di);
    },
  );
}

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[main] Unhandled rejection', { reason });
  process.exit(1);
});

main().catch((error: unknown) => {
  console.error('❌ main() failed:', error);
  process.exit(1);
});

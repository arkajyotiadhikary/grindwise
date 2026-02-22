import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/init';
import { seedRoadmap } from './db/seeder';
import { startScheduler } from './services/scheduler';
import webhookRouter from './services/webhook';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', webhookRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DSA Learning System'
  });
});

// Manual trigger endpoints (for testing/admin)
app.post('/admin/send-daily', async (_req, res) => {
  const { Repository } = require('./db/repository');
  const { LearningService } = require('./services/learning');
  const repo = new Repository();
  const learning = new LearningService();

  try {
    const users = repo.getAllActiveUsers();
    let sent = 0;
    for (const user of users) {
      await learning.sendDailyTopic(user);
      sent++;
    }
    res.json({ success: true, sent });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    repo.close();
    learning.close();
  }
});

app.post('/admin/register', async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const { LearningService } = require('./services/learning');
  const learning = new LearningService();
  try {
    const user = await learning.registerUser(phone, name);
    res.json({ success: true, user });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  } finally {
    learning.close();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     DSA Learning System — WhatsApp Bot   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 1. Initialize database schema
  console.log('🗄️  Initializing database...');
  initializeDatabase();

  // 2. Seed roadmap content
  console.log('📚 Seeding NeetCode roadmap...');
  seedRoadmap();

  // 3. Start background scheduler
  console.log('⏰ Starting message scheduler...');
  startScheduler();

  // 4. Start HTTP server (for webhook)
  app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 Webhook endpoint: POST /api/webhook`);
    console.log(`❤️  Health check: GET /health`);
    console.log('');
    console.log('System ready! Waiting for messages...');
  });
}

bootstrap().catch(error => {
  console.error('❌ Bootstrap failed:', error);
  process.exit(1);
});

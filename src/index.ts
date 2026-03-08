import express from 'express';
import dotenv from 'dotenv';
import { DIContainer } from './di-container';
import { config } from './config';

dotenv.config();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DSA Learning System',
  });
});

export function startExpressServer(di: DIContainer): void {
  // Admin: trigger daily topic delivery manually
  app.post('/admin/send-daily', async (_req, res) => {
    try {
      const users = di.getRepository().getAllActiveUsers();
      let sent = 0;
      for (const user of users) {
        await di.getSendDailyTopicUseCase().execute(user);
        sent++;
      }
      res.json({ success: true, sent });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[index] /admin/send-daily error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // Admin: register a user
  app.post('/admin/register', async (req, res) => {
    const { phone, name } = req.body as { phone?: string; name?: string };
    if (!phone) {
      res.status(400).json({ error: 'phone is required' });
      return;
    }

    try {
      const user = await di.getRegisterUserUseCase().execute(phone, name);
      res.json({ success: true, user });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[index] /admin/register error', { error: msg, phone });
      res.status(500).json({ error: msg });
    }
  });

  app.listen(config.port, () => {
    console.log('');
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`❤️  Health check: GET /health`);
    console.log('');
  });
}

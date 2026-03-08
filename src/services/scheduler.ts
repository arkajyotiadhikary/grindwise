import cron from 'node-cron';
import dotenv from 'dotenv';
import { DIContainer } from '../di-container';

dotenv.config();

const DAILY_TIME = process.env.DAILY_MESSAGE_TIME ?? '09:00';
const [DAILY_HOUR, DAILY_MIN] = DAILY_TIME.split(':').map(Number);
const WEEKLY_TEST_DAY = parseInt(process.env.WEEKLY_TEST_DAY ?? '6'); // 6 = Saturday
const WEEKLY_TEST_HOUR = parseInt((process.env.WEEKLY_TEST_TIME ?? '10:00').split(':')[0] ?? '10');
const WEEKLY_TEST_MIN = parseInt((process.env.WEEKLY_TEST_TIME ?? '10:00').split(':')[1] ?? '0');

export function startScheduler(di: DIContainer): void {
  console.log('⏰ Starting scheduler...');

  // ── Daily Topic Delivery ──────────────────────────────────────────────────
  const dailyCron = `${DAILY_MIN} ${DAILY_HOUR} * * *`;
  cron.schedule(dailyCron, async () => {
    console.log(`📬 [${new Date().toISOString()}] Running daily topic delivery...`);
    await runDailyTopicDelivery(di);
  }, { timezone: 'Asia/Kolkata' });

  // ── Weekly Test (Saturday) ────────────────────────────────────────────────
  const weeklyCron = `${WEEKLY_TEST_MIN} ${WEEKLY_TEST_HOUR} * * ${WEEKLY_TEST_DAY}`;
  cron.schedule(weeklyCron, async () => {
    console.log(`📝 [${new Date().toISOString()}] Running weekly test delivery...`);
    await runWeeklyTestDelivery(di);
  }, { timezone: 'Asia/Kolkata' });

  // ── Spaced Repetition Check (Daily at +1 hour after main delivery) ────────
  const srHour = (DAILY_HOUR + 1) % 24;
  const srCron = `${DAILY_MIN} ${srHour} * * *`;
  cron.schedule(srCron, async () => {
    console.log(`🔄 [${new Date().toISOString()}] Running spaced repetition checks...`);
    await runSpacedRepetitionDelivery(di);
  }, { timezone: 'Asia/Kolkata' });

  // ── Health Check (Every hour) ─────────────────────────────────────────────
  cron.schedule('0 * * * *', () => {
    console.log(`💓 [${new Date().toISOString()}] Scheduler health check OK`);
  });

  console.log(`✅ Scheduler started:`);
  console.log(`   Daily topics: ${DAILY_TIME}`);
  console.log(`   Weekly tests: Day ${WEEKLY_TEST_DAY} at ${process.env.WEEKLY_TEST_TIME}`);
  console.log(`   SR reviews: ${srHour}:${String(DAILY_MIN).padStart(2, '0')}`);
}

async function runDailyTopicDelivery(di: DIContainer): Promise<void> {
  try {
    const users = di.getRepository().getAllActiveUsers();
    console.log(`   Sending to ${users.length} active users...`);

    for (const user of users) {
      try {
        const today = new Date().toISOString().split('T')[0];
        if (user.last_active === today) {
          console.log(`   ⏭ Skipping ${user.phone_number} (already active today)`);
          continue;
        }

        await di.getSendDailyTopicUseCase().execute(user);
        console.log(`   ✅ Sent to ${user.phone_number}`);

        await delay(1500);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] runDailyTopicDelivery failed for ${user.phone_number}`, { error: msg });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scheduler] runDailyTopicDelivery error', { error: msg });
  }
}

async function runWeeklyTestDelivery(di: DIContainer): Promise<void> {
  try {
    const users = di.getRepository().getAllActiveUsers();
    console.log(`   Sending tests to ${users.length} active users...`);

    for (const user of users) {
      try {
        const summary = di.getRepository().getUserProgressSummary(user.id);
        if ((summary.understood ?? 0) === 0 && (summary.sent ?? 0) === 0) {
          console.log(`   ⏭ Skipping ${user.phone_number} (no progress this week)`);
          continue;
        }

        await di.getSendWeeklyTestUseCase().execute(user);
        await delay(2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] runWeeklyTestDelivery failed for ${user.phone_number}`, { error: msg });
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scheduler] runWeeklyTestDelivery error', { error: msg });
  }
}

async function runSpacedRepetitionDelivery(di: DIContainer): Promise<void> {
  try {
    const users = di.getRepository().getAllActiveUsers();
    let reviewsSent = 0;

    for (const user of users) {
      try {
        const dueReviews = di.getRepository().getDueReviews(user.id);
        if (dueReviews.length > 0) {
          await di.getSendDueReviewsUseCase().execute(user);
          reviewsSent++;
          await delay(1500);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] runSpacedRepetitionDelivery failed for ${user.phone_number}`, { error: msg });
      }
    }

    console.log(`   Sent ${reviewsSent} review reminders`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scheduler] runSpacedRepetitionDelivery error', { error: msg });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import cron from 'node-cron';
import dotenv from 'dotenv';
import { Repository } from '../db/repository';
import { LearningService } from './learning';

dotenv.config();

const DAILY_TIME = process.env.DAILY_MESSAGE_TIME ?? '09:00';
const [DAILY_HOUR, DAILY_MIN] = DAILY_TIME.split(':').map(Number);
const WEEKLY_TEST_DAY = parseInt(process.env.WEEKLY_TEST_DAY ?? '6'); // 6 = Saturday
const WEEKLY_TEST_HOUR = parseInt((process.env.WEEKLY_TEST_TIME ?? '10:00').split(':')[0]);
const WEEKLY_TEST_MIN = parseInt((process.env.WEEKLY_TEST_TIME ?? '10:00').split(':')[1]);

export function startScheduler(): void {
  console.log('⏰ Starting scheduler...');

  // ── Daily Topic Delivery ──────────────────────────────────────────────────
  // Runs every day at configured time (default 9:00 AM)
  const dailyCron = `${DAILY_MIN} ${DAILY_HOUR} * * *`;
  cron.schedule(dailyCron, async () => {
    console.log(`📬 [${new Date().toISOString()}] Running daily topic delivery...`);
    await runDailyTopicDelivery();
  }, { timezone: 'Asia/Kolkata' }); // Adjust timezone per your users

  // ── Weekly Test (Saturday) ────────────────────────────────────────────────
  const weeklyCron = `${WEEKLY_TEST_MIN} ${WEEKLY_TEST_HOUR} * * ${WEEKLY_TEST_DAY}`;
  cron.schedule(weeklyCron, async () => {
    console.log(`📝 [${new Date().toISOString()}] Running weekly test delivery...`);
    await runWeeklyTestDelivery();
  }, { timezone: 'Asia/Kolkata' });

  // ── Spaced Repetition Check (Daily at +1 hour after main delivery) ────────
  const srHour = (DAILY_HOUR + 1) % 24;
  const srCron = `${DAILY_MIN} ${srHour} * * *`;
  cron.schedule(srCron, async () => {
    console.log(`🔄 [${new Date().toISOString()}] Running spaced repetition checks...`);
    await runSpacedRepetitionDelivery();
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

async function runDailyTopicDelivery(): Promise<void> {
  const repo = new Repository();
  const learningService = new LearningService();

  try {
    const users = repo.getAllActiveUsers();
    console.log(`   Sending to ${users.length} active users...`);

    for (const user of users) {
      try {
        // Skip users who already received today's topic (check last_active)
        const today = new Date().toISOString().split('T')[0];
        if (user.last_active === today) {
          console.log(`   ⏭ Skipping ${user.phone_number} (already active today)`);
          continue;
        }

        await learningService.sendDailyTopic(user);
        console.log(`   ✅ Sent to ${user.phone_number}`);

        // Small delay between users to avoid rate limiting
        await delay(1500);
      } catch (err: any) {
        console.error(`   ❌ Failed for ${user.phone_number}:`, err.message);
      }
    }
  } finally {
    repo.close();
    learningService.close();
  }
}

async function runWeeklyTestDelivery(): Promise<void> {
  const repo = new Repository();
  const learningService = new LearningService();

  try {
    const users = repo.getAllActiveUsers();
    console.log(`   Sending tests to ${users.length} active users...`);

    for (const user of users) {
      try {
        // Only send test if user has been active this week (has learned topics)
        const summary = repo.getUserProgressSummary(user.id);
        if ((summary.understood ?? 0) === 0 && (summary.sent ?? 0) === 0) {
          console.log(`   ⏭ Skipping ${user.phone_number} (no progress this week)`);
          continue;
        }

        await learningService.sendWeeklyTest(user);
        await delay(2000);
      } catch (err: any) {
        console.error(`   ❌ Test failed for ${user.phone_number}:`, err.message);
      }
    }
  } finally {
    repo.close();
    learningService.close();
  }
}

async function runSpacedRepetitionDelivery(): Promise<void> {
  const repo = new Repository();
  const learningService = new LearningService();

  try {
    const users = repo.getAllActiveUsers();
    let reviewsSent = 0;

    for (const user of users) {
      try {
        const dueReviews = repo.getDueReviews(user.id);
        if (dueReviews.length > 0) {
          await learningService.sendDueReviews(user);
          reviewsSent++;
          await delay(1500);
        }
      } catch (err: any) {
        console.error(`   ❌ Review failed for ${user.phone_number}:`, err.message);
      }
    }

    console.log(`   Sent ${reviewsSent} review reminders`);
  } finally {
    repo.close();
    learningService.close();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run scheduler if called directly
if (require.main === module) {
  startScheduler();
  console.log('Scheduler running. Press Ctrl+C to stop.');
}

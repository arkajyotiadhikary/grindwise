import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  authStatePath: process.env['AUTH_STATE_PATH'] ?? 'auth_state',
  dailyMessageTime: process.env['DAILY_MESSAGE_TIME'] ?? '09:00',
  weeklyTestDay: parseInt(process.env['WEEKLY_TEST_DAY'] ?? '6', 10),
  weeklyTestTime: process.env['WEEKLY_TEST_TIME'] ?? '10:00',
} as const;

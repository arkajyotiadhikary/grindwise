import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './data/dsa_learning.db';

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export function getDatabase(): Database.Database {
  return new Database(DB_PATH);
}

export function initializeDatabase(): void {
  const db = getDatabase();

  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      name TEXT,
      roadmap_id TEXT DEFAULT 'neetcode',
      current_day INTEGER DEFAULT 1,
      current_week INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      last_active DATE,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    );

    -- Roadmap topics (NeetCode structure)
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      roadmap_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      difficulty TEXT CHECK(difficulty IN ('Beginner','Intermediate','Advanced')),
      day_number INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      content TEXT,          -- Full explanation markdown
      key_concepts TEXT,     -- JSON array of key points
      time_complexity TEXT,
      space_complexity TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Problems (from LeetCode)
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      leetcode_id INTEGER,
      leetcode_slug TEXT,
      title TEXT NOT NULL,
      description TEXT,
      difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')),
      solution_code TEXT,
      solution_explanation TEXT,
      hints TEXT,            -- JSON array
      tags TEXT,             -- JSON array
      url TEXT,
      fetched_at DATETIME,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- User progress per topic
    CREATE TABLE IF NOT EXISTS user_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      topic_id TEXT NOT NULL REFERENCES topics(id),
      status TEXT CHECK(status IN ('pending','sent','understood','needs_review')) DEFAULT 'pending',
      sent_at DATETIME,
      understood_at DATETIME,
      review_count INTEGER DEFAULT 0,
      last_reviewed DATETIME,
      user_rating INTEGER CHECK(user_rating BETWEEN 1 AND 5),
      notes TEXT,
      UNIQUE(user_id, topic_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Spaced repetition schedule
    CREATE TABLE IF NOT EXISTS spaced_repetition (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      topic_id TEXT NOT NULL REFERENCES topics(id),
      next_review_date DATE NOT NULL,
      interval_days INTEGER DEFAULT 1,
      ease_factor REAL DEFAULT 2.5,
      repetition_count INTEGER DEFAULT 0,
      last_quality INTEGER,   -- 0-5 rating from SM-2 algorithm
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Weekly tests
    CREATE TABLE IF NOT EXISTS weekly_tests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      week_number INTEGER NOT NULL,
      questions TEXT NOT NULL,  -- JSON array of question objects
      answers TEXT,             -- JSON object of user answers
      score INTEGER,
      max_score INTEGER,
      percentage REAL,
      status TEXT CHECK(status IN ('pending','sent','completed')) DEFAULT 'pending',
      sent_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Test questions bank
    CREATE TABLE IF NOT EXISTS test_questions (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id),
      question TEXT NOT NULL,
      type TEXT CHECK(type IN ('mcq','coding','true_false','fill_blank')) DEFAULT 'mcq',
      options TEXT,           -- JSON array for MCQ
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Message logs
    CREATE TABLE IF NOT EXISTS message_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      direction TEXT CHECK(direction IN ('inbound','outbound')) NOT NULL,
      message_type TEXT NOT NULL,  -- 'daily_topic','problem','test','reminder','response'
      content TEXT,
      status TEXT CHECK(status IN ('pending','sent','delivered','read','failed')) DEFAULT 'pending',
      openclaw_message_id TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- System scheduler jobs
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      job_type TEXT NOT NULL,  -- 'daily_topic','weekly_test','spaced_repeat'
      scheduled_for DATETIME NOT NULL,
      executed_at DATETIME,
      status TEXT CHECK(status IN ('pending','executed','failed','skipped')) DEFAULT 'pending',
      payload TEXT,           -- JSON metadata
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_topic ON user_progress(topic_id);
    CREATE INDEX IF NOT EXISTS idx_spaced_rep_next_review ON spaced_repetition(next_review_date);
    CREATE INDEX IF NOT EXISTS idx_spaced_rep_user ON spaced_repetition(user_id);
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_user ON scheduled_jobs(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_message_logs_user ON message_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_topics_week_day ON topics(week_number, day_number);
  `);

  console.log('✅ Database initialized successfully at:', DB_PATH);
  db.close();
}

// Run directly
if (require.main === module) {
  initializeDatabase();
}

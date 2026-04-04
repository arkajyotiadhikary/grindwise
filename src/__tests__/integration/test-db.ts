import Database from 'better-sqlite3';
import { SqliteRepositoryAdapter } from '@grindwise/adapters/persistence/sqlite/sqlite-repository.adapter';

const SCHEMA = `
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
    content TEXT,
    key_concepts TEXT,
    time_complexity TEXT,
    space_complexity TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

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
    hints TEXT,
    tags TEXT,
    url TEXT,
    fetched_at DATETIME,
    FOREIGN KEY (topic_id) REFERENCES topics(id)
  );

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

  CREATE TABLE IF NOT EXISTS spaced_repetition (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    topic_id TEXT NOT NULL REFERENCES topics(id),
    next_review_date DATE NOT NULL,
    interval_days INTEGER DEFAULT 1,
    ease_factor REAL DEFAULT 2.5,
    repetition_count INTEGER DEFAULT 0,
    last_quality INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
  );

  CREATE TABLE IF NOT EXISTS weekly_tests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    week_number INTEGER NOT NULL,
    questions TEXT NOT NULL,
    answers TEXT,
    score INTEGER,
    max_score INTEGER,
    percentage REAL,
    status TEXT CHECK(status IN ('pending','sent','completed')) DEFAULT 'pending',
    sent_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS test_questions (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL REFERENCES topics(id),
    question TEXT NOT NULL,
    type TEXT CHECK(type IN ('mcq','coding','true_false','fill_blank')) DEFAULT 'mcq',
    options TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty TEXT CHECK(difficulty IN ('Easy','Medium','Hard')),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
  );

  CREATE TABLE IF NOT EXISTS message_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    direction TEXT CHECK(direction IN ('inbound','outbound')) NOT NULL,
    message_type TEXT NOT NULL,
    content TEXT,
    status TEXT CHECK(status IN ('pending','sent','delivered','read','failed')) DEFAULT 'pending',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    phase TEXT CHECK(phase IN ('explanation','pseudo','code','completed')) DEFAULT 'explanation',
    awaiting_confirmation INTEGER DEFAULT 0,
    explanation_text TEXT,
    explanation_score INTEGER,
    explanation_feedback TEXT,
    pseudo_text TEXT,
    pseudo_score INTEGER,
    pseudo_feedback TEXT,
    code_text TEXT,
    code_score INTEGER,
    code_feedback TEXT,
    combined_quality INTEGER,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    UNIQUE(user_id, topic_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  );

  CREATE INDEX IF NOT EXISTS idx_topics_week_day ON topics(week_number, day_number);
`;

/**
 * Creates a fresh in-memory SQLite database with the full schema,
 * seeds minimal roadmap data, and returns a real SqliteRepositoryAdapter.
 */
export function createTestDb(): { repo: SqliteRepositoryAdapter; db: Database.Database } {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return { repo: new SqliteRepositoryAdapter(db), db };
}

/**
 * Seeds a minimal 2-week roadmap with 3 topics per week and 1 problem per topic.
 */
export function seedTestRoadmap(db: Database.Database): void {
  const topics = [
    { id: 'arrays-basics', name: 'Arrays Basics', category: 'Arrays', difficulty: 'Beginner', day: 1, week: 1, order: 1 },
    { id: 'hashing', name: 'Hashing', category: 'Arrays', difficulty: 'Beginner', day: 2, week: 1, order: 2 },
    { id: 'two-pointers', name: 'Two Pointers', category: 'Arrays', difficulty: 'Intermediate', day: 3, week: 1, order: 3 },
    { id: 'binary-search', name: 'Binary Search', category: 'Searching', difficulty: 'Intermediate', day: 1, week: 2, order: 4 },
    { id: 'sliding-window', name: 'Sliding Window', category: 'Arrays', difficulty: 'Intermediate', day: 2, week: 2, order: 5 },
    { id: 'stack-basics', name: 'Stack Basics', category: 'Stack', difficulty: 'Beginner', day: 3, week: 2, order: 6 },
  ];

  const insertTopic = db.prepare(`
    INSERT INTO topics (id, roadmap_id, name, description, category, difficulty, day_number, week_number, order_index, content, key_concepts, time_complexity, space_complexity)
    VALUES (?, 'neetcode', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProblem = db.prepare(`
    INSERT INTO problems (id, topic_id, leetcode_slug, title, difficulty, solution_code, solution_explanation, hints, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTestQuestion = db.prepare(`
    INSERT INTO test_questions (id, topic_id, question, type, options, correct_answer, explanation, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    for (const t of topics) {
      insertTopic.run(
        t.id, t.name, `Learn about ${t.name}`, t.category, t.difficulty,
        t.day, t.week, t.order,
        `${t.name} is a fundamental concept in DSA...`,
        JSON.stringify([`${t.name} basics`, `${t.name} patterns`]),
        'O(n)', 'O(1)',
      );

      insertProblem.run(
        `problem-${t.id}`, t.id, `${t.id}-problem`, `${t.name} Problem`,
        'Easy', `function solve() { /* ${t.name} */ }`,
        `Solution uses ${t.name} technique.`,
        JSON.stringify([`Think about ${t.name}`, 'Consider edge cases']),
        `https://leetcode.com/problems/${t.id}-problem/`,
      );

      insertTestQuestion.run(
        `tq-${t.id}`, t.id,
        `What is the key concept of ${t.name}?`, 'mcq',
        JSON.stringify(['Concept A', 'Concept B', 'Concept C', 'Concept D']),
        'Concept A', `${t.name} explanation`, 'Easy',
      );
    }
  });

  seed();
}

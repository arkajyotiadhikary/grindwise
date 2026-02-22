import Database from 'better-sqlite3';
import { getDatabase } from './init';
import { v4 as uuidv4 } from 'uuid';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  phone_number: string;
  name?: string;
  roadmap_id: string;
  current_day: number;
  current_week: number;
  streak: number;
  last_active?: string;
  enrolled_at: string;
  is_active: number;
}

export interface Topic {
  id: string;
  roadmap_id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  day_number: number;
  week_number: number;
  order_index: number;
  content: string;
  key_concepts: string; // JSON
  time_complexity: string;
  space_complexity: string;
}

export interface Problem {
  id: string;
  topic_id: string;
  leetcode_id?: number;
  leetcode_slug?: string;
  title: string;
  description?: string;
  difficulty: string;
  solution_code?: string;
  solution_explanation?: string;
  hints?: string; // JSON
  tags?: string; // JSON
  url?: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  topic_id: string;
  status: 'pending' | 'sent' | 'understood' | 'needs_review';
  sent_at?: string;
  understood_at?: string;
  review_count: number;
  last_reviewed?: string;
  user_rating?: number;
}

export interface SpacedRepetition {
  id: string;
  user_id: string;
  topic_id: string;
  next_review_date: string;
  interval_days: number;
  ease_factor: number;
  repetition_count: number;
  last_quality?: number;
}

export interface TestQuestion {
  id: string;
  topic_id: string;
  question: string;
  type: string;
  options?: string; // JSON
  correct_answer: string;
  explanation?: string;
  difficulty: string;
}

// ─── Repository Class ───────────────────────────────────────────────────────
export class Repository {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  close(): void {
    this.db.close();
  }

  // ── User Operations ──────────────────────────────────────────────────────
  createUser(phone: string, name?: string): User {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO users (id, phone_number, name, roadmap_id, current_day, current_week, streak)
      VALUES (?, ?, ?, 'neetcode', 1, 1, 0)
    `).run(id, phone, name ?? null);
    return this.getUserByPhone(phone)!;
  }

  getUserByPhone(phone: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phone) as User | undefined;
  }

  getUserById(id: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  getAllActiveUsers(): User[] {
    return this.db.prepare('SELECT * FROM users WHERE is_active = 1').all() as User[];
  }

  updateUserProgress(userId: string, newDay: number, newWeek: number): void {
    this.db.prepare(`
      UPDATE users SET current_day = ?, current_week = ?, last_active = CURRENT_DATE,
      streak = CASE WHEN last_active = DATE('now', '-1 day') THEN streak + 1 ELSE 1 END
      WHERE id = ?
    `).run(newDay, newWeek, userId);
  }

  // ── Topic Operations ─────────────────────────────────────────────────────
  getTopicByDayWeek(day: number, week: number, roadmapId = 'neetcode'): Topic | undefined {
    return this.db.prepare(`
      SELECT * FROM topics WHERE day_number = ? AND week_number = ? AND roadmap_id = ?
    `).get(day, week, roadmapId) as Topic | undefined;
  }

  getTopicsForWeek(week: number, roadmapId = 'neetcode'): Topic[] {
    return this.db.prepare(`
      SELECT * FROM topics WHERE week_number = ? AND roadmap_id = ? ORDER BY day_number
    `).all(week, roadmapId) as Topic[];
  }

  getTopicById(id: string): Topic | undefined {
    return this.db.prepare('SELECT * FROM topics WHERE id = ?').get(id) as Topic | undefined;
  }

  getAllTopics(roadmapId = 'neetcode'): Topic[] {
    return this.db.prepare(
      'SELECT * FROM topics WHERE roadmap_id = ? ORDER BY order_index'
    ).all(roadmapId) as Topic[];
  }

  getTotalWeeks(roadmapId = 'neetcode'): number {
    const result = this.db.prepare(
      'SELECT MAX(week_number) as max_week FROM topics WHERE roadmap_id = ?'
    ).get(roadmapId) as { max_week: number };
    return result.max_week;
  }

  getDaysInWeek(week: number, roadmapId = 'neetcode'): number {
    const result = this.db.prepare(
      'SELECT MAX(day_number) as max_day FROM topics WHERE week_number = ? AND roadmap_id = ?'
    ).get(week, roadmapId) as { max_day: number };
    return result.max_day;
  }

  // ── Problem Operations ───────────────────────────────────────────────────
  getProblemForTopic(topicId: string): Problem | undefined {
    return this.db.prepare('SELECT * FROM problems WHERE topic_id = ? LIMIT 1').get(topicId) as Problem | undefined;
  }

  getProblemsForTopic(topicId: string): Problem[] {
    return this.db.prepare('SELECT * FROM problems WHERE topic_id = ?').all(topicId) as Problem[];
  }

  upsertProblem(problem: Partial<Problem> & { topic_id: string; title: string }): void {
    const id = problem.id ?? uuidv4();
    this.db.prepare(`
      INSERT OR REPLACE INTO problems 
        (id, topic_id, leetcode_id, leetcode_slug, title, description, difficulty, solution_code, solution_explanation, hints, url, fetched_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, problem.topic_id, problem.leetcode_id ?? null, problem.leetcode_slug ?? null,
       problem.title, problem.description ?? null, problem.difficulty ?? 'Medium',
       problem.solution_code ?? null, problem.solution_explanation ?? null,
       problem.hints ?? null, problem.url ?? null);
  }

  // ── User Progress Operations ─────────────────────────────────────────────
  getOrCreateProgress(userId: string, topicId: string): UserProgress {
    const existing = this.db.prepare(
      'SELECT * FROM user_progress WHERE user_id = ? AND topic_id = ?'
    ).get(userId, topicId) as UserProgress | undefined;

    if (existing) return existing;

    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO user_progress (id, user_id, topic_id, status, review_count)
      VALUES (?, ?, ?, 'pending', 0)
    `).run(id, userId, topicId);
    return this.db.prepare('SELECT * FROM user_progress WHERE id = ?').get(id) as UserProgress;
  }

  markTopicSent(userId: string, topicId: string): void {
    this.db.prepare(`
      UPDATE user_progress SET status = 'sent', sent_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND topic_id = ?
    `).run(userId, topicId);
  }

  markTopicUnderstood(userId: string, topicId: string, rating: number): void {
    this.db.prepare(`
      UPDATE user_progress SET status = 'understood', understood_at = CURRENT_TIMESTAMP, user_rating = ?
      WHERE user_id = ? AND topic_id = ?
    `).run(rating, userId, topicId);
  }

  getUserProgressSummary(userId: string): { total: number; understood: number; sent: number } {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'understood' THEN 1 ELSE 0 END) as understood,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
      FROM user_progress WHERE user_id = ?
    `).get(userId) as any;
  }

  // ── Spaced Repetition Operations ─────────────────────────────────────────
  /**
   * SM-2 Algorithm implementation:
   * - quality: 0-5 (0=blackout, 5=perfect recall)
   * - easeFactor: starts at 2.5, adjusted based on quality
   * - interval: days until next review
   */
  updateSpacedRepetition(userId: string, topicId: string, quality: number): void {
    const existing = this.db.prepare(`
      SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?
    `).get(userId, topicId) as SpacedRepetition | undefined;

    let interval: number;
    let easeFactor: number;
    let repetitionCount: number;

    if (!existing) {
      interval = quality < 3 ? 1 : 1;
      easeFactor = 2.5;
      repetitionCount = 1;
    } else {
      easeFactor = Math.max(1.3, existing.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      repetitionCount = existing.repetition_count + 1;

      if (quality < 3) {
        interval = 1; // restart
      } else if (repetitionCount === 1) {
        interval = 1;
      } else if (repetitionCount === 2) {
        interval = 6;
      } else {
        interval = Math.round(existing.interval_days * easeFactor);
      }
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    const nextReviewStr = nextReview.toISOString().split('T')[0];

    if (!existing) {
      this.db.prepare(`
        INSERT INTO spaced_repetition (id, user_id, topic_id, next_review_date, interval_days, ease_factor, repetition_count, last_quality)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), userId, topicId, nextReviewStr, interval, easeFactor, repetitionCount, quality);
    } else {
      this.db.prepare(`
        UPDATE spaced_repetition 
        SET next_review_date = ?, interval_days = ?, ease_factor = ?, repetition_count = ?, last_quality = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND topic_id = ?
      `).run(nextReviewStr, interval, easeFactor, repetitionCount, quality, userId, topicId);
    }
  }

  getDueReviews(userId: string): SpacedRepetition[] {
    const today = new Date().toISOString().split('T')[0];
    return this.db.prepare(`
      SELECT * FROM spaced_repetition 
      WHERE user_id = ? AND next_review_date <= ?
      ORDER BY next_review_date
    `).all(userId, today) as SpacedRepetition[];
  }

  // ── Test Operations ───────────────────────────────────────────────────────
  getQuestionsForWeek(week: number, roadmapId = 'neetcode', limit = 10): TestQuestion[] {
    return this.db.prepare(`
      SELECT tq.* FROM test_questions tq
      JOIN topics t ON t.id = tq.topic_id
      WHERE t.week_number = ? AND t.roadmap_id = ?
      ORDER BY RANDOM() LIMIT ?
    `).all(week, roadmapId, limit) as TestQuestion[];
  }

  createWeeklyTest(userId: string, weekNumber: number, questions: TestQuestion[]): string {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO weekly_tests (id, user_id, week_number, questions, max_score, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(id, userId, weekNumber, JSON.stringify(questions), questions.length);
    return id;
  }

  getPendingTest(userId: string): any {
    return this.db.prepare(`
      SELECT * FROM weekly_tests WHERE user_id = ? AND status != 'completed' ORDER BY sent_at DESC LIMIT 1
    `).get(userId);
  }

  submitTestAnswer(testId: string, userId: string, answers: Record<string, string>): number {
    const test = this.db.prepare('SELECT * FROM weekly_tests WHERE id = ?').get(testId) as any;
    if (!test) return 0;

    const questions: TestQuestion[] = JSON.parse(test.questions);
    let score = 0;
    for (const q of questions) {
      if (answers[q.id]?.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()) {
        score++;
      }
    }
    const percentage = (score / questions.length) * 100;

    this.db.prepare(`
      UPDATE weekly_tests SET answers = ?, score = ?, percentage = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(answers), score, percentage, testId);

    return score;
  }

  // ── Message Logging ───────────────────────────────────────────────────────
  logMessage(userId: string, direction: 'inbound' | 'outbound', type: string, content: string, status = 'sent'): string {
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO message_logs (id, user_id, direction, message_type, content, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, direction, type, content, status);
    return id;
  }

  updateMessageStatus(logId: string, status: string, openclawId?: string): void {
    this.db.prepare(`
      UPDATE message_logs SET status = ?, openclaw_message_id = ? WHERE id = ?
    `).run(status, openclawId ?? null, logId);
  }
}

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { IRepositoryPort } from '../../../domain/ports/repository.port';
import { User } from '../../../domain/entities/user.entity';
import { Topic } from '../../../domain/entities/topic.entity';
import { Problem } from '../../../domain/entities/problem.entity';
import { UserProgress, SpacedRepetition, TestQuestion, WeeklyTest } from '../../../domain/entities/progress.entity';
import { SpacedRepetitionVO } from '../../../domain/value-objects/spaced-repetition.vo';

export class SqliteRepositoryAdapter implements IRepositoryPort {
  constructor(private readonly db: Database.Database) {}

  close(): void {
    this.db.close();
  }

  // ── User ──────────────────────────────────────────────────────────────────

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

  // ── Topics ────────────────────────────────────────────────────────────────

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
      'SELECT * FROM topics WHERE roadmap_id = ? ORDER BY order_index',
    ).all(roadmapId) as Topic[];
  }

  getTotalWeeks(roadmapId = 'neetcode'): number {
    const result = this.db.prepare(
      'SELECT MAX(week_number) as max_week FROM topics WHERE roadmap_id = ?',
    ).get(roadmapId) as { max_week: number };
    return result.max_week;
  }

  getDaysInWeek(week: number, roadmapId = 'neetcode'): number {
    const result = this.db.prepare(
      'SELECT MAX(day_number) as max_day FROM topics WHERE week_number = ? AND roadmap_id = ?',
    ).get(week, roadmapId) as { max_day: number };
    return result.max_day;
  }

  // ── Problems ──────────────────────────────────────────────────────────────

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
    `).run(
      id, problem.topic_id, problem.leetcode_id ?? null, problem.leetcode_slug ?? null,
      problem.title, problem.description ?? null, problem.difficulty ?? 'Medium',
      problem.solution_code ?? null, problem.solution_explanation ?? null,
      problem.hints ?? null, problem.url ?? null,
    );
  }

  // ── User Progress ─────────────────────────────────────────────────────────

  getOrCreateProgress(userId: string, topicId: string): UserProgress {
    const existing = this.db.prepare(
      'SELECT * FROM user_progress WHERE user_id = ? AND topic_id = ?',
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'understood' THEN 1 ELSE 0 END) as understood,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
      FROM user_progress WHERE user_id = ?
    `).get(userId) as { total: number; understood: number; sent: number };
  }

  // ── Spaced Repetition ─────────────────────────────────────────────────────

  updateSpacedRepetition(userId: string, topicId: string, quality: number): void {
    const existing = this.db.prepare(`
      SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?
    `).get(userId, topicId) as SpacedRepetition | undefined;

    const state = existing
      ? {
          intervalDays: existing.interval_days,
          easeFactor: existing.ease_factor,
          repetitionCount: existing.repetition_count,
        }
      : undefined;

    const next = SpacedRepetitionVO.computeNextInterval(quality, state);

    if (!existing) {
      this.db.prepare(`
        INSERT INTO spaced_repetition (id, user_id, topic_id, next_review_date, interval_days, ease_factor, repetition_count, last_quality)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), userId, topicId, next.nextReviewDate, next.intervalDays, next.easeFactor, next.repetitionCount, quality);
    } else {
      this.db.prepare(`
        UPDATE spaced_repetition
        SET next_review_date = ?, interval_days = ?, ease_factor = ?, repetition_count = ?, last_quality = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND topic_id = ?
      `).run(next.nextReviewDate, next.intervalDays, next.easeFactor, next.repetitionCount, quality, userId, topicId);
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

  // ── Tests ─────────────────────────────────────────────────────────────────

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

  getPendingTest(userId: string): WeeklyTest | undefined {
    return this.db.prepare(`
      SELECT * FROM weekly_tests WHERE user_id = ? AND status != 'completed' ORDER BY sent_at DESC LIMIT 1
    `).get(userId) as WeeklyTest | undefined;
  }

  submitTestAnswer(testId: string, userId: string, answers: Record<string, string>): number {
    const test = this.db.prepare('SELECT * FROM weekly_tests WHERE id = ?').get(testId) as WeeklyTest | undefined;
    if (!test) return 0;

    const questions = JSON.parse(test.questions) as TestQuestion[];
    let score = 0;
    for (const q of questions) {
      if ((answers[q.id] ?? '').toLowerCase().trim() === q.correct_answer.toLowerCase().trim()) {
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

  // ── Logging ───────────────────────────────────────────────────────────────

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

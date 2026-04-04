import { createTestDb, seedTestRoadmap } from './test-db';
import { SqliteRepositoryAdapter } from '@grindwise/adapters/persistence/sqlite/sqlite-repository.adapter';
import Database from 'better-sqlite3';

describe('SqliteRepositoryAdapter — Integration', () => {
  let repo: SqliteRepositoryAdapter;
  let db: Database.Database;

  beforeEach(() => {
    ({ repo, db } = createTestDb());
    seedTestRoadmap(db);
  });

  afterEach(() => repo.close());

  // ─── User CRUD ────────────────────────────────────────────────────────────

  describe('User management', () => {
    it('creates a user and retrieves by phone', () => {
      const user = repo.createUser('919999999999', 'Arka');
      expect(user.phone_number).toBe('919999999999');
      expect(user.name).toBe('Arka');
      expect(user.current_day).toBe(1);
      expect(user.current_week).toBe(1);
      expect(user.roadmap_id).toBe('neetcode');

      const found = repo.getUserByPhone('919999999999');
      expect(found).toBeDefined();
      expect(found!.id).toBe(user.id);
    });

    it('retrieves user by id', () => {
      const user = repo.createUser('919999999999');
      const found = repo.getUserById(user.id);
      expect(found).toBeDefined();
      expect(found!.phone_number).toBe('919999999999');
    });

    it('returns undefined for non-existent user', () => {
      expect(repo.getUserByPhone('000')).toBeUndefined();
      expect(repo.getUserById('no-such-id')).toBeUndefined();
    });

    it('lists all active users', () => {
      repo.createUser('91111');
      repo.createUser('91222');
      const users = repo.getAllActiveUsers();
      expect(users.length).toBe(2);
    });

    it('updates user progress (day/week)', () => {
      const user = repo.createUser('919999999999');
      repo.updateUserProgress(user.id, 2, 1);
      const updated = repo.getUserById(user.id)!;
      expect(updated.current_day).toBe(2);
      expect(updated.current_week).toBe(1);
    });
  });

  // ─── Topics ───────────────────────────────────────────────────────────────

  describe('Topic queries', () => {
    it('gets topic by day and week', () => {
      const topic = repo.getTopicByDayWeek(1, 1);
      expect(topic).toBeDefined();
      expect(topic!.id).toBe('arrays-basics');
      expect(topic!.name).toBe('Arrays Basics');
    });

    it('returns undefined for non-existent day/week', () => {
      expect(repo.getTopicByDayWeek(99, 99)).toBeUndefined();
    });

    it('gets all topics for a week', () => {
      const week1 = repo.getTopicsForWeek(1);
      expect(week1.length).toBe(3);
      expect(week1[0]!.day_number).toBe(1);
      expect(week1[2]!.day_number).toBe(3);
    });

    it('gets total weeks', () => {
      expect(repo.getTotalWeeks()).toBe(2);
    });

    it('gets days in week', () => {
      expect(repo.getDaysInWeek(1)).toBe(3);
      expect(repo.getDaysInWeek(2)).toBe(3);
    });

    it('gets all topics ordered by order_index', () => {
      const all = repo.getAllTopics();
      expect(all.length).toBe(6);
      expect(all[0]!.order_index).toBe(1);
      expect(all[5]!.order_index).toBe(6);
    });

    it('gets topic by id', () => {
      const topic = repo.getTopicById('hashing');
      expect(topic).toBeDefined();
      expect(topic!.name).toBe('Hashing');
    });
  });

  // ─── Problems ─────────────────────────────────────────────────────────────

  describe('Problem queries', () => {
    it('gets problem for topic', () => {
      const problem = repo.getProblemForTopic('arrays-basics');
      expect(problem).toBeDefined();
      expect(problem!.title).toBe('Arrays Basics Problem');
      expect(problem!.topic_id).toBe('arrays-basics');
    });

    it('returns undefined for topic with no problems', () => {
      // Remove problems for a topic
      db.prepare('DELETE FROM problems WHERE topic_id = ?').run('hashing');
      expect(repo.getProblemForTopic('hashing')).toBeUndefined();
    });

    it('upserts a new problem', () => {
      repo.upsertProblem({
        topic_id: 'arrays-basics',
        title: 'New Problem',
        difficulty: 'Medium',
        description: 'A new problem',
      });
      const problems = repo.getProblemsForTopic('arrays-basics');
      expect(problems.length).toBe(2);
    });
  });

  // ─── User Progress ────────────────────────────────────────────────────────

  describe('User progress tracking', () => {
    it('creates progress on first access and returns existing on second', () => {
      const user = repo.createUser('919999999999');
      const progress1 = repo.getOrCreateProgress(user.id, 'arrays-basics');
      expect(progress1.status).toBe('pending');

      const progress2 = repo.getOrCreateProgress(user.id, 'arrays-basics');
      expect(progress2.id).toBe(progress1.id);
    });

    it('marks topic as sent', () => {
      const user = repo.createUser('919999999999');
      repo.getOrCreateProgress(user.id, 'arrays-basics');
      repo.markTopicSent(user.id, 'arrays-basics');

      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.sent).toBe(1);
    });

    it('marks topic as understood with rating', () => {
      const user = repo.createUser('919999999999');
      repo.getOrCreateProgress(user.id, 'arrays-basics');
      repo.markTopicUnderstood(user.id, 'arrays-basics', 5);

      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.understood).toBe(1);
    });

    it('returns correct progress summary', () => {
      const user = repo.createUser('919999999999');
      repo.getOrCreateProgress(user.id, 'arrays-basics');
      repo.markTopicSent(user.id, 'arrays-basics');
      repo.getOrCreateProgress(user.id, 'hashing');
      repo.markTopicSent(user.id, 'hashing');
      repo.markTopicUnderstood(user.id, 'hashing', 4);

      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.total).toBe(2);
      expect(summary.sent).toBe(1); // arrays is still 'sent', hashing became 'understood'
      expect(summary.understood).toBe(1);
    });
  });

  // ─── Spaced Repetition ────────────────────────────────────────────────────

  describe('Spaced repetition', () => {
    it('creates SR record on first call', () => {
      const user = repo.createUser('919999999999');
      repo.updateSpacedRepetition(user.id, 'arrays-basics', 5);

      const reviews = repo.getDueReviews(user.id);
      // First interval is 1 day into the future, so not due today
      // But let's check the record exists
      const row = db.prepare(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?',
      ).get(user.id, 'arrays-basics') as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row['last_quality']).toBe(5);
    });

    it('updates existing SR record on subsequent calls', () => {
      const user = repo.createUser('919999999999');
      repo.updateSpacedRepetition(user.id, 'arrays-basics', 5);
      repo.updateSpacedRepetition(user.id, 'arrays-basics', 3);

      const row = db.prepare(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?',
      ).get(user.id, 'arrays-basics') as Record<string, unknown>;
      expect(row['last_quality']).toBe(3);
      expect(row['repetition_count']).toBe(2);
    });

    it('returns due reviews for past review dates', () => {
      const user = repo.createUser('919999999999');
      // Insert a review that was due yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO spaced_repetition (id, user_id, topic_id, next_review_date, interval_days, ease_factor, repetition_count)
        VALUES ('sr-1', ?, 'arrays-basics', ?, 1, 2.5, 1)
      `).run(user.id, dateStr);

      const reviews = repo.getDueReviews(user.id);
      expect(reviews.length).toBe(1);
      expect(reviews[0]!.topic_id).toBe('arrays-basics');
    });

    it('does not return future reviews', () => {
      const user = repo.createUser('919999999999');
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const dateStr = future.toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO spaced_repetition (id, user_id, topic_id, next_review_date, interval_days, ease_factor, repetition_count)
        VALUES ('sr-1', ?, 'arrays-basics', ?, 30, 2.5, 3)
      `).run(user.id, dateStr);

      expect(repo.getDueReviews(user.id).length).toBe(0);
    });
  });

  // ─── Weekly Tests ─────────────────────────────────────────────────────────

  describe('Weekly tests', () => {
    it('fetches test questions for a week', () => {
      const questions = repo.getQuestionsForWeek(1);
      expect(questions.length).toBe(3); // one per topic in week 1
    });

    it('creates a test and retrieves as pending', () => {
      const user = repo.createUser('919999999999');
      const questions = repo.getQuestionsForWeek(1);
      const testId = repo.createWeeklyTest(user.id, 1, questions);

      const pending = repo.getPendingTest(user.id);
      expect(pending).toBeDefined();
      expect(pending!.id).toBe(testId);
      expect(pending!.status).toBe('pending');
    });

    it('submits answers and scores correctly', () => {
      const user = repo.createUser('919999999999');
      const questions = repo.getQuestionsForWeek(1);
      const testId = repo.createWeeklyTest(user.id, 1, questions);

      // Answer all correctly
      const answers: Record<string, string> = {};
      for (const q of questions) {
        answers[q.id] = q.correct_answer;
      }
      const score = repo.submitTestAnswer(testId, user.id, answers);
      expect(score).toBe(questions.length);

      // Test should be completed now
      const pending = repo.getPendingTest(user.id);
      expect(pending).toBeUndefined();
    });

    it('scores partial answers correctly', () => {
      const user = repo.createUser('919999999999');
      const questions = repo.getQuestionsForWeek(1);
      const testId = repo.createWeeklyTest(user.id, 1, questions);

      const answers: Record<string, string> = {};
      // Only answer first one correctly
      answers[questions[0]!.id] = questions[0]!.correct_answer;
      for (let i = 1; i < questions.length; i++) {
        answers[questions[i]!.id] = 'WRONG';
      }
      const score = repo.submitTestAnswer(testId, user.id, answers);
      expect(score).toBe(1);
    });
  });

  // ─── Practice Sessions ────────────────────────────────────────────────────

  describe('Practice sessions', () => {
    it('creates a practice session and retrieves it', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );
      expect(session.phase).toBe('explanation');
      expect(session.awaiting_confirmation).toBe(0);
    });

    it('returns existing session on duplicate create', () => {
      const user = repo.createUser('919999999999');
      const s1 = repo.getOrCreatePracticeSession(user.id, 'arrays-basics', 'problem-arrays-basics');
      const s2 = repo.getOrCreatePracticeSession(user.id, 'arrays-basics', 'problem-arrays-basics');
      expect(s1.id).toBe(s2.id);
    });

    it('gets active practice session', () => {
      const user = repo.createUser('919999999999');
      repo.getOrCreatePracticeSession(user.id, 'arrays-basics', 'problem-arrays-basics');
      const active = repo.getActivePracticeSession(user.id);
      expect(active).toBeDefined();
      expect(active!.topic_id).toBe('arrays-basics');
    });

    it('saves phase submission (sets text and awaiting_confirmation)', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );
      repo.savePracticePhaseSubmission(session.id, 'explanation', 'Use hash map');

      const updated = repo.getActivePracticeSession(user.id)!;
      expect(updated.explanation_text).toBe('Use hash map');
      expect(updated.awaiting_confirmation).toBe(1);
    });

    it('saves phase score', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );
      repo.savePracticePhaseScore(session.id, 'explanation', 'approach', 4, 'Good');

      const updated = repo.getActivePracticeSession(user.id)!;
      expect(updated.explanation_text).toBe('approach');
      expect(updated.explanation_score).toBe(4);
      expect(updated.explanation_feedback).toBe('Good');
    });

    it('updates practice phase', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );
      repo.updatePracticePhase(session.id, 'pseudo', 0);

      const updated = repo.getActivePracticeSession(user.id)!;
      expect(updated.phase).toBe('pseudo');
      expect(updated.awaiting_confirmation).toBe(0);
    });

    it('completes practice session', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );
      repo.completePracticeSession(session.id, 4);

      // No longer active
      const active = repo.getActivePracticeSession(user.id);
      expect(active).toBeUndefined();

      // But retrievable by topic
      const completed = repo.getPracticeSessionForTopic(user.id, 'arrays-basics');
      expect(completed).toBeDefined();
      expect(completed!.combined_quality).toBe(4);
      expect(completed!.phase).toBe('completed');
    });

    it('full practice flow: explanation → pseudo → code → complete', () => {
      const user = repo.createUser('919999999999');
      const session = repo.getOrCreatePracticeSession(
        user.id, 'arrays-basics', 'problem-arrays-basics',
      );

      // Explanation phase
      repo.savePracticePhaseSubmission(session.id, 'explanation', 'My approach');
      repo.savePracticePhaseScore(session.id, 'explanation', 'My approach', 4, 'Good');
      repo.updatePracticePhase(session.id, 'pseudo', 0);

      // Pseudo phase
      repo.savePracticePhaseSubmission(session.id, 'pseudo', 'for each elem...');
      repo.savePracticePhaseScore(session.id, 'pseudo', 'for each elem...', 3, 'OK');
      repo.updatePracticePhase(session.id, 'code', 0);

      // Code phase
      repo.savePracticePhaseSubmission(session.id, 'code', 'function solve() {}');
      repo.savePracticePhaseScore(session.id, 'code', 'function solve() {}', 5, 'Great');

      // Complete
      const combined = Math.round(4 * 0.25 + 3 * 0.35 + 5 * 0.40);
      repo.completePracticeSession(session.id, combined);

      const completed = repo.getPracticeSessionForTopic(user.id, 'arrays-basics')!;
      expect(completed.explanation_score).toBe(4);
      expect(completed.pseudo_score).toBe(3);
      expect(completed.code_score).toBe(5);
      expect(completed.combined_quality).toBe(combined);
      expect(completed.phase).toBe('completed');
    });
  });

  // ─── Message Logging ──────────────────────────────────────────────────────

  describe('Message logging', () => {
    it('logs and retrieves messages', () => {
      const user = repo.createUser('919999999999');
      const logId = repo.logMessage(user.id, 'outbound', 'topic', 'Hello');
      expect(logId).toBeDefined();

      const row = db.prepare('SELECT * FROM message_logs WHERE id = ?').get(logId) as Record<string, unknown>;
      expect(row['content']).toBe('Hello');
      expect(row['direction']).toBe('outbound');
    });

    it('updates message status', () => {
      const user = repo.createUser('919999999999');
      const logId = repo.logMessage(user.id, 'outbound', 'topic', 'Hello');
      repo.updateMessageStatus(logId, 'delivered');

      const row = db.prepare('SELECT * FROM message_logs WHERE id = ?').get(logId) as Record<string, unknown>;
      expect(row['status']).toBe('delivered');
    });
  });
});

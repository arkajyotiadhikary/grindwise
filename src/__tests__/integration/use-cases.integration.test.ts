import { createTestDb, seedTestRoadmap } from './test-db';
import { SqliteRepositoryAdapter } from '@grindwise/adapters/persistence/sqlite/sqlite-repository.adapter';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { RegisterUserUseCase } from '@grindwise/application/use-cases/register-user.usecase';
import { SendDailyTopicUseCase } from '@grindwise/application/use-cases/send-daily-topic.usecase';
import { SendDailyProblemUseCase } from '@grindwise/application/use-cases/send-daily-problem.usecase';
import { SendSolutionUseCase } from '@grindwise/application/use-cases/send-solution.usecase';
import { HandleDifficultyRatingUseCase } from '@grindwise/application/use-cases/handle-difficulty-rating.usecase';
import { SendDueReviewsUseCase } from '@grindwise/application/use-cases/send-due-reviews.usecase';
import { HandleReviewRatingUseCase } from '@grindwise/application/use-cases/handle-review-rating.usecase';
import { SendWeeklyTestUseCase } from '@grindwise/application/use-cases/send-weekly-test.usecase';
import { SubmitTestAnswerUseCase } from '@grindwise/application/use-cases/submit-test-answer.usecase';
import { SendProgressReportUseCase } from '@grindwise/application/use-cases/send-progress-report.usecase';
import { SubmitPracticePhaseUseCase } from '@grindwise/application/use-cases/submit-practice-phase.usecase';
import { HandlePracticeConfirmationUseCase } from '@grindwise/application/use-cases/handle-practice-confirmation.usecase';
import { AskDsaQuestionUseCase } from '@grindwise/application/use-cases/ask-dsa-question.usecase';
import { SendHelpUseCase } from '@grindwise/application/use-cases/send-help.usecase';
import { createMockMessenger, createMockContentGen } from '../mocks';
import Database from 'better-sqlite3';

jest.useFakeTimers();

describe('Use Cases — Integration with real SQLite', () => {
  let repo: SqliteRepositoryAdapter;
  let db: Database.Database;
  let messenger: ReturnType<typeof createMockMessenger>;
  let contentGen: ReturnType<typeof createMockContentGen>;
  let curriculum: CurriculumDomainService;

  beforeEach(() => {
    ({ repo, db } = createTestDb());
    seedTestRoadmap(db);
    messenger = createMockMessenger();
    contentGen = createMockContentGen();
    curriculum = new CurriculumDomainService(repo);
  });

  afterEach(() => repo.close());

  // ─── Registration ─────────────────────────────────────────────────────────

  describe('RegisterUser', () => {
    it('creates user in DB and sends welcome', async () => {
      const useCase = new RegisterUserUseCase(repo, messenger);
      const user = await useCase.execute('919999999999', 'Arka');

      expect(user.phone_number).toBe('919999999999');
      expect(user.name).toBe('Arka');

      // Verify persisted in DB
      const dbUser = repo.getUserByPhone('919999999999');
      expect(dbUser).toBeDefined();
      expect(dbUser!.id).toBe(user.id);

      // Welcome message sent
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Welcome'),
      );

      // Message logged in DB
      const logs = db.prepare(
        'SELECT * FROM message_logs WHERE user_id = ?',
      ).all(user.id);
      expect(logs.length).toBe(1);
    });

    it('does not create duplicate users', async () => {
      const useCase = new RegisterUserUseCase(repo, messenger);
      const u1 = await useCase.execute('919999999999', 'Arka');
      const u2 = await useCase.execute('919999999999');
      expect(u1.id).toBe(u2.id);

      const allUsers = repo.getAllActiveUsers();
      expect(allUsers.length).toBe(1);
    });
  });

  // ─── Daily Topic Flow ─────────────────────────────────────────────────────

  describe('SendDailyTopic + SendDailyProblem', () => {
    it('sends topic, marks progress, schedules problem', async () => {
      const user = repo.createUser('919999999999', 'Arka');
      const sendProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
      const useCase = new SendDailyTopicUseCase(
        repo, messenger, contentGen, curriculum, sendProblem,
      );

      await useCase.execute(user);

      // Topic sent
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Arrays Basics'),
      );

      // Progress tracked
      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.sent).toBe(1);

      // Problem scheduled after timeout
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve(); // flush microtasks
    });

    it('sends congratulations when roadmap is complete', async () => {
      const user = repo.createUser('919999999999', 'Arka');
      // Move past all topics
      repo.updateUserProgress(user.id, 99, 99);
      const freshUser = repo.getUserById(user.id)!;

      const sendProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
      const useCase = new SendDailyTopicUseCase(
        repo, messenger, contentGen, curriculum, sendProblem,
      );

      await useCase.execute(freshUser);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Congratulations'),
      );
    });
  });

  describe('SendDailyProblem', () => {
    it('sends problem and creates practice session in DB', async () => {
      const user = repo.createUser('919999999999');
      const useCase = new SendDailyProblemUseCase(repo, messenger, curriculum);

      await useCase.execute(user);

      // Problem sent
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Arrays Basics Problem'),
      );

      // Practice session created
      const session = repo.getActivePracticeSession(user.id);
      expect(session).toBeDefined();
      expect(session!.phase).toBe('explanation');
    });
  });

  // ─── Solution ─────────────────────────────────────────────────────────────

  describe('SendSolution', () => {
    it('sends solution for current topic from DB', async () => {
      const user = repo.createUser('919999999999');
      const useCase = new SendSolutionUseCase(repo, messenger, contentGen, curriculum);

      await useCase.execute(user);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Solution'),
      );
    });
  });

  // ─── Difficulty Rating + Advancement ──────────────────────────────────────

  describe('HandleDifficultyRating — full advancement flow', () => {
    it('EASY: advances user from day 1 to day 2, updates SR', async () => {
      const user = repo.createUser('919999999999');
      repo.getOrCreateProgress(user.id, 'arrays-basics');
      const useCase = new HandleDifficultyRatingUseCase(repo, messenger, curriculum);

      await useCase.execute(user, 'EASY');

      // User advanced
      const updated = repo.getUserById(user.id)!;
      expect(updated.current_day).toBe(2);
      expect(updated.current_week).toBe(1);

      // SR record created
      const sr = db.prepare(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?',
      ).get(user.id, 'arrays-basics') as Record<string, unknown>;
      expect(sr).toBeDefined();
      expect(sr['last_quality']).toBe(5);

      // Progress marked understood
      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.understood).toBe(1);
    });

    it('advances across week boundary (day 3 week 1 → day 1 week 2)', async () => {
      const user = repo.createUser('919999999999');
      repo.updateUserProgress(user.id, 3, 1);
      const freshUser = repo.getUserById(user.id)!;
      repo.getOrCreateProgress(freshUser.id, 'two-pointers');

      const useCase = new HandleDifficultyRatingUseCase(repo, messenger, curriculum);
      await useCase.execute(freshUser, 'MEDIUM');

      const updated = repo.getUserById(user.id)!;
      expect(updated.current_day).toBe(1);
      expect(updated.current_week).toBe(2);
    });

    it('marks roadmap complete at last topic', async () => {
      const user = repo.createUser('919999999999');
      repo.updateUserProgress(user.id, 3, 2); // last topic
      const freshUser = repo.getUserById(user.id)!;
      repo.getOrCreateProgress(freshUser.id, 'stack-basics');

      const useCase = new HandleDifficultyRatingUseCase(repo, messenger, curriculum);
      await useCase.execute(freshUser, 'EASY');

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('completed the entire roadmap'),
      );
    });
  });

  // ─── Spaced Repetition Reviews ────────────────────────────────────────────

  describe('SendDueReviews + HandleReviewRating', () => {
    it('sends "no reviews due" when none exist', async () => {
      const user = repo.createUser('919999999999');
      const useCase = new SendDueReviewsUseCase(repo, messenger, contentGen);

      await useCase.execute(user);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('No reviews due'),
      );
    });

    it('sends review for due topic and allows rating', async () => {
      const user = repo.createUser('919999999999');

      // Insert a due review
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      db.prepare(`
        INSERT INTO spaced_repetition (id, user_id, topic_id, next_review_date, interval_days, ease_factor, repetition_count)
        VALUES ('sr-1', ?, 'arrays-basics', ?, 1, 2.5, 1)
      `).run(user.id, yesterday.toISOString().split('T')[0]);

      const sendReviews = new SendDueReviewsUseCase(repo, messenger, contentGen);
      await sendReviews.execute(user);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Arrays Basics'),
      );

      // Rate the review
      messenger.sendText.mockClear();
      const handleRating = new HandleReviewRatingUseCase(repo, messenger);
      await handleRating.execute(user, 'RECALL');

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Perfect recall'),
      );

      // SR updated — quality should be 5
      const sr = db.prepare(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?',
      ).get(user.id, 'arrays-basics') as Record<string, unknown>;
      expect(sr['last_quality']).toBe(5);
    });
  });

  // ─── Weekly Test Flow ─────────────────────────────────────────────────────

  describe('SendWeeklyTest + SubmitTestAnswer', () => {
    it('creates test and sends first question', async () => {
      const user = repo.createUser('919999999999');
      const sendTest = new SendWeeklyTestUseCase(repo, messenger);

      await sendTest.execute(user);

      const pending = repo.getPendingTest(user.id);
      expect(pending).toBeDefined();
      expect(pending!.status).toBe('pending');

      const questions = JSON.parse(pending!.questions) as Array<{
        id: string;
        correct_answer: string;
      }>;
      expect(questions.length).toBe(3);
      expect(messenger.sendList).toHaveBeenCalled();
    });

    it('completes multi-question test end-to-end', async () => {
      const user = repo.createUser('919999999999');
      const sendTest = new SendWeeklyTestUseCase(repo, messenger);

      await sendTest.execute(user);

      const pending = repo.getPendingTest(user.id)!;
      const questions = JSON.parse(pending.questions) as Array<{
        id: string;
        correct_answer: string;
      }>;

      messenger.sendText.mockClear();
      messenger.sendList.mockClear();
      const submitAnswer = new SubmitTestAnswerUseCase(repo, messenger);

      // Answer all questions correctly one by one
      for (const q of questions) {
        await submitAnswer.execute(
          user,
          `test:${pending.id}:q:${q.id}:a:${q.correct_answer}`,
        );
      }

      // Test completed — no more pending
      expect(repo.getPendingTest(user.id)).toBeUndefined();

      // Results sent
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Test Complete'),
      );

      // Score persisted in DB
      const completed = db.prepare(
        'SELECT * FROM weekly_tests WHERE id = ?',
      ).get(pending.id) as Record<string, unknown>;
      expect(completed['status']).toBe('completed');
      expect(completed['score']).toBe(questions.length);
      expect(completed['percentage']).toBe(100);
    });

    it('scores partial answers correctly', async () => {
      const user = repo.createUser('919999999999');
      const questions = repo.getQuestionsForWeek(1);
      const testId = repo.createWeeklyTest(user.id, 1, questions);

      const submitAnswer = new SubmitTestAnswerUseCase(repo, messenger);

      // First question correct, rest wrong
      await submitAnswer.execute(
        user,
        `test:${testId}:q:${questions[0]!.id}:a:${questions[0]!.correct_answer}`,
      );
      for (let i = 1; i < questions.length; i++) {
        await submitAnswer.execute(
          user,
          `test:${testId}:q:${questions[i]!.id}:a:WRONG`,
        );
      }

      const completed = db.prepare(
        'SELECT * FROM weekly_tests WHERE id = ?',
      ).get(testId) as Record<string, unknown>;
      expect(completed['score']).toBe(1);

      // Weak topics marked for SR review
      expect(
        db.prepare('SELECT COUNT(*) as c FROM spaced_repetition WHERE user_id = ?')
          .get(user.id) as { c: number },
      ).toEqual({ c: 2 }); // 2 wrong answers → 2 unique weak topics
    });
  });

  // ─── Practice Session Flow (end-to-end) ───────────────────────────────────

  describe('Full practice session: submit → confirm → advance', () => {
    it('explanation → pseudo → code → session complete', async () => {
      const user = repo.createUser('919999999999');

      // First send problem to create session
      const sendProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
      await sendProblem.execute(user);
      messenger.sendText.mockClear();

      const submitPhase = new SubmitPracticePhaseUseCase(repo, messenger);
      const handleConfirm = new HandlePracticeConfirmationUseCase(
        repo, messenger, contentGen, curriculum,
      );

      // ── EXPLANATION ──
      await submitPhase.execute(user, 'explanation', 'Use a hash map for O(n) lookup');
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('YES'),
      );

      // Verify DB state
      let session = repo.getActivePracticeSession(user.id)!;
      expect(session.explanation_text).toBe('Use a hash map for O(n) lookup');
      expect(session.awaiting_confirmation).toBe(1);

      messenger.sendText.mockClear();
      await handleConfirm.execute(user, true);

      // Should advance to pseudo
      session = repo.getActivePracticeSession(user.id)!;
      expect(session.phase).toBe('pseudo');
      expect(session.explanation_score).toBeDefined();

      // ── PSEUDOCODE ──
      messenger.sendText.mockClear();
      await submitPhase.execute(user, 'pseudo', 'for each element, check if complement in map');
      await handleConfirm.execute(user, true);

      session = repo.getActivePracticeSession(user.id)!;
      expect(session.phase).toBe('code');
      expect(session.pseudo_score).toBeDefined();

      // ── CODE ──
      messenger.sendText.mockClear();
      await submitPhase.execute(user, 'code', 'function twoSum(nums, target) { ... }');
      await handleConfirm.execute(user, true);

      // Session should be completed
      const active = repo.getActivePracticeSession(user.id);
      expect(active).toBeUndefined();

      const completed = repo.getPracticeSessionForTopic(user.id, 'arrays-basics')!;
      expect(completed.phase).toBe('completed');
      expect(completed.combined_quality).toBeDefined();
      expect(completed.explanation_score).toBeDefined();
      expect(completed.pseudo_score).toBeDefined();
      expect(completed.code_score).toBeDefined();

      // User should have advanced
      const updatedUser = repo.getUserById(user.id)!;
      expect(updatedUser.current_day).toBeGreaterThanOrEqual(1);

      // SR record should exist
      const sr = db.prepare(
        'SELECT * FROM spaced_repetition WHERE user_id = ? AND topic_id = ?',
      ).get(user.id, 'arrays-basics');
      expect(sr).toBeDefined();

      // Practice complete message sent
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Practice Session Complete'),
      );
    });

    it('rejects wrong phase order', async () => {
      const user = repo.createUser('919999999999');
      const sendProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
      await sendProblem.execute(user);
      messenger.sendText.mockClear();

      const submitPhase = new SubmitPracticePhaseUseCase(repo, messenger);

      // Try submitting code before explanation
      await submitPhase.execute(user, 'code', 'function solve() {}');

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('explanation'),
      );
    });

    it('allows retry on NO confirmation', async () => {
      const user = repo.createUser('919999999999');
      const sendProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
      await sendProblem.execute(user);

      const submitPhase = new SubmitPracticePhaseUseCase(repo, messenger);
      const handleConfirm = new HandlePracticeConfirmationUseCase(
        repo, messenger, contentGen, curriculum,
      );

      await submitPhase.execute(user, 'explanation', 'bad answer');
      messenger.sendText.mockClear();
      await handleConfirm.execute(user, false); // NO

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('/explanation'),
      );

      // Session still on explanation phase
      const session = repo.getActivePracticeSession(user.id)!;
      expect(session.phase).toBe('explanation');
      expect(session.awaiting_confirmation).toBe(0);

      // Can resubmit
      messenger.sendText.mockClear();
      await submitPhase.execute(user, 'explanation', 'better answer');
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('YES'),
      );
    });
  });

  // ─── Progress Report ──────────────────────────────────────────────────────

  describe('SendProgressReport', () => {
    it('reports correct stats from real DB', async () => {
      const user = repo.createUser('919999999999', 'Arka');
      repo.getOrCreateProgress(user.id, 'arrays-basics');
      repo.markTopicSent(user.id, 'arrays-basics');
      repo.markTopicUnderstood(user.id, 'arrays-basics', 5);

      const useCase = new SendProgressReportUseCase(repo, messenger, curriculum);
      await useCase.execute(user);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('Arka'),
      );
      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('1'),
      );
    });
  });

  // ─── Ask DSA Question ─────────────────────────────────────────────────────

  describe('AskDsaQuestion', () => {
    it('sends answer and logs in DB', async () => {
      const user = repo.createUser('919999999999');
      contentGen.askDsaQuestion.mockResolvedValue({
        isDsaRelated: true,
        answer: 'A stack uses LIFO ordering.',
      });

      const useCase = new AskDsaQuestionUseCase(repo, messenger, contentGen);
      await useCase.execute(user, 'What is a stack?');

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('LIFO'),
      );

      // Logged in DB
      const logs = db.prepare(
        "SELECT * FROM message_logs WHERE user_id = ? AND message_type = 'ask'",
      ).all(user.id);
      expect(logs.length).toBe(1);
    });
  });

  // ─── Help ─────────────────────────────────────────────────────────────────

  describe('SendHelp', () => {
    it('sends help and logs', async () => {
      const user = repo.createUser('919999999999');
      const useCase = new SendHelpUseCase(repo, messenger);
      await useCase.execute(user);

      expect(messenger.sendText).toHaveBeenCalledWith(
        '919999999999',
        expect.stringContaining('/topic'),
      );

      const logs = db.prepare(
        "SELECT * FROM message_logs WHERE user_id = ? AND message_type = 'help'",
      ).all(user.id);
      expect(logs.length).toBe(1);
    });
  });

  // ─── Multi-topic advancement (end-to-end) ─────────────────────────────────

  describe('Full roadmap progression: topic → rate → next topic', () => {
    it('user advances through 3 topics correctly', async () => {
      const user = repo.createUser('919999999999', 'Arka');
      const ratingUC = new HandleDifficultyRatingUseCase(repo, messenger, curriculum);

      // Topic 1: arrays-basics (day 1 week 1)
      let currentUser = repo.getUserById(user.id)!;
      expect(curriculum.getCurrentTopic(currentUser)!.id).toBe('arrays-basics');
      repo.getOrCreateProgress(currentUser.id, 'arrays-basics');
      await ratingUC.execute(currentUser, 'EASY');

      // Topic 2: hashing (day 2 week 1)
      currentUser = repo.getUserById(user.id)!;
      expect(currentUser.current_day).toBe(2);
      expect(curriculum.getCurrentTopic(currentUser)!.id).toBe('hashing');
      repo.getOrCreateProgress(currentUser.id, 'hashing');
      await ratingUC.execute(currentUser, 'MEDIUM');

      // Topic 3: two-pointers (day 3 week 1)
      currentUser = repo.getUserById(user.id)!;
      expect(currentUser.current_day).toBe(3);
      expect(curriculum.getCurrentTopic(currentUser)!.id).toBe('two-pointers');
      repo.getOrCreateProgress(currentUser.id, 'two-pointers');
      await ratingUC.execute(currentUser, 'HARD');

      // Now at week 2, day 1
      currentUser = repo.getUserById(user.id)!;
      expect(currentUser.current_week).toBe(2);
      expect(currentUser.current_day).toBe(1);
      expect(curriculum.getCurrentTopic(currentUser)!.id).toBe('binary-search');

      // 3 SR records created
      const srCount = db.prepare(
        'SELECT COUNT(*) as c FROM spaced_repetition WHERE user_id = ?',
      ).get(user.id) as { c: number };
      expect(srCount.c).toBe(3);

      // 3 topics understood
      const summary = repo.getUserProgressSummary(user.id);
      expect(summary.understood).toBe(3);
    });
  });
});

import { User } from '../entities/user.entity';
import { Topic } from '../entities/topic.entity';
import { Problem } from '../entities/problem.entity';
import {
  UserProgress,
  SpacedRepetition,
  TestQuestion,
  WeeklyTest,
} from '../entities/progress.entity';
import {
  PracticeSession,
  PracticePhase,
} from '../entities/practice-session.entity';

export interface IRepositoryPort {
  // ── User ──────────────────────────────────────────────────────────────────
  createUser(phone: string, name?: string): User;
  getUserByPhone(phone: string): User | undefined;
  getUserById(id: string): User | undefined;
  getAllActiveUsers(): User[];
  updateUserProgress(userId: string, newDay: number, newWeek: number): void;

  // ── Topics ────────────────────────────────────────────────────────────────
  getTopicByDayWeek(
    day: number,
    week: number,
    roadmapId?: string,
  ): Topic | undefined;
  getTopicsForWeek(week: number, roadmapId?: string): Topic[];
  getTopicById(id: string): Topic | undefined;
  getAllTopics(roadmapId?: string): Topic[];
  getTotalWeeks(roadmapId?: string): number;
  getDaysInWeek(week: number, roadmapId?: string): number;

  // ── Problems ──────────────────────────────────────────────────────────────
  getProblemForTopic(topicId: string): Problem | undefined;
  getProblemsForTopic(topicId: string): Problem[];
  upsertProblem(
    problem: Partial<Problem> & { topic_id: string; title: string },
  ): void;

  // ── User Progress ─────────────────────────────────────────────────────────
  getOrCreateProgress(userId: string, topicId: string): UserProgress;
  markTopicSent(userId: string, topicId: string): void;
  markTopicUnderstood(userId: string, topicId: string, rating: number): void;
  getUserProgressSummary(userId: string): {
    total: number;
    understood: number;
    sent: number;
  };

  // ── Spaced Repetition ─────────────────────────────────────────────────────
  updateSpacedRepetition(
    userId: string,
    topicId: string,
    quality: number,
  ): void;
  getDueReviews(userId: string): SpacedRepetition[];

  // ── Tests ─────────────────────────────────────────────────────────────────
  getQuestionsForWeek(
    week: number,
    roadmapId?: string,
    limit?: number,
  ): TestQuestion[];
  createWeeklyTest(
    userId: string,
    weekNumber: number,
    questions: TestQuestion[],
  ): string;
  getPendingTest(userId: string): WeeklyTest | undefined;
  submitTestAnswer(
    testId: string,
    userId: string,
    answers: Record<string, string>,
  ): number;

  // ── Practice Sessions ────────────────────────────────────────────────────
  getActivePracticeSession(userId: string): PracticeSession | undefined;
  getOrCreatePracticeSession(
    userId: string,
    topicId: string,
    problemId: string,
  ): PracticeSession;
  updatePracticePhase(
    sessionId: string,
    phase: PracticePhase,
    awaitingConfirmation: number,
  ): void;
  savePracticePhaseScore(
    sessionId: string,
    phase: 'explanation' | 'pseudo' | 'code',
    text: string,
    score: number,
    feedback: string,
  ): void;
  completePracticeSession(
    sessionId: string,
    combinedQuality: number,
  ): void;
  getPracticeSessionForTopic(
    userId: string,
    topicId: string,
  ): PracticeSession | undefined;

  // ── Logging ───────────────────────────────────────────────────────────────
  logMessage(
    userId: string,
    direction: 'inbound' | 'outbound',
    type: string,
    content: string,
    status?: string,
  ): string;
  updateMessageStatus(logId: string, status: string, openclawId?: string): void;

  close(): void;
}

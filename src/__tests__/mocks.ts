import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger, SendResult } from '@grindwise/domain/ports/messaging.port';
import { IContentGeneratorPort } from '@grindwise/domain/ports/content-generator.port';
import { User } from '@grindwise/domain/entities/user.entity';
import { Topic } from '@grindwise/domain/entities/topic.entity';
import { Problem } from '@grindwise/domain/entities/problem.entity';
import { PracticeSession } from '@grindwise/domain/entities/practice-session.entity';

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    phone_number: '919999999999',
    name: 'Test User',
    roadmap_id: 'neetcode',
    current_day: 1,
    current_week: 1,
    streak: 5,
    last_active: '2026-03-21',
    enrolled_at: '2026-03-01',
    is_active: 1,
    ...overrides,
  };
}

export function createMockTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'topic-1',
    roadmap_id: 'neetcode',
    name: 'Arrays & Hashing',
    description: 'Learn about arrays and hash maps.',
    category: 'Arrays',
    difficulty: 'Easy',
    day_number: 1,
    week_number: 1,
    order_index: 1,
    content: 'Arrays are a fundamental data structure...',
    key_concepts: '["indexing","hashing","collision resolution"]',
    time_complexity: 'O(1) average for hash map operations',
    space_complexity: 'O(n)',
    ...overrides,
  };
}

export function createMockProblem(overrides: Partial<Problem> = {}): Problem {
  return {
    id: 'problem-1',
    topic_id: 'topic-1',
    leetcode_id: 1,
    leetcode_slug: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target...',
    difficulty: 'Easy',
    solution_code: 'function twoSum(nums: number[], target: number): number[] { ... }',
    solution_explanation: 'Use a hash map to store complement values.',
    hints: '["Think about what complement means","Use a hash map"]',
    tags: 'array,hash-table',
    url: 'https://leetcode.com/problems/two-sum/',
    ...overrides,
  };
}

export function createMockPracticeSession(
  overrides: Partial<PracticeSession> = {},
): PracticeSession {
  return {
    id: 'session-1',
    user_id: 'user-1',
    topic_id: 'topic-1',
    problem_id: 'problem-1',
    phase: 'explanation',
    awaiting_confirmation: 0,
    started_at: '2026-03-21T10:00:00Z',
    ...overrides,
  };
}

const successResult: SendResult = { success: true, messageId: 'msg-1' };

export function createMockMessenger(): jest.Mocked<IMessenger> {
  return {
    sendText: jest.fn().mockResolvedValue(successResult),
    sendButtons: jest.fn().mockResolvedValue(successResult),
    sendList: jest.fn().mockResolvedValue(successResult),
    sendPoll: jest.fn().mockResolvedValue(successResult),
    getPollContext: jest.fn().mockReturnValue(undefined),
    markRead: jest.fn().mockResolvedValue(undefined),
    showTyping: jest.fn().mockResolvedValue(undefined),
    stopTyping: jest.fn().mockResolvedValue(undefined),
    isBotMessage: jest.fn().mockReturnValue(false),
  };
}

export function createMockRepo(): jest.Mocked<IRepositoryPort> {
  return {
    createUser: jest.fn(),
    getUserByPhone: jest.fn(),
    getUserById: jest.fn(),
    getAllActiveUsers: jest.fn().mockReturnValue([]),
    updateUserProgress: jest.fn(),
    getTopicByDayWeek: jest.fn(),
    getTopicsForWeek: jest.fn().mockReturnValue([]),
    getTopicById: jest.fn(),
    getAllTopics: jest.fn().mockReturnValue([]),
    getTotalWeeks: jest.fn().mockReturnValue(10),
    getDaysInWeek: jest.fn().mockReturnValue(3),
    getProblemForTopic: jest.fn(),
    getProblemsForTopic: jest.fn().mockReturnValue([]),
    upsertProblem: jest.fn(),
    getOrCreateProgress: jest.fn().mockReturnValue({
      id: 'prog-1',
      user_id: 'user-1',
      topic_id: 'topic-1',
      status: 'pending',
      review_count: 0,
    }),
    markTopicSent: jest.fn(),
    markTopicUnderstood: jest.fn(),
    getUserProgressSummary: jest.fn().mockReturnValue({
      total: 10,
      understood: 3,
      sent: 5,
    }),
    updateSpacedRepetition: jest.fn(),
    getDueReviews: jest.fn().mockReturnValue([]),
    getQuestionsForWeek: jest.fn().mockReturnValue([]),
    createWeeklyTest: jest.fn().mockReturnValue('test-1'),
    getPendingTest: jest.fn(),
    saveTestAnswers: jest.fn(),
    submitTestAnswer: jest.fn().mockReturnValue(0),
    getActivePracticeSession: jest.fn(),
    getOrCreatePracticeSession: jest.fn(),
    updatePracticePhase: jest.fn(),
    savePracticePhaseSubmission: jest.fn(),
    savePracticePhaseScore: jest.fn(),
    completePracticeSession: jest.fn(),
    getPracticeSessionForTopic: jest.fn(),
    logMessage: jest.fn().mockReturnValue('log-1'),
    updateMessageStatus: jest.fn(),
    close: jest.fn(),
  };
}

export function createMockContentGen(): jest.Mocked<IContentGeneratorPort> {
  return {
    generateTheory: jest.fn().mockResolvedValue(null),
    generateSolutionWalkthrough: jest.fn().mockResolvedValue(null),
    generateRevisionSummary: jest.fn().mockResolvedValue(null),
    askDsaQuestion: jest.fn().mockResolvedValue(null),
    formatTheoryMessage: jest.fn().mockReturnValue('formatted theory'),
    formatSolutionMessage: jest.fn().mockReturnValue('formatted solution'),
    formatRevisionMessage: jest.fn().mockReturnValue('formatted revision'),
    evaluateExplanation: jest.fn().mockResolvedValue({ score: 4, feedback: 'Good', isAcceptable: true }),
    evaluatePseudoCode: jest.fn().mockResolvedValue({ score: 3, feedback: 'OK', isAcceptable: true }),
    evaluateCode: jest.fn().mockResolvedValue({ score: 4, feedback: 'Nice', isAcceptable: true }),
  };
}

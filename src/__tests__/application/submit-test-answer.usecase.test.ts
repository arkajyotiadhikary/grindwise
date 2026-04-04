import { SubmitTestAnswerUseCase } from '@grindwise/application/use-cases/submit-test-answer.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('SubmitTestAnswerUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new SubmitTestAnswerUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('ignores when no pending test', async () => {
    repo.getPendingTest.mockReturnValue(undefined);
    await useCase.execute(createMockUser(), 'test-1', 'q1', 'A');
    expect(messenger.sendText).not.toHaveBeenCalled();
    expect(messenger.sendPoll).not.toHaveBeenCalled();
  });

  it('ignores when test ID does not match', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'other-test', user_id: 'user-1', week_number: 1,
      questions: '[]', status: 'pending' as const,
    });
    await useCase.execute(createMockUser(), 'test-1', 'q1', 'A');
    expect(messenger.sendText).not.toHaveBeenCalled();
    expect(messenger.sendPoll).not.toHaveBeenCalled();
  });

  it('sends next MCQ question as poll when more remain', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'test-1', user_id: 'user-1', week_number: 1,
      questions: JSON.stringify([
        { id: 'q1', topic_id: 't1', question: 'Q1?', type: 'mcq', options: '["A","B"]', correct_answer: 'A', difficulty: 'Easy' },
        { id: 'q2', topic_id: 't2', question: 'Q2?', type: 'mcq', options: '["X","Y"]', correct_answer: 'X', difficulty: 'Easy' },
      ]),
      answers: '{}',
      status: 'pending' as const,
    });

    await useCase.execute(createMockUser(), 'test-1', 'q1', 'A');

    expect(messenger.sendPoll).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Q2/2'),
      ['X', 'Y'],
      1,
      { testId: 'test-1', questionId: 'q2' },
    );
  });

  it('sends next text question via sendText when not MCQ', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'test-1', user_id: 'user-1', week_number: 1,
      questions: JSON.stringify([
        { id: 'q1', topic_id: 't1', question: 'Q1?', type: 'mcq', options: '["A","B"]', correct_answer: 'A', difficulty: 'Easy' },
        { id: 'q2', topic_id: 't2', question: 'Explain binary search.', type: 'text', options: null, correct_answer: 'O(log n)', difficulty: 'Medium' },
      ]),
      answers: '{}',
      status: 'pending' as const,
    });

    await useCase.execute(createMockUser(), 'test-1', 'q1', 'A');

    expect(messenger.sendPoll).not.toHaveBeenCalled();
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Explain binary search'),
    );
  });

  it('shows results and marks weak topics when all answered', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'test-1', user_id: 'user-1', week_number: 1,
      questions: JSON.stringify([
        { id: 'q1', topic_id: 't1', question: 'Q1?', type: 'mcq', options: '["A","B"]', correct_answer: 'A', difficulty: 'Easy' },
      ]),
      answers: '{}',
      status: 'pending' as const,
    });
    repo.submitTestAnswer.mockReturnValue(0);

    await useCase.execute(createMockUser(), 'test-1', 'q1', 'B');

    expect(repo.submitTestAnswer).toHaveBeenCalledWith('test-1', 'user-1', { q1: 'B' });
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test Complete'),
    );
    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 't1', 1);
  });

  it('does not mark correctly answered topics as weak', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'test-1', user_id: 'user-1', week_number: 1,
      questions: JSON.stringify([
        { id: 'q1', topic_id: 't1', question: 'Q1?', type: 'mcq', options: '["A","B"]', correct_answer: 'A', difficulty: 'Easy' },
      ]),
      answers: '{}',
      status: 'pending' as const,
    });
    repo.submitTestAnswer.mockReturnValue(1);

    await useCase.execute(createMockUser(), 'test-1', 'q1', 'A');

    expect(repo.updateSpacedRepetition).not.toHaveBeenCalled();
  });
});

import { SubmitTestAnswerUseCase } from '@grindwise/application/use-cases/submit-test-answer.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('SubmitTestAnswerUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new SubmitTestAnswerUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('ignores invalid interactive ID format', async () => {
    await useCase.execute(createMockUser(), 'bad:format');
    expect(repo.getPendingTest).not.toHaveBeenCalled();
  });

  it('ignores when no pending test', async () => {
    repo.getPendingTest.mockReturnValue(undefined);
    await useCase.execute(createMockUser(), 'test:t1:q:q1:a:answer');
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it('ignores when test ID does not match', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'other-test', user_id: 'user-1', week_number: 1,
      questions: '[]', status: 'pending' as const,
    });
    await useCase.execute(createMockUser(), 'test:t1:q:q1:a:answer');
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it('sends next question when more remain', async () => {
    repo.getPendingTest.mockReturnValue({
      id: 'test-1', user_id: 'user-1', week_number: 1,
      questions: JSON.stringify([
        { id: 'q1', topic_id: 't1', question: 'Q1?', type: 'mcq', options: '["A","B"]', correct_answer: 'A', difficulty: 'Easy' },
        { id: 'q2', topic_id: 't2', question: 'Q2?', type: 'mcq', options: '["X","Y"]', correct_answer: 'X', difficulty: 'Easy' },
      ]),
      answers: '{}',
      status: 'pending' as const,
    });

    await useCase.execute(createMockUser(), 'test:test-1:q:q1:a:A');

    expect(messenger.sendList).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Q2/2'),
      'Select Answer',
      expect.any(Array),
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
    repo.submitTestAnswer.mockReturnValue(0); // got it wrong

    await useCase.execute(createMockUser(), 'test:test-1:q:q1:a:B');

    expect(repo.submitTestAnswer).toHaveBeenCalledWith('test-1', 'user-1', { q1: 'B' });
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test Complete'),
    );
    // Weak topic marked for SR
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

    await useCase.execute(createMockUser(), 'test:test-1:q:q1:a:A');

    expect(repo.updateSpacedRepetition).not.toHaveBeenCalled();
  });
});

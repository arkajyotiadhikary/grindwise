import { SendWeeklyTestUseCase } from '@grindwise/application/use-cases/send-weekly-test.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('SendWeeklyTestUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new SendWeeklyTestUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('sends "being prepared" when no questions', async () => {
    repo.getQuestionsForWeek.mockReturnValue([]);
    await useCase.execute(createMockUser());
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('being prepared'),
    );
  });

  it('creates test and sends first MCQ question as poll', async () => {
    const questions = [{
      id: 'q-1', topic_id: 'topic-1',
      question: 'What is O(1)?', type: 'mcq',
      options: '["Constant","Linear","Quadratic"]',
      correct_answer: 'Constant', explanation: '', difficulty: 'Easy',
    }];
    repo.getQuestionsForWeek.mockReturnValue(questions);
    repo.createWeeklyTest.mockReturnValue('test-1');

    await useCase.execute(createMockUser());

    expect(repo.createWeeklyTest).toHaveBeenCalledWith('user-1', 1, questions);
    expect(messenger.sendPoll).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Q1/1'),
      ['Constant', 'Linear', 'Quadratic'],
      1,
      { testId: 'test-1', questionId: 'q-1' },
    );
  });

  it('sends non-MCQ question as text', async () => {
    const questions = [{
      id: 'q-1', topic_id: 'topic-1',
      question: 'Explain time complexity of binary search.',
      type: 'text', options: undefined,
      correct_answer: 'O(log n)', explanation: '', difficulty: 'Medium',
    }];
    repo.getQuestionsForWeek.mockReturnValue(questions);
    repo.createWeeklyTest.mockReturnValue('test-1');

    await useCase.execute(createMockUser());

    expect(messenger.sendPoll).not.toHaveBeenCalled();
    const calls = messenger.sendText.mock.calls;
    const lastMsg = calls[calls.length - 1]![1];
    expect(lastMsg).toContain('Explain time complexity');
  });

  it('logs the test message', async () => {
    repo.getQuestionsForWeek.mockReturnValue([{
      id: 'q-1', topic_id: 'topic-1',
      question: 'Q?', type: 'mcq',
      options: '["A","B"]',
      correct_answer: 'A', explanation: '', difficulty: 'Easy',
    }]);
    repo.createWeeklyTest.mockReturnValue('test-1');

    await useCase.execute(createMockUser());

    expect(repo.logMessage).toHaveBeenCalledWith(
      'user-1', 'outbound', 'test', expect.stringContaining('Weekly test'),
    );
  });
});

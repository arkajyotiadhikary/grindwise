import { SendDailyProblemUseCase } from '@grindwise/application/use-cases/send-daily-problem.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import {
  createMockRepo,
  createMockMessenger,
  createMockUser,
  createMockTopic,
  createMockProblem,
  createMockPracticeSession,
} from '../mocks';

describe('SendDailyProblemUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const curriculum = new CurriculumDomainService(repo);
  const useCase = new SendDailyProblemUseCase(repo, messenger, curriculum);

  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no current topic', async () => {
    repo.getTopicByDayWeek.mockReturnValue(undefined);
    await useCase.execute(createMockUser());
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it('sends fallback message when no problem for topic', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    repo.getProblemForTopic.mockReturnValue(undefined);

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Search LeetCode'),
    );
  });

  it('sends problem and creates practice session', async () => {
    const topic = createMockTopic();
    const problem = createMockProblem();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    repo.getProblemForTopic.mockReturnValue(problem);
    repo.getOrCreatePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'explanation', awaiting_confirmation: 0 }),
    );

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Two Sum'),
    );
    expect(repo.getOrCreatePracticeSession).toHaveBeenCalled();
  });

  it('shows "already completed" for finished sessions', async () => {
    const topic = createMockTopic();
    const problem = createMockProblem();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    repo.getProblemForTopic.mockReturnValue(problem);
    repo.getOrCreatePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'completed' }),
    );

    await useCase.execute(createMockUser());

    const calls = messenger.sendText.mock.calls;
    const lastMsg = calls[calls.length - 1]![1];
    expect(lastMsg).toContain('already completed');
  });

  it('prompts for pending confirmation', async () => {
    const topic = createMockTopic();
    const problem = createMockProblem();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    repo.getProblemForTopic.mockReturnValue(problem);
    repo.getOrCreatePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'pseudo', awaiting_confirmation: 1 }),
    );

    await useCase.execute(createMockUser());

    const calls = messenger.sendText.mock.calls;
    const lastMsg = calls[calls.length - 1]![1];
    expect(lastMsg).toContain('YES');
    expect(lastMsg).toContain('NO');
  });

  it('uses topicOverride when provided', async () => {
    const overrideTopic = createMockTopic({ id: 'override-topic' });
    const problem = createMockProblem({ topic_id: 'override-topic' });
    repo.getProblemForTopic.mockReturnValue(problem);
    repo.getOrCreatePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'explanation' }),
    );

    await useCase.execute(createMockUser(), overrideTopic);

    expect(repo.getProblemForTopic).toHaveBeenCalledWith('override-topic');
  });
});

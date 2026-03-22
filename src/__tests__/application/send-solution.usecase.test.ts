import { SendSolutionUseCase } from '@grindwise/application/use-cases/send-solution.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import {
  createMockRepo,
  createMockMessenger,
  createMockContentGen,
  createMockUser,
  createMockTopic,
  createMockProblem,
} from '../mocks';

describe('SendSolutionUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const contentGen = createMockContentGen();
  const curriculum = new CurriculumDomainService(repo);
  const useCase = new SendSolutionUseCase(repo, messenger, contentGen, curriculum);

  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no current topic', async () => {
    repo.getTopicByDayWeek.mockReturnValue(undefined);
    await useCase.execute(createMockUser());
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it('sends warning when no problem for topic', async () => {
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(undefined);

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('No solution stored'),
    );
  });

  it('sends AI walkthrough when available', async () => {
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(createMockProblem());
    contentGen.generateSolutionWalkthrough.mockResolvedValue({
      approach: 'Hash map',
      steps: ['step1'],
      keyInsight: 'Complement lookup',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    });
    contentGen.formatSolutionMessage.mockReturnValue('AI solution');

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(expect.any(String), 'AI solution');
  });

  it('falls back to static solution when AI fails', async () => {
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(createMockProblem());
    contentGen.generateSolutionWalkthrough.mockResolvedValue(null);

    await useCase.execute(createMockUser());

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('Solution');
    expect(sentMsg).toContain('twoSum');
  });

  it('shows typing indicator', async () => {
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(createMockProblem());

    await useCase.execute(createMockUser());

    expect(messenger.showTyping).toHaveBeenCalled();
  });

  it('logs the solution message', async () => {
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(createMockProblem());

    await useCase.execute(createMockUser());

    expect(repo.logMessage).toHaveBeenCalledWith(
      'user-1',
      'outbound',
      'solution',
      expect.any(String),
    );
  });
});

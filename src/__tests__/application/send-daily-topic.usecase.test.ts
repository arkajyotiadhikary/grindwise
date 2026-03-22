import { SendDailyTopicUseCase } from '@grindwise/application/use-cases/send-daily-topic.usecase';
import { SendDailyProblemUseCase } from '@grindwise/application/use-cases/send-daily-problem.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import {
  createMockRepo,
  createMockMessenger,
  createMockContentGen,
  createMockUser,
  createMockTopic,
} from '../mocks';

jest.useFakeTimers();

describe('SendDailyTopicUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const contentGen = createMockContentGen();
  const curriculum = new CurriculumDomainService(repo);
  const sendDailyProblem = new SendDailyProblemUseCase(repo, messenger, curriculum);
  const useCase = new SendDailyTopicUseCase(repo, messenger, contentGen, curriculum, sendDailyProblem);

  beforeEach(() => jest.clearAllMocks());

  it('sends congratulations when roadmap is complete', async () => {
    repo.getTopicByDayWeek.mockReturnValue(undefined);
    const user = createMockUser();

    await useCase.execute(user);

    expect(messenger.sendText).toHaveBeenCalledWith(
      user.phone_number,
      expect.stringContaining('Congratulations'),
    );
  });

  it('sends AI-generated theory when available', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    contentGen.generateTheory.mockResolvedValue({
      coreConcept: 'Arrays store elements contiguously',
      keyTakeaways: ['O(1) access'],
      codeExample: 'arr[0]',
      analogy: 'Like mailboxes',
    });
    contentGen.formatTheoryMessage.mockReturnValue('AI theory message');

    const user = createMockUser();
    await useCase.execute(user);

    expect(contentGen.formatTheoryMessage).toHaveBeenCalled();
    expect(messenger.sendText).toHaveBeenCalledWith(user.phone_number, 'AI theory message');
  });

  it('falls back to static format when AI fails', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);
    contentGen.generateTheory.mockResolvedValue(null);

    const user = createMockUser();
    await useCase.execute(user);

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain(topic.name);
    expect(sentMsg).toContain('Day 1');
  });

  it('marks topic as sent on successful delivery', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);

    const user = createMockUser();
    await useCase.execute(user);

    expect(repo.getOrCreateProgress).toHaveBeenCalledWith(user.id, topic.id);
    expect(repo.markTopicSent).toHaveBeenCalledWith(user.id, topic.id);
  });

  it('schedules problem delivery after 3 seconds', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);

    const user = createMockUser();
    await useCase.execute(user);

    // Problem not sent yet
    const problemSpy = jest.spyOn(sendDailyProblem, 'execute').mockResolvedValue();
    jest.advanceTimersByTime(3000);

    // setTimeout fires asynchronously
    await Promise.resolve();
    expect(problemSpy).toHaveBeenCalled();
    problemSpy.mockRestore();
  });

  it('shows typing indicator before generating content', async () => {
    const topic = createMockTopic();
    repo.getTopicByDayWeek.mockReturnValue(topic);

    await useCase.execute(createMockUser());

    expect(messenger.showTyping).toHaveBeenCalled();
  });
});

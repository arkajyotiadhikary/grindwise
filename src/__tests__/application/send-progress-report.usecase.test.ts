import { SendProgressReportUseCase } from '@grindwise/application/use-cases/send-progress-report.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { createMockRepo, createMockMessenger, createMockUser, createMockTopic } from '../mocks';

describe('SendProgressReportUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const curriculum = new CurriculumDomainService(repo);
  const useCase = new SendProgressReportUseCase(repo, messenger, curriculum);

  beforeEach(() => jest.clearAllMocks());

  it('sends formatted progress report', async () => {
    repo.getUserProgressSummary.mockReturnValue({ total: 20, understood: 5, sent: 8 });
    repo.getAllTopics.mockReturnValue(Array.from({ length: 20 }, (_, i) =>
      createMockTopic({ order_index: i + 1 }),
    ));
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic({ order_index: 6 }));

    const user = createMockUser({ current_day: 1, current_week: 2, streak: 10 });
    await useCase.execute(user);

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('Test User');
    expect(sentMsg).toContain('Week 2, Day 1');
    expect(sentMsg).toContain('Streak: 10');
    expect(sentMsg).toContain('5/20');
  });

  it('logs the progress message', async () => {
    repo.getUserProgressSummary.mockReturnValue({ total: 5, understood: 1, sent: 2 });
    repo.getAllTopics.mockReturnValue([createMockTopic()]);
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());

    await useCase.execute(createMockUser());

    expect(repo.logMessage).toHaveBeenCalledWith(
      'user-1', 'outbound', 'progress', expect.any(String),
    );
  });
});

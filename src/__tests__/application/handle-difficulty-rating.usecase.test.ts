import { HandleDifficultyRatingUseCase } from '@grindwise/application/use-cases/handle-difficulty-rating.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import {
  createMockRepo,
  createMockMessenger,
  createMockUser,
  createMockTopic,
} from '../mocks';

describe('HandleDifficultyRatingUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const curriculum = new CurriculumDomainService(repo);
  const useCase = new HandleDifficultyRatingUseCase(repo, messenger, curriculum);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic());
    repo.getDaysInWeek.mockReturnValue(3);
    repo.getTotalWeeks.mockReturnValue(10);
    // Make advanceUser work (next topic exists)
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic({ order_index: 2 }));
  });

  it('does nothing when no current topic', async () => {
    repo.getTopicByDayWeek.mockReturnValue(undefined);
    await useCase.execute(createMockUser(), 'EASY');
    expect(repo.markTopicUnderstood).not.toHaveBeenCalled();
  });

  it('maps EASY to quality 5', async () => {
    await useCase.execute(createMockUser(), 'EASY');
    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 5);
    expect(repo.markTopicUnderstood).toHaveBeenCalledWith('user-1', 'topic-1', 5);
  });

  it('maps MEDIUM to quality 3', async () => {
    await useCase.execute(createMockUser(), 'MEDIUM');
    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 3);
    expect(repo.markTopicUnderstood).toHaveBeenCalledWith('user-1', 'topic-1', 3);
  });

  it('maps HARD to quality 1, marks as rating 2', async () => {
    await useCase.execute(createMockUser(), 'HARD');
    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 1);
    expect(repo.markTopicUnderstood).toHaveBeenCalledWith('user-1', 'topic-1', 2);
  });

  it('advances user after rating', async () => {
    await useCase.execute(createMockUser(), 'EASY');
    expect(repo.updateUserProgress).toHaveBeenCalled();
  });

  it('sends EASY feedback message', async () => {
    await useCase.execute(createMockUser(), 'EASY');
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Great job'),
    );
  });

  it('sends MEDIUM feedback message', async () => {
    await useCase.execute(createMockUser(), 'MEDIUM');
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Good work'),
    );
  });

  it('sends HARD feedback message', async () => {
    await useCase.execute(createMockUser(), 'HARD');
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('extra review'),
    );
  });

  it('sends completion message when roadmap finishes', async () => {
    // Last topic
    const user = createMockUser({ current_day: 3, current_week: 10 });
    repo.getDaysInWeek.mockReturnValue(3);
    repo.getTotalWeeks.mockReturnValue(10);

    await useCase.execute(user, 'EASY');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('completed the entire roadmap'),
    );
  });
});

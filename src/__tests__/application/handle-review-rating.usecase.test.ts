import { HandleReviewRatingUseCase } from '@grindwise/application/use-cases/handle-review-rating.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('HandleReviewRatingUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new HandleReviewRatingUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no due reviews', async () => {
    repo.getDueReviews.mockReturnValue([]);
    await useCase.execute(createMockUser(), 'RECALL');
    expect(repo.updateSpacedRepetition).not.toHaveBeenCalled();
    expect(messenger.sendText).not.toHaveBeenCalled();
  });

  it('maps RECALL to quality 5', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);

    await useCase.execute(createMockUser(), 'RECALL');

    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 5);
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Perfect recall'),
    );
  });

  it('maps FUZZY to quality 3', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);

    await useCase.execute(createMockUser(), 'FUZZY');

    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 3);
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Partial recall'),
    );
  });

  it('maps BLANK to quality 0', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);

    await useCase.execute(createMockUser(), 'BLANK');

    expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 0);
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('reviewed again tomorrow'),
    );
  });
});

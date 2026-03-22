import { SendDueReviewsUseCase } from '@grindwise/application/use-cases/send-due-reviews.usecase';
import {
  createMockRepo,
  createMockMessenger,
  createMockContentGen,
  createMockUser,
  createMockTopic,
  createMockProblem,
  createMockPracticeSession,
} from '../mocks';

describe('SendDueReviewsUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const contentGen = createMockContentGen();
  const useCase = new SendDueReviewsUseCase(repo, messenger, contentGen);

  beforeEach(() => jest.clearAllMocks());

  it('sends "no reviews due" when empty', async () => {
    repo.getDueReviews.mockReturnValue([]);
    await useCase.execute(createMockUser());
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('No reviews due'),
    );
  });

  it('sends just problem for high-quality previous session (>=4)', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);
    repo.getTopicById.mockReturnValue(createMockTopic());
    repo.getPracticeSessionForTopic.mockReturnValue(
      createMockPracticeSession({ combined_quality: 5 }),
    );
    repo.getProblemForTopic.mockReturnValue(createMockProblem());

    await useCase.execute(createMockUser());

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('scored 5/5');
    expect(sentMsg).toContain('Two Sum');
  });

  it('sends AI revision summary for lower quality sessions', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);
    repo.getTopicById.mockReturnValue(createMockTopic());
    repo.getPracticeSessionForTopic.mockReturnValue(
      createMockPracticeSession({ combined_quality: 2 }),
    );
    contentGen.generateRevisionSummary.mockResolvedValue({
      recap: 'Arrays recap',
      keyPoints: ['point1'],
      commonMistakes: ['mistake1'],
      connectsTo: 'Hashing',
    });
    contentGen.formatRevisionMessage.mockReturnValue('AI revision message');

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(expect.any(String), 'AI revision message');
  });

  it('falls back to static review when AI fails', async () => {
    repo.getDueReviews.mockReturnValue([{
      id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
      next_review_date: '2026-03-20', interval_days: 7,
      ease_factor: 2.5, repetition_count: 3,
    }]);
    repo.getTopicById.mockReturnValue(createMockTopic());
    repo.getPracticeSessionForTopic.mockReturnValue(undefined);
    contentGen.generateRevisionSummary.mockResolvedValue(null);

    await useCase.execute(createMockUser());

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('Review');
    expect(sentMsg).toContain('Arrays & Hashing');
  });

  it('notifies about remaining reviews', async () => {
    repo.getDueReviews.mockReturnValue([
      {
        id: 'sr-1', user_id: 'user-1', topic_id: 'topic-1',
        next_review_date: '2026-03-20', interval_days: 7,
        ease_factor: 2.5, repetition_count: 3,
      },
      {
        id: 'sr-2', user_id: 'user-1', topic_id: 'topic-2',
        next_review_date: '2026-03-20', interval_days: 3,
        ease_factor: 2.5, repetition_count: 1,
      },
    ]);
    repo.getTopicById.mockReturnValue(createMockTopic());
    repo.getPracticeSessionForTopic.mockReturnValue(undefined);

    await useCase.execute(createMockUser());

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('more topic(s) due for review'),
    );
  });
});

import { User } from '../../domain/entities/user.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';

export class HandleReviewRatingUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(user: User, rating: 'RECALL' | 'FUZZY' | 'BLANK'): Promise<void> {
    try {
      const dueReviews = this.repo.getDueReviews(user.id);
      if (!dueReviews.length) return;

      const qualityMap: Record<string, number> = { RECALL: 5, FUZZY: 3, BLANK: 0 };
      const firstReview = dueReviews[0];
      if (!firstReview) return;

      this.repo.updateSpacedRepetition(user.id, firstReview.topic_id, qualityMap[rating] ?? 0);

      const messages: Record<string, string> = {
        RECALL: '🟢 Perfect recall! This topic\'s next review has been pushed further out.',
        FUZZY: '🟡 Partial recall noted. We\'ll review this again soon.',
        BLANK: '🔴 No worries — this happens! It\'ll be reviewed again tomorrow.',
      };

      await this.messenger.sendText(user.phone_number, messages[rating] ?? '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[HandleReviewRating] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

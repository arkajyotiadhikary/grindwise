import { User } from '../../domain/entities/user.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';
import { IContentGeneratorPort } from '../../domain/ports/content-generator.port';
import { MessageFormatter } from '../../shared/message-formatter';

export class SendDueReviewsUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly contentGen: IContentGeneratorPort,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const dueReviews = this.repo.getDueReviews(user.id);

      if (!dueReviews.length) {
        await this.messenger.sendText(
          user.phone_number,
          '✅ *No reviews due today!*\n\nYou\'re all caught up. Great work staying consistent!',
        );
        return;
      }

      const reviewItem = dueReviews[0];
      if (!reviewItem) return;

      const topic = this.repo.getTopicById(reviewItem.topic_id);
      if (!topic) return;

      const daysDiff = Math.round(
        (Date.now() - new Date(reviewItem.next_review_date).getTime()) /
          (1000 * 60 * 60 * 24) +
          reviewItem.interval_days,
      );
      const daysAgo = Math.max(daysDiff, reviewItem.interval_days);

      const revisionSummary = await this.contentGen.generateRevisionSummary(
        topic,
        reviewItem.repetition_count,
      );
      const reviewMsg = revisionSummary
        ? this.contentGen.formatRevisionMessage(topic, revisionSummary, daysAgo)
        : MessageFormatter.reviewReminder(topic, daysAgo);
      await this.messenger.sendText(user.phone_number, reviewMsg);

      if (dueReviews.length > 1) {
        await this.messenger.sendText(
          user.phone_number,
          `📋 You have *${dueReviews.length - 1}* more topic(s) due for review. ` +
            'After rating this one, reply *REVIEW* for the next.',
        );
      }

      this.repo.logMessage(user.id, 'outbound', 'reminder', reviewMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendDueReviews] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

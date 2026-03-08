import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';

export class HandleDifficultyRatingUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly curriculum: CurriculumDomainService,
  ) {}

  async execute(user: User, rating: 'EASY' | 'MEDIUM' | 'HARD'): Promise<void> {
    try {
      const topic = this.curriculum.getCurrentTopic(user);
      if (!topic) return;

      const qualityMap: Record<string, number> = {
        EASY: 5,
        MEDIUM: 3,
        HARD: 1,
      };
      const quality = qualityMap[rating] ?? 3;

      this.repo.markTopicUnderstood(
        user.id,
        topic.id,
        quality === 5 ? 5 : quality === 3 ? 3 : 2,
      );
      this.repo.updateSpacedRepetition(user.id, topic.id, quality);

      const result = this.curriculum.advanceUser(user);

      const feedbackMessages: Record<string, string> = {
        EASY: result.isComplete
          ? "🌟 Outstanding! You've completed the entire roadmap!"
          : '🌟 Great job! Next topic scheduled for tomorrow.',
        MEDIUM:
          '💪 Good work! Keep practicing. Tomorrow brings a new challenge.',
        HARD: '📖 No worries! This topic has been marked for extra review. Keep going!',
      };

      await this.messenger.sendText(
        user.phone_number,
        feedbackMessages[rating] ?? '',
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[HandleDifficultyRating] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

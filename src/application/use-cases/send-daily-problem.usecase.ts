import { User } from '../../domain/entities/user.entity';
import { Topic } from '../../domain/entities/topic.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';
import { CurriculumDomainService } from '../../domain/services/curriculum.domain-service';
import { MessageFormatter } from '../../shared/message-formatter';

export class SendDailyProblemUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly curriculum: CurriculumDomainService,
  ) {}

  async execute(user: User, topicOverride?: Topic): Promise<void> {
    try {
      const topic = topicOverride ?? this.curriculum.getCurrentTopic(user);
      if (!topic) return;

      const problem = this.repo.getProblemForTopic(topic.id);
      if (!problem) {
        await this.messenger.sendText(
          user.phone_number,
          `📝 *Practice Problem*\n\nFor topic: *${topic.name}*\n\n` +
            `🔗 Search LeetCode for "${topic.name}" problems.\n\n` +
            'Start with Easy difficulty problems to build confidence!',
        );
        return;
      }

      const problemMsg = MessageFormatter.dailyProblem(problem, topic);
      await this.messenger.sendText(user.phone_number, problemMsg);
      this.repo.logMessage(user.id, 'outbound', 'problem', problemMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendDailyProblem] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

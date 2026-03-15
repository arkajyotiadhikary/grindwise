import { User } from '@grindwise/domain/entities/user.entity';
import { Topic } from '@grindwise/domain/entities/topic.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

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

      const session = this.repo.getOrCreatePracticeSession(user.id, topic.id, problem.id);

      if (session.phase === 'completed') {
        await this.messenger.sendText(
          user.phone_number,
          '_You already completed this problem! Reply */topic* after advancing to get a new one._',
        );
      } else if (session.awaiting_confirmation) {
        await this.messenger.sendText(
          user.phone_number,
          `_You have a pending ${session.phase} evaluation. Reply *YES* to continue or *NO* to retry._`,
        );
      } else {
        const phasePrompts: Record<string, string> = {
          explanation: '_Start by explaining your approach. Reply */explanation <your approach>*_',
          pseudo: '_Write your pseudocode. Reply */pseudo <your pseudocode>*_',
          code: '_Write your code solution. Reply */code <your code>*_',
        };
        await this.messenger.sendText(
          user.phone_number,
          phasePrompts[session.phase] ?? phasePrompts['explanation']!,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendDailyProblem] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

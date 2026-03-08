import { User } from '@grindwise/domain/entities/user.entity';
import { Topic } from '@grindwise/domain/entities/topic.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { IContentGeneratorPort } from '@grindwise/domain/ports/content-generator.port';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { MessageFormatter } from '@grindwise/shared/message-formatter';
import { SendDailyProblemUseCase } from './send-daily-problem.usecase';

export class SendDailyTopicUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly contentGen: IContentGeneratorPort,
    private readonly curriculum: CurriculumDomainService,
    private readonly sendDailyProblem: SendDailyProblemUseCase,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const topic = this.curriculum.getCurrentTopic(user);

      if (!topic) {
        await this.messenger.sendText(
          user.phone_number,
          '🎉 *Congratulations!* You\'ve completed the NeetCode DSA roadmap! ' +
            'You\'re ready to ace coding interviews. Keep practicing on LeetCode!',
        );
        return;
      }

      const theoryContent = await this.contentGen.generateTheory(topic);
      const topicMsg = theoryContent
        ? this.contentGen.formatTheoryMessage(topic, theoryContent, user.current_day, user.current_week)
        : MessageFormatter.dailyTopic(topic, user.current_day, user.current_week);

      const result = await this.messenger.sendText(user.phone_number, topicMsg);

      if (result.success) {
        this.repo.getOrCreateProgress(user.id, topic.id);
        this.repo.markTopicSent(user.id, topic.id);
        this.repo.logMessage(user.id, 'outbound', 'daily_topic', topicMsg);
        console.log(`[SendDailyTopic] Sent topic "${topic.name}" to ${user.phone_number}`);
      }

      setTimeout(() => {
        this.sendDailyProblem.execute(user, topic).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[SendDailyTopic] sendDailyProblem failed', { error: message });
        });
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendDailyTopic] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

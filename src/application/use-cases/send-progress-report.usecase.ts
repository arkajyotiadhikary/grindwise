import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SendProgressReportUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly curriculum: CurriculumDomainService,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const summary = this.repo.getUserProgressSummary(user.id);
      const curriculumProgress = this.curriculum.getProgress(user);

      const progressMsg = MessageFormatter.progressReport(user, {
        ...summary,
        completedTopics: curriculumProgress.completedTopics,
        totalTopics: curriculumProgress.totalTopics,
        percentageComplete: curriculumProgress.percentageComplete,
      });

      await this.messenger.sendText(user.phone_number, progressMsg);
      this.repo.logMessage(user.id, 'outbound', 'progress', progressMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendProgressReport] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

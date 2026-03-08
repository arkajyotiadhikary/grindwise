import { User } from '../../domain/entities/user.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';
import { IContentGeneratorPort } from '../../domain/ports/content-generator.port';
import { CurriculumDomainService } from '../../domain/services/curriculum.domain-service';
import { MessageFormatter } from '../../shared/message-formatter';

export class SendSolutionUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly contentGen: IContentGeneratorPort,
    private readonly curriculum: CurriculumDomainService,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const topic = this.curriculum.getCurrentTopic(user);
      if (!topic) return;

      const problem = this.repo.getProblemForTopic(topic.id);
      if (!problem) {
        await this.messenger.sendText(
          user.phone_number,
          '⚠️ No solution stored yet for today\'s topic. Check the LeetCode editorial!',
        );
        return;
      }

      const walkthrough = await this.contentGen.generateSolutionWalkthrough(problem, topic);
      const solutionMsg = walkthrough
        ? this.contentGen.formatSolutionMessage(problem, walkthrough)
        : MessageFormatter.solution(problem);
      await this.messenger.sendText(user.phone_number, solutionMsg);
      this.repo.logMessage(user.id, 'outbound', 'solution', solutionMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendSolution] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

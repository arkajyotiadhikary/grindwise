import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { IContentGeneratorPort } from '@grindwise/domain/ports/content-generator.port';

const NOT_DSA_REPLY =
  "I'm a DSA tutor bot — I can only answer questions about Data Structures & Algorithms.\n\nTry asking about arrays, trees, graphs, sorting, dynamic programming, etc.\n\nReply */help* for available commands.";

export class AskDsaQuestionUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly contentGen: IContentGeneratorPort,
  ) {}

  async execute(user: User, question: string): Promise<void> {
    try {
      const result = await this.contentGen.askDsaQuestion(question);

      if (!result || !result.isDsaRelated) {
        await this.messenger.sendText(user.phone_number, NOT_DSA_REPLY);
        this.repo.logMessage(user.id, 'outbound', 'ask', NOT_DSA_REPLY);
        return;
      }

      const reply = `🤖 *DSA Answer:*\n\n${result.answer}`;
      await this.messenger.sendText(user.phone_number, reply);
      this.repo.logMessage(user.id, 'outbound', 'ask', reply);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[AskDsaQuestion] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

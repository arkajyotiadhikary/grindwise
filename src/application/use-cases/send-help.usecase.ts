import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SendHelpUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const helpMsg = MessageFormatter.help();
      await this.messenger.sendText(user.phone_number, helpMsg);
      this.repo.logMessage(user.id, 'outbound', 'help', helpMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendHelp] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

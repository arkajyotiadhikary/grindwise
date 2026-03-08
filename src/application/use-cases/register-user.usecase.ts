import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class RegisterUserUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(phoneNumber: string, name?: string): Promise<User> {
    try {
      let user = this.repo.getUserByPhone(phoneNumber);

      if (!user) {
        user = this.repo.createUser(phoneNumber, name);
        console.log(`[RegisterUser] Registered new user: ${phoneNumber}`);
      }

      const welcomeMsg = MessageFormatter.welcome(user.name ?? 'there');
      await this.messenger.sendText(phoneNumber, welcomeMsg);
      this.repo.logMessage(user.id, 'outbound', 'welcome', welcomeMsg);

      return user;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[RegisterUser] execute failed', {
        error: message,
        phoneNumber,
      });
      throw err;
    }
  }
}

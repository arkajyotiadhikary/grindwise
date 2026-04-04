import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SubmitPracticePhaseUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(
    user: User,
    phase: 'explanation' | 'pseudo' | 'code',
    submission: string,
  ): Promise<void> {
    try {
      const session = this.repo.getActivePracticeSession(user.id);
      if (!session) {
        await this.messenger.sendText(
          user.phone_number,
          'No active practice session. Run */topic* first to get a problem.',
        );
        return;
      }

      if (session.phase !== phase) {
        await this.messenger.sendText(
          user.phone_number,
          `You're currently on the *${session.phase}* phase. Complete it first before moving to *${phase}*.`,
        );
        return;
      }

      this.repo.savePracticePhaseSubmission(session.id, phase, submission);

      const confirmMsg = MessageFormatter.phaseSubmissionConfirm(phase);
      await this.messenger.sendText(user.phone_number, confirmMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SubmitPracticePhase] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

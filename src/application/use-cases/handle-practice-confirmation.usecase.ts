import { User } from '@grindwise/domain/entities/user.entity';
import { PracticePhase } from '@grindwise/domain/entities/practice-session.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

const NEXT_PHASE: Record<string, PracticePhase> = {
  explanation: 'pseudo',
  pseudo: 'code',
};

export class HandlePracticeConfirmationUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly curriculum: CurriculumDomainService,
  ) {}

  async execute(user: User, confirmed: boolean): Promise<boolean> {
    try {
      const session = this.repo.getActivePracticeSession(user.id);
      if (!session || !session.awaiting_confirmation) {
        return false;
      }

      const currentPhase = session.phase as 'explanation' | 'pseudo' | 'code';

      if (!confirmed) {
        this.repo.updatePracticePhase(session.id, currentPhase, 0);
        const retryMsg = MessageFormatter.retryPhasePrompt(currentPhase);
        await this.messenger.sendText(user.phone_number, retryMsg);
        return true;
      }

      const nextPhase = NEXT_PHASE[currentPhase];
      if (nextPhase) {
        this.repo.updatePracticePhase(session.id, nextPhase, 0);
        const promptMsg = MessageFormatter.phasePrompt(nextPhase);
        await this.messenger.sendText(user.phone_number, promptMsg);
        return true;
      }

      const explanationScore = session.explanation_score ?? 3;
      const pseudoScore = session.pseudo_score ?? 3;
      const codeScore = session.code_score ?? 3;
      const combined = Math.round(
        explanationScore * 0.25 + pseudoScore * 0.35 + codeScore * 0.40,
      );
      const clampedQuality = Math.min(5, Math.max(0, combined));

      this.repo.completePracticeSession(session.id, clampedQuality);
      this.repo.markTopicUnderstood(user.id, session.topic_id, clampedQuality);
      this.repo.updateSpacedRepetition(user.id, session.topic_id, clampedQuality);

      const advanceResult = this.curriculum.advanceUser(user);

      const summaryMsg = MessageFormatter.practiceComplete(
        { explanation: explanationScore, pseudo: pseudoScore, code: codeScore },
        clampedQuality,
      );
      await this.messenger.sendText(user.phone_number, summaryMsg);

      if (advanceResult.isComplete) {
        await this.messenger.sendText(
          user.phone_number,
          'You have completed the entire roadmap! Reply */progress* to see your stats.',
        );
      } else if (clampedQuality >= 4) {
        await this.messenger.sendText(
          user.phone_number,
          'Great job! Reply */topic* when you\'re ready for the next topic.',
        );
      } else {
        await this.messenger.sendText(
          user.phone_number,
          'Keep practicing! The next review will include theory to reinforce this topic. Reply */topic* for the next topic.',
        );
      }

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[HandlePracticeConfirmation] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

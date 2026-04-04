import { User } from '@grindwise/domain/entities/user.entity';
import {
  PracticePhase,
  PracticeSession,
} from '@grindwise/domain/entities/practice-session.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import {
  IContentGeneratorPort,
  PhaseEvaluationResult,
  PriorPhaseContext,
} from '@grindwise/domain/ports/content-generator.port';
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
    private readonly contentGen: IContentGeneratorPort,
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

      const submission = this.getPhaseText(session, currentPhase);
      if (!submission) {
        await this.messenger.sendText(
          user.phone_number,
          'Could not find your submission. Please resubmit.',
        );
        this.repo.updatePracticePhase(session.id, currentPhase, 0);
        return true;
      }

      const topic = this.repo.getTopicById(session.topic_id);
      const problem = this.repo.getProblemForTopic(session.topic_id);
      if (!topic || !problem) {
        await this.messenger.sendText(
          user.phone_number,
          'Could not find the topic or problem for your session. Try */topic* again.',
        );
        return true;
      }

      await this.messenger.showTyping(user.phone_number);

      const priorPhases = this.buildPriorContext(session, currentPhase);
      let result: PhaseEvaluationResult | null = null;
      if (currentPhase === 'explanation') {
        result = await this.contentGen.evaluateExplanation(submission, problem, topic, priorPhases);
      } else if (currentPhase === 'pseudo') {
        result = await this.contentGen.evaluatePseudoCode(submission, problem, topic, priorPhases);
      } else {
        result = await this.contentGen.evaluateCode(submission, problem, topic, priorPhases);
      }

      if (!result) {
        result = { score: 3, feedback: 'Submission received. Could not generate detailed feedback.', isAcceptable: true };
      }

      this.repo.savePracticePhaseScore(
        session.id,
        currentPhase,
        submission,
        result.score,
        result.feedback,
      );

      const evalMsg = MessageFormatter.phaseEvaluationResult(currentPhase, result.score, result.feedback);
      await this.messenger.sendText(user.phone_number, evalMsg);

      const nextPhase = NEXT_PHASE[currentPhase];
      if (nextPhase) {
        this.repo.updatePracticePhase(session.id, nextPhase, 0);
        const promptMsg = MessageFormatter.phasePrompt(nextPhase);
        await this.messenger.sendText(user.phone_number, promptMsg);
        return true;
      }

      const explanationScore = session.explanation_score ?? result.score;
      const pseudoScore = session.pseudo_score ?? result.score;
      const codeScore = result.score;
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

  private getPhaseText(
    session: PracticeSession,
    phase: 'explanation' | 'pseudo' | 'code',
  ): string | undefined {
    if (phase === 'explanation') return session.explanation_text ?? undefined;
    if (phase === 'pseudo') return session.pseudo_text ?? undefined;
    return session.code_text ?? undefined;
  }

  private buildPriorContext(
    session: PracticeSession,
    currentPhase: 'explanation' | 'pseudo' | 'code',
  ): PriorPhaseContext[] {
    const prior: PriorPhaseContext[] = [];

    if (
      currentPhase !== 'explanation' &&
      session.explanation_score !== undefined &&
      session.explanation_score !== null &&
      session.explanation_text
    ) {
      prior.push({
        phase: 'explanation',
        score: session.explanation_score,
        summary: session.explanation_text.slice(0, 150),
      });
    }

    if (
      currentPhase === 'code' &&
      session.pseudo_score !== undefined &&
      session.pseudo_score !== null &&
      session.pseudo_text
    ) {
      prior.push({
        phase: 'pseudocode',
        score: session.pseudo_score,
        summary: session.pseudo_text.slice(0, 150),
      });
    }

    return prior;
  }
}

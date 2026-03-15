import { User } from '@grindwise/domain/entities/user.entity';
import { PracticePhase } from '@grindwise/domain/entities/practice-session.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import {
  IContentGeneratorPort,
  PhaseEvaluationResult,
  PriorPhaseContext,
} from '@grindwise/domain/ports/content-generator.port';
import { PracticeSession } from '@grindwise/domain/entities/practice-session.entity';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SubmitPracticePhaseUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    private readonly contentGen: IContentGeneratorPort,
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

      const topic = this.repo.getTopicById(session.topic_id);
      const problem = this.repo.getProblemForTopic(session.topic_id);
      if (!topic || !problem) {
        await this.messenger.sendText(
          user.phone_number,
          'Could not find the topic or problem for your session. Try */topic* again.',
        );
        return;
      }

      const priorPhases = this.buildPriorContext(session, phase);

      await this.messenger.showTyping(user.phone_number);

      let result: PhaseEvaluationResult | null = null;
      if (phase === 'explanation') {
        result = await this.contentGen.evaluateExplanation(submission, problem, topic, priorPhases);
      } else if (phase === 'pseudo') {
        result = await this.contentGen.evaluatePseudoCode(submission, problem, topic, priorPhases);
      } else {
        result = await this.contentGen.evaluateCode(submission, problem, topic, priorPhases);
      }

      if (!result) {
        result = { score: 3, feedback: 'Submission received. Could not generate detailed feedback.', isAcceptable: true };
      }

      this.repo.savePracticePhaseScore(
        session.id,
        phase,
        submission,
        result.score,
        result.feedback,
      );

      const evalMsg = MessageFormatter.phaseEvaluationResult(phase, result.score, result.feedback);
      await this.messenger.sendText(user.phone_number, evalMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SubmitPracticePhase] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
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

import { User } from '../../domain/entities/user.entity';
import { TestQuestion } from '../../domain/entities/progress.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';
import { MessageFormatter } from '../../shared/message-formatter';

export class SubmitTestAnswerUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  /**
   * Handles an interactive test answer submission.
   * interactiveId format: test:{testId}:q:{questionId}:a:{answer}
   */
  async execute(user: User, interactiveId: string): Promise<void> {
    try {
      const parts = interactiveId.split(':');
      if (parts.length < 6) return;

      const testId = parts[1] ?? '';
      const questionId = parts[3] ?? '';
      const answer = parts.slice(5).join(':');

      const test = this.repo.getPendingTest(user.id);
      if (!test || test.id !== testId) return;

      const questions = JSON.parse(test.questions) as TestQuestion[];
      const answeredSoFar = JSON.parse(test.answers ?? '{}') as Record<string, string>;
      answeredSoFar[questionId] = answer;

      const nextQuestion = questions.find((q) => !answeredSoFar[q.id]);

      if (nextQuestion) {
        const questionNum = Object.keys(answeredSoFar).length + 1;
        const options = JSON.parse(nextQuestion.options ?? '[]') as string[];

        if (nextQuestion.type === 'mcq' && options.length > 0) {
          await this.messenger.sendList(
            user.phone_number,
            `Q${questionNum}/${questions.length}: ${nextQuestion.question}`,
            'Select Answer',
            options.map((opt, i) => ({
              id: `test:${testId}:q:${nextQuestion.id}:a:${opt}`,
              title: `${String.fromCharCode(65 + i)}) ${opt}`,
            })),
          );
        } else {
          await this.messenger.sendText(
            user.phone_number,
            `Q${questionNum}/${questions.length}: ${nextQuestion.question}`,
          );
        }
      } else {
        const score = this.repo.submitTestAnswer(testId, user.id, answeredSoFar);
        const percentage = (score / questions.length) * 100;

        const results = MessageFormatter.testResults(score, questions.length, percentage);
        await this.messenger.sendText(user.phone_number, results);

        const weakTopics = questions
          .filter(
            (q) => (answeredSoFar[q.id] ?? '').toLowerCase() !== q.correct_answer.toLowerCase(),
          )
          .map((q) => q.topic_id);

        for (const topicId of [...new Set(weakTopics)]) {
          this.repo.updateSpacedRepetition(user.id, topicId, 1);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SubmitTestAnswer] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

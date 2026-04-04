import { User } from '@grindwise/domain/entities/user.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SendWeeklyTestUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(user: User): Promise<void> {
    try {
      const questions = this.repo.getQuestionsForWeek(user.current_week);

      if (!questions.length) {
        await this.messenger.sendText(
          user.phone_number,
          '📝 *Weekly Test*\n\nTest questions for this week are being prepared. Check back soon!',
        );
        return;
      }

      const testId = this.repo.createWeeklyTest(
        user.id,
        user.current_week,
        questions,
      );

      await this.messenger.sendText(
        user.phone_number,
        `📝 *Week ${user.current_week} Assessment*\n\n` +
          `You'll answer ${questions.length} questions covering this week's topics.\n\n` +
          'For MCQ questions, reply with the *option number*.\n' +
          'For text questions, type your answer directly.\n\n' +
          "_Type SKIP to skip a question._\n\nReady? Here's Question 1:",
      );

      const q = questions[0];
      if (!q) return;

      if (q.type === 'mcq' || q.type === 'true_false') {
        const options =
          q.type === 'true_false'
            ? ['True', 'False']
            : (JSON.parse(q.options ?? '[]') as string[]);

        await this.messenger.sendPoll(
          user.phone_number,
          `Q1/${questions.length}: ${q.question}`,
          options,
          1,
          { testId, questionId: q.id },
        );
      } else {
        await this.messenger.sendText(
          user.phone_number,
          MessageFormatter.testQuestion(q, 1, questions.length),
        );
      }

      this.repo.logMessage(
        user.id,
        'outbound',
        'test',
        `Weekly test week ${user.current_week}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendWeeklyTest] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }
}

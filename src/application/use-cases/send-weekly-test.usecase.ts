import { User } from '../../domain/entities/user.entity';
import { IRepositoryPort } from '../../domain/ports/repository.port';
import { IMessenger } from '../../domain/ports/messaging.port';
import { MessageFormatter } from '../../shared/message-formatter';

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

      const testId = this.repo.createWeeklyTest(user.id, user.current_week, questions);

      await this.messenger.sendText(
        user.phone_number,
        `📝 *Week ${user.current_week} Assessment*\n\n` +
          `You'll answer ${questions.length} questions covering this week's topics.\n\n` +
          'Reply with A, B, C, or D for MCQs, True/False for T/F questions, ' +
          'or your answer for fill-in-the-blank.\n\n' +
          '_Type SKIP to skip a question._\n\nReady? Here\'s Question 1:',
      );

      const q = questions[0];
      if (!q) return;

      const options = JSON.parse(q.options ?? '[]') as string[];

      if (q.type === 'mcq' && options.length > 0) {
        await this.messenger.sendList(
          user.phone_number,
          `Q1/${questions.length}: ${q.question}`,
          'Select Answer',
          options.map((opt, i) => ({
            id: `test:${testId}:q:${q.id}:a:${opt}`,
            title: `${String.fromCharCode(65 + i)}) ${opt}`,
          })),
        );
      } else {
        await this.messenger.sendText(
          user.phone_number,
          MessageFormatter.testQuestion(q, 1, questions.length),
        );
      }

      this.repo.logMessage(user.id, 'outbound', 'test', `Weekly test week ${user.current_week}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SendWeeklyTest] execute failed', { error: message, phone: user.phone_number });
      throw err;
    }
  }
}

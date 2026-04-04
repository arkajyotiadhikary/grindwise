import { User } from '@grindwise/domain/entities/user.entity';
import { TestQuestion } from '@grindwise/domain/entities/progress.entity';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IMessenger } from '@grindwise/domain/ports/messaging.port';
import { MessageFormatter } from '@grindwise/shared/message-formatter';

export class SubmitTestAnswerUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
  ) {}

  async execute(
    user: User,
    testId: string,
    questionId: string,
    answer: string,
  ): Promise<void> {
    try {
      const test = this.repo.getPendingTest(user.id);
      if (!test || test.id !== testId) return;

      const questions = JSON.parse(test.questions) as TestQuestion[];
      const answeredSoFar = JSON.parse(test.answers ?? '{}') as Record<
        string,
        string
      >;
      answeredSoFar[questionId] = answer;

      const nextQuestion = questions.find((q) => !answeredSoFar[q.id]);

      if (nextQuestion) {
        this.repo.saveTestAnswers(testId, answeredSoFar);
        const questionNum = Object.keys(answeredSoFar).length + 1;

        if (
          nextQuestion.type === 'mcq' ||
          nextQuestion.type === 'true_false'
        ) {
          await this.sendNextQuestionAsPoll(
            user,
            testId,
            nextQuestion,
            questionNum,
            questions.length,
          );
        } else {
          await this.messenger.sendText(
            user.phone_number,
            MessageFormatter.testQuestion(
              nextQuestion,
              questionNum,
              questions.length,
            ),
          );
        }
      } else {
        const score = this.repo.submitTestAnswer(
          testId,
          user.id,
          answeredSoFar,
        );
        const percentage = (score / questions.length) * 100;

        const results = MessageFormatter.testResults(
          score,
          questions.length,
          percentage,
        );
        await this.messenger.sendText(user.phone_number, results);

        const weakTopics = questions
          .filter(
            (q) =>
              (answeredSoFar[q.id] ?? '').toLowerCase() !==
              q.correct_answer.toLowerCase(),
          )
          .map((q) => q.topic_id);

        for (const topicId of [...new Set(weakTopics)]) {
          this.repo.updateSpacedRepetition(user.id, topicId, 1);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SubmitTestAnswer] execute failed', {
        error: message,
        phone: user.phone_number,
      });
      throw err;
    }
  }

  private async sendNextQuestionAsPoll(
    user: User,
    testId: string,
    question: TestQuestion,
    questionNum: number,
    totalQuestions: number,
  ): Promise<void> {
    const options =
      question.type === 'true_false'
        ? ['True', 'False']
        : (JSON.parse(question.options ?? '[]') as string[]);

    await this.messenger.sendPoll(
      user.phone_number,
      `Q${questionNum}/${totalQuestions}: ${question.question}`,
      options,
      1,
      { testId, questionId: question.id },
    );
  }
}

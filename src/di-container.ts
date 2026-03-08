import Database from 'better-sqlite3';
import { IRepositoryPort } from './domain/ports/repository.port';
import { IMessenger } from './domain/ports/messaging.port';
import { IContentGeneratorPort } from './domain/ports/content-generator.port';
import { SqliteRepositoryAdapter } from './adapters/persistence/sqlite/sqlite-repository.adapter';
import { OllamaContentGeneratorAdapter } from './adapters/content-generator/ollama-content-generator.adapter';
import { OllamaClient } from './infrastructure/ollama-client';
import { CurriculumDomainService } from './domain/services/curriculum.domain-service';
import { RegisterUserUseCase } from './application/use-cases/register-user.usecase';
import { SendDailyTopicUseCase } from './application/use-cases/send-daily-topic.usecase';
import { SendDailyProblemUseCase } from './application/use-cases/send-daily-problem.usecase';
import { SendSolutionUseCase } from './application/use-cases/send-solution.usecase';
import { HandleDifficultyRatingUseCase } from './application/use-cases/handle-difficulty-rating.usecase';
import { HandleReviewRatingUseCase } from './application/use-cases/handle-review-rating.usecase';
import { SendDueReviewsUseCase } from './application/use-cases/send-due-reviews.usecase';
import { SendWeeklyTestUseCase } from './application/use-cases/send-weekly-test.usecase';
import { SubmitTestAnswerUseCase } from './application/use-cases/submit-test-answer.usecase';
import { SendProgressReportUseCase } from './application/use-cases/send-progress-report.usecase';
import { SendHelpUseCase } from './application/use-cases/send-help.usecase';
import { AskDsaQuestionUseCase } from './application/use-cases/ask-dsa-question.usecase';

/**
 * DIContainer wires all infrastructure adapters and application use cases.
 * Accepts a pre-constructed Database and IMessenger so main.ts remains the
 * single composition root. Business logic lives in use cases, not here.
 */
export class DIContainer {
  private readonly repo: IRepositoryPort;
  private readonly contentGen: IContentGeneratorPort;
  private readonly curriculum: CurriculumDomainService;
  private readonly _sendDailyProblem: SendDailyProblemUseCase;

  constructor(
    db: Database.Database,
    private readonly messenger: IMessenger,
  ) {
    this.repo = new SqliteRepositoryAdapter(db);
    this.contentGen = new OllamaContentGeneratorAdapter(new OllamaClient());
    this.curriculum = new CurriculumDomainService(this.repo);
    this._sendDailyProblem = new SendDailyProblemUseCase(
      this.repo,
      this.messenger,
      this.curriculum,
    );
  }

  getRegisterUserUseCase(): RegisterUserUseCase {
    return new RegisterUserUseCase(this.repo, this.messenger);
  }

  getSendDailyTopicUseCase(): SendDailyTopicUseCase {
    return new SendDailyTopicUseCase(
      this.repo,
      this.messenger,
      this.contentGen,
      this.curriculum,
      this._sendDailyProblem,
    );
  }

  getSendDailyProblemUseCase(): SendDailyProblemUseCase {
    return this._sendDailyProblem;
  }

  getSendSolutionUseCase(): SendSolutionUseCase {
    return new SendSolutionUseCase(
      this.repo,
      this.messenger,
      this.contentGen,
      this.curriculum,
    );
  }

  getHandleDifficultyRatingUseCase(): HandleDifficultyRatingUseCase {
    return new HandleDifficultyRatingUseCase(
      this.repo,
      this.messenger,
      this.curriculum,
    );
  }

  getHandleReviewRatingUseCase(): HandleReviewRatingUseCase {
    return new HandleReviewRatingUseCase(this.repo, this.messenger);
  }

  getSendDueReviewsUseCase(): SendDueReviewsUseCase {
    return new SendDueReviewsUseCase(
      this.repo,
      this.messenger,
      this.contentGen,
    );
  }

  getSendWeeklyTestUseCase(): SendWeeklyTestUseCase {
    return new SendWeeklyTestUseCase(this.repo, this.messenger);
  }

  getSubmitTestAnswerUseCase(): SubmitTestAnswerUseCase {
    return new SubmitTestAnswerUseCase(this.repo, this.messenger);
  }

  getSendProgressReportUseCase(): SendProgressReportUseCase {
    return new SendProgressReportUseCase(
      this.repo,
      this.messenger,
      this.curriculum,
    );
  }

  getSendHelpUseCase(): SendHelpUseCase {
    return new SendHelpUseCase(this.repo, this.messenger);
  }

  getAskDsaQuestionUseCase(): AskDsaQuestionUseCase {
    return new AskDsaQuestionUseCase(this.repo, this.messenger, this.contentGen);
  }

  getRepository(): IRepositoryPort {
    return this.repo;
  }

  getMessenger(): IMessenger {
    return this.messenger;
  }
}

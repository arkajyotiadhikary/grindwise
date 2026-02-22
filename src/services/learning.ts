import { Repository, User, Topic } from '../db/repository';
import { OpenClawService, MessageFormatter } from './openclaw';
import { CurriculumEngine } from '../core/curriculum-engine';
import { ContentGeneratorService } from './content-generator';
import { v4 as uuidv4 } from 'uuid';

export class LearningService {
  private repo: Repository;
  private openclaw: OpenClawService;
  private curriculum: CurriculumEngine;
  private contentGenerator: ContentGeneratorService;

  constructor() {
    this.repo = new Repository();
    this.openclaw = new OpenClawService();
    this.curriculum = new CurriculumEngine(this.repo);
    this.contentGenerator = new ContentGeneratorService();
  }

  /**
   * Register a new user and send welcome message
   */
  async registerUser(phoneNumber: string, name?: string): Promise<User> {
    let user = this.repo.getUserByPhone(phoneNumber);

    if (!user) {
      user = this.repo.createUser(phoneNumber, name);
      console.log(`✅ Registered new user: ${phoneNumber}`);
    }

    const welcomeMsg = MessageFormatter.welcome(user.name ?? 'there');
    await this.openclaw.sendText(phoneNumber, welcomeMsg);
    this.repo.logMessage(user.id, 'outbound', 'welcome', welcomeMsg);

    return user;
  }

  /**
   * Send today's DSA topic to a user.
   * Topic resolution is fully delegated to CurriculumEngine — no direct
   * week/day arithmetic happens here.
   */
  async sendDailyTopic(user: User): Promise<void> {
    const topic = this.curriculum.getCurrentTopic(user);

    if (!topic) {
      // CurriculumEngine returned null → roadmap is complete
      await this.openclaw.sendText(
        user.phone_number,
        '🎉 *Congratulations!* You\'ve completed the NeetCode DSA roadmap! ' +
          'You\'re ready to ace coding interviews. Keep practicing on LeetCode!',
      );
      return;
    }

    const theoryContent = await this.contentGenerator.generateTheory(topic);
    const topicMsg = theoryContent
      ? this.contentGenerator.formatTheoryMessage(topic, theoryContent, user.current_day, user.current_week)
      : MessageFormatter.dailyTopic(topic, user.current_day, user.current_week);
    const result = await this.openclaw.sendText(user.phone_number, topicMsg);

    if (result.success) {
      this.repo.getOrCreateProgress(user.id, topic.id);
      this.repo.markTopicSent(user.id, topic.id);
      this.repo.logMessage(user.id, 'outbound', 'daily_topic', topicMsg);
      console.log(`📤 Sent topic "${topic.name}" to ${user.phone_number}`);
    }

    // Send the practice problem after a short delay
    setTimeout(async () => {
      await this.sendDailyProblem(user, topic);
    }, 3000);
  }

  /**
   * Send today's practice problem.
   * Topic is resolved via CurriculumEngine when not provided directly.
   */
  async sendDailyProblem(user: User, topicOverride?: Topic): Promise<void> {
    const topic = topicOverride ?? this.curriculum.getCurrentTopic(user);
    if (!topic) return;

    const problem = this.repo.getProblemForTopic(topic.id);
    if (!problem) {
      await this.openclaw.sendText(
        user.phone_number,
        `📝 *Practice Problem*\n\nFor topic: *${topic.name}*\n\n` +
          `🔗 Search LeetCode for "${topic.name}" problems.\n\n` +
          'Start with Easy difficulty problems to build confidence!',
      );
      return;
    }

    const problemMsg = MessageFormatter.dailyProblem(problem, topic);
    await this.openclaw.sendText(user.phone_number, problemMsg);
    this.repo.logMessage(user.id, 'outbound', 'problem', problemMsg);
  }

  /**
   * Reveal solution to today's problem.
   */
  async sendSolution(user: User): Promise<void> {
    const topic = this.curriculum.getCurrentTopic(user);
    if (!topic) return;

    const problem = this.repo.getProblemForTopic(topic.id);
    if (!problem) {
      await this.openclaw.sendText(
        user.phone_number,
        '⚠️ No solution stored yet for today\'s topic. Check the LeetCode editorial!',
      );
      return;
    }

    const walkthrough = await this.contentGenerator.generateSolutionWalkthrough(problem, topic);
    const solutionMsg = walkthrough
      ? this.contentGenerator.formatSolutionMessage(problem, walkthrough)
      : MessageFormatter.solution(problem);
    await this.openclaw.sendText(user.phone_number, solutionMsg);
    this.repo.logMessage(user.id, 'outbound', 'solution', solutionMsg);
  }

  /**
   * Handle user's self-rating after solving a problem.
   * Advances curriculum position via CurriculumEngine; schedules spaced repetition.
   */
  async handleDifficultyRating(
    user: User,
    rating: 'EASY' | 'MEDIUM' | 'HARD',
  ): Promise<void> {
    const topic = this.curriculum.getCurrentTopic(user);
    if (!topic) return;

    // Map difficulty rating to SM-2 quality score (0-5)
    const qualityMap: Record<string, number> = { EASY: 5, MEDIUM: 3, HARD: 1 };
    const quality = qualityMap[rating];

    this.repo.markTopicUnderstood(user.id, topic.id, quality === 5 ? 5 : quality === 3 ? 3 : 2);
    this.repo.updateSpacedRepetition(user.id, topic.id, quality);

    // Delegate advancement to CurriculumEngine
    const result = this.curriculum.advanceUser(user);

    const feedbackMessages: Record<string, string> = {
      EASY: result.isComplete
        ? '🌟 Outstanding! You\'ve completed the entire roadmap!'
        : '🌟 Great job! Next topic scheduled for tomorrow.',
      MEDIUM: '💪 Good work! Keep practicing. Tomorrow brings a new challenge.',
      HARD: '📖 No worries! This topic has been marked for extra review. Keep going!',
    };

    await this.openclaw.sendText(user.phone_number, feedbackMessages[rating]);
  }

  /**
   * Send spaced repetition review for due topics.
   */
  async sendDueReviews(user: User): Promise<void> {
    const dueReviews = this.repo.getDueReviews(user.id);

    if (!dueReviews.length) {
      await this.openclaw.sendText(
        user.phone_number,
        '✅ *No reviews due today!*\n\nYou\'re all caught up. Great work staying consistent!',
      );
      return;
    }

    // Send first due review only (to avoid overwhelming the user)
    const reviewItem = dueReviews[0];
    const topic = this.repo.getTopicById(reviewItem.topic_id);
    if (!topic) return;

    const daysDiff = Math.round(
      (Date.now() - new Date(reviewItem.next_review_date).getTime()) /
        (1000 * 60 * 60 * 24) +
        reviewItem.interval_days,
    );

    const daysAgo = Math.max(daysDiff, reviewItem.interval_days);
    const revisionSummary = await this.contentGenerator.generateRevisionSummary(
      topic,
      reviewItem.repetition_count,
    );
    const reviewMsg = revisionSummary
      ? this.contentGenerator.formatRevisionMessage(topic, revisionSummary, daysAgo)
      : MessageFormatter.reviewReminder(topic, daysAgo);
    await this.openclaw.sendText(user.phone_number, reviewMsg);

    if (dueReviews.length > 1) {
      await this.openclaw.sendText(
        user.phone_number,
        `📋 You have *${dueReviews.length - 1}* more topic(s) due for review. ` +
          'After rating this one, reply *REVIEW* for the next.',
      );
    }

    this.repo.logMessage(user.id, 'outbound', 'reminder', reviewMsg);
  }

  /**
   * Handle recall quality after review (RECALL=5, FUZZY=3, BLANK=0).
   */
  async handleReviewRating(
    user: User,
    rating: 'RECALL' | 'FUZZY' | 'BLANK',
  ): Promise<void> {
    const dueReviews = this.repo.getDueReviews(user.id);
    if (!dueReviews.length) return;

    const qualityMap: Record<string, number> = { RECALL: 5, FUZZY: 3, BLANK: 0 };
    this.repo.updateSpacedRepetition(user.id, dueReviews[0].topic_id, qualityMap[rating]);

    const messages: Record<string, string> = {
      RECALL: '🟢 Perfect recall! This topic\'s next review has been pushed further out.',
      FUZZY: '🟡 Partial recall noted. We\'ll review this again soon.',
      BLANK: '🔴 No worries — this happens! It\'ll be reviewed again tomorrow.',
    };

    await this.openclaw.sendText(user.phone_number, messages[rating]);
  }

  /**
   * Generate and send weekly test (called on weekends).
   * Questions are scoped to the current week via CurriculumEngine.
   */
  async sendWeeklyTest(user: User): Promise<void> {
    const questions = this.repo.getQuestionsForWeek(user.current_week);

    if (!questions.length) {
      await this.openclaw.sendText(
        user.phone_number,
        '📝 *Weekly Test*\n\nTest questions for this week are being prepared. Check back soon!',
      );
      return;
    }

    const testId = this.repo.createWeeklyTest(user.id, user.current_week, questions);

    await this.openclaw.sendText(
      user.phone_number,
      `📝 *Week ${user.current_week} Assessment*\n\n` +
        `You'll answer ${questions.length} questions covering this week's topics.\n\n` +
        'Reply with A, B, C, or D for MCQs, True/False for T/F questions, ' +
        'or your answer for fill-in-the-blank.\n\n' +
        '_Type SKIP to skip a question._\n\nReady? Here\'s Question 1:',
    );

    const q = questions[0];
    const options = JSON.parse(q.options ?? '[]') as string[];

    if (q.type === 'mcq' && options.length > 0) {
      await this.openclaw.sendList(
        user.phone_number,
        `Q1/${questions.length}: ${q.question}`,
        'Select Answer',
        options.map((opt, i) => ({
          id: `test:${testId}:q:${q.id}:a:${opt}`,
          title: `${String.fromCharCode(65 + i)}) ${opt}`,
        })),
      );
    } else {
      await this.openclaw.sendText(
        user.phone_number,
        MessageFormatter.testQuestion(q, 1, questions.length),
      );
    }

    this.repo.logMessage(user.id, 'outbound', 'test', `Weekly test week ${user.current_week}`);
  }

  /**
   * Send progress report.
   * Uses CurriculumEngine.getProgress() for curriculum-aware stats.
   */
  async sendProgressReport(user: User): Promise<void> {
    const summary = this.repo.getUserProgressSummary(user.id);
    const curriculumProgress = this.curriculum.getProgress(user);

    const progressMsg = MessageFormatter.progressReport(user, {
      ...summary,
      completedTopics: curriculumProgress.completedTopics,
      totalTopics: curriculumProgress.totalTopics,
      percentageComplete: curriculumProgress.percentageComplete,
    });

    await this.openclaw.sendText(user.phone_number, progressMsg);
    this.repo.logMessage(user.id, 'outbound', 'progress', progressMsg);
  }

  /**
   * Send help message.
   */
  async sendHelp(user: User): Promise<void> {
    const helpMsg = MessageFormatter.help();
    await this.openclaw.sendText(user.phone_number, helpMsg);
    this.repo.logMessage(user.id, 'outbound', 'help', helpMsg);
  }

  close(): void {
    this.repo.close();
  }
}

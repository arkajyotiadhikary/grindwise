import { Topic } from '../domain/entities/topic.entity';
import { Problem } from '../domain/entities/problem.entity';
import { User } from '../domain/entities/user.entity';
import { TestQuestion } from '../domain/entities/progress.entity';

export class MessageFormatter {
  static dailyTopic(
    topic: Topic,
    dayNumber: number,
    weekNumber: number,
  ): string {
    const concepts = JSON.parse(topic.key_concepts ?? '[]') as string[];
    return [
      `📚 *Day ${dayNumber}, Week ${weekNumber}: ${topic.name}*`,
      `_${topic.category} • ${topic.difficulty}_`,
      '',
      topic.description,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      topic.content.slice(0, 1800),
      '',
      '🔑 *Key Concepts:*',
      concepts.map((c) => `  • ${c}`).join('\n'),
      '',
      `⏱ *Time:* ${topic.time_complexity}`,
      `💾 *Space:* ${topic.space_complexity}`,
      '',
      "_Reply *PROBLEM* to get today's practice problem, or *HELP* for commands._",
    ].join('\n');
  }

  static dailyProblem(problem: Problem, topic: Topic): string {
    const hints = JSON.parse(problem.hints ?? '[]') as string[];
    return [
      `🧩 *Today's Problem: ${problem.title}*`,
      `_Difficulty: ${problem.difficulty} | Topic: ${topic.name}_`,
      '',
      problem.description
        ? `*Problem:*\n${problem.description.slice(0, 600)}`
        : '*(Visit LeetCode for full problem statement)*',
      '',
      problem.url ? `🔗 ${problem.url}` : '',
      '',
      '💡 *Hints:*',
      hints.map((h, i) => `  ${i + 1}. ${h}`).join('\n'),
      '',
      '_Reply *SOLUTION* to reveal the answer, or try solving it first!_',
    ].join('\n');
  }

  static solution(problem: Problem): string {
    return [
      `✅ *Solution: ${problem.title}*`,
      '',
      '```typescript',
      problem.solution_code ?? '// Solution not available yet',
      '```',
      '',
      `📖 *Explanation:*`,
      problem.solution_explanation ?? 'See LeetCode for detailed explanation.',
      '',
      '_How did you do? Reply your rating: *EASY*, *MEDIUM*, or *HARD*_',
    ].join('\n');
  }

  static reviewReminder(topic: Topic, daysAgo: number): string {
    return [
      `🔄 *Time to Review: ${topic.name}*`,
      `_You learned this ${daysAgo} days ago. Let's reinforce it!_`,
      '',
      '📝 *Quick Recap:*',
      topic.description,
      '',
      `⏱ *Time:* ${topic.time_complexity}`,
      `💾 *Space:* ${topic.space_complexity}`,
      '',
      '🔑 *Key Concepts:*',
      (JSON.parse(topic.key_concepts ?? '[]') as string[])
        .map((c) => `  • ${c}`)
        .join('\n'),
      '',
      "_Reply *RECALL* (easy recall), *FUZZY* (partially recalled), or *BLANK* (couldn't recall)_",
    ].join('\n');
  }

  static testQuestion(
    question: TestQuestion,
    questionNum: number,
    total: number,
  ): string {
    return [
      `📝 *Weekly Test — Q${questionNum}/${total}*`,
      '',
      question.question,
    ].join('\n');
  }

  static testResults(score: number, total: number, percentage: number): string {
    const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '✅' : '📖';
    const message =
      percentage >= 80
        ? "Excellent work! You've mastered this week's material."
        : percentage >= 60
          ? 'Good effort! Review the topics you missed before moving on.'
          : "This week's content needs more practice. Don't give up!";

    return [
      `${emoji} *Weekly Test Complete!*`,
      '',
      `*Score: ${score}/${total} (${percentage.toFixed(0)}%)*`,
      '',
      message,
      '',
      `Your next review session will be scheduled automatically.`,
      '_Reply *PROGRESS* to see your overall stats._',
    ].join('\n');
  }

  static welcome(userName: string): string {
    return [
      `👋 *Welcome to DSA Learning Bot, ${userName}!*`,
      '',
      "🗺 You've been enrolled in the *NeetCode DSA Roadmap* — a structured path to master Data Structures & Algorithms.",
      '',
      '📅 *What to expect:*',
      '  • Daily topic + concept explanation',
      '  • Daily practice problem from LeetCode',
      '  • Weekend assessment test',
      '  • Spaced repetition reminders for revision',
      '',
      '🕘 *Messages arrive at 9:00 AM daily.*',
      '',
      '📌 *Commands:*',
      "  PROBLEM — Get today's practice problem",
      '  SOLUTION — Reveal the solution',
      '  PROGRESS — View your stats',
      '  REVIEW — Get a topic to review',
      '  HELP — Show all commands',
      '',
      "_Let's start your DSA journey! Your first topic arrives tomorrow morning. 🚀_",
    ].join('\n');
  }

  static progressReport(
    user: User,
    summary: {
      understood?: number;
      sent?: number;
      completedTopics?: number;
      totalTopics?: number;
      total?: number;
      percentageComplete?: number;
    },
  ): string {
    return [
      `📊 *Your Progress Report*`,
      '',
      `👤 ${user.name ?? 'Learner'}`,
      `📅 Week ${user.current_week}, Day ${user.current_day}`,
      `🔥 Streak: ${user.streak} days`,
      '',
      `✅ Topics Understood: ${summary.understood ?? 0}`,
      `📨 Topics Sent: ${summary.sent ?? 0}`,
      `📚 Roadmap Progress: ${summary.completedTopics ?? 0}/${summary.totalTopics ?? summary.total ?? 0} topics (${summary.percentageComplete ?? 0}%)`,
      '',
      `💪 Keep going! Consistency is the key to mastering DSA.`,
    ].join('\n');
  }

  static help(): string {
    return [
      `🤖 *DSA Learning Bot — Commands*`,
      '',
      '📖 *Content:*',
      "  /topic — Today's topic",
      "  /problem — Today's problem",
      '  /solution — Reveal solution',
      '',
      '📊 *Tracking:*',
      '  /progress — Your stats',
      '  /review — Spaced repetition topic',
      '',
      '🎯 *Self-Rating (after solving):*',
      '  /easy — Solved with ease (high recall)',
      '  /medium — Solved with some difficulty',
      '  /hard — Struggled significantly',
      '  /recall / /fuzzy / /blank — For review sessions',
      '',
      '📝 *Tests:*',
      "  /test — Start today's test (weekend only)",
      '',
      '_Questions? Our system tracks your progress automatically!_',
    ].join('\n');
  }
}

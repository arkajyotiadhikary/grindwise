import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'interactive';
  text?: string;
  interactive?: InteractiveMessage;
}

export interface InteractiveMessage {
  type: 'button' | 'list';
  body: string;
  buttons?: Array<{ id: string; title: string }>;
  sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
}

export class OpenClawService {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor() {
    this.phoneNumberId = process.env.OPENCLAW_PHONE_NUMBER_ID ?? '';
    this.client = axios.create({
      baseURL: process.env.OPENCLAW_BASE_URL ?? 'https://api.openclaw.io/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENCLAW_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Send a plain text WhatsApp message
   */
  async sendText(to: string, text: string): Promise<SendMessageResult> {
    try {
      const response = await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        to: this.formatPhone(to),
        type: 'text',
        text: { body: text, preview_url: false }
      });

      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id
      };
    } catch (error: any) {
      console.error('OpenClaw sendText error:', error.response?.data ?? error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send interactive button message (for quizzes, confirmations)
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string
  ): Promise<SendMessageResult> {
    try {
      const payload: any = {
        phone_number_id: this.phoneNumberId,
        to: this.formatPhone(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map(b => ({
              type: 'reply',
              reply: { id: b.id, title: b.title.slice(0, 20) } // WhatsApp 20 char limit
            }))
          }
        }
      };

      if (header) {
        payload.interactive.header = { type: 'text', text: header };
      }

      const response = await this.client.post('/messages', payload);
      return { success: true, messageId: response.data?.messages?.[0]?.id };
    } catch (error: any) {
      console.error('OpenClaw sendButtons error:', error.response?.data ?? error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send list-based interactive message (for MCQ test questions)
   */
  async sendList(
    to: string,
    body: string,
    buttonText: string,
    options: Array<{ id: string; title: string; description?: string }>
  ): Promise<SendMessageResult> {
    try {
      const response = await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        to: this.formatPhone(to),
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: {
            button: buttonText,
            sections: [{
              title: 'Options',
              rows: options.map(o => ({
                id: o.id,
                title: o.title.slice(0, 24), // WhatsApp limit
                description: o.description?.slice(0, 72) ?? undefined
              }))
            }]
          }
        }
      });
      return { success: true, messageId: response.data?.messages?.[0]?.id };
    } catch (error: any) {
      console.error('OpenClaw sendList error:', error.response?.data ?? error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark a message as read
   */
  async markRead(messageId: string): Promise<void> {
    try {
      await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        status: 'read',
        message_id: messageId
      });
    } catch { /* Non-critical */ }
  }

  private formatPhone(phone: string): string {
    // Ensure E.164 format: +CountryCode followed by number
    return phone.startsWith('+') ? phone : `+${phone}`;
  }
}

// ─── Message Formatter ────────────────────────────────────────────────────────
export class MessageFormatter {
  /**
   * Format daily topic lesson message
   */
  static dailyTopic(topic: any, dayNumber: number, weekNumber: number): string {
    const concepts = JSON.parse(topic.key_concepts ?? '[]') as string[];
    return [
      `📚 *Day ${dayNumber}, Week ${weekNumber}: ${topic.name}*`,
      `_${topic.category} • ${topic.difficulty}_`,
      '',
      topic.description,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      topic.content.slice(0, 1800), // WhatsApp 4096 char limit, keep content readable
      '',
      '🔑 *Key Concepts:*',
      concepts.map((c: string) => `  • ${c}`).join('\n'),
      '',
      `⏱ *Time:* ${topic.time_complexity}`,
      `💾 *Space:* ${topic.space_complexity}`,
      '',
      '_Reply *PROBLEM* to get today\'s practice problem, or *HELP* for commands._'
    ].join('\n');
  }

  /**
   * Format daily problem message
   */
  static dailyProblem(problem: any, topic: any): string {
    const hints = JSON.parse(problem.hints ?? '[]') as string[];
    return [
      `🧩 *Today's Problem: ${problem.title}*`,
      `_Difficulty: ${problem.difficulty} | Topic: ${topic.name}_`,
      '',
      problem.description ? `*Problem:*\n${problem.description.slice(0, 600)}` : '*(Visit LeetCode for full problem statement)*',
      '',
      problem.url ? `🔗 ${problem.url}` : '',
      '',
      '💡 *Hints:*',
      hints.map((h: string, i: number) => `  ${i + 1}. ${h}`).join('\n'),
      '',
      '_Reply *SOLUTION* to reveal the answer, or try solving it first!_'
    ].join('\n');
  }

  /**
   * Format solution reveal message
   */
  static solution(problem: any): string {
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
      '_How did you do? Reply your rating: *EASY*, *MEDIUM*, or *HARD*_'
    ].join('\n');
  }

  /**
   * Format spaced repetition reminder
   */
  static reviewReminder(topic: any, daysAgo: number): string {
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
      (JSON.parse(topic.key_concepts ?? '[]') as string[]).map((c: string) => `  • ${c}`).join('\n'),
      '',
      '_Reply *RECALL* (easy recall), *FUZZY* (partially recalled), or *BLANK* (couldn\'t recall)_'
    ].join('\n');
  }

  /**
   * Format weekly test question
   */
  static testQuestion(question: any, questionNum: number, total: number): string {
    return [
      `📝 *Weekly Test — Q${questionNum}/${total}*`,
      '',
      question.question,
    ].join('\n');
  }

  /**
   * Format weekly test results
   */
  static testResults(score: number, total: number, percentage: number): string {
    const emoji = percentage >= 80 ? '🏆' : percentage >= 60 ? '✅' : '📖';
    const message = percentage >= 80
      ? 'Excellent work! You\'ve mastered this week\'s material.'
      : percentage >= 60
      ? 'Good effort! Review the topics you missed before moving on.'
      : 'This week\'s content needs more practice. Don\'t give up!';

    return [
      `${emoji} *Weekly Test Complete!*`,
      '',
      `*Score: ${score}/${total} (${percentage.toFixed(0)}%)*`,
      '',
      message,
      '',
      `Your next review session will be scheduled automatically.`,
      '_Reply *PROGRESS* to see your overall stats._'
    ].join('\n');
  }

  /**
   * Format welcome message
   */
  static welcome(userName: string): string {
    return [
      `👋 *Welcome to DSA Learning Bot, ${userName}!*`,
      '',
      '🗺 You\'ve been enrolled in the *NeetCode DSA Roadmap* — a structured path to master Data Structures & Algorithms.',
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
      '  PROBLEM — Get today\'s practice problem',
      '  SOLUTION — Reveal the solution',
      '  PROGRESS — View your stats',
      '  REVIEW — Get a topic to review',
      '  HELP — Show all commands',
      '',
      '_Let\'s start your DSA journey! Your first topic arrives tomorrow morning. 🚀_'
    ].join('\n');
  }

  /**
   * Format progress report
   */
  static progressReport(user: any, summary: any): string {
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
      `💪 Keep going! Consistency is the key to mastering DSA.`
    ].join('\n');
  }

  /**
   * Format help message
   */
  static help(): string {
    return [
      `🤖 *DSA Learning Bot — Commands*`,
      '',
      '📖 *Content:*',
      '  TOPIC — Today\'s topic',
      '  PROBLEM — Today\'s problem',
      '  SOLUTION — Reveal solution',
      '',
      '📊 *Tracking:*',
      '  PROGRESS — Your stats',
      '  REVIEW — Spaced repetition topic',
      '',
      '🎯 *Self-Rating (after solving):*',
      '  EASY — Solved with ease (high recall)',
      '  MEDIUM — Solved with some difficulty',
      '  HARD — Struggled significantly',
      '  RECALL / FUZZY / BLANK — For review sessions',
      '',
      '📝 *Tests:*',
      '  TEST — Start today\'s test (weekend only)',
      '',
      '_Questions? Our system tracks your progress automatically!_'
    ].join('\n');
  }
}

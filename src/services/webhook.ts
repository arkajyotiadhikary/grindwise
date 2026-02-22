import express, { Request, Response } from 'express';
import { Repository } from '../db/repository';
import { LearningService } from './learning';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ─── OpenClaw Webhook Verification ───────────────────────────────────────────
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.OPENCLAW_VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Incoming Message Handler ─────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  // Always respond 200 immediately to avoid OpenClaw timeout
  res.sendStatus(200);

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Handle status updates (delivered, read)
    if (value?.statuses?.length) {
      handleStatusUpdate(value.statuses[0]);
      return;
    }

    // Handle actual messages
    const messages = value?.messages;
    if (!messages?.length) return;

    const message = messages[0];
    const from = message.from; // User's phone number
    const messageId = message.id;

    const repo = new Repository();
    const learning = new LearningService();

    try {
      // Auto-register user if not exists
      let user = repo.getUserByPhone(from);
      if (!user) {
        await learning.registerUser(from, value?.contacts?.[0]?.profile?.name);
        return;
      }

      // Log incoming message
      const text = extractMessageText(message);
      if (text) {
        repo.logMessage(user.id, 'inbound', message.type ?? 'text', text);
      }

      // Route command
      await routeUserCommand(user, message, text?.toUpperCase().trim() ?? '', learning, repo);
    } finally {
      repo.close();
      learning.close();
    }
  } catch (error: any) {
    console.error('Webhook error:', error.message);
  }
});

// ─── Command Router ───────────────────────────────────────────────────────────
async function routeUserCommand(
  user: any,
  message: any,
  command: string,
  learning: LearningService,
  repo: Repository
): Promise<void> {
  // Handle interactive button/list responses
  if (message.type === 'interactive') {
    const interactiveId = message.interactive?.button_reply?.id ??
                          message.interactive?.list_reply?.id ?? '';

    if (interactiveId.startsWith('test:')) {
      await handleTestAnswer(user, interactiveId, learning, repo);
      return;
    }
  }

  // Text commands
  switch (command) {
    case 'TOPIC':
      await learning.sendDailyTopic(user);
      break;

    case 'PROBLEM':
      await learning.sendDailyProblem(user);
      break;

    case 'SOLUTION':
      await learning.sendSolution(user);
      break;

    case 'EASY':
    case 'MEDIUM':
    case 'HARD':
      await learning.handleDifficultyRating(user, command as 'EASY' | 'MEDIUM' | 'HARD');
      break;

    case 'RECALL':
    case 'FUZZY':
    case 'BLANK':
      await learning.handleReviewRating(user, command as 'RECALL' | 'FUZZY' | 'BLANK');
      break;

    case 'REVIEW':
      await learning.sendDueReviews(user);
      break;

    case 'TEST':
      await learning.sendWeeklyTest(user);
      break;

    case 'PROGRESS':
      await learning.sendProgressReport(user);
      break;

    case 'HELP':
    case 'START':
    case 'HI':
    case 'HELLO':
      await learning.sendHelp(user);
      break;

    default:
      // For unrecognized messages, provide helpful response
      if (command.length > 0) {
        const { OpenClawService } = require('./openclaw');
        const openclaw = new OpenClawService();
        await openclaw.sendText(user.phone_number,
          `I didn't understand "*${command.slice(0, 50)}*".\n\nReply *HELP* for available commands.`
        );
      }
  }
}

async function handleTestAnswer(
  user: any,
  interactiveId: string,
  learning: LearningService,
  repo: Repository
): Promise<void> {
  // Format: test:{testId}:q:{questionId}:a:{answer}
  const parts = interactiveId.split(':');
  if (parts.length < 6) return;

  const testId = parts[1];
  const questionId = parts[3];
  const answer = parts.slice(5).join(':');

  // Store the answer and get next question or finish
  const test = repo.getPendingTest(user.id);
  if (!test || test.id !== testId) return;

  const questions = JSON.parse(test.questions);
  const answeredSoFar = JSON.parse(test.answers ?? '{}');
  answeredSoFar[questionId] = answer;

  // Find next unanswered question
  const nextQuestion = questions.find((q: any) => !answeredSoFar[q.id]);

  if (nextQuestion) {
    const questionNum = Object.keys(answeredSoFar).length + 1;
    const options = JSON.parse(nextQuestion.options ?? '[]') as string[];

    const { OpenClawService } = require('./openclaw');
    const openclaw = new OpenClawService();

    if (nextQuestion.type === 'mcq' && options.length > 0) {
      await openclaw.sendList(
        user.phone_number,
        `Q${questionNum}/${questions.length}: ${nextQuestion.question}`,
        'Select Answer',
        options.map((opt: string, i: number) => ({
          id: `test:${testId}:q:${nextQuestion.id}:a:${opt}`,
          title: `${String.fromCharCode(65 + i)}) ${opt}`
        }))
      );
    } else {
      await openclaw.sendText(user.phone_number,
        `Q${questionNum}/${questions.length}: ${nextQuestion.question}`
      );
    }
  } else {
    // All answered — calculate score
    const score = repo.submitTestAnswer(testId, user.id, answeredSoFar);
    const percentage = (score / questions.length) * 100;

    const { MessageFormatter, OpenClawService } = require('./openclaw');
    const openclaw = new OpenClawService();
    const results = MessageFormatter.testResults(score, questions.length, percentage);
    await openclaw.sendText(user.phone_number, results);

    // Schedule spaced repetition for weak areas
    const weakTopics = questions
      .filter((q: any) => answeredSoFar[q.id]?.toLowerCase() !== q.correct_answer.toLowerCase())
      .map((q: any) => q.topic_id);

    for (const topicId of [...new Set(weakTopics)] as string[]) {
      repo.updateSpacedRepetition(user.id, topicId, 1); // Low quality = review soon
    }
  }
}

function extractMessageText(message: any): string | undefined {
  if (message.type === 'text') return message.text?.body;
  if (message.type === 'interactive') {
    return message.interactive?.button_reply?.title ??
           message.interactive?.list_reply?.title;
  }
  return undefined;
}

function handleStatusUpdate(status: any): void {
  console.log(`📨 Message ${status.id} status: ${status.status}`);
}

export default router;

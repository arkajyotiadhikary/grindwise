import { DIContainer } from '../di-container';
import { User } from '../domain/entities/user.entity';
import { OnMessageCallback } from './socket';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baileys = require('@whiskeysockets/baileys');
type WASocket = ReturnType<typeof baileys.makeWASocket>;

type BaileysMessage = {
  messages: unknown[];
  type: string;
};

type RawMessage = {
  key?: { fromMe?: boolean; remoteJid?: string | null; id?: string };
  message?: unknown;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 1000;

function markProcessed(messageId: string): boolean {
  if (processedMessageIds.has(messageId)) return false;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const first = processedMessageIds.values().next().value as string;
    processedMessageIds.delete(first);
  }
  return true;
}

export function createMessageHandler(di: DIContainer): OnMessageCallback {
  return async (sock: WASocket, payload: BaileysMessage): Promise<void> => {
    if (payload.type !== 'notify') return;
    const raw = payload.messages[0] as RawMessage | undefined;
    await handleIncomingMessage(raw, sock, di);
  };
}

function stripDeviceSuffix(jid: string): string {
  return jid.replace(/:.*@/, '@');
}

function isSelfChat(remoteJid: string, sock: WASocket): boolean {
  // LID-based: compare remoteJid against bot's own LID
  if (remoteJid.endsWith('@lid')) {
    const botLid: string | undefined = sock.user?.lid;
    if (botLid) {
      return stripDeviceSuffix(remoteJid) === stripDeviceSuffix(botLid);
    }
    return false;
  }
  // PN-based: compare remoteJid against bot's own phone JID
  const botJid: string | undefined = sock.user?.id;
  if (botJid) {
    return stripDeviceSuffix(remoteJid) === stripDeviceSuffix(botJid);
  }
  return false;
}

function resolvePhone(
  remoteJid: string,
  msg: RawMessage,
  sock: WASocket,
): string {
  if (remoteJid.endsWith('@lid')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const senderPn: string | undefined = (msg as any)['senderPn'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participantPn: string | undefined = (msg as any)['participantPn'];
    if (senderPn) return senderPn;
    if (participantPn) return participantPn;

    const botJid: string | undefined = sock.user?.id;
    if (botJid) {
      return botJid.replace(/:.*@/, '@');
    }
  }
  return remoteJid;
}

async function handleIncomingMessage(
  msg: RawMessage | undefined,
  sock: WASocket,
  di: DIContainer,
): Promise<void> {
  if (!msg || !msg.message) return;
  
  const messageId = msg.key?.id;
  if (!messageId) return;

  if (di.getMessenger().isBotMessage(messageId)) return;
  if (!markProcessed(messageId)) return;

  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid || typeof remoteJid !== 'string') return;

  // Only process messages from self-chat (our own number)
  if (!msg.key?.fromMe) return;
  if (!isSelfChat(remoteJid, sock)) return;

  const phone = resolvePhone(remoteJid, msg, sock);

  try {
    const repo = di.getRepository();

    let user = repo.getUserByPhone(phone);
    if (!user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactName: string | undefined =
        (msg as any)['pushName'] ?? undefined;
      await di.getRegisterUserUseCase().execute(phone, contactName);
      return;
    }

    const text = extractMessageText(msg);
    if (text) {
      repo.logMessage(user.id, 'inbound', msg.type ?? 'text', text);
    }
    
    user = repo.getUserByPhone(phone) ?? user;
    const trimmedText = text?.trim() ?? '';
    const normalized = trimmedText.toUpperCase().replace(/^\//, '');

    const messenger = di.getMessenger();
    await messenger.showTyping(phone);
    try {
      const askMatch = /^\/?\s*ASK\s+/i.exec(trimmedText);
      if (askMatch) {
        const question = trimmedText.slice(askMatch[0].length).trim();
        if (question.length > 0) {
          await di.getAskDsaQuestionUseCase().execute(user, question);
          return;
        }
      }

      const explanationMatch = /^\/?\s*EXPLANATION\s+/i.exec(trimmedText);
      if (explanationMatch) {
        const content = trimmedText.slice(explanationMatch[0].length).trim();
        if (content.length > 0) {
          await di.getSubmitPracticePhaseUseCase().execute(user, 'explanation', content);
          return;
        }
      }

      const pseudoMatch = /^\/?\s*PSEUDO\s+/i.exec(trimmedText);
      if (pseudoMatch) {
        const content = trimmedText.slice(pseudoMatch[0].length).trim();
        if (content.length > 0) {
          await di.getSubmitPracticePhaseUseCase().execute(user, 'pseudo', content);
          return;
        }
      }

      const codeMatch = /^\/?\s*CODE\s+/i.exec(trimmedText);
      if (codeMatch) {
        const content = trimmedText.slice(codeMatch[0].length).trim();
        if (content.length > 0) {
          await di.getSubmitPracticePhaseUseCase().execute(user, 'code', content);
          return;
        }
      }

      // If user has an active test, intercept plain text as a test answer
      // before command routing. MCQ/true_false answers are parsed from
      // numbered replies since native WhatsApp polls don't work in self-chat.
      if (normalized.length > 0 && !normalized.startsWith('HELP') && !normalized.startsWith('TEST')) {
        const pendingTest = di.getRepository().getPendingTest(user.id);
        if (pendingTest) {
          const questions = JSON.parse(pendingTest.questions) as Array<{
            id: string;
            type: string;
            options?: string;
          }>;
          const answers = JSON.parse(pendingTest.answers ?? '{}') as Record<string, string>;
          const currentQuestion = questions.find((q) => !answers[q.id]);

          if (currentQuestion) {
            if (normalized === 'SKIP') {
              await di
                .getSubmitTestAnswerUseCase()
                .execute(user, pendingTest.id, currentQuestion.id, 'SKIP');
              return;
            }

            if (
              currentQuestion.type === 'mcq' ||
              currentQuestion.type === 'true_false'
            ) {
              const opts =
                currentQuestion.type === 'true_false'
                  ? ['True', 'False']
                  : (JSON.parse(currentQuestion.options ?? '[]') as string[]);

              const numChoice = parseInt(trimmedText, 10);
              let answer: string | undefined;
              if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= opts.length) {
                answer = opts[numChoice - 1];
              } else {
                answer = opts.find(
                  (o) => o.toLowerCase() === trimmedText.toLowerCase(),
                );
              }

              if (answer) {
                await di
                  .getSubmitTestAnswerUseCase()
                  .execute(user, pendingTest.id, currentQuestion.id, answer);
                return;
              }

              await messenger.sendText(
                phone,
                `Please reply with a number (1–${opts.length}) or the option text.`,
              );
              return;
            }

            // Text / fill-in-blank question
            await di
              .getSubmitTestAnswerUseCase()
              .execute(user, pendingTest.id, currentQuestion.id, trimmedText);
            return;
          }
        }
      }

      await routeUserCommand(user, normalized, di);
    } finally {
      await messenger.stopTyping(phone);
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[handlers] handleIncomingMessage error', {
      error: errMsg,
      phone,
    });
  }
}

async function routeUserCommand(
  user: User,
  command: string,
  di: DIContainer,
): Promise<void> {
  switch (command) {
    case 'TOPIC':
      await di.getSendDailyTopicUseCase().execute(user);
      break;
    case 'PROBLEM':
      await di.getSendDailyProblemUseCase().execute(user);
      break;
    case 'SOLUTION':
      await di.getSendSolutionUseCase().execute(user);
      break;
    case 'YES':
    case 'NO': {
      const handled = await di
        .getHandlePracticeConfirmationUseCase()
        .execute(user, command === 'YES');
      if (!handled) {
        await di
          .getMessenger()
          .sendText(
            user.phone_number,
            `I didn't understand "*${command}*" in this context.\n\nReply */help* for available commands.`,
          );
      }
      break;
    }
    case 'EASY':
    case 'MEDIUM':
    case 'HARD': {
      const activeSession = di.getRepository().getActivePracticeSession(user.id);
      if (activeSession) {
        await di
          .getMessenger()
          .sendText(
            user.phone_number,
            `You have an active practice session (phase: *${activeSession.phase}*). Complete it first before rating.\n\nReply */${activeSession.phase}* with your answer.`,
          );
        break;
      }
      await di
        .getHandleDifficultyRatingUseCase()
        .execute(user, command as 'EASY' | 'MEDIUM' | 'HARD');
      break;
    }
    case 'RECALL':
    case 'FUZZY':
    case 'BLANK':
      await di
        .getHandleReviewRatingUseCase()
        .execute(user, command as 'RECALL' | 'FUZZY' | 'BLANK');
      break;
    case 'REVIEW':
      await di.getSendDueReviewsUseCase().execute(user);
      break;
    case 'TEST':
      await di.getSendWeeklyTestUseCase().execute(user);
      break;
    case 'PROGRESS':
      await di.getSendProgressReportUseCase().execute(user);
      break;
    case 'HELP':
    case 'START':
    case 'HI':
    case 'HELLO':
      await di.getSendHelpUseCase().execute(user);
      break;
    default:
      if (command.length > 0) {
        await di
          .getMessenger()
          .sendText(
            user.phone_number,
            `I didn't understand "*${command.slice(0, 50)}*".\n\nReply */help* for available commands.`,
          );
      }
  }
}

export function createPollVoteHandler(
  di: DIContainer,
): (pollMessageId: string, voterJid: string, selectedOptions: string[]) => Promise<void> {
  return async (
    pollMessageId: string,
    _voterJid: string,
    selectedOptions: string[],
  ): Promise<void> => {
    try {
      const context = di.getMessenger().getPollContext(pollMessageId);
      if (!context) return;

      const testId = context['testId'];
      const questionId = context['questionId'];
      if (!testId || !questionId) return;

      const users = di.getRepository().getAllActiveUsers();
      const user = users[0];
      if (!user) return;

      const answer = selectedOptions[0];
      if (!answer) return;

      await di
        .getSubmitTestAnswerUseCase()
        .execute(user, testId, questionId, answer);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[handlers] poll vote handler error', { error: errMsg });
    }
  };
}

function extractMessageText(msg: RawMessage): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = msg.message as any;
  if (msg.type === 'text' || m?.conversation) {
    return m?.conversation ?? m?.extendedTextMessage?.text;
  }
  if (msg.type === 'interactive') {
    return (
      m?.buttonsResponseMessage?.selectedButtonId ??
      m?.listResponseMessage?.singleSelectReply?.selectedRowId
    );
  }
  if (m?.extendedTextMessage?.text) {
    return m.extendedTextMessage.text as string;
  }
  return undefined;
}

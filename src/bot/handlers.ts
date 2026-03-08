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

    await di.getMessenger().showTyping(phone);

    const askMatch = /^\/?\s*ASK\s+/i.exec(trimmedText);
    if (askMatch) {
      const question = trimmedText.slice(askMatch[0].length).trim();
      if (question.length > 0) {
        await di.getAskDsaQuestionUseCase().execute(user, question);
        return;
      }
    }

    await routeUserCommand(user, msg, normalized, di);
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
  msg: RawMessage,
  command: string,
  di: DIContainer,
): Promise<void> {
  if (msg.type === 'interactive') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interactiveId: string =
      (msg as any)['interactive']?.button_reply?.id ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (msg as any)['interactive']?.list_reply?.id ??
      '';
    if (interactiveId.startsWith('test:')) {
      await di.getSubmitTestAnswerUseCase().execute(user, interactiveId);
      return;
    }
  }

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
    case 'EASY':
    case 'MEDIUM':
    case 'HARD':
      await di
        .getHandleDifficultyRatingUseCase()
        .execute(user, command as 'EASY' | 'MEDIUM' | 'HARD');
      break;
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

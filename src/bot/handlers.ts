import { DIContainer } from '../di-container';
import { User } from '../domain/entities/user.entity';
import { OnMessageCallback } from './socket';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baileys = require('baileys');
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

export function createMessageHandler(di: DIContainer): OnMessageCallback {
  return async (_sock: WASocket, payload: BaileysMessage): Promise<void> => {
    if (payload.type !== 'notify') return;
    const raw = payload.messages[0] as RawMessage | undefined;
    await handleIncomingMessage(raw, di);
  };
}

async function handleIncomingMessage(
  msg: RawMessage | undefined,
  di: DIContainer,
): Promise<void> {
  if (!msg || !msg.message || msg.key?.fromMe) return;

  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid || typeof remoteJid !== 'string') return;

  const phone = remoteJid.endsWith('@s.whatsapp.net')
    ? remoteJid.replace('@s.whatsapp.net', '')
    : remoteJid;

  try {
    const repo = di.getRepository();

    let user = repo.getUserByPhone(phone);
    if (!user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contactName: string | undefined = (msg as any)['pushName'] ?? undefined;
      await di.getRegisterUserUseCase().execute(phone, contactName);
      return;
    }

    const text = extractMessageText(msg);
    if (text) {
      repo.logMessage(user.id, 'inbound', msg.type ?? 'text', text);
    }

    user = repo.getUserByPhone(phone) ?? user;
    await routeUserCommand(user, msg, text?.toUpperCase().trim() ?? '', di);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[handlers] handleIncomingMessage error', { error: errMsg, phone });
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
    const interactiveId: string = (msg as any)['interactive']?.button_reply?.id ??
                                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                   (msg as any)['interactive']?.list_reply?.id ?? '';
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
      await di.getHandleDifficultyRatingUseCase().execute(user, command as 'EASY' | 'MEDIUM' | 'HARD');
      break;
    case 'RECALL':
    case 'FUZZY':
    case 'BLANK':
      await di.getHandleReviewRatingUseCase().execute(user, command as 'RECALL' | 'FUZZY' | 'BLANK');
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
        await di.getMessenger().sendText(
          user.phone_number,
          `I didn't understand "*${command.slice(0, 50)}*".\n\nReply *HELP* for available commands.`,
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
    return m?.buttonsResponseMessage?.selectedButtonId ??
           m?.listResponseMessage?.singleSelectReply?.selectedRowId;
  }
  if (m?.extendedTextMessage?.text) {
    return m.extendedTextMessage.text as string;
  }
  return undefined;
}

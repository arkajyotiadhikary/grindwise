import {
  IMessenger,
  SendResult,
  ButtonOption,
  ListOption,
} from './messenger.interface';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baileys = require('@whiskeysockets/baileys');
type WASocket = ReturnType<typeof baileys.makeWASocket>;

const MAX_TEXT_LENGTH = 4096;
const RATE_LIMIT_MS = 1000;

function formatJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function buildNumberedMenu(
  body: string,
  options: Array<{ title: string }>,
): string {
  const items = options.map((o, i) => `${i + 1}. ${o.title}`).join('\n');
  return `${body}\n\n${items}`;
}

export class BaileysMessenger implements IMessenger {
  private readonly sock: WASocket;
  private lastSent = 0;
  private readonly sentMessageIds = new Set<string>();

  constructor(sock: WASocket) {
    this.sock = sock;
  }

  isBotMessage(messageId: string): boolean {
    return this.sentMessageIds.has(messageId);
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      await this.rateLimit();
      const jid = this.resolveJid(to);
      const safe = sanitizeText(text);
      const sent = await this.sock.sendMessage(jid, { text: safe });
      const messageId = sent?.key?.id as string | undefined;
      if (messageId) {
        this.sentMessageIds.add(messageId);
      }
      return { success: true, messageId };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[BaileysMessenger] sendText failed', { error: msg, to });
      return { success: false, error: msg };
    }
  }

  async sendButtons(
    to: string,
    body: string,
    buttons: ButtonOption[],
    header?: string,
  ): Promise<SendResult> {
    const headerPrefix = header ? `*${header}*\n\n` : '';
    const numbered = buildNumberedMenu(`${headerPrefix}${body}`, buttons);
    return this.sendText(to, numbered);
  }

  async sendList(
    to: string,
    body: string,
    _buttonText: string,
    options: ListOption[],
  ): Promise<SendResult> {
    const numbered = buildNumberedMenu(body, options);
    return this.sendText(to, numbered);
  }

  async markRead(_messageId: string): Promise<void> {}

  private resolveJid(to: string): string {
    if (
      to.endsWith('@s.whatsapp.net') ||
      to.endsWith('@g.us') ||
      to.endsWith('@lid')
    ) {
      return to;
    }
    return formatJid(to);
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastSent;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, RATE_LIMIT_MS - elapsed),
      );
    }
    this.lastSent = Date.now();
  }
}

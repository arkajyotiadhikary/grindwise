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

const TYPING_REFRESH_MS = 4000;
const MAX_POLL_CONTEXTS = 100;

export class BaileysMessenger implements IMessenger {
  private readonly sock: WASocket;
  private lastSent = 0;
  private sendingCount = 0;
  private readonly sentMessageIds = new Set<string>();
  private readonly typingTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly pollContextStore = new Map<string, Record<string, string>>();

  constructor(sock: WASocket) {
    this.sock = sock;
  }

  isBotMessage(messageId: string): boolean {
    // sendingCount > 0 means a send is in flight. Baileys defers the
    // messages.upsert handler as a microtask that runs AFTER sendMessage
    // resolves but BEFORE the setTimeout(0) macrotask that decrements
    // the counter. This reliably catches bot-sent messages in self-chat.
    return this.sendingCount > 0 || this.sentMessageIds.has(messageId);
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    this.sendingCount++;
    try {
      await this.rateLimit();
      const jid = this.resolveJid(to);
      this.stopTypingFor(jid);
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
    } finally {
      // Decrement in a macrotask so the counter stays positive through
      // the microtask queue where messages.upsert handlers run.
      setTimeout(() => { this.sendingCount--; }, 0);
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

  async sendPoll(
    to: string,
    question: string,
    options: string[],
    _selectableCount: number,
    context?: Record<string, string>,
  ): Promise<SendResult> {
    // WhatsApp does not render native polls in self-chat ("Message Yourself").
    // Send as numbered text instead; the handler resolves number replies to
    // the matching option.
    const numbered = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const text = `${question}\n\n${numbered}\n\n_Reply with the option number._`;
    const result = await this.sendText(to, text);

    if (result.messageId && context) {
      if (this.pollContextStore.size >= MAX_POLL_CONTEXTS) {
        const oldest = this.pollContextStore.keys().next().value as string;
        this.pollContextStore.delete(oldest);
      }
      this.pollContextStore.set(result.messageId, context);
    }
    return result;
  }

  getPollContext(messageId: string): Record<string, string> | undefined {
    return this.pollContextStore.get(messageId);
  }

  async markRead(_messageId: string): Promise<void> {}

  async showTyping(to: string): Promise<void> {
    const jid = this.resolveJid(to);
    this.stopTypingFor(jid);

    try {
      await this.sock.sendPresenceUpdate('composing', jid);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[BaileysMessenger] showTyping failed', { error: msg, to });
      return;
    }

    const timer = setInterval(() => {
      this.sock.sendPresenceUpdate('composing', jid).catch(() => {
        this.stopTypingFor(jid);
      });
    }, TYPING_REFRESH_MS);

    this.typingTimers.set(jid, timer);
  }

  async stopTyping(to: string): Promise<void> {
    const jid = this.resolveJid(to);
    this.stopTypingFor(jid);
  }

  private stopTypingFor(jid: string): void {
    const existing = this.typingTimers.get(jid);
    if (existing) {
      clearInterval(existing);
      this.typingTimers.delete(jid);
    }
    this.sock.sendPresenceUpdate('paused', jid).catch(() => {});
  }

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

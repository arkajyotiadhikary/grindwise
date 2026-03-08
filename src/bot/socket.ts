import { config } from '../config';

// Baileys is ESM-only; use require() with esModuleInterop in CJS build
// eslint-disable-next-line @typescript-eslint/no-require-imports
const baileys = require('baileys');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode-terminal');

type WASocket = ReturnType<typeof baileys.makeWASocket>;
type BaileysMessage = { messages: unknown[]; type: string };

export type OnMessageCallback = (sock: WASocket, payload: BaileysMessage) => Promise<void>;
export type OnReadyCallback = (sock: WASocket) => void;

const INITIAL_BACKOFF_MS = 3_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60_000;
const MAX_RETRIES = 10;

export async function startBot(
  onMessage: OnMessageCallback,
  onReady: OnReadyCallback,
): Promise<void> {
  await connectWithBackoff(onMessage, onReady, 0, INITIAL_BACKOFF_MS);
}

async function connectWithBackoff(
  onMessage: OnMessageCallback,
  onReady: OnReadyCallback,
  retryCount: number,
  backoffMs: number,
): Promise<void> {
  try {
    const { state, saveCreds } = await baileys.useMultiFileAuthState(config.authStatePath);

    const sock: WASocket = baileys.makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: { level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as unknown,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: { connection?: string; lastDisconnect?: { error?: { output?: { statusCode?: number } } }; qr?: string }) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Scan this QR code with WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connection established');
        onReady(sock);
      }

      if (connection === 'close') {
        const statusCode: number = lastDisconnect?.error?.output?.statusCode ?? 0;
        const isLoggedOut: boolean = statusCode === baileys.DisconnectReason.loggedOut;

        if (isLoggedOut) {
          console.error('[socket] Logged out — will not reconnect. Delete auth_state/ and restart.');
          return;
        }

        if (retryCount >= MAX_RETRIES) {
          console.error(`[socket] Max retries (${MAX_RETRIES}) reached. Giving up.`);
          return;
        }

        const nextBackoff = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
        console.log(`[socket] Disconnected (${statusCode}). Retrying in ${backoffMs / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);

        await delay(backoffMs);
        await connectWithBackoff(onMessage, onReady, retryCount + 1, nextBackoff);
      }
    });

    sock.ev.on('messages.upsert', async (payload: BaileysMessage) => {
      try {
        await onMessage(sock, payload);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[socket] onMessage callback failed', { error: msg });
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[socket] connectWithBackoff error', { error: msg, retryCount });

    if (retryCount >= MAX_RETRIES) {
      console.error('[socket] Max retries reached after connection error. Giving up.');
      return;
    }

    const nextBackoff = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
    await delay(backoffMs);
    await connectWithBackoff(onMessage, onReady, retryCount + 1, nextBackoff);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

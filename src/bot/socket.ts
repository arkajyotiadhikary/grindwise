import { config } from '../config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const baileys = require('@whiskeysockets/baileys');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode-terminal');

type WASocket = ReturnType<typeof baileys.makeWASocket>;
type BaileysMessage = { messages: unknown[]; type: string };

export type OnMessageCallback = (
  sock: WASocket,
  payload: BaileysMessage,
) => Promise<void>;
export type OnReadyCallback = (sock: WASocket) => void;

const INITIAL_BACKOFF_MS = 3_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60_000;
const MAX_RETRIES = 10;
let hasAttemptedAuthReset = false;

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
    const { state, saveCreds } = await baileys.useMultiFileAuthState(
      config.authStatePath,
    );

    // Fetch latest WA Web version to avoid 405 errors from outdated versions
    let waVersion: [number, number, number] | undefined;
    try {
      const { version } = await baileys.fetchLatestBaileysVersion();
      waVersion = version;
      console.log(`[socket] Using WA Web version: ${version.join('.')}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[socket] Failed to fetch latest WA version, using default. ${msg}`);
    }

    const silentLogger = {
      level: 'silent',
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => silentLogger,
    } as unknown;

    const msgStore = new Map<string, unknown>();

    const socketOptions: Record<string, unknown> = {
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger,
      getMessage: async (key: { remoteJid?: string; id?: string }) => {
        const msg = msgStore.get(key.id ?? '');
        return (msg as Record<string, unknown> | undefined)?.message ?? { conversation: '' };
      },
      patchMessageBeforeSending: async (
        msg: unknown,
        _recipientJids: unknown[],
      ) => {
        await sock.uploadPreKeysToServerIfRequired();
        return msg;
      },
    };
    if (waVersion) {
      socketOptions.version = waVersion;
    }

    const sock: WASocket = baileys.makeWASocket(socketOptions);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on(
      'connection.update',
      async (update: {
        connection?: string;
        lastDisconnect?: { error?: { output?: { statusCode?: number } } };
        qr?: string;
      }) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n📱 Scan this QR code with WhatsApp:\n');
          qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
          hasAttemptedAuthReset = false;
          console.log('✅ WhatsApp connection established');
          onReady(sock);
        }

        if (connection === 'close') {
          const statusCode: number =
            lastDisconnect?.error?.output?.statusCode ?? 0;
          const NON_RECOVERABLE_CODES: number[] = [
            baileys.DisconnectReason.loggedOut, // 401
            405,
          ];
          const isNonRecoverable: boolean =
            NON_RECOVERABLE_CODES.includes(statusCode);

          if (isNonRecoverable) {
            if (!hasAttemptedAuthReset) {
              hasAttemptedAuthReset = true;
              console.log(
                `[socket] Non-recoverable disconnect (${statusCode}). Clearing auth state for fresh QR...`,
              );
              const fs = await import('fs');
              const path = await import('path');
              const authDir = path.resolve(config.authStatePath);
              if (fs.existsSync(authDir)) {
                fs.rmSync(authDir, { recursive: true, force: true });
              }
              await connectWithBackoff(
                onMessage,
                onReady,
                0,
                INITIAL_BACKOFF_MS,
              );
            } else {
              console.error(
                `[socket] Disconnect (${statusCode}) persists after auth reset. Giving up.`,
              );
              console.error(
                '[socket] This may be a Baileys version issue. Try updating @whiskeysockets/baileys.',
              );
            }
            return;
          }

          if (retryCount >= MAX_RETRIES) {
            console.error(
              `[socket] Max retries (${MAX_RETRIES}) reached. Giving up.`,
            );
            return;
          }

          const nextBackoff = Math.min(
            backoffMs * BACKOFF_MULTIPLIER,
            MAX_BACKOFF_MS,
          );
          console.log(
            `[socket] Disconnected (${statusCode}). Retrying in ${backoffMs / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
          );

          await delay(backoffMs);
          await connectWithBackoff(
            onMessage,
            onReady,
            retryCount + 1,
            nextBackoff,
          );
        }
      },
    );

    sock.ev.on('messages.upsert', async (payload: BaileysMessage) => {
      try {
        for (const m of payload.messages as Array<{ key?: { id?: string }; message?: unknown }>) {
          if (m.key?.id && m.message) {
            msgStore.set(m.key.id, m);
          }
        }
        await onMessage(sock, payload);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[socket] onMessage callback failed', { error: msg });
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[socket] connectWithBackoff error', {
      error: msg,
      retryCount,
    });

    if (retryCount >= MAX_RETRIES) {
      console.error(
        '[socket] Max retries reached after connection error. Giving up.',
      );
      return;
    }

    const nextBackoff = Math.min(
      backoffMs * BACKOFF_MULTIPLIER,
      MAX_BACKOFF_MS,
    );
    await delay(backoffMs);
    await connectWithBackoff(onMessage, onReady, retryCount + 1, nextBackoff);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

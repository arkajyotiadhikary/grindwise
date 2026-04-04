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
export type OnPollVoteCallback = (
  pollMessageId: string,
  voterJid: string,
  selectedOptions: string[],
) => Promise<void>;

const INITIAL_BACKOFF_MS = 3_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 60_000;
const MAX_RETRIES = 10;
const BAD_MAC_THRESHOLD = 5;
const BAD_MAC_WINDOW_MS = 60_000;
let hasAttemptedAuthReset = false;
let badMacTimestamps: number[] = [];

export async function startBot(
  onMessage: OnMessageCallback,
  onReady: OnReadyCallback,
  onPollVote?: OnPollVoteCallback,
): Promise<void> {
  await connectWithBackoff(onMessage, onReady, onPollVote, 0, INITIAL_BACKOFF_MS);
}

async function connectWithBackoff(
  onMessage: OnMessageCallback,
  onReady: OnReadyCallback,
  onPollVote: OnPollVoteCallback | undefined,
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
        return (msg as Record<string, unknown> | undefined)?.message;
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
                onPollVote,
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
            onPollVote,
            retryCount + 1,
            nextBackoff,
          );
        }
      },
    );

    sock.ev.on('messages.upsert', async (payload: BaileysMessage) => {
      try {
        for (const m of payload.messages as Array<{
          key?: { id?: string; fromMe?: boolean };
          message?: unknown;
          messageStubType?: number;
        }>) {
          if (m.key?.id && m.message) {
            msgStore.set(m.key.id, m);
          }

          // Detect decryption failures (Bad MAC / corrupted session)
          // Messages that arrive without content and aren't from us indicate
          // the Signal session failed to decrypt
          if (!m.key?.fromMe && !m.message && m.messageStubType) {
            console.warn(
              `[socket] Possible decryption failure detected (stubType: ${m.messageStubType})`,
            );
            if (trackBadMacError() && !hasAttemptedAuthReset) {
              hasAttemptedAuthReset = true;
              console.error(
                `[socket] ${BAD_MAC_THRESHOLD} decryption failures in ${BAD_MAC_WINDOW_MS / 1000}s. Clearing auth state for fresh session...`,
              );
              badMacTimestamps = [];
              await clearAuthState();
              await connectWithBackoff(
                onMessage,
                onReady,
                onPollVote,
                0,
                INITIAL_BACKOFF_MS,
              );
              return;
            }
          }
        }
        await onMessage(sock, payload);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);

        // Catch Bad MAC errors that propagate as exceptions
        if (errMsg.includes('Bad MAC') || errMsg.includes('Bad mac')) {
          console.warn('[socket] Bad MAC error caught in message handler');
          if (trackBadMacError() && !hasAttemptedAuthReset) {
            hasAttemptedAuthReset = true;
            console.error(
              `[socket] ${BAD_MAC_THRESHOLD} Bad MAC errors in ${BAD_MAC_WINDOW_MS / 1000}s. Clearing auth state for fresh session...`,
            );
            badMacTimestamps = [];
            await clearAuthState();
            await connectWithBackoff(
              onMessage,
              onReady,
              onPollVote,
              0,
              INITIAL_BACKOFF_MS,
            );
            return;
          }
        }

        console.error('[socket] onMessage callback failed', { error: errMsg });
      }
    });

    if (onPollVote) {
      sock.ev.on(
        'messages.update',
        async (
          updates: Array<{
            key: { id?: string; remoteJid?: string };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            update: any;
          }>,
        ) => {
          try {
            for (const { key, update } of updates) {
              if (!update.pollUpdates || update.pollUpdates.length === 0) {
                continue;
              }

              const pollMsgId = key.id ?? '';
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const stored = msgStore.get(pollMsgId) as any;
              if (!stored?.message) continue;

              const { getAggregateVotesInPollMessage, updateMessageWithPollUpdate } =
                baileys;

              for (const pollUpdate of update.pollUpdates) {
                updateMessageWithPollUpdate(stored, pollUpdate);
              }

              const votes = getAggregateVotesInPollMessage({
                message: stored.message,
                pollUpdates: stored.pollUpdates ?? update.pollUpdates,
              }) as Array<{ name: string; voters: string[] }>;

              const selected = votes.filter(
                (v: { voters: string[] }) => v.voters.length > 0,
              );
              if (selected.length === 0) continue;

              const voterJid =
                selected[0]?.voters[0] ?? key.remoteJid ?? '';
              const selectedOptions = selected.map(
                (v: { name: string }) => v.name,
              );

              await onPollVote(pollMsgId, voterJid, selectedOptions);
            }
          } catch (error: unknown) {
            const errMsg =
              error instanceof Error ? error.message : String(error);
            console.error('[socket] messages.update poll handler failed', {
              error: errMsg,
            });
          }
        },
      );
    }
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
    await connectWithBackoff(onMessage, onReady, onPollVote, retryCount + 1, nextBackoff);
  }
}

function trackBadMacError(): boolean {
  const now = Date.now();
  badMacTimestamps.push(now);
  badMacTimestamps = badMacTimestamps.filter(
    (ts) => now - ts <= BAD_MAC_WINDOW_MS,
  );
  return badMacTimestamps.length >= BAD_MAC_THRESHOLD;
}

async function clearAuthState(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const authDir = path.resolve(config.authStatePath);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('[socket] Auth state cleared.');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

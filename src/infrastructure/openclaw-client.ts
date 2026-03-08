import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import {
  SendResult,
  ButtonOption,
  ListOption,
} from '../domain/ports/messaging.port';

export class OpenClawClient {
  private readonly client: AxiosInstance;
  private readonly phoneNumberId: string;

  constructor() {
    this.phoneNumberId = config.openclawPhoneNumberId;
    this.client = axios.create({
      baseURL: config.openclawBaseUrl,
      headers: {
        Authorization: `Bearer ${config.openclawApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      const response = await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        to: this.formatPhone(to),
        type: 'text',
        text: { body: text, preview_url: false },
      });

      const data = response.data as Record<string, unknown>;
      const messages = data['messages'] as
        | Array<Record<string, unknown>>
        | undefined;
      return { success: true, messageId: String(messages?.[0]?.['id'] ?? '') };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[OpenClawClient] sendText error', { error: msg, to });
      return { success: false, error: msg };
    }
  }

  async sendButtons(
    to: string,
    body: string,
    buttons: ButtonOption[],
    header?: string,
  ): Promise<SendResult> {
    try {
      const interactive: Record<string, unknown> = {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      };

      if (header) {
        interactive['header'] = { type: 'text', text: header };
      }

      const response = await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        to: this.formatPhone(to),
        type: 'interactive',
        interactive,
      });

      const data = response.data as Record<string, unknown>;
      const messages = data['messages'] as
        | Array<Record<string, unknown>>
        | undefined;
      return { success: true, messageId: String(messages?.[0]?.['id'] ?? '') };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[OpenClawClient] sendButtons error', { error: msg, to });
      return { success: false, error: msg };
    }
  }

  async sendList(
    to: string,
    body: string,
    buttonText: string,
    options: ListOption[],
  ): Promise<SendResult> {
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
            sections: [
              {
                title: 'Options',
                rows: options.map((o) => ({
                  id: o.id,
                  title: o.title.slice(0, 24),
                  description: o.description?.slice(0, 72) ?? undefined,
                })),
              },
            ],
          },
        },
      });

      const data = response.data as Record<string, unknown>;
      const messages = data['messages'] as
        | Array<Record<string, unknown>>
        | undefined;
      return { success: true, messageId: String(messages?.[0]?.['id'] ?? '') };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[OpenClawClient] sendList error', { error: msg, to });
      return { success: false, error: msg };
    }
  }

  async markRead(messageId: string): Promise<void> {
    try {
      await this.client.post('/messages', {
        phone_number_id: this.phoneNumberId,
        status: 'read',
        message_id: messageId,
      });
    } catch {
      // Non-critical — mark-read failure should not surface to callers
    }
  }

  private formatPhone(phone: string): string {
    return phone.startsWith('+') ? phone : `+${phone}`;
  }
}

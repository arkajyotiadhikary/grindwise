import {
  IMessenger,
  SendResult,
  ButtonOption,
  ListOption,
} from './messenger.interface';
import { OpenClawClient } from '../infrastructure/openclaw-client';

export class OpenClawMessenger implements IMessenger {
  private readonly svc: OpenClawClient;

  constructor() {
    this.svc = new OpenClawClient();
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    return this.svc.sendText(to, text);
  }

  async sendButtons(
    to: string,
    body: string,
    buttons: ButtonOption[],
    header?: string,
  ): Promise<SendResult> {
    return this.svc.sendButtons(to, body, buttons, header);
  }

  async sendList(
    to: string,
    body: string,
    buttonText: string,
    options: ListOption[],
  ): Promise<SendResult> {
    return this.svc.sendList(to, body, buttonText, options);
  }

  async markRead(messageId: string): Promise<void> {
    return this.svc.markRead(messageId);
  }

  async showTyping(_to: string): Promise<void> {}

  isBotMessage(_messageId: string): boolean {
    return false;
  }
}

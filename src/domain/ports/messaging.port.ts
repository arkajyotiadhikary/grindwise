export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ButtonOption {
  id: string;
  title: string;
}

export interface ListOption {
  id: string;
  title: string;
  description?: string;
}

export interface PollVoteResult {
  pollMessageId: string;
  voterJid: string;
  selectedOptions: string[];
}

export interface IMessenger {
  sendText(to: string, text: string): Promise<SendResult>;
  sendButtons(
    to: string,
    body: string,
    buttons: ButtonOption[],
    header?: string,
  ): Promise<SendResult>;
  sendList(
    to: string,
    body: string,
    buttonText: string,
    options: ListOption[],
  ): Promise<SendResult>;
  sendPoll(
    to: string,
    question: string,
    options: string[],
    selectableCount: number,
    context?: Record<string, string>,
  ): Promise<SendResult>;
  getPollContext(messageId: string): Record<string, string> | undefined;
  markRead(messageId: string): Promise<void>;
  showTyping(to: string): Promise<void>;
  stopTyping(to: string): Promise<void>;
  isBotMessage(messageId: string): boolean;
}

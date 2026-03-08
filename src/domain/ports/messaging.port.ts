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
  markRead(messageId: string): Promise<void>;
}

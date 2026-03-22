import { SendHelpUseCase } from '@grindwise/application/use-cases/send-help.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('SendHelpUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new SendHelpUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('sends help message with all commands', async () => {
    await useCase.execute(createMockUser());

    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('/topic');
    expect(sentMsg).toContain('/problem');
    expect(sentMsg).toContain('/solution');
    expect(sentMsg).toContain('/progress');
    expect(sentMsg).toContain('/review');
    expect(sentMsg).toContain('/test');
    expect(sentMsg).toContain('/ask');
  });

  it('logs the help message', async () => {
    await useCase.execute(createMockUser());
    expect(repo.logMessage).toHaveBeenCalledWith(
      'user-1', 'outbound', 'help', expect.any(String),
    );
  });
});

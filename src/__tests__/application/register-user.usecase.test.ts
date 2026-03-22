import { RegisterUserUseCase } from '@grindwise/application/use-cases/register-user.usecase';
import { createMockRepo, createMockMessenger, createMockUser } from '../mocks';

describe('RegisterUserUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new RegisterUserUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('creates a new user when not found', async () => {
    const newUser = createMockUser();
    repo.getUserByPhone.mockReturnValue(undefined);
    repo.createUser.mockReturnValue(newUser);

    const result = await useCase.execute('919999999999', 'Test User');

    expect(repo.createUser).toHaveBeenCalledWith('919999999999', 'Test User');
    expect(result).toBe(newUser);
  });

  it('returns existing user without creating a new one', async () => {
    const existingUser = createMockUser();
    repo.getUserByPhone.mockReturnValue(existingUser);

    const result = await useCase.execute('919999999999');

    expect(repo.createUser).not.toHaveBeenCalled();
    expect(result).toBe(existingUser);
  });

  it('sends welcome message', async () => {
    const user = createMockUser();
    repo.getUserByPhone.mockReturnValue(user);

    await useCase.execute('919999999999');

    expect(messenger.sendText).toHaveBeenCalledTimes(1);
    const sentMsg = messenger.sendText.mock.calls[0]![1];
    expect(sentMsg).toContain('Welcome');
    expect(sentMsg).toContain('Test User');
  });

  it('logs the welcome message', async () => {
    const user = createMockUser();
    repo.getUserByPhone.mockReturnValue(user);

    await useCase.execute('919999999999');

    expect(repo.logMessage).toHaveBeenCalledWith(
      user.id,
      'outbound',
      'welcome',
      expect.stringContaining('Welcome'),
    );
  });

  it('throws and logs on error', async () => {
    repo.getUserByPhone.mockImplementation(() => {
      throw new Error('DB down');
    });

    await expect(useCase.execute('919999999999')).rejects.toThrow('DB down');
  });
});

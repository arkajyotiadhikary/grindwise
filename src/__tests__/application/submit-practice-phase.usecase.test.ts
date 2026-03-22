import { SubmitPracticePhaseUseCase } from '@grindwise/application/use-cases/submit-practice-phase.usecase';
import {
  createMockRepo,
  createMockMessenger,
  createMockUser,
  createMockPracticeSession,
} from '../mocks';

describe('SubmitPracticePhaseUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const useCase = new SubmitPracticePhaseUseCase(repo, messenger);

  beforeEach(() => jest.clearAllMocks());

  it('sends error when no active session', async () => {
    repo.getActivePracticeSession.mockReturnValue(undefined);

    await useCase.execute(createMockUser(), 'explanation', 'my approach');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('No active practice session'),
    );
  });

  it('sends error when phase mismatch', async () => {
    repo.getActivePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'explanation' }),
    );

    await useCase.execute(createMockUser(), 'code', 'function solve() {}');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('explanation'),
    );
  });

  it('saves submission and sends confirmation', async () => {
    repo.getActivePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'explanation' }),
    );

    await useCase.execute(createMockUser(), 'explanation', 'Use two pointers');

    expect(repo.savePracticePhaseSubmission).toHaveBeenCalledWith(
      'session-1', 'explanation', 'Use two pointers',
    );
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('YES'),
    );
  });

  it('works for pseudo phase', async () => {
    repo.getActivePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'pseudo' }),
    );

    await useCase.execute(createMockUser(), 'pseudo', 'for each elem...');

    expect(repo.savePracticePhaseSubmission).toHaveBeenCalledWith(
      'session-1', 'pseudo', 'for each elem...',
    );
  });

  it('works for code phase', async () => {
    repo.getActivePracticeSession.mockReturnValue(
      createMockPracticeSession({ phase: 'code' }),
    );

    await useCase.execute(createMockUser(), 'code', 'function twoSum() {}');

    expect(repo.savePracticePhaseSubmission).toHaveBeenCalledWith(
      'session-1', 'code', 'function twoSum() {}',
    );
  });
});

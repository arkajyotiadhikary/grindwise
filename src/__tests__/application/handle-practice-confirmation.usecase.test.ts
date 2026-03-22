import { HandlePracticeConfirmationUseCase } from '@grindwise/application/use-cases/handle-practice-confirmation.usecase';
import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import {
  createMockRepo,
  createMockMessenger,
  createMockContentGen,
  createMockUser,
  createMockTopic,
  createMockProblem,
  createMockPracticeSession,
} from '../mocks';

describe('HandlePracticeConfirmationUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const contentGen = createMockContentGen();
  const curriculum = new CurriculumDomainService(repo);
  const useCase = new HandlePracticeConfirmationUseCase(repo, messenger, contentGen, curriculum);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getTopicById.mockReturnValue(createMockTopic());
    repo.getProblemForTopic.mockReturnValue(createMockProblem());
    repo.getDaysInWeek.mockReturnValue(3);
    repo.getTotalWeeks.mockReturnValue(10);
    repo.getTopicByDayWeek.mockReturnValue(createMockTopic({ order_index: 2 }));
  });

  it('returns false when no active session', async () => {
    repo.getActivePracticeSession.mockReturnValue(undefined);
    const result = await useCase.execute(createMockUser(), true);
    expect(result).toBe(false);
  });

  it('returns false when not awaiting confirmation', async () => {
    repo.getActivePracticeSession.mockReturnValue(
      createMockPracticeSession({ awaiting_confirmation: 0 }),
    );
    const result = await useCase.execute(createMockUser(), true);
    expect(result).toBe(false);
  });

  describe('NO (retry)', () => {
    it('resets phase and sends retry prompt', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({ phase: 'explanation', awaiting_confirmation: 1 }),
      );

      const result = await useCase.execute(createMockUser(), false);

      expect(result).toBe(true);
      expect(repo.updatePracticePhase).toHaveBeenCalledWith('session-1', 'explanation', 0);
      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('/explanation'),
      );
    });
  });

  describe('YES — explanation phase', () => {
    it('evaluates and advances to pseudo phase', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'explanation',
          awaiting_confirmation: 1,
          explanation_text: 'Use hash map for O(n) lookup',
        }),
      );
      contentGen.evaluateExplanation.mockResolvedValue({
        score: 4, feedback: 'Good approach', isAcceptable: true,
      });

      const result = await useCase.execute(createMockUser(), true);

      expect(result).toBe(true);
      expect(repo.savePracticePhaseScore).toHaveBeenCalledWith(
        'session-1', 'explanation', 'Use hash map for O(n) lookup', 4, 'Good approach',
      );
      expect(repo.updatePracticePhase).toHaveBeenCalledWith('session-1', 'pseudo', 0);
      // Should send eval result + next phase prompt
      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('EXPLANATION Evaluation'),
      );
      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('pseudocode'),
      );
    });
  });

  describe('YES — pseudo phase', () => {
    it('evaluates and advances to code phase', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'pseudo',
          awaiting_confirmation: 1,
          explanation_text: 'approach',
          explanation_score: 4,
          pseudo_text: 'for each element, check map',
        }),
      );
      contentGen.evaluatePseudoCode.mockResolvedValue({
        score: 3, feedback: 'Decent', isAcceptable: true,
      });

      await useCase.execute(createMockUser(), true);

      expect(contentGen.evaluatePseudoCode).toHaveBeenCalled();
      expect(repo.updatePracticePhase).toHaveBeenCalledWith('session-1', 'code', 0);
    });
  });

  describe('YES — code phase (final)', () => {
    it('evaluates, computes combined score, completes session', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'code',
          awaiting_confirmation: 1,
          explanation_text: 'approach',
          explanation_score: 4,
          pseudo_text: 'pseudocode',
          pseudo_score: 3,
          code_text: 'function twoSum() { ... }',
        }),
      );
      contentGen.evaluateCode.mockResolvedValue({
        score: 5, feedback: 'Perfect code', isAcceptable: true,
      });

      await useCase.execute(createMockUser(), true);

      // Combined: 4*0.25 + 3*0.35 + 5*0.40 = 1 + 1.05 + 2 = 4.05 → 4
      expect(repo.completePracticeSession).toHaveBeenCalledWith('session-1', 4);
      expect(repo.markTopicUnderstood).toHaveBeenCalledWith('user-1', 'topic-1', 4);
      expect(repo.updateSpacedRepetition).toHaveBeenCalledWith('user-1', 'topic-1', 4);
      expect(repo.updateUserProgress).toHaveBeenCalled(); // advance user
    });

    it('sends practice complete summary with correct scores', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'code',
          awaiting_confirmation: 1,
          explanation_score: 4,
          pseudo_score: 3,
          code_text: 'code here',
        }),
      );
      contentGen.evaluateCode.mockResolvedValue({
        score: 5, feedback: 'Great', isAcceptable: true,
      });

      await useCase.execute(createMockUser(), true);

      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Practice Session Complete'),
      );
    });

    it('sends "Great job" for quality >= 4', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'code',
          awaiting_confirmation: 1,
          explanation_score: 5,
          pseudo_score: 5,
          code_text: 'code',
        }),
      );
      contentGen.evaluateCode.mockResolvedValue({
        score: 5, feedback: 'Perfect', isAcceptable: true,
      });

      await useCase.execute(createMockUser(), true);

      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Great job'),
      );
    });

    it('sends "Keep practicing" for quality < 4', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'code',
          awaiting_confirmation: 1,
          explanation_score: 1,
          pseudo_score: 1,
          code_text: 'code',
        }),
      );
      contentGen.evaluateCode.mockResolvedValue({
        score: 1, feedback: 'Needs work', isAcceptable: true,
      });

      await useCase.execute(createMockUser(), true);

      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Keep practicing'),
      );
    });
  });

  describe('edge cases', () => {
    it('handles null AI evaluation with default score', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'explanation',
          awaiting_confirmation: 1,
          explanation_text: 'approach',
        }),
      );
      contentGen.evaluateExplanation.mockResolvedValue(null);

      await useCase.execute(createMockUser(), true);

      expect(repo.savePracticePhaseScore).toHaveBeenCalledWith(
        'session-1', 'explanation', 'approach', 3,
        'Submission received. Could not generate detailed feedback.',
      );
    });

    it('handles missing submission text', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'explanation',
          awaiting_confirmation: 1,
          // no explanation_text
        }),
      );

      await useCase.execute(createMockUser(), true);

      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('resubmit'),
      );
    });

    it('handles missing topic/problem', async () => {
      repo.getActivePracticeSession.mockReturnValue(
        createMockPracticeSession({
          phase: 'explanation',
          awaiting_confirmation: 1,
          explanation_text: 'text',
        }),
      );
      repo.getTopicById.mockReturnValue(undefined);

      await useCase.execute(createMockUser(), true);

      expect(messenger.sendText).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Could not find the topic'),
      );
    });
  });
});
